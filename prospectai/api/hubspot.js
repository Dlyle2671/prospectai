export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
        const { name, email, title, company, linkedin } = req.body;

      const [firstName, ...lastParts] = (name || "").split(" ");
        const lastName = lastParts.join(" ");

      const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
              method: "POST",
              headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
              },
              body: JSON.stringify({
                        properties: {
                                    firstname: firstName || "",
                                    lastname: lastName || "",
                                    email: email !== "—" ? email : "",
                                    jobtitle: title || "",
                                    company: company || "",
                                    linkedin_bio: linkedin || "",
                        },
              }),
      });

      const data = await response.json();

      if (!response.ok) {
              return res.status(response.status).json({ error: data.message || "HubSpot error" });
      }

      return res.status(200).json({ success: true, contact: data });
  } catch (err) {
        return res.status(500).json({ error: err.message });
  }
}
