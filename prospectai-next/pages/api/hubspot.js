// ProspectAI — /api/hubspot
// Reads HubSpot token from user's own Redis-stored integrations first, then env var
import { getAuth } from '@clerk/nextjs/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });

async function getUserKey(userId, keyName) {
    try {
          const raw = await redis.get(`user:${userId}:integrations`);
          if (!raw) return null;
          const stored = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return stored[keyName] || null;
    } catch { return null; }
}

function mapIndustry(raw) { if(!raw) return null; const s=raw.toLowerCase().trim(); const map={'technology':'INFORMATION_TECHNOLOGY_AND_SERVICES','information technology':'INFORMATION_TECHNOLOGY_AND_SERVICES','information technology & services':'INFORMATION_TECHNOLOGY_AND_SERVICES','information technology and services':'INFORMATION_TECHNOLOGY_AND_SERVICES','it services':'INFORMATION_TECHNOLOGY_AND_SERVICES','software':'COMPUTER_SOFTWARE','computer software':'COMPUTER_SOFTWARE','saas':'COMPUTER_SOFTWARE','cloud computing':'COMPUTER_SOFTWARE','internet':'INTERNET','cybersecurity':'COMPUTER_NETWORK_SECURITY','fintech':'FINANCIAL_SERVICES','financial services':'FINANCIAL_SERVICES','banking':'BANKING','healthcare':'HOSPITAL_AND_HEALTH_CARE','health care':'HOSPITAL_AND_HEALTH_CARE','biotech':'BIOTECHNOLOGY','biotechnology':'BIOTECHNOLOGY','e-commerce':'RETAIL','ecommerce':'RETAIL','retail':'RETAIL','marketing':'MARKETING_AND_ADVERTISING','advertising':'MARKETING_AND_ADVERTISING','media':'MEDIA_PRODUCTION','education':'EDUCATION_MANAGEMENT','real estate':'REAL_ESTATE','manufacturing':'INDUSTRIAL_AUTOMATION','logistics':'LOGISTICS_AND_SUPPLY_CHAIN','consulting':'MANAGEMENT_CONSULTING','staffing':'STAFFING_AND_RECRUITING','telecommunications':'TELECOMMUNICATIONS','telecom':'TELECOMMUNICATIONS','aerospace':'AVIATION_AND_AEROSPACE','automotive':'AUTOMOTIVE','construction':'CONSTRUCTION','legal':'LAW_PRACTICE','accounting':'ACCOUNTING','energy':'OIL_AND_ENERGY','renewables':'RENEWABLES_AND_ENVIRONMENT','nonprofit':'NON_PROFIT_ORGANIZATION_MANAGEMENT','government':'GOVERNMENT_ADMINISTRATION','defense':'DEFENSE_AND_SPACE','research':'RESEARCH','entertainment':'ENTERTAINMENT','hospitality':'HOSPITALITY','human resources':'HUMAN_RESOURCES','hr':'HUMAN_RESOURCES'}; if(map[s]) return map[s]; for(const [key,val] of Object.entries(map)){if(s.includes(key)||key.includes(s)) return val;} return null; }

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin","*");
    res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
