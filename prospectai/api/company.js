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
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();

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

    // --- 2. Find Key Contacts at this company ---
    const peopleResp = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({
        api_key: apiKey,
        organization_domains: [cleanDomain],
        person_seniorities: ["c_suite", "founder", "vp", "director", "head"],
        contact_email_status: ["verified", "guessed"],
        per_page: 20,
        page: 1,
      }),
    });
    const peopleData = await peopleResp.json();
    const candidates = (peopleData.people || []).filter(p => p.has_email);

    // --- 3. Enrich top contacts ---
    const contacts = await Promise.all(
      candidates.slice(0, 12).map(async (p) => {
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

    const allTech = (org.technology_names || org.technologies || [])
      .map(t => typeof t === "string" ? t : t.name || "").filter(Boolean);
    const AWS_PATTERNS = ["amazon", "aws ", "aws-", "amazon web services"];
    const awsServices = allTech.filter(t => AWS_PATTERNS.some(p => t.toLowerCase().includes(p)));
    const techStack = allTech.filter(t => !AWS_PATTERNS.some(p => t.toLowerCase().includes(p))).slice(0, 12);

    const fundingEvents = org.funding_events || org.funding_rounds || [];
    const sortedFunding = [...fundingEvents].sort((a, b) =>
      new Date(b.date || b.announced_on || 0) - new Date(a.date || a.announced_on || 0)
    );

    const company = {
      id: org.id || "",
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
        investors: (e.investors || e.lead_investors || [])
          .map(i => typeof i === "string" ? i : i.name || "").filter(Boolean).slice(0, 4),
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
      contacts: contacts.filter(Boolean),
    };

    return res.status(200).json(company);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
