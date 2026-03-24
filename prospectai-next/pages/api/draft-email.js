// ProspectAI — /api/draft-email
// POST: use Claude to draft a personalized FinOps outreach email
// Falls back to smart template if Claude credits are exhausted

function fmtTimeInRole(months) {
  if (!months || months < 1) return null;
  if (months < 12) return months + ' months';
  const yrs = Math.floor(months / 12);
  const mo = months % 12;
  return mo > 0 ? yrs + ' year' + (yrs > 1 ? 's' : '') + ' ' + mo + ' months' : yrs + ' year' + (yrs > 1 ? 's' : '');
}

function fmtRevenue(r) {
  if (!r) return null;
  if (typeof r === 'string') return r;
  const n = Number(r);
  if (isNaN(n) || n <= 0) return null;
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M';
  return '$' + n;
}

function fmtFundingAmt(a) {
  if (!a) return null;
  const n = Number(a);
  if (isNaN(n) || n <= 0) return null;
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M';
  if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
  return '$' + n;
}

function pickBestHook(body) {
  const { first_name, name, company_name, aws_services, tech_stack, recently_funded, hiring_surge,
    funding_stage, funding_round_amount, top_investors, headcount_growth, time_in_role_months, prev_jobs } = body;
  const co = company_name || 'your company';
  const fn = first_name || (name || '').split(' ')[0] || 'there';
  if (recently_funded && funding_round_amount && top_investors && top_investors.length > 0) {
    const amt = fmtFundingAmt(funding_round_amount);
    const stage = funding_stage ? funding_stage + ' ' : '';
    return { hook: 'Saw ' + co + ' just closed a ' + stage + (amt ? amt + ' round' : 'round') + ' led by ' + top_investors[0] + ' — congrats', tier: 'funding_rich' };
  }
  if (recently_funded && funding_round_amount) {
    const amt = fmtFundingAmt(funding_round_amount);
    const stage = funding_stage ? funding_stage + ' ' : '';
    return { hook: 'Congrats on the ' + stage + (amt ? amt + ' round' : 'funding round') + ' at ' + co, tier: 'funding' };
  }
  if (recently_funded && funding_stage) {
    return { hook: 'Congrats on the ' + funding_stage + ' at ' + co, tier: 'funding' };
  }
  if (aws_services && aws_services.length >= 2) {
    return { hook: 'Noticed ' + co + ' is running ' + aws_services.slice(0, 2).join(' and ') + ' on AWS', tier: 'aws' };
  }
  if (aws_services && aws_services.length === 1) {
    return { hook: 'Noticed ' + co + ' is on ' + aws_services[0], tier: 'aws' };
  }
  if (hiring_surge && headcount_growth) {
    const pct = Math.round(Number(headcount_growth) * 100);
    if (!isNaN(pct) && pct > 0) return { hook: 'Saw ' + co + ' grew headcount ' + pct + '% in the last 6 months', tier: 'hiring' };
  }
  if (hiring_surge) return { hook: 'Saw ' + co + ' is scaling the team aggressively right now', tier: 'hiring' };
  if (time_in_role_months && time_in_role_months < 9) {
    const t = fmtTimeInRole(time_in_role_months) || 'recently';
    return { hook: fn + ', you joined ' + co + ' ' + t + ' ago — figured this might be good timing', tier: 'new_role' };
  }
  if (prev_jobs && prev_jobs.length > 0 && prev_jobs[0].company) {
    return { hook: 'Noticed your background at ' + prev_jobs[0].company + ' before ' + co, tier: 'background' };
  }
  if (tech_stack && tech_stack.includes('AWS')) return { hook: 'Noticed ' + co + ' is on AWS', tier: 'aws' };
  return { hook: 'Been looking into ' + co + ' and the work you all are doing', tier: 'generic' };
}

