// ProspectAI — /api/draft-email
// POST: use Claude to draft a personalized FinOps outreach email
// Falls back to smart template if Claude credits are exhausted

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Pick the single best hook from available signals ─────────────────────────

function pickBestHook(body) {
  const {
    first_name, name, company_name, title, seniority,
    aws_services, tech_stack, recently_funded, hiring_surge,
    funding_stage, funding_round_amount, top_investors,
    headcount_growth, time_in_role_months, prev_jobs,
    annual_revenue, company_founded, location,
  } = body;

  const co = company_name || 'your company';
  const fn = first_name || (name || '').split(' ')[0] || 'there';

  // Priority order: most specific / verifiable signals first
  // 1. Specific funding with amount + investor
  if (recently_funded && funding_round_amount && top_investors && top_investors.length > 0) {
    const amt = fmtFundingAmt(funding_round_amount);
    const stage = funding_stage ? funding_stage + ' ' : '';
    return { hook: 'Saw ' + co + ' just closed a ' + stage + (amt ? amt + ' round' : 'round') + ' led by ' + top_investors[0] + ' — congrats', tier: 'funding_rich' };
  }
  // 2. Funding with amount only
  if (recently_funded && funding_round_amount) {
    const amt = fmtFundingAmt(funding_round_amount);
    const stage = funding_stage ? funding_stage + ' ' : '';
    return { hook: 'Congrats on the ' + stage + (amt ? amt + ' round' : 'funding round') + ' at ' + co, tier: 'funding' };
  }
  // 3. Funding stage only
  if (recently_funded && funding_stage) {
    return { hook: 'Congrats on the ' + funding_stage + ' at ' + co, tier: 'funding' };
  }
  // 4. Specific AWS services
  if (aws_services && aws_services.length >= 2) {
    const svcs = aws_services.slice(0, 2).join(' and ');
    return { hook: 'Noticed ' + co + ' is running ' + svcs + ' on AWS', tier: 'aws' };
  }
  if (aws_services && aws_services.length === 1) {
    return { hook: 'Noticed ' + co + ' is on ' + aws_services[0], tier: 'aws' };
  }
  // 5. Strong headcount growth with number
  if (hiring_surge && headcount_growth) {
    const pct = Math.round(Number(headcount_growth) * 100);
    if (!isNaN(pct) && pct > 0) {
      return { hook: 'Saw ' + co + ' grew headcount ' + pct + '% in the last 6 months', tier: 'hiring' };
    }
  }
  // 6. Hiring surge (no number)
  if (hiring_surge) {
    return { hook: 'Saw ' + co + ' is scaling the team pretty aggressively right now', tier: 'hiring' };
  }
  // 7. New in role (great opener — new leaders often shake things up)
  if (time_in_role_months && time_in_role_months < 9) {
    const t = fmtTimeInRole(time_in_role_months) || 'recently';
    return { hook: fn + ', you joined ' + co + ' ' + t + ' ago — figured this might be good timing', tier: 'new_role' };
  }
  // 8. Previous company (warm reference)
  if (prev_jobs && prev_jobs.length > 0 && prev_jobs[0].company) {
    return { hook: 'Noticed your background at ' + prev_jobs[0].company + ' before ' + co, tier: 'background' };
  }
  // 9. AWS tech stack fallback
  if (tech_stack && tech_stack.includes('AWS')) {
    return { hook: 'Noticed ' + co + ' is on AWS', tier: 'aws' };
  }
  // 10. Generic
  return { hook: 'Been looking into ' + co + ' and the work you all are doing', tier: 'generic' };
}

// ─── Pain point keyed to signal tier + seniority ─────────────────────────────

