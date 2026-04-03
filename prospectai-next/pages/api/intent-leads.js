// ProspectAI — /api/intent-leads
// Returns leads for all companies currently flagged with High Buying Intent in Redis.
// Redis keys are written by /api/intent-webhook (from Apollo Workflow).
// No search params needed — just call GET /api/intent-leads.

import { getAuth } from '@clerk/nextjs/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

async function getUserKey(userId, keyName) {
  try {
    const raw = await redis.get(`user:${userId}:integrations`);
    if (!raw) return null;
    const stored = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return stored[keyName] || null;
  } catch { return null; }
}

// ── scoring helpers (same as apollo.js) ──────────────────────────────────────
const DEFAULT_ICP = { titleWeight:40,seniorityWeight:30,companySizeWeight:25,industryWeight:30,fundingWeight:15,verifiedEmailBonus:3,linkedinBonus:2,phoneBonus:2,hiringSurgeBonus:8,awsBonus:5,hotThreshold:75,warmThreshold:50,targetIndustries:['technology','software','saas','cloud computing','cybersecurity','fintech','financial services','healthcare','biotech'] };
const SENIORITY_RATIO = { c_suite:1.0,founder:1.0,vp:0.875,head:0.75,director:0.625,manager:0.375,senior:0.25,entry:0.125 };
const TITLE_RATIO = { ceo:1.0,cto:0.95,coo:0.875,cfo:0.8,cmo:0.75,founder:1.0,'co-founder':1.0,'vp of engineering':0.875,'vp of sales':0.825,'vp of marketing':0.75,'vp of product':0.75,vp:0.7,'director of engineering':0.7,'director of sales':0.65,'director of marketing':0.6,director:0.55,'head of engineering':0.65,'head of growth':0.6,'head of product':0.6,head:0.5,manager:0.3,'account executive':0.2,senior:0.2 };
const AWS_PATTERNS = ['amazon','aws ','aws-','amazon s3','amazon ec2','amazon rds','amazon cloudfront','amazon lambda','amazon dynamodb','amazon sns','amazon sqs','amazon redshift','amazon vpc','amazon route','amazon iam','amazon eks','amazon ecs','amazon elasticache','amazon kinesis','amazon sagemaker','amazon athena','amazon glue','amazon emr','amazon cloudwatch','amazon cognito'];
function isAwsService(name) { const l=(name||'').toLowerCase(); return AWS_PATTERNS.some(p=>l.includes(p))||l==='amazon web services'; }
function cleanAwsName(name) { return name.replace(/^Amazon\s+/i,'').replace(/^AWS\s+/i,''); }
function scoreEmployeeCount(count,maxPts) { if(!count)return 0; const n=Number(count); if(n>=501&&n<=5000)return maxPts; if(n>=201&&n<=500)return Math.round(maxPts*0.86); if(n>=51&&n<=200)return Math.round(maxPts*0.63); if(n>5000)return Math.round(maxPts*0.71); if(n>=11&&n<=50)return Math.round(maxPts*0.34); return Math.round(maxPts*0.14); }
function calcLeadScore(lead,icp) { const w={...DEFAULT_ICP,...(icp||{})}; let score=0; const tl=(lead.title||'').toLowerCase(); let tr=0; for(const [k,r] of Object.entries(TITLE_RATIO)) if(tl.includes(k)) tr=Math.max(tr,r); score+=Math.round(w.titleWeight*tr); if(tr<0.5){const sl=(lead.seniority||'').toLowerCase(); for(const [k,r] of Object.entries(SENIORITY_RATIO)) if(sl.includes(k)){score+=Math.round(w.seniorityWeight*r);break;}} score+=scoreEmployeeCount(lead.company_size,w.companySizeWeight); const il=(lead.company_industry||'').toLowerCase(); const inds=Array.isArray(w.targetIndustries)?w.targetIndustries:DEFAULT_ICP.targetIndustries; score+=inds.some(i=>il.includes(i))?w.industryWeight:5; if(lead.linkedin_url)score+=w.linkedinBonus; if(lead.email_status==='verified')score+=w.verifiedEmailBonus; if(lead.personal_phone)score+=w.phoneBonus; if(lead.funding_round_date){const mo=(Date.now()-new Date(lead.funding_round_date))/(1000*60*60*24*30);if(mo<=18)score+=w.fundingWeight;} if(lead.linkedin_follower_count>1000)score+=3; if(lead.job_postings_count>5)score+=2; if(lead.twitter_url)score+=1; if(lead.hiring_surge)score+=w.hiringSurgeBonus; if(lead.aws_services?.length>=3)score+=w.awsBonus; return Math.min(100,Math.round(score)); }
function scoreLabel(score,icp) { const hot=(icp?.hotThreshold??DEFAULT_ICP.hotThreshold); const warm=(icp?.warmThreshold??DEFAULT_ICP.warmThreshold); return score>=hot?'hot':score>=warm?'warm':'cold'; }
function fmtRevenue(rev) { if(!rev)return null; if(typeof rev==='string')return rev; const n=Number(rev); if(isNaN(n)||n<=0)return null; if(n>=1e9)return'$'+(n/1e9).toFixed(1)+'B ARR'; if(n>=1e6)return'$'+(n/1e6).toFixed(0)+'M ARR'; if(n>=1e3)return'$'+(n/1e3).toFixed(0)+'K ARR'; return'$'+n; }
function buildLead(p,org,icp,intentData) {
  org=org||p.organization||p.account||{};
  const allTech=(org.technology_names||org.technologies||[]).map(t=>typeof t==='string'?t:(t.name||t.category||'')).filter(Boolean);
  const awsRaw=allTech.filter(t=>isAwsService(t));
  const awsSpecific=awsRaw.filter(t=>t.toLowerCase()!=='amazon web services').map(cleanAwsName);
  const aws_services=awsSpecific.length>0?[...new Set(awsSpecific)].slice(0,15):(awsRaw.length>0?['Amazon Web Services']:[]);
  const techStack=allTech.filter(t=>!isAwsService(t)).slice(0,8);
  const fundingEvents=org.funding_events||org.funding_rounds||[];
  const sortedFunding=[...fundingEvents].sort((a,b)=>new Date(b.date||b.announced_on||0)-new Date(a.date||a.announced_on||0));
  const latest=sortedFunding[0]||{};
  const funding_round_date=latest.date||latest.announced_on||org.latest_funding_round_date||null;
  const funding_round_type=latest.type||latest.round_type||org.latest_funding_round_type||null;
  const funding_round_amount=latest.amount||latest.raised_amount||null;
  const top_investors=(latest.investors||latest.lead_investors||[]).map(i=>typeof i==='string'?i:(i.name||'')).filter(Boolean).slice(0,3);
  const headcount_growth=org.headcount_growth_rate_6_month||null;
  const job_postings_count=org.job_postings_count||org.open_jobs_count||null;
  const headcountGrowthNum=headcount_growth!==null?Number(headcount_growth):null;
  const hiring_surge=(job_postings_count>10)||(headcountGrowthNum!==null&&headcountGrowthNum>0.20);
  let recently_funded=false;
  if(funding_round_date){const mo=(Date.now()-new Date(funding_round_date))/(1000*60*60*24*30);recently_funded=mo<=18;}
  const funding_stage=org.latest_funding_stage||org.funding_stage||'';
  const intent_signals=[];
  if(recently_funded&&funding_stage) intent_signals.push({type:'funding',label:funding_stage+(funding_round_amount?(funding_round_amount>=1e9?' $'+(funding_round_amount/1e9).toFixed(1)+'B':funding_round_amount>=1e6?' $'+(funding_round_amount/1e6).toFixed(0)+'M':''):'')}); else if(recently_funded) intent_signals.push({type:'funding',label:'Recently Funded'});
  if(hiring_surge) intent_signals.push({type:'hiring',label:job_postings_count?job_postings_count+' open roles':'Hiring Surge'});
  // Merge intent data from Redis
  const intent_strength = intentData?.intent_strength || org.intent_strength || p.intent_strength || 'high';
  (intentData?.intent_signals||[]).forEach(s => {
    const label=typeof s==='string'?s:(s.topic||s.label||s.name||'');
    if(label) intent_signals.push({type:'intent',label});
  });
  const phoneNums=p.phone_numbers||[];
  const directDial=Array.isArray(phoneNums)?(phoneNums.find(x=>x.type==='direct_dial')||phoneNums.find(x=>x.type==='mobile')||phoneNums[0]||null):null;
  const personal_phone=directDial?.sanitized_number||directDial?.raw_number||p.mobile_phone||p.phone||null;
  const all_phones=Array.isArray(phoneNums)?phoneNums.map(x=>x.sanitized_number||x.raw_number||x.number||'').filter(Boolean):(personal_phone?[personal_phone]:[]);
  const empHistory=p.employment_history||[];
  const currentJob=empHistory.find(j=>j.current)||{};
  const prevJobs=empHistory.filter(j=>!j.current&&j.organization_name).slice(0,2).map(j=>({company:j.organization_name,title:j.title||'',end_date:j.end_date||''}));
  const name=p.name||[p.first_name,p.last_name].filter(Boolean).join(' ')||'';
  const company_size=org.estimated_num_employees||org.num_employees||org.headcount||null;
  const company_industry=org.industry||org.primary_industry||'';
  const lead={id:p.id,name,first_name:p.first_name||'',last_name:p.last_name||'',title:p.title||'',seniority:p.seniority||'',department:p.departments?.[0]||p.department||'',email:p.email||'',email_status:p.email_status||p.contact_email_status||'',linkedin_url:p.linkedin_url||'',twitter_url:p.twitter_url||'',github_url:p.github_url||'',photo_url:p.photo_url||'',city:p.city||'',state:p.state||'',country:p.country||'',prev_jobs:prevJobs,time_in_role_months:currentJob.start_date?Math.floor((Date.now()-new Date(currentJob.start_date))/(1000*60*60*24*30)):null,intent_strength,company_name:org.name||p.organization_name||'',company_domain:org.primary_domain||org.domain||'',company_industry,subindustry:org.subindustry||'',company_size,company_founded:org.founded_year||'',company_linkedin:org.linkedin_url||'',company_twitter:org.twitter_url||'',company_description:(org.short_description||'').slice(0,160),seo_description:org.seo_description||'',personal_phone,all_phones,company_phone:org.primary_phone?.number||org.phone||null,company_street:org.street_address||null,company_zip:org.postal_code||null,company_city:org.city||null,company_state:org.state||null,company_country:org.country||null,market_cap:org.market_cap||null,tech_stack:techStack,aws_services,funding_stage,funding_total:org.total_funding||null,funding_round_date,funding_round_type,funding_round_amount,top_investors,num_funding_rounds:org.num_funding_rounds||fundingEvents.length||null,headcount_growth,linkedin_follower_count:org.linkedin_follower_count||null,annual_revenue:fmtRevenue(org.annual_revenue_printed||org.annual_revenue||null),alexa_rank:org.alexa_rank||null,job_postings_count,keywords:(org.keywords||[]).slice(0,5),hiring_surge:hiring_surge||false,recently_funded,intent_signals};
  lead.score=calcLeadScore(lead,icp);
  lead.score_label=scoreLabel(lead.score,icp);
  return lead;
}
// ─────────────────────────────────────────────────────────────────────────────

