// ProspectAI — /api/apollo
// Full lead scoring + Apollo enrichment pipeline

const SENIORITY_SCORE = { c_suite:40, founder:40, vp:35, head:30, director:25, manager:15, senior:10, entry:5 };
const TITLE_SCORE = { ceo:40, cto:38, coo:35, cfo:32, cmo:30, founder:40, 'co-founder':40, 'vp of engineering':35, 'vp of sales':33, 'vp of marketing':30, 'vp of product':30, vp:28, 'director of engineering':28, 'director of sales':26, 'director of marketing':24, director:22, 'head of engineering':26, 'head of growth':24, 'head of product':24, head:20, manager:12, 'account executive':8, senior:8 };
const HIGH_VALUE_INDUSTRIES = ['technology','software','saas','cloud computing','cybersecurity','fintech','financial services','healthcare','biotech'];
const AWS_PATTERNS = ['amazon','aws ','aws-','amazon s3','amazon ec2','amazon rds','amazon cloudfront','amazon lambda','amazon dynamodb','amazon sns','amazon sqs','amazon redshift','amazon vpc','amazon route','amazon iam','amazon eks','amazon ecs','amazon elasticache','amazon kinesis','amazon sagemaker','amazon athena','amazon glue','amazon emr','amazon cloudwatch','amazon cognito'];

function isAwsService(name) { const l=(name||'').toLowerCase(); return AWS_PATTERNS.some(p=>l.includes(p))||l==='amazon web services'; }
function cleanAwsName(name) { return name.replace(/^Amazon\s+/i,'').replace(/^AWS\s+/i,''); }
function scoreEmployeeCount(count) { if(!count)return 0; const n=Number(count); if(n>=201&&n<=500)return 30; if(n>=501&&n<=1000)return 35; if(n>=1001&&n<=5000)return 38; if(n>=51&&n<=200)return 22; if(n>5000)return 25; if(n>=11&&n<=50)return 12; return 5; }

function calcLeadScore(lead) {
        let score=0;
        const tl=(lead.title||'').toLowerCase();
        let tp=0;
        for(const [k,p] of Object.entries(TITLE_SCORE)) if(tl.includes(k)) tp=Math.max(tp,p);
        score+=tp;
        if(tp<20){ const sl=(lead.seniority||'').toLowerCase(); for(const [k,p] of Object.entries(SENIORITY_SCORE)) if(sl.includes(k)){score+=p;break;} }
        score+=scoreEmployeeCount(lead.company_size);
        const il=(lead.company_industry||'').toLowerCase();
        score+=HIGH_VALUE_INDUSTRIES.some(i=>il.includes(i))?20:5;
        if(lead.linkedin_url) score+=2;
        if(lead.email_status==='verified') score+=3;
        if(lead.personal_phone) score+=2;
        if(lead.funding_round_date){ const mo=(Date.now()-new Date(lead.funding_round_date))/(1000*60*60*24*30); if(mo<=18) score+=8; }
        if(lead.linkedin_follower_count>1000) score+=3;
        if(lead.job_postings_count>5) score+=2;
        if(lead.twitter_url) score+=1;
        if(lead.hiring_surge) score+=3;
        if(lead.aws_services?.length>=3) score+=3;
        return Math.min(100,Math.round(score));
}

function scoreLabel(s) { return s>=75?'hot':s>=50?'warm':'cold'; }

function fmtRevenue(rev) {
        if(!rev)return null;
        if(typeof rev==='string')return rev;
        const n=Number(rev);
        if(isNaN(n)||n<=0)return null;
        if(n>=1e9)return'$'+(n/1e9).toFixed(1)+'B ARR';
        if(n>=1e6)return'$'+(n/1e6).toFixed(0)+'M ARR';
        if(n>=1e3)return'$'+(n/1e3).toFixed(0)+'K ARR';
        return'$'+n;
}

