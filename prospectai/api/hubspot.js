export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      first_name, last_name, email, title,
      company_name, company_domain, linkedin_url,
      department, seniority, city, state, country,
      company_size, company_industry, lead_score, score_label,
      twitter_url, annual_revenue,
      company_city, company_state, company_country,
      company_street, company_zip, company_phone,
      company_founded, company_linkedin, company_description,
    } = req.body;

    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    const hsHeaders = {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token,
    };

    // --- 1. UPSERT COMPANY ---
    let companyId = null;
    let existingCompanyId = null;
    if (company_domain || company_name) {
      if (company_domain) {
        const domainSearch = await fetch(
          "https://api.hubapi.com/crm/v3/objects/companies/search",
          {
            method: "POST",
            headers: hsHeaders,
            body: JSON.stringify({
              filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: company_domain }] }],
              properties: ["domain", "name"],
              limit: 1,
            }),
          }
        );
        const domainData = await domainSearch.json();
        if (domainData.results && domainData.results.length > 0) {
          existingCompanyId = domainData.results[0].id;
        }
      }

      const companyProps = {};
      if (company_name) companyProps.name = company_name;
      if (company_domain) companyProps.domain = company_domain;
      if (company_domain) companyProps.website = "https://" + company_domain;
      if (company_industry) companyProps.industry = company_industry;
      if (company_size) companyProps.numberofemployees = String(company_size);
      if (annual_revenue) companyProps.annualrevenue = annual_revenue;
      if (company_phone) companyProps.phone = company_phone;
      if (company_city) companyProps.city = company_city;
      if (company_state) companyProps.state = company_state;
      if (company_country) companyProps.country = company_country;
      if (company_street) companyProps.address = company_street;
      if (company_zip) companyProps.zip = company_zip;
      if (company_founded) companyProps.founded_year = String(company_founded);
      if (company_linkedin) companyProps.linkedin_company_page = company_linkedin;
      if (company_description) companyProps.description = company_description;

      if (existingCompanyId) {
        const updateResp = await fetch(
          "https://api.hubapi.com/crm/v3/objects/companies/" + existingCompanyId,
          { method: "PATCH", headers: hsHeaders, body: JSON.stringify({ properties: companyProps }) }
        );
        const updateData = await updateResp.json();
        companyId = updateData.id || existingCompanyId;
      } else {
        const createResp = await fetch(
          "https://api.hubapi.com/crm/v3/objects/companies",
          { method: "POST", headers: hsHeaders, body: JSON.stringify({ properties: companyProps }) }
        );
        const createData = await createResp.json();
        if (!createResp.ok) {
          return res.status(createResp.status).json({ error: createData.message || JSON.stringify(createData) });
        }
        companyId = createData.id;
      }
    }

    // --- 2. UPSERT CONTACT ---
    let contactId = null;
    let existingContactId = null;
    if (email) {
      const contactSearch = await fetch(
        "https://api.hubapi.com/crm/v3/objects/contacts/search",
        {
          method: "POST",
          headers: hsHeaders,
          body: JSON.stringify({
            filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
            properties: ["email", "firstname", "lastname"],
            limit: 1,
          }),
        }
      );
      const contactData = await contactSearch.json();
      if (contactData.results && contactData.results.length > 0) {
        existingContactId = contactData.results[0].id;
      }
    }

    const contactProps = {};
    if (first_name) contactProps.firstname = first_name;
    if (last_name) contactProps.lastname = last_name;
    if (email) contactProps.email = email;
    if (title) contactProps.jobtitle = title;
    if (company_name) contactProps.company = company_name;
    if (company_domain) contactProps.website = "https://" + company_domain;
    if (linkedin_url) contactProps.linkedinbio = linkedin_url;
    if (department) contactProps.department = department;
    if (seniority) contactProps.seniority = seniority;
    if (city) contactProps.city = city;
    if (state) contactProps.state = state;
    if (country) contactProps.country = country;
    if (twitter_url) contactProps.twitterhandle = twitter_url;
    if (lead_score !== undefined && lead_score !== null) contactProps.hubspotscore = String(lead_score);
    if (score_label) contactProps.lifecyclestage = score_label === "hot" ? "salesqualifiedlead" : score_label === "warm" ? "marketingqualifiedlead" : "lead";

    if (existingContactId) {
      const updateResp = await fetch(
        "https://api.hubapi.com/crm/v3/objects/contacts/" + existingContactId,
        { method: "PATCH", headers: hsHeaders, body: JSON.stringify({ properties: contactProps }) }
      );
      const updateData = await updateResp.json();
      contactId = updateData.id || existingContactId;
    } else {
      const createResp = await fetch(
        "https://api.hubapi.com/crm/v3/objects/contacts",
        { method: "POST", headers: hsHeaders, body: JSON.stringify({ properties: contactProps }) }
      );
      const createData = await createResp.json();
      if (!createResp.ok) {
        return res.status(createResp.status).json({ error: createData.message || JSON.stringify(createData) });
      }
      contactId = createData.id;
    }

    // --- 3. ASSOCIATE CONTACT with COMPANY ---
    if (contactId && companyId) {
      await fetch(
        "https://api.hubapi.com/crm/v4/objects/contacts/" + contactId + "/associations/companies/" + companyId,
        {
          method: "PUT",
          headers: hsHeaders,
          body: JSON.stringify([{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 279 }]),
        }
      );
    }

    return res.status(200).json({
      contact_id: contactId,
      company_id: companyId,
      contact_status: existingContactId ? "updated" : "created",
      company_status: companyId ? (existingCompanyId ? "updated" : "created") : "skipped",
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