function buildPainPoint(hook, body) {
  const { seniority, title, aws_services } = body;
  const isExec = ['c_suite','founder','vp'].includes((seniority || '').toLowerCase()) || /(ceo|cto|cfo|coo|cmo|vp|founder)/i.test(title || '');
  switch (hook.tier) {
    case 'funding_rich':
    case 'funding':
      return isExec
        ? 'With fresh capital in the bank, cloud spend tends to accelerate fast. Most series-stage companies we talk to are running 25-40% more AWS than they need to — and it usually shows up as a nasty surprise on the next board deck.'
        : 'Post-raise is usually when AWS spend starts compounding quietly. Engineering ships fast, infra grows, and by the time anyone looks the bill is 2x what it was at close.';
    case 'aws':
      if (aws_services && aws_services.length >= 3) {
        return 'With ' + aws_services.length + ' AWS services in the stack, spend tends to spread across a lot of line items. Most teams we talk to find 18-30% in recoverable savings from rightsizing and commitment coverage.';
      }
      return 'AWS bills have a way of growing faster than the engineering that drives them. Most companies we work with find 18-30% in recoverable savings from rightsizing and commitment coverage — without touching architecture.';
    case 'hiring':
      return 'Rapid hiring usually means rapid infra growth too. Cloud spend tends to scale with headcount, but the efficiency does not — most scaling teams end up with over-provisioned resources and unused reservations by the time anyone audits it.';
    case 'new_role':
      return 'New leaders often inherit cloud bills that grew without much governance. It is one of the faster wins to show early — most teams find 18-30% in savings within the first 30 days of a proper audit.';
    default:
      return 'Most engineering-driven companies have AWS spend that has grown faster than their visibility into it. The Altus Cloud AWS FinOps Program typically uncovers 18-30% in recoverable savings in the first 30 days.';
  }
}

// Subject line template library keyed by hook tier
// Pick one at random so each lead gets variety
const SUBJECT_TEMPLATES = {
  funding_rich: [
    function(co, amt) { return 'Protecting runway at ' + co; },
    function(co, amt) { return amt ? amt + ' raise → cutting AWS costs next?' : 'Fresh capital → cutting AWS costs next?'; },
    function(co, amt) { return 'Post-raise cloud efficiency at ' + co; },
    function(co, amt) { return 'Quick question for ' + co + ' post-raise'; }
  ],
  funding: [
    function(co, amt) { return 'Protecting runway at ' + co; },
    function(co, amt) { return 'Fresh capital — is AWS spend under control?'; },
    function(co, amt) { return co + ' + AWS savings — quick thought'; },
    function(co, amt) { return 'Post-raise, is cloud spend a priority?'; }
  ],
  aws: [
    function(co) { return 'Are you leaving 18-30% on the table?'; },
    function(co) { return co + 's AWS bill — quick thought'; },
    function(co) { return 'Cutting ' + co + 's cloud spend by 18-30%'; },
    function(co) { return 'Free AWS savings assessment for ' + co; }
  ],
  hiring: [
    function(co) { return 'Scaling fast — is AWS keeping pace?'; },
    function(co) { return co + ' growth + cloud costs — a thought'; },
    function(co) { return 'Headcount up. AWS bill too?'; },
    function(co) { return 'Rapid growth → hidden cloud costs at ' + co; }
  ],
  new_role: [
    function(co, fn) { return fn + ', quick win for your first 30 days'; },
    function(co, fn) { return 'New role at ' + co + ' — low-hanging fruit?'; },
    function(co, fn) { return 'Fast cloud savings win at ' + co; },
    function(co, fn) { return fn + ', inherit any AWS bloat at ' + co + '?'; }
  ],
  background: [
    function(co) { return 'Quick question about ' + co + 's AWS spend'; },
    function(co) { return '18-30% AWS savings — worth 15 min?'; },
    function(co) { return 'Free optimization assessment for ' + co; },
    function(co) { return 'Cutting cloud costs at ' + co; }
  ],
  generic: [
    function(co) { return 'Are you leaving money on the table with AWS?'; },
    function(co) { return 'Quick question about ' + co + 's cloud bill'; },
    function(co) { return '18-30% AWS savings — free assessment'; },
    function(co) { return 'Free AWS optimization for ' + co; }
  ]
};