async function enrichPerson(p, apiKey, searchedDomain) {
        try {
                  const r = await fetch('https://api.apollo.io/api/v1/people/match', {
                              method:'POST',
                              headers:{'Content-Type':'application/json','X-Api-Key':apiKey},
                              body:JSON.stringify({
                                            id: p.id,
                                            reveal_personal_emails: true,
                                            reveal_phone_number: true,
                              })
                  });
                  const d = await r.json();
                  const ep = d.person||{};
                  const org = (searchedDomain ? p.organization : ep.organization)||ep.organization||p.organization||{};
                  const email = ep.email||p.email||'';
                  

          const allTech = (org.technology_names||org.technologies||[]).map(t=>typeof t==='string'?t:t.name||t.category||'').filter(Boolean);
                  const awsRaw = allTech.filter(t=>isAwsService(t));
                  const awsSpecific = awsRaw.filter(t=>t.toLowerCase()!=='amazon web services').map(t=>cleanAwsName(t));
                  const aws_services = awsSpecific.length>0?[...new Set(awsSpecific)].slice(0,15):(awsRaw.length>0?['Amazon Web Services']:[]);
                  const techStack = allTech.filter(t=>!isAwsService(t)).slice(0,8);

          const empHistory = ep.employment_history||[];
                  const currentJob = empHistory.find(j=>j.current)||{};
                  const prevJobs = empHistory.filter(j=>!j.current&&j.organization_name).slice(0,2).map(j=>({company:j.organization_name,title:j.title||'',end_date:j.end_date||''}));

          // Phone numbers — prefer direct dial, then mobile, then first available
          const phoneNums = ep.phone_numbers||[];
                  const directDial = Array.isArray(phoneNums)
                    ? (phoneNums.find(x=>x.type==='direct_dial')||phoneNums.find(x=>x.type==='mobile')||phoneNums[0]||null)
                              : null;
                  const personal_phone = directDial?.sanitized_number||directDial?.raw_number||ep.mobile_phone||ep.phone||null;
                  // Also collect all available phone numbers for full transparency
          const all_phones = Array.isArray(phoneNums)
                    ? phoneNums.map(x=>x.sanitized_number||x.raw_number||x.number||'').filter(Boolean)
                      : (personal_phone ? [personal_phone] : []);

          const fundingEvents = org.funding_events||org.funding_rounds||[];
                  const sortedFunding = [...fundingEvents].sort((a,b)=>new Date(b.date||b.announced_on||0)-new Date(a.date||a.announced_on||0));
                  const latest = sortedFunding[0]||{};
                  const funding_round_date = latest.date||latest.announced_on||org.latest_funding_round_date||null;
                  const funding_round_type = latest.type||latest.round_type||org.latest_funding_round_type||null;
                  const funding_round_amount = latest.amount||latest.raised_amount||null;
                  const top_investors = (latest.investors||latest.lead_investors||[]).map(i=>typeof i==='string'?i:i.name||'').filter(Boolean).slice(0,3);

          const headcount_growth = org.headcount_growth_rate_6_month||null;
                  const job_postings_count = org.job_postings_count||org.open_jobs_count||null;
                  const headcountGrowthNum = headcount_growth!==null?Number(headcount_growth):null;
                  const hiring_surge = (job_postings_count>10)||(headcountGrowthNum!==null&&headcountGrowthNum>0.20);

          let recently_funded = false;
                  if(funding_round_date){ const mo=(Date.now()-new Date(funding_round_date))/(1000*60*60*24*30); recently_funded=mo<=18; }

          const funding_stage = org.latest_funding_stage||org.funding_stage||'';
                  const intent_signals = [];
                  if(recently_funded&&funding_stage) intent_signals.push({type:'funding',label:funding_stage+(funding_round_amount?(funding_round_amount>=1e9?' $'+(funding_round_amount/1e9).toFixed(1)+'B':funding_round_amount>=1e6?' $'+(funding_round_amount/1e6).toFixed(0)+'M':''):'')}); else if(recently_funded) intent_signals.push({type:'funding',label:'Recently Funded'});
                  if(hiring_surge) intent_signals.push({type:'hiring',label:job_postings_count?job_postings_count+' open roles':'Hiring Surge'});

          const lead = {
                      id:p.id,
                      name:ep.name||p.name||'',
                      first_name:ep.first_name||p.first_name||'',
                      last_name:ep.last_name||p.last_name||'',
                      title:ep.title||p.title||'',
                      seniority:ep.seniority||p.seniority||'',
                      department:ep.departments?.[0]||ep.department||p.departments?.[0]||'',
                      email,
                      email_status:ep.email_status||ep.contact_email_status||'',
                      linkedin_url:ep.linkedin_url||'',
                      twitter_url:ep.twitter_url||'',
                      github_url:ep.github_url||'',
                      photo_url:ep.photo_url||'',
                      city:ep.city||p.city||'',
                      state:ep.state||p.state||'',
                      country:ep.country||p.country||'',
                      prev_jobs:prevJobs,
                      time_in_role_months:currentJob.start_date?Math.floor((Date.now()-new Date(currentJob.start_date))/(1000*60*60*24*30)):null,
                      intent_strength:ep.intent_strength||null,
                      company_name:org.name||p.organization?.name||'',
                      company_domain:searchedDomain||org.primary_domain||p.organization?.primary_domain||'',
                      company_industry:org.industry||p.organization?.industry||'',
                      subindustry:org.subindustry||'',
                      company_size:org.estimated_num_employees||p.organization?.estimated_num_employees||'',
                      company_founded:org.founded_year||'',
                      company_linkedin:org.linkedin_url||'',
                      company_twitter:org.twitter_url||'',
                      company_description:(org.short_description||'').slice(0,160),
                      seo_description:org.seo_description||'',
                      personal_phone,
                      all_phones,
                      company_phone:org.primary_phone?.number||org.phone||null,
                      company_street:org.street_address||null,
                      company_zip:org.postal_code||null,
                      company_city:org.city||null,
                      company_state:org.state||null,
                      company_country:org.country||null,
                                  market_cap:org.market_cap||null,
                      tech_stack:techStack,
                      aws_services,
                      funding_stage,
                      funding_total:org.total_funding||null,
                      funding_round_date,
                      funding_round_type,
                      funding_round_amount,
                      top_investors,
                      num_funding_rounds:org.num_funding_rounds||fundingEvents.length||null,
                      headcount_growth,
                      linkedin_follower_count:org.linkedin_follower_count||null,
                      annual_revenue:fmtRevenue(org.annual_revenue_printed||org.annual_revenue||null),
                      alexa_rank:org.alexa_rank||null,
                      job_postings_count,
                      keywords:(org.keywords||[]).slice(0,5),
                      hiring_surge:hiring_surge||false,
                      recently_funded,
                      intent_signals,
          };
                  lead.score = calcLeadScore(lead);
                  lead.score_label = scoreLabel(lead.score);
                  return lead;
        } catch { return null; }
}

