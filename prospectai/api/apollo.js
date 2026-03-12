// Lead scoring weights
const SENIORITY_SCORE = { 'c_suite': 40, 'founder': 40, 'vp': 35, 'head': 30, 'director': 25, 'manager': 15, 'senior': 10, 'entry': 5 };
const TITLE_SCORE = { 'ceo': 40, 'cto': 38, 'coo': 35, 'cfo': 32, 'cmo': 30, 'founder': 40, 'co-founder': 40, 'vp of engineering': 35, 'vp of sales': 33, 'vp of marketing': 30, 'vp of product': 30, 'vp': 28, 'director of engineering': 28, 'director of sales': 26, 'director of marketing': 24, 'director': 22, 'head of engineering': 26, 'head of growth': 24, 'head of product': 24, 'head': 20, 'manager': 12, 'account executive': 8, 'senior': 8 };
const SIZE_SCORE = { '1,10': 5, '11,50': 12, '51,200': 22, '201,500': 30, '501,1000': 35, '1001,5000': 38, '5001,10000000': 25 };
const HIGH_VALUE_INDUSTRIES = [ 'technology', 'software', 'saas', 'cloud computing', 'cybersecurity', 'fintech', 'financial services', 'healthcare', 'biotech' ];

function scoreEmployeeCount(count) {
  if (!count) return 0;
  const n = Number(count);
  if (n >= 201 && n <= 500) return 30;
  if (n >= 501 && n <= 1000) return 35;
  if (n >= 1001 && n <= 5000) return 38;
  if (n >= 51 && n <= 200) return 22;
  if (n > 5000) return 25;
  if (n >= 11 && n <= 50) return 12;
  return 5;
}

function calcLeadScore(lead) {
  let score = 0;
  // Title score (up to 40pts)
  const titleLower = (lead.title || '').toLowerCase();
  let titlePts = 0;
  for (const [key, pts] of Object.entries(TITLE_SCORE)) {
    if (titleLower.includes(key)) { titlePts = Math.max(titlePts, pts); }
  }
  score += titlePts;
  // Seniority score (up to 40pts, only if title didn't already score high)
  if (titlePts < 20) {
    const senLower = (lead.seniority || '').toLowerCase();
    for (const [key, pts] of Object.entries(SENIORITY_SCORE)) {
      if (senLower.includes(key)) { score += pts; break; }
    }
  }
  // Company size score (up to 38pts)
  score += scoreEmployeeCount(lead.company_size);
  // Industry fit (up to 20pts)
  const indLower = (lead.company_industry || '').toLowerCase();
  if (HIGH_VALUE_INDUSTRIES.some(i => indLower.includes(i))) score += 20; else score += 5;
  // Has LinkedIn (2pts)
  if (lead.linkedin_url) score += 2;
  // Recent funding bonus: funded within last 18 months (+8pts)
  if (lead.funding_round_date) {
    const monthsAgo = (Date.now() - new Date(lead.funding_round_date)) / (1000 * 60 * 60 * 24 * 30);
    if (monthsAgo <= 18) score += 8;
  }
  // High LinkedIn follower count = brand/intent signal (+3pts if >1000)
  if (lead.linkedin_follower_count && lead.linkedin_follower_count > 1000) score += 3;
  // Cap at 100
  return Math.min(100, Math.round(score));
}

function scoreLabel(score) {
  if (score >= 75) return 'hot';
  if (score >= 50) return 'warm';
  return 'cold';
}