hubspot.js: use per-user HubSpot token from Redis, fall back to env var    if(req.method==="OPTIONS") return res.status(200).end();
    if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
    try {
          const { userId } = getAuth(req);
          const { first_name, last_name, email, title, company_name, company_domain, linkedin_url, city, state, country, company_size, company_industry, score_label, score, twitter_url, personal_phone, company_city, company_state, company_country, company_street, company_zip, company_phone, company_description } = req.body;
          const userHsToken = userId ? await getUserKey(userId, 'hubspot') : null;
          const token = userHsToken || process.env.HUBSPOT_ACCESS_TOKEN;
          if (!token) return res.status(400).json({ error: 'HubSpot token not configured. Add it in Settings → Integrations.' });
          const hsHeaders = {"Content-Type":"application/json","Authorization":"Bearer "+token};
          let defaultOwnerId=null;
          try{const r=await fetch("https://api.hubapi.com/crm/v3/owners?limit=1",{headers:hsHeaders}); const d=await r.json(); if(d.results?.length>0) defaultOwnerId=String(d.results[0].id);}catch(_){}
          let companyId=null,existingCompanyId=null;
          if(company_domain||company_name){if(company_domain){const sr=await fetch("https://api.hubapi.com/crm/v3/objects/companies/search",{method:"POST",headers:hsHeaders,body:JSON.stringify({filterGroups:[{filters:[{propertyName:"domain",operator:"EQ",value:company_domain}]}],properties:["domain","name"],limit:1})}); const sd=await sr.json(); if(sd.results?.length>0) existingCompanyId=sd.results[0].id;} const cp={}; if(company_name) cp.name=company_name; if(company_domain){cp.domain=company_domain;cp.website="https://"+company_domain;} if(company_size) cp.numberofemployees=String(company_size); if(company_phone) cp.phone=company_phone; if(company_city) cp.city=company_city; if(company_state) cp.state=company_state; if(company_country) cp.country=company_country; if(company_street) cp.address=company_street; if(company_zip) cp.zip=company_zip; if(company_description) cp.description=company_description; const mi=mapIndustry(company_industry); if(mi) cp.industry=mi; if(defaultOwnerId) cp.hubspot_owner_id=defaultOwnerId; if(existingCompanyId){const ur=await fetch("https://api.hubapi.com/crm/v3/objects/companies/"+existingCompanyId,{method:"PATCH",headers:hsHeaders,body:JSON.stringify({properties:cp})}); const ud=await ur.json(); companyId=ud.id||existingCompanyId;}else{const cr=await fetch("https://api.hubapi.com/crm/v3/objects/companies",{method:"POST",headers:hsHeaders,body:JSON.stringify({properties:cp})}); const cd=await cr.json(); if(!cr.ok){return res.status(cr.status).json({error:cd.message||JSON.stringify(cd)});} companyId=cd.id;}}
          let contactId=null,existingContactId=null;
          if(email){const csr=await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search",{method:"POST",headers:hsHeaders,body:JSON.stringify({filterGroups:[{filters:[{propertyName:"email",operator:"EQ",value:email}]}],properties:["email"],limit:1})}); const csd=await csr.json(); if(csd.results?.length>0) existingContactId=csd.results[0].id;}
          const ph=personal_phone||company_phone||null;
          const ct={}; if(first_name) ct.firstname=first_name; if(last_name) ct.lastname=last_name; if(email) ct.email=email; if(title) ct.jobtitle=title; if(company_name) ct.company=company_name; if(company_domain) ct.website="https://"+company_domain; if(linkedin_url) ct.linkedinbio=linkedin_url; if(city) ct.city=city; if(state) ct.state=state; if(country) ct.country=country; if(twitter_url) ct.twitterhandle=twitter_url; if(ph) ct.phone=ph; if(defaultOwnerId) ct.hubspot_owner_id=defaultOwnerId; if(score_label) ct.lifecyclestage=score_label==="hot"?"salesqualifiedlead":score_label==="warm"?"marketingqualifiedlead":"lead";
          if(existingContactId){const ur=await fetch("https://api.hubapi.com/crm/v3/objects/contacts/"+existingContactId,{method:"PATCH",headers:hsHeaders,body:JSON.stringify({properties:ct})}); const ud=await ur.json(); contactId=ud.id||existingContactId;}else{const cr=await fetch("https://api.hubapi.com/crm/v3/objects/contacts",{method:"POST",headers:hsHeaders,body:JSON.stringify({properties:ct})}); const cd=await cr.json(); if(!cr.ok){return res.status(cr.status).json({error:cd.message||JSON.stringify(cd)});} contactId=cd.id;}
          if(contactId&&companyId){await fetch("https://api.hubapi.com/crm/v4/objects/contacts/"+contactId+"/associations/companies/"+companyId,{method:"PUT",headers:hsHeaders,body:JSON.stringify([{associationCategory:"HUBSPOT_DEFINED",associationTypeId:279}])});}
          return res.status(200).json({contact_id:contactId,company_id:companyId,contact_status:existingContactId?"updated":"created",company_status:companyId?(existingCompanyId?"updated":"created"):"skipped"});
    } catch(err) { return res.status(500).json({error:err.message}); }
}
