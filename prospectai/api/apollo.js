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
        "1,10": "1,10",
        "11,50": "11,50",
        "51,200": "51,200",
        "201,500": "201,500",
        "501,1000": "501,1000",
        "1001,5000": "1001,5000",
        "5001,10000000": "5001,10000000"
      };
      const ranges = employee_ranges.map(r => map[r]).filter(Boolean);
      if (ranges.length > 0) body.organization_num_employees_ranges = ranges;
    }

    const response = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": process.env.APOLLO_API_KEY
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || data.error || JSON.stringify(data) });
    }

    const people = (data.people || [])
      .map(p => {
        const email = (p.email_status === "verified" || p.email_status === "guessed") ? (p.email || "") : "";
        const phone = (p.phone_numbers && p.phone_numbers.length > 0)
          ? p.phone_numbers[0].sanitized_number || p.phone_numbers[0].raw_number || ""
          : "";
        return {
          id: p.id,
          first_name: p.first_name || "",
          last_name: p.last_name || "",
          name: p.name || ((p.first_name || "") + " " + (p.last_name || "")).trim(),
          title: p.title || "",
          email,
          phone,
          linkedin_url: p.linkedin_url || "",
          photo_url: p.photo_url || "",
          company_name: (p.organization && p.organization.name) || "",
          company_domain: (p.organization && p.organization.primary_domain) || "",
          company_industry: (p.organization && p.organization.industry) || "",
          company_size: (p.organization && p.organization.estimated_num_employees) || "",
        };
      })
      .filter(p => p.email || p.phone);

    return res.status(200).json(people);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
