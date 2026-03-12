// Lead scoring weights
const SENIORITY_SCORE = {
    'c_suite': 40, 'founder': 40, 'vp': 35, 'head': 30,
    'director': 25, 'manager': 15, 'senior': 10, 'entry': 5
};

const TITLE_SCORE = {
    'ceo': 40, 'cto': 38, 'coo': 35, 'cfo': 32, 'cmo': 30,
    'founder': 40, 'co-founder': 40,
    'vp of engineering': 35, 'vp of sales': 33, 'vp of marketing': 30,
    'vp of product': 30, 'vp': 28,
    'director of engineering': 28, 'director of sales': 26,
    'director of marketing': 24, 'director': 22,
    'head of engineering': 26, 'head of growth': 24,
    'head of product': 24, 'head': 20,
    'manager': 12, 'account executive': 8, 'senior': 8
};

const SIZE_SCORE = {
    '1,10': 5, '11,50': 12, '51,200': 22, '201,500': 30,
    '501,1000': 35, '1001,5000': 38, '5001,10000000': 25
};

const HIGH_VALUE_INDUSTRIES = [
    'technology', 'software', 'saas', 'cloud computing', 'cybersecurity',
    'fintech', 'financial services', 'healthcare', 'biotech'
  ];

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
    if (HIGH_VALUE_INDUSTRIES.some(i => indLower.includes(i))) score += 20;
    else score += 5;

  // Has LinkedIn (2pts)
  if (lead.linkedin_url) score += 2;

  // Cap at 100
  return Math.min(100, Math.round(score));
}

function scoreLabel(score) {
    if (score >= 75) return 'hot';
    if (score >= 50) return 'warm';
    return 'cold';
}

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
        const {
                industry = [], employee_ranges = [], tech_stack = [],
                titles = [], page = 1, per_page = 25
        } = req.body;

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
                const map = {
                          "1,10": "1,10", "11,50": "11,50", "51,200": "51,200",
                          "201,500": "201,500", "501,1000": "501,1000",
                          "1001,5000": "1001,5000", "5001,10000000": "5001,10000000"
                };
                const ranges = employee_ranges.map(r => map[r]).filter(Boolean);
                if (ranges.length > 0) body.organization_num_employees_ranges = ranges;
        }

      const searchResp = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
              method: "POST",
              headers: {
                        "Content-Type": "application/json",
                        "Cache-Control": "no-cache",
                        "X-Api-Key": process.env.APOLLO_API_KEY
              },
              body: JSON.stringify(body),
      });

      const searchData = await searchResp.json();
        if (!searchResp.ok) {
                return res.status(searchResp.status).json({
                          error: searchData.message || searchData.error || JSON.stringify(searchData)
                });
        }

      const candidates = (searchData.people || []).filter(p => p.has_email);
        if (candidates.length === 0) return res.status(200).json([]);

      // Enrich each candidate via people/match to get full profile
      const enriched = await Promise.all(
              candidates.map(async (p) => {
                        try {
                                    const r = await fetch("https://api.apollo.io/api/v1/people/match", {
                                                  method: "POST",
                                                  headers: {
                                                                  "Content-Type": "application/json",
                                                                  "X-Api-Key": process.env.APOLLO_API_KEY
                                                  },
                                                  body: JSON.stringify({ id: p.id }),
                                    });
                                    const d = await r.json();
                                    const ep = d.person || {};
                                    const org = ep.organization || p.organization || {};

                          const email = ep.email || "";
                                    if (!email) return null;

                          // Pull all available tech stack from org
                          const techStack = (org.technology_names || org.technologies || [])
                                      .map(t => (typeof t === 'string' ? t : t.name || t.category || ''))
                                      .filter(Boolean)
                                      .slice(0, 8);

                          // Employment history snippet
                          const currentJob = (ep.employment_history || []).find(j => j.current) || {};

                          // Funding info from org
                          const funding = org.latest_funding_stage || org.funding_stage || "";
                                    const fundingAmt = org.total_funding || org.funding_total || null;

                          // Growth signals
                          const headcountGrowth = org.headcount_growth_rate_6_month
                                      || org.employee_count_6_month_growth
                                      || null;

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
                                        funding_stage: funding,
                                        funding_total: fundingAmt,
                                        headcount_growth: headcountGrowth,
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
      const results = enriched
          .filter(Boolean)
          .sort((a, b) => b.score - a.score);

      return res.status(200).json(results);
  } catch (err) {
        return res.status(500).json({ error: err.message });
  }
}