export default async function handler(req, res) {
        res.setHeader('Access-Control-Allow-Origin','*');
        res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers','Content-Type');
        if(req.method==='OPTIONS') return res.status(200).end();
        if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  try {
            const {
                        industry=[],
                        employee_ranges=[],
                        tech_stack=[],
                        titles=[],
                        locations=[],
                        page=1,
                        per_page=25,
                        email,
                        linkedin_url,
                        changed_jobs_recently,
                        organization_domains=[],
            } = req.body;

          const apiKey = process.env.APOLLO_API_KEY;
            const isDomainSearch = Array.isArray(organization_domains) && organization_domains.length > 0;

          // ── Email/LinkedIn lookup mode ──────────────────────────────────────────
          if(email || linkedin_url) {
                      const matchBody = { api_key: apiKey, reveal_personal_emails: true, reveal_phone_number: true };
                      if(email) matchBody.email = email;
                      if(linkedin_url) matchBody.linkedin_url = linkedin_url;
                      const r = await fetch('https://api.apollo.io/api/v1/people/match', {
                                    method:'POST',
                                    headers:{'Content-Type':'application/json','X-Api-Key':apiKey},
                                    body:JSON.stringify(matchBody)
                      });
                      const d = await r.json();
                      const p = d.person;
                      if(!p) return res.status(200).json([]);
                      const org = p.organization || {};
                      const allTech = (org.technology_names||[]).map(t=>typeof t==='string'?t:t.name||'').filter(Boolean);
                      const awsRaw = allTech.filter(t=>isAwsService(t));
                      const awsSpecific = awsRaw.filter(t=>t.toLowerCase()!=='amazon web services').map(t=>cleanAwsName(t));
                      const aws_services = awsSpecific.length>0?[...new Set(awsSpecific)].slice(0,15):(awsRaw.length>0?['Amazon Web Services']:[]);
                      const techStack = allTech.filter(t=>!isAwsService(t)).slice(0,8);
                      const phoneNums = p.phone_numbers||[];
                      const directDial = Array.isArray(phoneNums)?(phoneNums.find(x=>x.type==='direct_dial')||phoneNums.find(x=>x.type==='mobile')||phoneNums[0]||null):null;
                      const personal_phone = directDial?.sanitized_number||directDial?.raw_number||p.mobile_phone||p.phone||null;
                      const all_phones = Array.isArray(phoneNums)?phoneNums.map(x=>x.sanitized_number||x.raw_number||x.number||'').filter(Boolean):(personal_phone?[personal_phone]:[]);
                      const lead = {
                                    id:p.id, name:p.name||'', first_name:p.first_name||'', last_name:p.last_name||'',
                                    title:p.title||'', seniority:p.seniority||'', department:p.departments?.[0]||'',
                                    email:p.email||'', email_status:p.email_status||'',
                                    linkedin_url:p.linkedin_url||'', twitter_url:p.twitter_url||'', github_url:p.github_url||'', photo_url:p.photo_url||'',
                                    city:p.city||'', state:p.state||'', country:p.country||'',
                                    company_name:org.name||'', company_domain:org.primary_domain||'', company_industry:org.industry||'',
                                    company_size:org.estimated_num_employees||'', company_founded:org.founded_year||'',
                                    company_linkedin:org.linkedin_url||'', company_description:(org.short_description||'').slice(0,160),
                                    seo_description:org.seo_description||'',
                                    personal_phone,
                                    all_phones,
                                    company_phone:org.primary_phone?.number||org.phone||null,
                                    tech_stack:techStack, aws_services,
                                    prev_jobs:(p.employment_history||[]).filter(j=>!j.current&&j.organization_name).slice(0,2).map(j=>({company:j.organization_name,title:j.title||'',end_date:j.end_date||''})),
                                    keywords:(org.keywords||[]).slice(0,5),
                                    hiring_surge:false, recently_funded:false, intent_signals:[],
                      };
                      lead.score = calcLeadScore(lead);
                      lead.score_label = scoreLabel(lead.score);
                      return res.status(200).json([lead]);
          }

          // ── Search mode ─────────────────────────────────────────────────────────
          const body = { api_key: apiKey, page, per_page: isDomainSearch ? Math.min(per_page * 3, 100) : per_page };

          if(isDomainSearch) {
                      body.contact_email_status = ['verified','guessed','unavailable','bounced'];
          } else {
                      body.contact_email_status = ['verified','guessed'];
                      body.organization_technology_names = ['Amazon Web Services'].concat(
                                    (tech_stack||[]).filter(t=>t!=='AWS'&&t!=='Amazon Web Services')
                                  );
          }

          const titleList = req.body.person_titles?.length > 0 ? req.body.person_titles : titles;
            if(titleList.length > 0) body.person_titles = titleList;

          if(!isDomainSearch) {
                      if(industry.length > 0) body.q_organization_industry_tag_ids = industry;
                      if(req.body.industries?.length > 0) body.q_keywords = req.body.industries.join(' ');
          }

          const sizeRanges = req.body.organization_num_employees_ranges || employee_ranges || [];
            if(sizeRanges.length > 0) {
                        const map = {'1-10':'1,10','11-50':'11,50','51-200':'51,200','201-500':'201,500','501-1000':'501,1000','1001-5000':'1001,5000','5001+':'5001,10000000','1,10':'1,10','11,50':'11,50','51,200':'51,200','201,500':'201,500','501,1000':'501,1000','1001,5000':'1001,5000','5001,10000000':'5001,10000000'};
                        const mapped = sizeRanges.map(r=>map[r]).filter(Boolean);
                        if(mapped.length > 0) body.organization_num_employees_ranges = mapped;
            }

          if(isDomainSearch) { body.organization_domains = organization_domains; }
            if(locations.length > 0) body.person_locations = locations;
            if(changed_jobs_recently) body.changed_jobs_recently = true;

          console.log('[apollo] search body:', JSON.stringify(body));

          const searchResp = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
                      method:'POST',
                      headers:{'Content-Type':'application/json','Cache-Control':'no-cache','X-Api-Key':apiKey},
                      body:JSON.stringify(body)
          });
            const searchData = await searchResp.json();
            console.log('[apollo] search result: total_entries=', searchData.pagination?.total_entries, 'people=', searchData.people?.length, 'error=', searchData.error);

          if(!searchResp.ok) return res.status(searchResp.status).json({error:searchData.message||searchData.error||JSON.stringify(searchData)});

          const candidates = isDomainSearch
              ? (searchData.people||[]).filter(p => { const pd = p.organization?.primary_domain||''; const match = !organization_domains[0] || pd === organization_domains[0] || pd.endsWith('.'+organization_domains[0]) || organization_domains[0].endsWith('.'+pd); return match && (p.email || p.has_email || p.contact_email_status !== 'notFound'); })
                      : (searchData.people||[]).filter(p => p.has_email);

          console.log('[apollo] candidates after filter:', candidates.length, 'isDomainSearch:', isDomainSearch);
            if(!candidates.length) return res.status(200).json([]);

          const enriched = await Promise.all(candidates.map(p => enrichPerson(p, apiKey, isDomainSearch ? organization_domains[0] : null)));
            return res.status(200).json(enriched.filter(Boolean).sort((a,b)=>b.score-a.score));

  } catch(err) {
            console.error('[apollo] error:', err.message);
            return res.status(500).json({error:err.message});
  }
}
