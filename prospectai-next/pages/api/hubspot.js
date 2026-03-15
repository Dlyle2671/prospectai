// Maps Apollo/free-text industry strings to HubSpot's required enum values
function mapIndustry(raw) {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  const map = {
    'technology': 'INFORMATION_TECHNOLOGY_AND_SERVICES',
    'information technology': 'INFORMATION_TECHNOLOGY_AND_SERVICES',
    'information technology & services': 'INFORMATION_TECHNOLOGY_AND_SERVICES',
    'information technology and services': 'INFORMATION_TECHNOLOGY_AND_SERVICES',
    'it services': 'INFORMATION_TECHNOLOGY_AND_SERVICES',
    'software': 'COMPUTER_SOFTWARE',
    'computer software': 'COMPUTER_SOFTWARE',
    'saas': 'COMPUTER_SOFTWARE',
    'cloud computing': 'COMPUTER_SOFTWARE',
    'internet': 'INTERNET',
    'internet software': 'INTERNET',
    'online media': 'INTERNET',
    'cybersecurity': 'COMPUTER_NETWORK_SECURITY',
    'network security': 'COMPUTER_NETWORK_SECURITY',
    'computer & network security': 'COMPUTER_NETWORK_SECURITY',
    'computer and network security': 'COMPUTER_NETWORK_SECURITY',
    'fintech': 'FINANCIAL_SERVICES',
    'financial services': 'FINANCIAL_SERVICES',
    'banking': 'BANKING',
    'investment banking': 'INVESTMENT_BANKING',
    'venture capital': 'VENTURE_CAPITAL_AND_PRIVATE_EQUITY',
    'private equity': 'VENTURE_CAPITAL_AND_PRIVATE_EQUITY',
    'insurance': 'INSURANCE',
    'healthcare': 'HOSPITAL_AND_HEALTH_CARE',
    'hospital & health care': 'HOSPITAL_AND_HEALTH_CARE',
    'health care': 'HOSPITAL_AND_HEALTH_CARE',
    'medical': 'MEDICAL_DEVICES',
    'medical devices': 'MEDICAL_DEVICES',
    'pharmaceuticals': 'PHARMACEUTICALS',
    'biotech': 'BIOTECHNOLOGY',
    'biotechnology': 'BIOTECHNOLOGY',
    'e-commerce': 'RETAIL',
    'ecommerce': 'RETAIL',
    'retail': 'RETAIL',
    'marketing': 'MARKETING_AND_ADVERTISING',
    'marketing and advertising': 'MARKETING_AND_ADVERTISING',
    'advertising': 'MARKETING_AND_ADVERTISING',
    'media': 'MEDIA_PRODUCTION',
    'broadcast media': 'BROADCAST_MEDIA',
    'publishing': 'PUBLISHING',
    'education': 'EDUCATION_MANAGEMENT',
    'education management': 'EDUCATION_MANAGEMENT',
    'e-learning': 'E_LEARNING',
    'elearning': 'E_LEARNING',
    'real estate': 'REAL_ESTATE',
    'manufacturing': 'INDUSTRIAL_AUTOMATION',
    'industrial automation': 'INDUSTRIAL_AUTOMATION',
    'logistics': 'LOGISTICS_AND_SUPPLY_CHAIN',
    'logistics and supply chain': 'LOGISTICS_AND_SUPPLY_CHAIN',
    'transportation': 'TRANSPORTATION_TRUCKING_RAILROAD',
    'consulting': 'MANAGEMENT_CONSULTING',
    'management consulting': 'MANAGEMENT_CONSULTING',
    'staffing': 'STAFFING_AND_RECRUITING',
    'recruiting': 'STAFFING_AND_RECRUITING',
    'telecommunications': 'TELECOMMUNICATIONS',
    'telecom': 'TELECOMMUNICATIONS',
    'aerospace': 'AVIATION_AND_AEROSPACE',
    'aviation': 'AVIATION_AND_AEROSPACE',
    'automotive': 'AUTOMOTIVE',
    'construction': 'CONSTRUCTION',
    'legal': 'LAW_PRACTICE',
    'law': 'LAW_PRACTICE',
    'accounting': 'ACCOUNTING',
    'food': 'FOOD_AND_BEVERAGES',
    'food & beverages': 'FOOD_AND_BEVERAGES',
    'energy': 'OIL_AND_ENERGY',
    'oil and energy': 'OIL_AND_ENERGY',
    'renewables': 'RENEWABLES_AND_ENVIRONMENT',
    'environmental': 'RENEWABLES_AND_ENVIRONMENT',
    'nonprofit': 'NON_PROFIT_ORGANIZATION_MANAGEMENT',
    'non-profit': 'NON_PROFIT_ORGANIZATION_MANAGEMENT',
    'government': 'GOVERNMENT_ADMINISTRATION',
    'defense': 'DEFENSE_AND_SPACE',
    'research': 'RESEARCH',
    'architecture': 'ARCHITECTURE_AND_PLANNING',
    'design': 'GRAPHIC_DESIGN',
    'entertainment': 'ENTERTAINMENT',
    'sports': 'SPORTS',
    'hospitality': 'HOSPITALITY',
    'travel': 'LEISURE_TRAVEL_AND_TOURISM',
    'human resources': 'HUMAN_RESOURCES',
    'hr': 'HUMAN_RESOURCES',
  };
  if (map[s]) return map[s];
  for (const [key, val] of Object.entries(map)) {
    if (s.includes(key) || key.includes(s)) return val;
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      first_name, last_name, email, title,
      company_name, company_domain,
      linkedin_url, city, state, country,
      company_size, company_industry, score_label,
      twitter_url, personal_phone,
      company_city, company_state, company_country,
      company_street, company_zip, company_phone,
      company_description,
    } = req.body;

    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    const hsHeaders = {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token,
    };

    // --- 0. FETCH DEFAULT OWNER ---
    let defaultOwnerId = null;
    try {
      const ownersResp = await fetch(
        "https://api.hubapi.com/crm/v3/owners?limit=1",
        { headers: hsHeaders }
      );
      const ownersData = await ownersResp.json();
      if (ownersData.results && ownersData.results.length > 0) {
        defaultOwnerId = String(ownersData.results[0].id);
      }
    } catch (_) {}

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
      if (company_size) companyProps.numberofemployees = String(company_size);
      if (company_phone) companyProps.phone = company_phone;
      if (company_city) companyProps.city = company_city;
      if (company_state) companyProps.state = company_state;
      if (company_country) companyProps.country = company_country;
      if (company_street) companyProps.address = company_street;
      if (company_zip) companyProps.zip = company_zip;
      if (company_description) companyProps.description = company_description;
      const mappedIndustry = mapIndustry(company_industry);
      if (mappedIndustry) companyProps.industry = mappedIndustry;
      if (defaultOwnerId) companyProps.hubspot_owner_id = defaultOwnerId;

      if (existingCompanyId) {
        const updateResp = await fetch(
          "https://api.hubapi.com/crm/v3/objects/companies/" + existingCompanyId,
          {
            method: "PATCH",
            headers: hsHeaders,
            body: JSON.stringify({ properties: companyProps })
          }
        );
        const updateData = await updateResp.json();
        companyId = updateData.id || existingCompanyId;
      } else {
        const createResp = await fetch(
          "https://api.hubapi.com/crm/v3/objects/companies",
          {
            method: "POST",
            headers: hsHeaders,
            body: JSON.stringify({ properties: companyProps })
          }
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

    // Use personal_phone first, fall back to company_phone
    const contactPhone = personal_phone || company_phone || null;

    const contactProps = {};
    if (first_name) contactProps.firstname = first_name;
    if (last_name) contactProps.lastname = last_name;
    if (email) contactProps.email = email;
    if (title) contactProps.jobtitle = title;
    if (company_name) contactProps.company = company_name;
    if (company_domain) contactProps.website = "https://" + company_domain;
    if (linkedin_url) contactProps.linkedinbio = linkedin_url;
    if (city) contactProps.city = city;
    if (state) contactProps.state = state;
    if (country) contactProps.country = country;
    if (twitter_url) contactProps.twitterhandle = twitter_url;
    if (contactPhone) contactProps.phone = contactPhone;
    if (defaultOwnerId) contactProps.hubspot_owner_id = defaultOwnerId;
    if (score_label) contactProps.lifecyclestage =
      score_label === "hot" ? "salesqualifiedlead" :
      score_label === "warm" ? "marketingqualifiedlead" : "lead";

    if (existingContactId) {
      const updateResp = await fetch(
        "https://api.hubapi.com/crm/v3/objects/contacts/" + existingContactId,
        {
          method: "PATCH",
          headers: hsHeaders,
          body: JSON.stringify({ properties: contactProps })
        }
      );
      const updateData = await updateResp.json();
      contactId = updateData.id || existingContactId;
    } else {
      const createResp = await fetch(
        "https://api.hubapi.com/crm/v3/objects/contacts",
        {
          method: "POST",
          headers: hsHeaders,
          body: JSON.stringify({ properties: contactProps })
        }
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
