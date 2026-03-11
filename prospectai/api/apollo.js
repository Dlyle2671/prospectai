export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { industry = [], employee_ranges = [], tech_stack = [], page = 1, per_page = 25 } = req.body;
    const empRangeMap = {
      "1-10":{"min":1,"max":10},"11-50":{"min":11,"max":50},"51-200":{"min":51,"max":200},
      "201-500":{"min":201,"max":500},"501-1000":{"min":501,"max":1000},
      "1001-5000":{"min":1001,"max":5000},"5001+":{"min":5001,"max":1000000}
    };
    const empRanges = employee_ranges.map(r => empRangeMap[r]).filter(Boolean).map(r => r.min + "," + r.max);
    const techNames = ["Amazon Web Services"].concat(tech_stack.filter(t => t !== "Amazon Web Services"));
    const body = {
      api_key: process.env.APOLLO_API_KEY,
      page, per_page,
      contact_email_status: ["verified", "guessed"],
      organization_technology_names: techNames,
    };
    if (industry.length > 0) body.organization_industry_tag_ids = industry;
    if (empRanges.length > 0) body.organization_num_employees_ranges = empRanges;
    const response = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.message || "Apollo error" });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