function buildPainPoint(hook, body) {
  const { seniority, title, aws_services, annual_revenue, time_in_role_months } = body;
  const isExec = ['c_suite', 'founder', 'vp'].includes((seniority || '').toLowerCase()) ||
    /(ceo|cto|cfo|coo|cmo|vp|founder)/i.test(title || '');

  switch (hook.tier) {
    case 'funding_rich':
    case 'funding':
      return isExec
        ? 'With fresh capital in the bank, cloud spend tends to accelerate fast. Most series-stage companies we talk to are running 25-40% more AWS than they need to — and it usually shows up as a nasty surprise on the next board deck.'
        : 'Post-raise is usually when AWS spend starts compounding quietly. Engineering ships fast, infra grows, and by the time anyone looks the bill is 2x what it was at close.';
    case 'aws':
      if (aws_services && aws_services.length >= 3) {
        return 'With ' + aws_services.length + ' AWS services in the stack, spend tends to spread across a lot of line items — reserved instance coverage, idle resources, oversized RDS, S3 lifecycle gaps. Most teams we talk to are leaving 20-35% on the table just from lack of visibility.';
      }
      return 'AWS bills have a way of growing faster than the engineering that drives them. Most companies we work with find 20-40% recoverable savings just from rightsizing and commitment coverage — without touching architecture.';
    case 'hiring':
      return 'Rapid hiring usually means rapid infra growth too. Cloud spend tends to scale with headcount, but the efficiency doesn't — most scaling teams end up with a lot of over-provisioned resources and unused reservations by the time anyone audits it.';
    case 'new_role':
      return 'New leaders often inherit cloud bills that grew organically without much governance. It's one of the faster wins to show early — most teams find 20-35% in savings within the first 60 days of a proper audit.';
    case 'background':
      return 'Companies at ' + (body.company_name || 'your stage') + ''s stage almost always have cloud spend that's outpaced their visibility into it. We typically find 20-40% in recoverable savings in the first 30 days.';
    default:
      return 'Most engineering-driven companies have AWS spend that's grown faster than their visibility into it. We typically find 20-40% in recoverable savings in the first 30 days — rightsizing, commitment coverage, governance basics.';
  }
}

// ─── Template fallback (no Claude) ───────────────────────────────────────────

