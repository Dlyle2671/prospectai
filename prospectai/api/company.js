export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ error: "domain is required" });

    const apiKey = process.env.APOLLO_API_KEY;
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim().toLowerCase();

    // --- 1. Enrich Organization ---
    const orgResp = await fetch("https://api.apollo.io/api/v1/organizations/enrich?domain=" + encodeURIComponent(cleanDomain), {
      method: "GET",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    });
    const orgData = await orgResp.json();
    const org = orgData.organization || {};

    if (!org.name && !org.id) {
      return res.status(404).json({ error: "Company not found for domain: " + cleanDomain });
    }

    const orgId = org.id || null;
    const orgNameLower = (org.name || "").toLowerCase().trim();

    const domainVariants = new Set([cleanDomain]);
    if (cleanDomain.startsWith("www.")) domainVariants.add(cleanDomain.slice(4));

    function nameMatches(n) {
      if (!n) return false;
      const nl = n.toLowerCase().trim();
      if (nl === orgNameLower) return true;
      if (orgNameLower.length >= 6 && nl.includes(orgNameLower)) return true;
      if (nl.length >= 6 && orgNameLower.includes(nl)) return true;
      return false;
    }

    function domainMatches(d) {
      if (!d) return false;
      const dl = d.toLowerCase().replace(/^www\./, "");
      return domainVariants.has(dl) || dl === cleanDomain;
    }

    // --- 2. Parallel: people search x2 + job postings + news ---
    const [res1, res2, jobsResp, newsResp] = await Promise.all([
      // People by org_id
      fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify({
          api_key: apiKey,
          ...(orgId ? { organization_ids: [orgId] } : { organization_domains: [cleanDomain] }),
          person_seniorities: ["c_suite", "founder", "vp", "director", "head", "manager", "senior"],
          contact_email_status: ["verified", "guessed"],
          per_page: 50,
          page: 1,
        }),
      }),
      // People by domain
      fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify({
          api_key: apiKey,
          organization_domains: [cleanDomain],
          person_seniorities: ["c_suite", "founder", "vp", "director", "head", "manager", "senior"],
          contact_email_status: ["verified", "guessed"],
          per_page: 50,
          page: 1,
        }),
      }),
      // Job postings from Apollo
      fetch("https://api.apollo.io/api/v1/mixed_jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify({
          api_key: apiKey,
          organization_ids: orgId ? [orgId] : undefined,
          per_page: 50,
          page: 1,
        }),
      }).catch(() => null),
      // Google News RSS
      fetch("https://news.google.com/rss/search?q=" + encodeURIComponent('"' + (org.name || cleanDomain) + '"') + "&hl=en-US&gl=US&ceid=US:en")
        .catch(() => null),
    ]);

    const [data1, data2] = await Promise.all([res1.json(), res2.json()]);

    // --- Parse job postings ---
    const TECH_KEYWORDS = ["engineer", "developer", "devops", "cloud", "architect", "data", "software", "infrastructure", "platform", "backend", "frontend", "fullstack", "full-stack", "sre", "security", "machine learning", "ml", "ai", "analytics", "database", "network", "systems", "it ", "technical", "technology", "cyber", "devsecops", "kubernetes", "terraform"];
    let jobPostings = [];
    if (jobsResp && jobsResp.ok) {
      const jobsData = await jobsResp.json();
      const allJobs = jobsData.jobs || jobsData.job_postings || [];
      jobPostings = allJobs
        .filter(j => {
          const title = (j.title || j.job_title || "").toLowerCase();
          return TECH_KEYWORDS.some(kw => title.includes(kw));
        })
        .slice(0, 15)
        .map(j => ({
          title: j.title || j.job_title || "",
          location: j.city || j.location || "",
          url: j.url || j.job_url || "",
          posted_at: j.posted_at || j.created_at || "",
        }));
    }

    // --- Parse news articles from Google RSS ---
    let newsArticles = [];
    if (newsResp && newsResp.ok) {
      const xmlText = await newsResp.text();
      const items = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
      newsArticles = items.slice(0, 8).map(item => {
        const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/) || [])[1] || "";
        const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || "";
        const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || "";
        const source = (item.match(/<source[^>]*>(.*?)<\/source>/) || [])[1] || "";
        const cleanTitle = title.replace(/ - [^-]+$/, "").trim();
        const sourceName = source || (link.match(/https?:\/\/(?:www\.)?([^/]+)/) || [])[1] || "";
        return { title: cleanTitle, url: link, date: pubDate ? new Date(pubDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "", source: sourceName };
      }).filter(a => a.title);
    }

    // --- Merge and deduplicate people ---
    const seen = new Set();
    const candidates = [];
    for (const p of [...(data1.people || []), ...(data2.people || [])]) {
      if (p.has_email && !seen.has(p.id)) {
        seen.add(p.id);
        candidates.push(p);
      }
    }

    // --- Enrich and validate contacts ---
    const contacts = await Promise.all(
      candidates.slice(0, 30).map(async (p) => {
        try {
          const r = await fetch("https://api.apollo.io/api/v1/people/match", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
            body: JSON.stringify({ id: p.id }),
          });
          const d = await r.json();
          const ep = d.person || {};
          const email = ep.email || "";
          if (!email) return null;

          const empHistory = ep.employment_history || [];
          const personOrg = ep.organization || {};
          const personOrgId = personOrg.id || ep.organization_id || "";

          if (!(orgId && personOrgId && personOrgId === orgId)) {
            const matchingJobs = empHistory.filter(j => {
              const jobDomain = (j.organization_domain || j.organization?.primary_domain || "").toLowerCase().replace(/^www\./, "");
              const jobOrgId = j.organization_id || j.organization?.id || "";
              return domainMatches(jobDomain) || (orgId && jobOrgId === orgId) || nameMatches(j.organization_name || "");
            });
            if (matchingJobs.length === 0) return null;
            const hasCurrentJob = matchingJobs.some(j => j.current === true || !j.end_date);
            if (!hasCurrentJob) return null;
            const otherCurrentJobs = empHistory.filter(j => {
              if (j.current !== true && j.end_date) return false;
              const jobDomain = (j.organization_domain || j.organization?.primary_domain || "").toLowerCase().replace(/^www\./, "");
              const jobOrgId = j.organization_id || j.organization?.id || "";
              return (j.current === true) && !domainMatches(jobDomain) && !(orgId && jobOrgId === orgId) && !nameMatches(j.organization_name || "");
            });
            if (otherCurrentJobs.length > 0) return null;
          }

          const phoneNums = ep.phone_numbers || [];
          const directDial = Array.isArray(phoneNums)
            ? (phoneNums.find(x => x.type === "direct_dial" || x.type === "mobile") || phoneNums[0] || null)
            : null;
          const personal_phone = directDial?.sanitized_number || directDial?.number || ep.mobile_phone || ep.phone || null;

          return {
            id: ep.id || p.id,
            name: ep.name || p.name || "",
            first_name: ep.first_name || p.first_name || "",
            last_name: ep.last_name || p.last_name || "",
            title: ep.title || p.title || "",
            seniority: ep.seniority || p.seniority || "",
            email,
            email_status: ep.email_status || "",
            linkedin_url: ep.linkedin_url || "",
            twitter_url: ep.twitter_url || "",
            photo_url: ep.photo_url || "",
            city: ep.city || p.city || "",
            state: ep.state || p.state || "",
            country: ep.country || p.country || "",
            personal_phone,
            _hsSent: false,
          };
        } catch (_) { return null; }
      })
    );

    const validContacts = contacts.filter(Boolean);
    const allTech = (org.technology_names || org.technologies || []).map(t => typeof t === "string" ? t : t.name || "").filter(Boolean);
    const AWS_PATTERNS = ["amazon", "aws ", "aws-", "amazon web services"];
    const awsServices = allTech.filter(t => AWS_PATTERNS.some(p => t.toLowerCase().includes(p)));
    const techStack = allTech.filter(t => !AWS_PATTERNS.some(p => t.toLowerCase().includes(p))).slice(0, 12);
    const fundingEvents = org.funding_events || org.funding_rounds || [];
    const sortedFunding = [...fundingEvents].sort((a, b) => new Date(b.date || b.announced_on || 0) - new Date(a.date || a.announced_on || 0));

    return res.status(200).json({
      id: orgId || "",
      name: org.name || "",
      domain: cleanDomain,
      website: org.website_url || ("https://" + cleanDomain),
      description: org.short_description || org.description || "",
      seo_description: org.seo_description || "",
      industry: org.industry || "",
      subindustry: org.subindustry || "",
      employee_count: org.estimated_num_employees || org.num_employees || null,
      founded_year: org.founded_year || null,
      headquarters: [org.city, org.state, org.country].filter(Boolean).join(", "),
      street_address: org.street_address || org.raw_address || "",
      postal_code: org.postal_code || "",
      phone: org.primary_phone?.number || org.phone || "",
      linkedin_url: org.linkedin_url || "",
      twitter_url: org.twitter_url || "",
      facebook_url: org.facebook_url || "",
      logo_url: org.logo_url || org.primary_logo || "",
      annual_revenue: org.annual_revenue_printed || org.annual_revenue || null,
      market_cap: org.market_cap || null,
      total_funding: org.total_funding || org.funding_total || null,
      latest_funding_stage: org.latest_funding_stage || org.funding_stage || "",
      latest_funding_date: org.latest_funding_round_date || (sortedFunding[0] && (sortedFunding[0].date || sortedFunding[0].announced_on)) || null,
      latest_funding_amount: (sortedFunding[0] && (sortedFunding[0].amount || sortedFunding[0].raised_amount)) || null,
      num_funding_rounds: org.num_funding_rounds || fundingEvents.length || null,
      funding_events: sortedFunding.slice(0, 8).map(e => ({
        date: e.date || e.announced_on || "",
        type: e.type || e.round_type || "",
        amount: e.amount || e.raised_amount || null,
        investors: (e.investors || e.lead_investors || []).map(i => typeof i === "string" ? i : i.name || "").filter(Boolean).slice(0, 4),
      })),
      top_investors: (org.investors || []).map(i => typeof i === "string" ? i : i.name || "").filter(Boolean).slice(0, 6),
      alexa_rank: org.alexa_rank || null,
      linkedin_follower_count: org.linkedin_follower_count || null,
      job_postings_count: org.job_postings_count || org.open_jobs_count || null,
      headcount_growth_6mo: org.headcount_growth_rate_6_month || null,
      g2_review_count: org.g2_review_count || null,
      tech_stack: techStack,
      aws_services: awsServices.map(t => t.replace(/^Amazon\s+/i, "").replace(/^AWS\s+/i, "")).filter(t => t.toLowerCase() !== "amazon web services"),
      keywords: (org.keywords || []).slice(0, 8),
      similar_companies: (org.similar_companies || []).map(c => c.name || c).filter(Boolean).slice(0, 6),
      contacts: validContacts,
      job_postings: jobPostings,
      news: newsArticles,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