function fmtRevenue(rev) {
  if (!rev) return null;
  // Apollo sometimes returns as string like "$5M" or as number
  if (typeof rev === 'string') return rev;
  const n = Number(rev);
  if (isNaN(n) || n <= 0) return null;
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B ARR';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M ARR';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K ARR';
  return '$' + n;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { industry = [], employee_ranges = [], tech_stack = [], titles = [], page = 1, per_page = 25 } = req.body;
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
      const map = { "1,10": "1,10", "11,50": "11,50", "51,200": "51,200", "201,500": "201,500", "501,1000": "501,1000", "1001,5000": "1001,5000", "5001,10000000": "5001,10000000" };
      const ranges = employee_ranges.map(r => map[r]).filter(Boolean);
      if (ranges.length > 0) body.organization_num_employees_ranges = ranges;
    }

    const searchResp = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "X-Api-Key": process.env.APOLLO_API_KEY },
      body: JSON.stringify(body),
    });
    const searchData = await searchResp.json();
    if (!searchResp.ok) {
      return res.status(searchResp.status).json({ error: searchData.message || searchData.error || JSON.stringify(searchData) });
    }
    const candidates = (searchData.people || []).filter(p => p.has_email);
    if (candidates.length === 0) return res.status(200).json([]);

    // Enrich each candidate via people/match to get full profile
    const enriched = await Promise.all(
      candidates.map(async (p) => {
        try {
          const r = await fetch("https://api.apollo.io/api/v1/people/match", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Api-Key": process.env.APOLLO_API_KEY },
            body: JSON.stringify({ id: p.id }),
          });
          const d = await r.json();
          const ep = d.person || {};
          const org = ep.organization || p.organization || {};

          const email = ep.email || "";
          if (!email) return null;

          // Tech stack
          const techStack = (org.technology_names || org.technologies || [])
            .map(t => (typeof t === 'string' ? t : t.name || t.category || ''))
            .filter(Boolean).slice(0, 8);

          // Employment history
          const currentJob = (ep.employment_history || []).find(j => j.current) || {};

          // --- FUNDING & GROWTH (Step 2 enrichment) ---
          const funding_stage = org.latest_funding_stage || org.funding_stage || "";
          const funding_total = org.total_funding || org.funding_total || null;

          // Latest funding round date
          const fundingEvents = org.funding_events || org.funding_rounds || [];
          let funding_round_date = null;
          let funding_round_type = null;
          let funding_round_amount = null;
          let top_investors = [];
          if (fundingEvents.length > 0) {
            // Sort by date desc, take most recent
            const sorted = [...fundingEvents].sort((a, b) => new Date(b.date || b.announced_on || 0) - new Date(a.date || a.announced_on || 0));
            const latest = sorted[0];
            funding_round_date = latest.date || latest.announced_on || null;
            funding_round_type = latest.type || latest.round_type || null;
            funding_round_amount = latest.amount || latest.raised_amount || null;
            // Extract investor names
            const investors = latest.investors || latest.lead_investors || [];
            top_investors = investors
              .map(inv => (typeof inv === 'string' ? inv : inv.name || inv.investor_name || ''))
              .filter(Boolean).slice(0, 3);
          }
          // Fallback: Apollo sometimes puts these directly on org
          if (!funding_round_date) funding_round_date = org.latest_funding_round_date || org.last_funding_round_date || null;
          if (!funding_round_type) funding_round_type = org.latest_funding_round_type || null;
          if (top_investors.length === 0 && org.investors) {
            top_investors = (org.investors || []).map(inv => (typeof inv === 'string' ? inv : inv.name || '')).filter(Boolean).slice(0, 3);
          }

          // Growth signals
          const headcount_growth = org.headcount_growth_rate_6_month || org.employee_count_6_month_growth || null;

          // --- INTENT SIGNALS (Step 2) ---
          const linkedin_follower_count = org.linkedin_follower_count || org.linkedin_followers || null;
          const annual_revenue = fmtRevenue(org.annual_revenue_printed || org.annual_revenue || org.estimated_annual_revenue || null);
          const alexa_rank = org.alexa_rank || org.website_rank || null;
          const num_funding_rounds = org.num_funding_rounds || fundingEvents.length || null;

          // Job postings count as hiring signal
          const job_postings_count = org.job_postings_count || org.open_jobs_count || null;

          const lead = {
            id: p.id,
            name: ep.name || p.name || "",
            first_name: ep.first_name || p.first_name || "",
            last_name: ep.last_name || p.last_name || "",
            title: ep.title || p.title || "",
            seniority: ep.seniority || p.seniority || "",
            department: ep.departments?.[0] || ep.department || p.departments?.[0] || "",
            email,
            linkedin_url: ep.linkedin_url || "",
            photo_url: ep.photo_url || "",
            city: ep.city || p.city || "",
            state: ep.state || p.state || "",
            country: ep.country || p.country || "",
            company_name: org.name || p.organization?.name || "",
            company_domain: org.primary_domain || p.organization?.primary_domain || "",
            company_industry: org.industry || p.organization?.industry || "",
            company_size: org.estimated_num_employees || p.organization?.estimated_num_employees || "",
            company_founded: org.founded_year || "",
            company_linkedin: org.linkedin_url || "",
            company_description: (org.short_description || "").slice(0, 160),
            tech_stack: techStack,
            // Funding (existing + new)
            funding_stage,
            funding_total,
            funding_round_date,
            funding_round_type,
            funding_round_amount,
            top_investors,
            num_funding_rounds,
            // Growth
            headcount_growth,
            // Intent signals
            linkedin_follower_count,
            annual_revenue,
            alexa_rank,
            job_postings_count,
            // Keywords & description
            keywords: (org.keywords || []).slice(0, 5),
            employment_start: currentJob.start_date || "",
            time_in_role_months: currentJob.start_date
              ? Math.floor((Date.now() - new Date(currentJob.start_date)) / (1000 * 60 * 60 * 24 * 30))
              : null,
          };
          lead.score = calcLeadScore(lead);
          lead.score_label = scoreLabel(lead.score);
          return lead;
        } catch {
          return null;
        }
      })
    );

    // Sort by score descending
    const results = enriched.filter(Boolean).sort((a, b) => b.score - a.score);
    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
