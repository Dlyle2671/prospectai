export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { first_name, last_name, email, title, company_name, company_domain, linkedin_url } = req.body;

    const properties = {};
    if (first_name) properties.firstname = first_name;
    if (last_name) properties.lastname = last_name;
    if (email) properties.email = email;
    if (title) properties.jobtitle = title;
    if (company_name) properties.company = company_name;
    if (company_domain) properties.website = "https://" + company_domain;
    if (linkedin_url) properties.linkedinbio = linkedin_url;

    const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.HUBSPOT_ACCESS_TOKEN
      },
      body: JSON.stringify({ properties }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data.message || data.error || JSON.stringify(data)
      });
    }
    return res.status(200).json({ id: data.id, status: "created" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
