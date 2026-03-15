// ProspectAI — /api/hubspot (Next.js API route)
// Copied verbatim from prospectai/api/hubspot.js — already Next.js compatible

function mapIndustry(raw) {
  if(!raw) return null;
  const s = raw.toLowerCase().trim();
  const map = {
    technology:'INFORMATION_TECHNOLOGY_AND_SERVICES','information technology':'INFORMATION_TECHNOLOGY_AND_SERVICES',
    software:'COMPUTER_SOFTWARE','computer software':'COMPUTER_SOFTWARE','saas':'COMPUTER_SOFTWARE','cloud computing':'COMPUTER_SOFTWARE',
    internet:'INTERNET','cybersecurity':'COMPUTER_NETWORK_SECURITY','network security':'COMPUTER_NETWORK_SECURITY',
    fintech:'FINANCIAL_SERVICES','financial services':'FINANCIAL_SERVICES','banking':'BANKING',
    healthcare:'HOSPITAL_AND_HEALTH_CARE','health care':'HOSPITAL_AND_HEALTH_CARE',
    medical:'MEDICAL_DEVICES','pharmaceuticals':'PHARMACEUTICALS','biotech':'BIOTECHNOLOGY','biotechnology':'BIOTECHNOLOGY',
    'e-commerce':'RETAIL','ecommerce':'RETAIL','retail':'RETAIL',
    marketing:'MARKETING_AND_ADVERTISING','advertising':'MARKETING_AND_ADVERTISING',
    education:'EDUCATION_MANAGEMENT','e-learning':'E_LEARNING',
    'real estate':'REAL_ESTATE','manufacturing':'INDUSTRIAL_AUTOMATION',
    logistics:'LOGISTICS_AND_SUPPLY_CHAIN','transportation':'TRANSPORTATION_TRUCKING_RAILROAD',
    consulting:'MANAGEMENT_CONSULTING','staffing':'STAFFING_AND_RECRUITING','recruiting':'STAFFING_AND_RECRUITING',
    telecommunications:'TELECOMMUNICATIONS','telecom':'TELECOMMUNICATIONS',
    aerospace:'AVIATION_AND_AEROSPACE','automotive':'AUTOMOTIVE','construction':'CONSTRUCTION',
    legal:'LAW_PRACTICE','accounting':'ACCOUNTING',''energy':'OIL_AND_ENERGY',
    renewables':'RENEWABLES_AND_ENVIRONMENT','nonprofit':'NON_PROFIT_ORGANIZATION_MANAGEMENT',
    government:'GOVERNMENT_ADMINISTRATION','defense':'DEFENSE_AND_SPACE',
    research:'RESEARCH','entertainment':'ENTERTAINMENT',''hospitality':'HOSPITALITY',
  };
  if(map[s]) return map[s];
  for(const [k,v] of Object.entries(map)) if(s.includes(k)||k.includes(s)) return v;
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  try {
    const { first_name, last_name, email, title, company_name, company_domain, linkedin_url, city, state, country, company_size, company_industry, score_label, twitter_url, personal_phone, company_city, company_state, company_country, company_street, company_zip, company_phone, company_description } = req.body;
    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    const h = { 'Content-Type':'application/json', 'Authorization':'Bearer '+token };

    // 0. Default owner
    let defaultOwnerId = null;
    try {
      const r = await fetch('https://api.hubapi.com/crm/v3/owners?limit=1', {headers:h});
      const d = await r.json();
      if(d.results?.[0]) defaultOwnerId = String(d.results[0].id);
    } catch {}

    // 1. Upsert company
    let companyId = null, existingCompanyId = null;
    if(company_domain || company_name) {
      if(company_domain) {
        const r = await fetch('https://api.hubapi.com/crm/v3/objects/companies/search', {method:'POST',headers:h,body:JSON.stringify({filterGroups:[{filters:[{propertyName:'domain',operator:'EQ',value:company_domain}]}],properties:['domain','name'],limit:1})});
        const d = await r.json();
        if(d.results?.[0]) existingCompanyId = d.results[0].id;
      }
      const cp = {};
      if(company_name) cp.name = company_name;
      if(company_domain) { cp.domain = company_domain; cp.website = 'https://'+company_domain; }
      if(company_size) cp.numberofemployees = String(company_size);
      if(company_phone) cp.phone = company_phone;
      if(company_city) cp.city = company_city;
      if(company_state) cp.state = company_state;
      if(company_country) cp.country = company_country;
      if(company_street) cp.address = company_street;
      if(company_zip) cp.zip = company_zip;
      if(company_description) cp.description = company_description;
      const mi = mapIndustry(company_industry);
      if(mi) cp.industry = mi;
      if(defaultOwnerId) cp.hubspot_owner_id = defaultOwnerId;
      if(existingCompanyId) {
        const r = await fetch('https://api.hubapi.com/crm/v3/objects/companies/'+existingCompanyId, {method:'PATCH',headers:h,body:JSON.stringify({properties:cp})});
        const d = await r.json();
        companyId = d.id || existingCompanyId;
      } else {
        const r = await fetch('https://api.hubapi.com/crm/v3/objects/companies', {method:'POST',headers:h,body:JSON.stringify({properties:cp})});
        const d = await r.json();
        if(!r.ok) return res.status(r.status).json({error:d.message||JSON.stringify(d)});
        companyId = d.id;
      }
    }

    // 2. Upsert contact
    let contactId = null, existingContactId = null;
    if(email) {
      const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {method:'POST',headers:h,body:JSON.stringify({filterGroups:[{filters:[{propertyName:'email',operator:'EQ',value:email}]}],properties:['email','firstname','lastname'],limit:1})});
      const d = await r.json();
      if(d.results?.[0]) existingContactId = d.results[0].id;
    }
    const contactPhone = personal_phone || company_phone || null;
    const cp2 = {};
    if(first_name) cp2.firstname = first_name;
    if(last_name) cp2.lastname = last_name;
    if(email) cp2.email = email;
    if(title) cp2.jobtitle = title;
    if(company_name) cp2.company = company_name;
    if(company_domain) cp2.website = 'https://'+company_domain;
    if(linkedin_url) cp2.linkedinbio = linkedin_url;
    if(city) cp2.city = city;
    if(state) cp2.state = state;
    if(country) cp2.country = country;
    if(twitter_url) cp2.twitterhandle = twitter_url;
    if(contactPhone) cp2.phone = contactPhone;
    if(defaultOwnerId) cp2.hubspot_owner_id = defaultOwnerId;
    if(score_label) cp2.lifecyclestage = score_label==='hot'?'salesqualifiedlead':score_label==='warm'?'marketingqualifiedlead':'lead';
    if(existingContactId) {
      const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/'+existingContactId, {method:'PATCH',headers:h,body:JSON.stringify({properties:cp2})});
      const d = await r.json();
      contactId = d.id || existingContactId;
    } else {
      const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {method:'POST',headers:h,body:JSON.stringify({properties:cp2})});
      const d = await r.json();
      if(!r.ok) return res.status(r.status).json({error:d.message||JSON.stringify(d)});
      contactId = d.id;
    }

    // 3. Associate contact + company
    if(contactId && companyId) {
      await fetch('https://api.hubapi.com/crm/v4/objects/contacts/'+contactId+'/associations/companies/'+companyId, {method:'PUT',headers:h,body:JSON.stringify([{associationCategory:'HUBSPOT_DEFINED',associationTypeId:279}])});
    }

    return res.status(200).json({contact_id:contactId, company_id:companyId, contact_status:existingContactId?'updated':'created', company_status:companyId?(existingCompanyId?'updated':'created'):'skipped'});
  } catch(err) {
    return res.status(500).json({error:err.message});
  }
}
