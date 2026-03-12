export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      industry = [],
      employee_ranges = [],
      tech_stack = [],
      titles = [],
      page = 1,
      per_page = 25
    } = req.body;

    const body = {
      api_key: process.env.APOLLO_API_KEY,
      page,
      per_page,
      contact_email_status: ["verified", "guessed"],
      organization_technology_names: ["Amazon Web Services"].concat(
        tech_stack.filter(t => t !== "AWS" && t !== "Amazon Web Services")
      ),
    };

    if (industry.length > 0) body.q_organization_industry_tag_ids = industry;
    if (titles.length > 0) body.person_titles = titles;

    if (employee_ranges.length > 0) {
      const map = {
        "1,10": "1,10", "11,50": "11,50", "51,200": "51,200",
        "201,500": "201,500", "501,1000": "501,1000",
        "1001,5000": "1001,5000", "5001,10000000": "5001,10000000"
      };
      const ranges = employee_ranges.map(r => map[r]).filter(Boolean);
      if (ranges.length > 0) body.organization_num_employees_ranges = ranges;
    }

    const searchResp = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "X-Api-Key": process.env.APOLLO_API_KEY },
      body: JSON.stringify(body),
    });

    const searchData = await searchResp.json();
    if (!searchResp.ok) {
      return res.status(searchResp.status).json({ error: searchData.message || searchData.error || JSON.stringify(searchData) });
    }

    const candidates = (searchData.people || []).filter(p => p.has_email);
    if (candidates.length === 0) return res.status(200).json([]);

    // Enrich each candidate to get the verified email
    const enriched = await Promise.all(
      candidates.map(async (p) => {
        try {
          const r = await fetch("https://api.apollo.io/api/v1/people/match", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Api-Key": process.env.APOLLO_API_KEY },
            body: JSON.stringify({ id: p.id }),
          });
          const d = await r.json();
          const ep = d.person || {};
          const email = ep.email || "";
          if (!email) return null;
          return {
            id: p.id,
            name: ep.name || p.first_name || "",
            title: ep.title || p.title || "",
            email,
            linkedin_url: ep.linkedin_url || "",
            photo_url: ep.photo_url || "",
            company_name: (ep.organization && ep.organization.name) || (p.organization && p.organization.name) || "",
            company_domain: (ep.organization && ep.organization.primary_domain) || (p.organization && p.organization.primary_domain) || "",
            company_industry: (ep.organization && ep.organization.industry) || (p.organization && p.organization.industry) || "",
            company_size: (ep.organization && ep.organization.estimated_num_employees) || (p.organization && p.organization.estimated_num_employees) || "",
          };
        } catch { return null; }
      })
    );

    return res.status(200).json(enriched.filter(Boolean));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