function pickSubject(tier, body) {
  const co = body.company_name || 'your company';
  const fn = body.first_name || (body.name || '').split(' ')[0] || 'there';
  const amt = body.funding_round_amount ? fmtFundingAmt(body.funding_round_amount) : null;
  const templates = SUBJECT_TEMPLATES[tier] || SUBJECT_TEMPLATES.generic;
  const idx = Math.floor(Math.random() * templates.length);
  return templates[idx](co, amt || fn);
}

const PROGRAM_BULLETS = [
  '- You receive a discount on your AWS bill',
  '- 100% funded by AWS — no cost to you',
  '- No long-term contracts or commitments',
  '- Does not change your relationship with AWS',
  '- Requires no changes to your existing infrastructure'
].join('\n');

function buildTemplateDraft(body) {
  const { first_name, name, company_name } = body;
  const fn = first_name || (name || '').split(' ')[0] || 'there';
  const co = company_name || 'your company';
  const { hook, tier } = pickBestHook(body);
  const pain = buildPainPoint({ tier }, body);
  const subject = pickSubject(tier, body);
  const emailBody = [
    fn + ',',
    '',
    hook + ' — wanted to reach out.',
    '',
    pain,
    '',
    'At RRIL Solutions we run a free optimization assessment for AWS customers. Most teams uncover 18-30% in savings within the first 30 days — through rightsizing, commitment strategies, and spend governance.',
    '',
    'Benefits of the Altus Cloud AWS FinOps Program:',
    PROGRAM_BULLETS,
    '',
    'Worth a quick call to see if there is a fit? I can have a free optimization assessment scheduled for you this week.',
  ].join('\n');
  return { subject, body: emailBody };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const body = req.body || {};
  const {
    name, first_name, title, seniority, company_name, company_description, keywords, tech_stack,
    aws_services, funding_stage, recently_funded, hiring_surge, location,
    time_in_role_months, prev_jobs, headcount_growth, annual_revenue,
    funding_round_amount, top_investors, company_founded, intent_signals
  } = body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  if (!apiKey) {
    console.log('[draft-email] no API key');
    return res.status(200).json(buildTemplateDraft(body));
  }

  const { hook: bestHook, tier: hookTier } = pickBestHook(body);
  const suggestedPain = buildPainPoint({ tier: hookTier }, body);
  const suggestedSubject = pickSubject(hookTier, body);

  const ctx = [];
  if (title) ctx.push('Title: ' + title);
  if (seniority) ctx.push('Seniority: ' + seniority);
  if (company_name) ctx.push('Company: ' + company_name);
  if (location) ctx.push('Location: ' + location);
  if (company_description) ctx.push('About: ' + company_description);
  if (company_founded) ctx.push('Founded: ' + company_founded);
  if (annual_revenue) ctx.push('Revenue: ' + (fmtRevenue(annual_revenue) || annual_revenue));
  if (aws_services && aws_services.length > 0) ctx.push('AWS services: ' + aws_services.join(', '));
  if (tech_stack && tech_stack.length > 0) ctx.push('Tech stack: ' + tech_stack.slice(0, 6).join(', '));
  if (recently_funded) ctx.push('Recently funded: yes');
  if (funding_stage) ctx.push('Funding stage: ' + funding_stage);
  if (funding_round_amount) ctx.push('Round size: ' + (fmtFundingAmt(funding_round_amount) || funding_round_amount));
  if (top_investors && top_investors.length > 0) ctx.push('Investors: ' + top_investors.join(', '));
  if (hiring_surge) ctx.push('Hiring surge: yes');
  if (headcount_growth) {
    const pct = Math.round(Number(headcount_growth) * 100);
    if (!isNaN(pct)) ctx.push('Headcount growth 6mo: ' + (pct >= 0 ? '+' : '') + pct + '%');
  }
  if (time_in_role_months) {
    const t = fmtTimeInRole(time_in_role_months);
    if (t) ctx.push('Time in role: ' + t);
  }
  if (prev_jobs && prev_jobs.length > 0) {
    const jobs = prev_jobs.slice(0, 2).map(function(j) { return j.title ? j.title + ' @ ' + j.company : j.company; }).filter(Boolean);
    if (jobs.length) ctx.push('Previous roles: ' + jobs.join(', '));
  }
  if (intent_signals && intent_signals.length > 0) ctx.push('Intent signals: ' + intent_signals.map(function(s) { return s.label; }).join(', '));
  if (keywords && keywords.length > 0) ctx.push('Keywords: ' + keywords.slice(0, 5).join(', '));
  const contextStr = ctx.join('\n');

  const programInfo = [
    'PROGRAM DETAILS (label as "Benefits of the Altus Cloud AWS FinOps Program" in the email):',
    '- Prospect receives a discount on their AWS bill',
    '- 100% funded by AWS, no cost to the prospect',
    '- No long-term contracts or commitments',
    '- Does not change their relationship with AWS',
    '- Requires no changes to existing infrastructure',
  ].join('\n');

  const subjectExamples = [
    'SUBJECT LINE STYLE GUIDE (pick the best fit, do not copy verbatim):',
    '- Curiosity: "Are you leaving 18-30% on the table?" or "Scaling fast — is AWS keeping pace?"',
    '- Specific + personal: "Protecting runway at [Company]" or "[Name], quick win for your first 30 days"',
    '- Direct value: "Free AWS optimization for [Company]" or "Cutting [Company] cloud spend 18-30%"',
    '- Suggested subject (use or improve): ' + suggestedSubject,
  ].join('\n');

  const prompt = [
    'You are a B2B sales expert writing a short, personalized cold outreach email for RRIL Solutions, a FinOps firm that cuts AWS spend.',
    '',
    'LEAD:',
    'Name: ' + name,
    contextStr,
    '',
    'BEST HOOK: ' + bestHook,
    'PAIN ANGLE: ' + suggestedPain,
    '',
    subjectExamples,
    '',
    programInfo,
    '',
    'OFFER: RRIL runs a free optimization assessment. Average savings are 18-30% on AWS bills within 30 days.',
    '',
    'RULES:',
    '- Subject: max 8 words, punchy and curiosity-driven, personalized to this lead, do NOT just restate the hook',
    '- Open with the BEST HOOK above',
    '- Para 2: specific pain point (2-3 sentences)',
    '- Para 3: header "Benefits of the Altus Cloud AWS FinOps Program:" then list all 5 program details as bullet points',
    '- CTA: offer a free optimization assessment (not a generic call)',
    '- Savings: always say 18-30%, timeframe always 30 days',
    '- No sign-off. No buzzwords. Max 180 words in body.',
    '',
    'Return ONLY JSON: { "subject": "...", "body": "... use \\n for line breaks" }',
  ].join('\n');

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      const errMsg = (data.error && data.error.message) || '';
      const errType = (data.error && data.error.type) || '';
      if (errType === 'credit_balance_too_low' || errMsg.toLowerCase().includes('credit') || resp.status === 529) {
        return res.status(200).json(buildTemplateDraft(body));
      }
      return res.status(resp.status).json({ error: errMsg || 'Claude API error' });
    }
    const text = (data.content && data.content[0] && data.content[0].text) || '';
    let parsed;
    try {
      const cleaned = text.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(200).json(buildTemplateDraft(body));
    }
    if (!parsed.subject || !parsed.body) return res.status(200).json(buildTemplateDraft(body));
    return res.status(200).json({ subject: parsed.subject, body: parsed.body });
  } catch (err) {
    console.error('[draft-email] error:', err.message);
    return res.status(200).json(buildTemplateDraft(body));
  }
}