function buildTemplateDraft(body) {
  const { first_name, name, company_name } = body;
  const fn = first_name || (name || '').split(' ')[0] || 'there';
  const co = company_name || 'your company';

  const { hook, tier } = pickBestHook(body);
  const pain = buildPainPoint({ tier }, body);

  const subject = hook.length <= 60 ? hook : 'Quick question about ' + co + ''s cloud spend';
  const emailBody =
    fn + ',\n\n' +
    hook + ' — wanted to reach out.\n\n' +
    pain + '\n\n' +
    'At RRIL Solutions we specialize in FinOps for AWS-heavy companies. We've helped similar teams cut their cloud bills 20-40% within 90 days through rightsizing, commitment strategies, and spend governance — without slowing down engineering.\n\n' +
    'Worth a 15-min call to see if there's a fit? No pitch deck, just a straight conversation.';

  return { subject, body: emailBody };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const body = req.body || {};

  const {
    name, first_name, title, seniority, company_name, company_description,
    keywords, tech_stack, aws_services, funding_stage, recently_funded,
    hiring_surge, location,
    // new rich fields
    time_in_role_months, prev_jobs, headcount_growth, annual_revenue,
    funding_round_amount, top_investors, company_founded, intent_signals,
  } = body;

  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!apiKey) {
    console.log('[draft-email] no API key — using template fallback');
    return res.status(200).json(buildTemplateDraft(body));
  }

  // ── Pick best hook for the prompt ──────────────────────────────────────────
  const { hook: bestHook, tier: hookTier } = pickBestHook(body);
  const suggestedPain = buildPainPoint({ tier: hookTier }, body);

  // ── Build context block ────────────────────────────────────────────────────
  const ctx = [];
  if (title)               ctx.push('Title: ' + title);
  if (seniority)           ctx.push('Seniority: ' + seniority);
  if (company_name)        ctx.push('Company: ' + company_name);
  if (location)            ctx.push('Location: ' + location);
  if (company_description) ctx.push('About the company: ' + company_description);
  if (company_founded)     ctx.push('Founded: ' + company_founded);
  if (annual_revenue)      ctx.push('Est. annual revenue: ' + (fmtRevenue(annual_revenue) || annual_revenue));

  if (aws_services && aws_services.length > 0)
    ctx.push('AWS services in use: ' + aws_services.join(', '));
  if (tech_stack && tech_stack.length > 0)
    ctx.push('Other tech stack: ' + tech_stack.slice(0, 6).join(', '));

  if (recently_funded)         ctx.push('Recently funded: yes');
  if (funding_stage)           ctx.push('Funding stage: ' + funding_stage);
  if (funding_round_amount)    ctx.push('Round size: ' + (fmtFundingAmt(funding_round_amount) || funding_round_amount));
  if (top_investors && top_investors.length > 0)
    ctx.push('Lead investors: ' + top_investors.join(', '));

  if (hiring_surge)            ctx.push('Hiring surge: yes');
  if (headcount_growth) {
    const pct = Math.round(Number(headcount_growth) * 100);
    if (!isNaN(pct)) ctx.push('Headcount growth (6mo): ' + (pct >= 0 ? '+' : '') + pct + '%');
  }

  if (time_in_role_months) {
    const t = fmtTimeInRole(time_in_role_months);
    if (t) ctx.push('Time in current role: ' + t);
  }
  if (prev_jobs && prev_jobs.length > 0) {
    const jobs = prev_jobs.slice(0, 2).map(j => j.title ? j.title + ' @ ' + j.company : j.company).filter(Boolean);
    if (jobs.length) ctx.push('Previous roles: ' + jobs.join(', '));
  }

  if (intent_signals && intent_signals.length > 0)
    ctx.push('Intent signals: ' + intent_signals.map(s => s.label).join(', '));
  if (keywords && keywords.length > 0)
    ctx.push('Company keywords: ' + keywords.slice(0, 5).join(', '));

  const contextStr = ctx.join('\n');

  // ── Build prompt ───────────────────────────────────────────────────────────
  const prompt = `You are a B2B sales expert writing a short, highly personalized cold outreach email for RRIL Solutions, a FinOps consulting firm that helps companies reduce their AWS cloud spend.

LEAD INFORMATION:
Name: ${name}
${contextStr}

STRONGEST HOOK TO LEAD WITH: ${bestHook}
SUGGESTED PAIN POINT: ${suggestedPain}

OFFER: RRIL Solutions saves clients 20-40% on AWS bills within 90 days through rightsizing, commitment strategies, cost visibility, and governance — without slowing down engineering.

TONE: Direct, casual, peer-to-peer. Sound like a real person, not a BDR reading from a script. No corporate buzzwords.

RULES:
- Subject line: short and specific (under 8 words). Reference something real about the person or company — not a generic "quick question".
- First line: open with the STRONGEST HOOK provided. Make it feel like you actually looked at their company.
- If they are new in role: acknowledge it — new leaders often look for early wins.
- If they have specific AWS services: name them in the opening, it shows you did homework.
- If funded recently: reference the round specifically (stage + amount if known).
- If headcount is growing fast: acknowledge the growth and tie it to cloud scaling.
- Second paragraph: 2-3 sentences max on the pain point. Be specific, not generic.
- Third paragraph: 1-2 sentences on RRIL — mention a specific result type (not just "we help companies").
- CTA: offer a 15-min call. Keep it low-pressure.
- NO closing name/sign-off.
- DO NOT use: synergy, leverage, touch base, circle back, I hope this finds you well, reach out, at your earliest convenience.
- Max 150 words total in the body.

Return ONLY valid JSON with no markdown:
{ "subject": "subject line here", "body": "email body with \\n for line breaks" }`;

  try {
    console.log('[draft-email] calling Claude for:', name, company_name, '| hook tier:', hookTier);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await resp.json();
    console.log('[draft-email] Claude status:', resp.status);

    if (!resp.ok) {
      const errMsg = (data.error && data.error.message) || '';
      const errType = (data.error && data.error.type) || '';
      console.log('[draft-email] Claude error:', errType, errMsg.slice(0, 100));
      if (errType === 'credit_balance_too_low' || errMsg.toLowerCase().includes('credit') || errMsg.toLowerCase().includes('billing') || resp.status === 529) {
        console.log('[draft-email] credits exhausted — using template fallback');
        return res.status(200).json(buildTemplateDraft(body));
      }
      return res.status(resp.status).json({ error: errMsg || 'Claude API error' });
    }

    const text = (data.content && data.content[0] && data.content[0].text) || '';
    console.log('[draft-email] raw response:', text.slice(0, 200));

    let parsed;
    try {
      const cleaned = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/,'').replace(/^[^{]*/,'').replace(/[^}]*$/,'').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('[draft-email] JSON parse error:', e.message, '| raw:', text.slice(0, 200));
      return res.status(200).json(buildTemplateDraft(body));
    }

    if (!parsed.subject || !parsed.body) {
      return res.status(200).json(buildTemplateDraft(body));
    }

    return res.status(200).json({ subject: parsed.subject, body: parsed.body });
  } catch (err) {
    console.error('[draft-email] error:', err.message);
    return res.status(200).json(buildTemplateDraft(body));
  }
}