async function getOrgIdByDomain(domain, apiKey) {
  try {
    const r=await fetch('https://api.apollo.io/api/v1/organizations/enrich?domain='+encodeURIComponent(domain),{method:'GET',headers:{'Content-Type':'application/json','X-Api-Key':apiKey}});
    const d=await r.json();
    return d.organization?.id||null;
  } catch(e){return null;}
}

async function enrichPerson(p, apiKey, domain, icp, intentData) {
  try {
    const matchBody={api_key:apiKey,reveal_personal_emails:true};
    if(p.id) matchBody.id=p.id;
    if(p.email) matchBody.email=p.email;
    if(p.first_name) matchBody.first_name=p.first_name;
    if(p.last_name) matchBody.last_name=p.last_name;
    const orgName=p.organization?.name||p.organization_name||null;
    if(orgName) matchBody.organization_name=orgName;
    if(p.linkedin_url) matchBody.linkedin_url=p.linkedin_url;
    const r=await fetch('https://api.apollo.io/api/v1/people/match',{method:'POST',headers:{'Content-Type':'application/json','X-Api-Key':apiKey},body:JSON.stringify(matchBody)});
    if(!r.ok) return buildLead(p,p.organization||{},icp,intentData);
    const d=await r.json();
    const ep=d.person;
    if(!ep) return buildLead(p,p.organization||{},icp,intentData);
    return buildLead(ep,ep.organization||p.organization||{},icp,intentData);
  } catch(err){ return buildLead(p,p.organization||{},icp,intentData); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});

  try {
    const { userId } = getAuth(req);
    const userApolloKey = userId ? await getUserKey(userId, 'apollo') : null;
    const apiKey = userApolloKey || process.env.APOLLO_API_KEY;
    if(!apiKey) return res.status(400).json({error:'Apollo API key not configured.'});

    const icpRaw = userId ? await redis.get(`user:${userId}:icp_weights`) : null;
    const icp = icpRaw ? (typeof icpRaw==='string'?JSON.parse(icpRaw):icpRaw) : null;

    // 1. Scan Redis for all intent:* keys
    let cursor = '0';
    const intentKeys = [];
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: 'intent:*', count: 100 });
      cursor = nextCursor;
      intentKeys.push(...keys);
    } while (cursor !== '0');

    console.log('[intent-leads] found', intentKeys.length, 'intent domains in Redis');

    if (intentKeys.length === 0) {
      return res.status(200).json({ leads: [], companies: [], message: 'No companies with active buying intent yet. Check back after the Apollo workflow runs.' });
    }

    // 2. Fetch intent data for all keys
    const intentEntries = await Promise.all(
      intentKeys.map(async key => {
        const domain = key.replace('intent:', '');
        const raw = await redis.get(key);
        const data = raw ? (typeof raw==='string'?JSON.parse(raw):raw) : {};
        return { domain, intentData: data };
      })
    );

    // 3. Fetch leads for each domain (up to 5 leads per company, max 10 companies)
    const domains = intentEntries.slice(0, 10);
    console.log('[intent-leads] fetching leads for', domains.length, 'companies');

    const INTENT_TITLES = ['CEO','CTO','CFO','COO','VP','Director','Head','Manager','Founder'];

    const allLeads = [];
    const companySummaries = intentEntries.map(e => ({
      domain: e.domain,
      org_name: e.intentData?.org_name || e.domain,
      intent_strength: e.intentData?.intent_strength || 'high',
      intent_signals: e.intentData?.intent_signals || [],
      updated_at: e.intentData?.updated_at || null,
    }));

    for (const { domain, intentData } of domains) {
      try {
        const orgId = await getOrgIdByDomain(domain, apiKey);
        const searchBody = {
          api_key: apiKey,
          per_page: 5,
          page: 1,
          contact_email_status: ['verified', 'guessed'],
          person_titles: INTENT_TITLES,
        };
        if (orgId) searchBody.organization_ids = [orgId];
        else searchBody.organization_domains = [domain];

        const searchResp = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': apiKey },
          body: JSON.stringify(searchBody),
        });
        if (!searchResp.ok) continue;
        const searchData = await searchResp.json();
        const people = searchData.people || searchData.contacts || [];
        console.log('[intent-leads]', domain, '->', people.length, 'people');

        const enriched = await Promise.all(
          people.slice(0, 5).map(p => enrichPerson(p, apiKey, domain, icp, intentData))
        );
        allLeads.push(...enriched.filter(Boolean));
        await new Promise(r => setTimeout(r, 250));
      } catch (e) {
        console.log('[intent-leads] error for', domain, ':', e.message);
      }
    }

    // 4. Sort by score desc, intent leads always at top
    const sorted = allLeads
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    console.log('[intent-leads] returning', sorted.length, 'leads across', domains.length, 'companies');
    return res.status(200).json({ leads: sorted, companies: companySummaries });

  } catch (err) {
    console.error('[intent-leads] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
