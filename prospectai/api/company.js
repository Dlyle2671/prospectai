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
    const domainSlug = cleanDomain.split(".")[0].replace(/[^a-z0-9-]/g, "");

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
    const orgNameSlug = orgNameLower.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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

    const TECH_KEYWORDS = ["engineer", "developer", "devops", "cloud", "architect", "data", "software", "infrastructure", "platform", "backend", "frontend", "fullstack", "full-stack", "sre", "security", "machine learning", "ml", "ai", "analytics", "database", "network", "systems", "it ", "technical", "technology", "cyber", "devsecops", "kubernetes", "terraform", "java", "python", "golang", "typescript", "react", "node", "api", "qa", "test"];

    function isTechRole(title) {
      const t = (title || "").toLowerCase();
      return TECH_KEYWORDS.some(kw => t.includes(kw));
    }

    const slugsToTry = [...new Set([domainSlug, orgNameSlug])];

    async function tryGreenhouse(slug) {
      try {
        const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`, { headers: { "User-Agent": "ProspectAI/1.0" } });
        if (!r.ok) return [];
        const d = await r.json();
        return (d.jobs || []).filter(j => isTechRole(j.title)).slice(0, 15).map(j => ({
          title: j.title || "", location: (j.location && j.location.name) || "",
          url: j.absolute_url || "",
          date: j.updated_at ? new Date(j.updated_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "",
          source: "Greenhouse",
        }));
      } catch(_) { return []; }
    }

    async function tryLever(slug) {
      try {
        const r = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`, { headers: { "User-Agent": "ProspectAI/1.0" } });
        if (!r.ok) return [];
        const d = await r.json();
        return (Array.isArray(d) ? d : []).filter(j => isTechRole(j.text)).slice(0, 15).map(j => ({
          title: j.text || "", location: (j.categories && j.categories.location) || "",
          url: j.hostedUrl || j.applyUrl || "",
          date: j.createdAt ? new Date(j.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "",
          source: "Lever",
        }));
      } catch(_) { return []; }
    }

    async function tryAshby(slug) {
      try {
        const r = await fetch(`https://api.ashbyhq.com/posting-public/job-board/${slug}`, { headers: { "User-Agent": "ProspectAI/1.0" } });
        if (!r.ok) return [];
        const d = await r.json();
        return (Array.isArray(d.jobPostings) ? d.jobPostings : Array.isArray(d.jobs) ? d.jobs : []).filter(j => isTechRole(j.title)).slice(0, 15).map(j => ({
          title: j.title || "", location: j.locationName || j.location || "",
          url: j.jobUrl || j.applyUrl || "",
          date: j.publishedDate ? new Date(j.publishedDate).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "",
          source: "Ashby",
        }));
      } catch(_) { return []; }
    }

    async function tryWorkable(slug) {
      try {
        const r = await fetch(`https://apply.workable.com/api/v3/accounts/${slug}/jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": "ProspectAI/1.0" },
          body: JSON.stringify({ query: "", department: [], location: [], workplace: [], remote: null }),
        });
        if (!r.ok) return [];
        const d = await r.json();
        return (Array.isArray(d.results) ? d.results : []).filter(j => isTechRole(j.title)).slice(0, 15).map(j => ({
          title: j.title || "", location: j.location || j.city || "",
          url: `https://apply.workable.com/${slug}/j/${j.shortcode}/`,
          date: j.published_on ? new Date(j.published_on).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "",
          source: "Workable",
        }));
      } catch(_) { return []; }
    }

    async function tryBambooHR(slug) {
      try {
        const r = await fetch(`https://${slug}.bamboohr.com/careers/list`, { headers: { "User-Agent": "ProspectAI/1.0", "Accept": "application/json" } });
        if (!r.ok) return [];
        const d = await r.json();
        return (Array.isArray(d.result) ? d.result : []).filter(j => isTechRole(j.jobOpeningName)).slice(0, 15).map(j => ({
          title: j.jobOpeningName || "",
          location: j.location && j.location.city ? j.location.city + (j.location.state ? ", " + j.location.state : "") : "",
          url: `https://${slug}.bamboohr.com/careers/${j.id}`,
          date: "", source: "BambooHR",
        }));
      } catch(_) { return []; }
    }

    const [res1, res2, jobsResp, newsResp, ...externalJobResults] = await Promise.all([
      fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify({
          api_key: apiKey,
          ...(orgId ? { organization_ids: [orgId] } : { organization_domains: [cleanDomain] }),
          person_seniorities: ["c_suite", "founder", "vp", "director", "head", "manager", "senior"],
          contact_email_status: ["verified", "guessed"],
          per_page: 50, page: 1,
        }),
      }),
      fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify({
          api_key: apiKey,
          organization_domains: [cleanDomain],
          person_seniorities: ["c_suite", "founder", "vp", "director", "head", "manager", "senior"],
          contact_email_status: ["verified", "guessed"],
          per_page: 50, page: 1,
        }),
      }),
      (orgId ? fetch("https://api.apollo.io/api/v1/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify({ api_key: apiKey, organization_ids: [orgId], per_page: 50, page: 1 }),
      }).catch(() => null) : Promise.resolve(null)),
      fetch("https://news.google.com/rss/search?q=" + encodeURIComponent('"' + (org.name || cleanDomain) + '" ' + cleanDomain) + "&hl=en-US&gl=US&ceid=US:en").catch(() => null),
      ...slugsToTry.flatMap(slug => [
        tryGreenhouse(slug),
        tryLever(slug),
        tryAshby(slug),
        tryWorkable(slug),
        tryBambooHR(slug),
      ]),
    ]);

    const [data1, data2] = await Promise.all([res1.json(), res2.json()]);

    let apolloJobs = [];
    if (jobsResp && jobsResp.ok) {
      try {
        const jobsData = await jobsResp.json();
        apolloJobs = (jobsData.jobs || jobsData.job_postings || []).filter(j => {
          const title = (j.title || j.job_title || "").toLowerCase();
          return TECH_KEYWORDS.some(kw => title.includes(kw));
        }).slice(0, 15).map(j => ({
          title: j.title || j.job_title || "",
          location: [j.city, j.state, j.country].filter(Boolean).join(", ") || j.location || "",
          url: j.url || j.job_url || j.linkedin_url || "",
          date: j.posted_at ? new Date(j.posted_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "",
          source: "Apollo",
        }));
      } catch(_) {}
    }

    const allExternal = externalJobResults.flat();
    const seenJobTitles = new Set();
    const deduped = [];
    for (const j of [...apolloJobs, ...allExternal]) {
      const key = (j.title + "|" + j.source).toLowerCase();
      if (!seenJobTitles.has(key)) { seenJobTitles.add(key); deduped.push(j); }
    }
    const jobPostings = deduped.slice(0, 20);
    const jobSources = [...new Set(jobPostings.map(j => j.source).filter(Boolean))];

    const encodedName = encodeURIComponent((org.name || cleanDomain) + " engineer");
    const jobBoardLinks = [
      { label: "LinkedIn Jobs", url: "https://www.linkedin.com/jobs/search/?keywords=" + encodeURIComponent(org.name || cleanDomain) + "&f_TPR=r604800" },
      { label: "Indeed", url: "https://www.indeed.com/jobs?q=" + encodedName },
      { label: "Glassdoor", url: "https://www.glassdoor.com/Jobs/" + encodeURIComponent((org.name||cleanDomain).replace(/\s+/g,"-")) + "-jobs-SRCH_KE0," + (org.name||cleanDomain).length + ".htm" },
      { label: "Greenhouse", url: "https://boards.greenhouse.io/" + domainSlug },
      { label: "Lever", url: "https://jobs.lever.co/" + domainSlug },
      { label: "Wellfound", url: "https://wellfound.com/company/" + domainSlug + "/jobs" },
    ];

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
        return { title: cleanTitle, url: link, date: pubDate ? new Date(pubDate).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "", source: sourceName };
      }).filter(a => { if (!a.title) return false; const orgN = org.name || cleanDomain; const strictRe = new RegExp("\\b" + orgN + "\\b"); const looseRe = new RegExp("\\b" + orgN + "\\b", "i"); const urlMatch = !!(a.url && a.url.toLowerCase().includes(cleanDomain)); return strictRe.test(a.title) || urlMatch || (orgN.length > 8 && looseRe.test(a.title));});
    }

    const seen = new Set();
    const candidates = [];
    for (const p of [...(data1.people || []), ...(data2.people || [])]) {
      if (p.has_email && !seen.has(p.id)) { seen.add(p.id); candidates.push(p); }
    }

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
          const directDial = Array.isArray(phoneNums) ? (phoneNums.find(x => x.type === "direct_dial" || x.type === "mobile") || phoneNums[0] || null) : null;
          const personal_phone = directDial?.sanitized_number || directDial?.number || ep.mobile_phone || ep.phone || null;
          return {
            id: ep.id || p.id, name: ep.name || p.name || "",
            first_name: ep.first_name || p.first_name || "", last_name: ep.last_name || p.last_name || "",
            title: ep.title || p.title || "", seniority: ep.seniority || p.seniority || "",
            email, email_status: ep.email_status || "", linkedin_url: ep.linkedin_url || "",
            twitter_url: ep.twitter_url || "", photo_url: ep.photo_url || "",
            city: ep.city || p.city || "", state: ep.state || p.state || "",
            country: ep.country || p.country || "", personal_phone, _hsSent: false,
          };
        } catch (_) { return null; }
      })
    );
    const validContacts = contacts.filter(Boolean);

    const allTech = (Array.isArray(org.technology_names) ? org.technology_names : Array.isArray(org.technologies) ? org.technologies : []).map(t => typeof t === "string" ? t : t.name || "").filter(Boolean);
    const AWS_PATTERNS = ["amazon", "aws ", "aws-", "amazon web services"];
    const awsServices = allTech.filter(t => AWS_PATTERNS.some(p => t.toLowerCase().includes(p)));
    const techStack = allTech.filter(t => !AWS_PATTERNS.some(p => t.toLowerCase().includes(p))).slice(0, 12);
    const fundingEvents = Array.isArray(org.funding_events) ? org.funding_events : Array.isArray(org.funding_rounds) ? org.funding_rounds : [];
    const sortedFunding = [...fundingEvents].sort((a, b) => new Date(b.date || b.announced_on || 0) - new Date(a.date || a.announced_on || 0));

    return res.status(200).json({
      id: orgId || "", name: org.name || "", domain: cleanDomain,
      website: org.website_url || ("https://" + cleanDomain),
      description: org.short_description || org.description || "",
      seo_description: org.seo_description || "",
      industry: org.industry || "", subindustry: org.subindustry || "",
      employee_count: org.estimated_num_employees || org.num_employees || null,
      founded_year: org.founded_year || null,
      headquarters: [org.city, org.state, org.country].filter(Boolean).join(", "),
      street_address: org.street_address || "",
      postal_code: org.postal_code || "",
      phone: org.primary_phone?.number || org.phone || "",
      linkedin_url: org.linkedin_url || "", twitter_url: org.twitter_url || "",
      facebook_url: org.facebook_url || "", logo_url: org.logo_url || org.primary_logo || "",
      annual_revenue: org.annual_revenue_printed || org.annual_revenue || null,
      market_cap: org.market_cap || null,
      total_funding: org.total_funding || org.funding_total || null,
      latest_funding_stage: org.latest_funding_stage || org.funding_stage || "",
      latest_funding_date: org.latest_funding_round_date || (sortedFunding[0] && (sortedFunding[0].date || sortedFunding[0].announced_on)) || null,
      latest_funding_amount: (sortedFunding[0] && (sortedFunding[0].amount || sortedFunding[0].raised_amount)) || null,
      num_funding_rounds: org.num_funding_rounds || fundingEvents.length || null,
      funding_events: sortedFunding.slice(0, 8).map(e => ({
        date: e.date || e.announced_on || "", type: e.type || e.round_type || "",
        amount: e.amount || e.raised_amount || null,
        investors: (Array.isArray(e.investors) ? e.investors : Array.isArray(e.lead_investors) ? e.lead_investors : []).map(i => typeof i === "string" ? i : i.name || "").filter(Boolean).slice(0, 4),
      })),
      top_investors: (Array.isArray(org.investors) ? org.investors : []).map(i => typeof i === "string" ? i : i.name || "").filter(Boolean).slice(0, 6),
      alexa_rank: org.alexa_rank || null,
      linkedin_follower_count: org.linkedin_follower_count || null,
      job_postings_count: org.job_postings_count || org.open_jobs_count || null,
      headcount_growth_6mo: org.headcount_growth_rate_6_month || null,
      g2_review_count: org.g2_review_count || null,
      tech_stack: techStack,
      aws_services: awsServices.map(t => t.replace(/^Amazon\s+/i, "").replace(/^AWS\s+/i, "")).filter(t => t.toLowerCase() !== "amazon web services"),
      keywords: (Array.isArray(org.keywords) ? org.keywords : []).slice(0, 8),
      similar_companies: (Array.isArray(org.similar_companies) ? org.similar_companies : []).map(c => (c && c.name) ? c.name : (typeof c === "string" ? c : "")).filter(Boolean).slice(0, 6),
      contacts: validContacts,
      job_postings: jobPostings,
      job_sources: jobSources,
      job_board_links: jobBoardLinks,
      news: newsArticles,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
