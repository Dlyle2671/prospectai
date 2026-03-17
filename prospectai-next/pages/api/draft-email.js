// ProspectAI - /api/draft-email
// POST: use Claude to draft a personalized FinOps outreach email
// Falls back to smart template if Claude credits are exhausted

function buildTemplateDraft(body) {
  const { name, first_name, title, company_name, tech_stack, aws_services, keywords, recently_funded, hiring_surge, funding_stage } = body;
  const fn = first_name || (name || '').split(' ')[0] || 'there';
  const co = company_name || 'your company';
  const role = title || 'your role';

  // Pick personalization hook
  let hook = '';
  if (aws_services && aws_services.length > 0) {
    hook = 'Noticed ' + co + ' is running ' + aws_services.slice(0, 2).join(' and ') + ' on AWS';
  } else if (tech_stack && tech_stack.includes('AWS')) {
    hook = 'Noticed ' + co + ' is on AWS';
  } else if (recently_funded) {
    hook = 'Congrats on the recent funding round at ' + co;
  } else if (hiring_surge) {
    hook = 'Saw ' + co + ' is scaling the team';
  } else {
    hook = 'Been looking at ' + co + ' and the work you all are doing';
  }

  // Pain point based on signals
  let pain = '';
  if (aws_services && aws_services.length > 0) {
    pain = 'As you scale those services, AWS spend tends to creep up fast - often 30-40% higher than it needs to be. Most teams don't have visibility into where the waste is until it shows up as a line item shock.';
  } else if (recently_funded || hiring_surge) {
    pain = 'With growth comes cloud spend that can get away from you quickly. Most scaling companies find 20-35% of their AWS bill is avoidable waste they just haven't had time to track down.';
  } else {
    pain = 'Most engineering-focused companies have cloud spend that's grown faster than their visibility into it. We typically find 20-40% in recoverable savings in the first 30 days.';
  }

  const subject = hook.length < 60 ? hook : 'Quick question about ' + co + ''s cloud spend';

  const emailBody = fn + ',\n\n' +
    hook + ' - wanted to reach out.\n\n' +
    pain + '\n\n' +
    'At RRIL Solutions, we specialize in FinOps for AWS-heavy companies. We've helped similar teams cut their cloud bills 20-40% within 90 days through rightsizing, commitment strategies, and spend governance - without slowing down engineering.\n\n' +
    'Worth a 15-min call to see if there's a fit? No pitch deck, just a straight conversation.';

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
  const { name, first_name, title, company_name, company_description, keywords, tech_stack, aws_services, funding_stage, recently_funded, hiring_surge, location } = body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  // If no API key, use template fallback
  if (!apiKey) {
    console.log('[draft-email] no API key - using template fallback');
    return res.status(200).json(buildTemplateDraft(body));
  }

  // Build context for Claude
  const contextLines = [];
  if (title) contextLines.push('Title: ' + title);
  if (company_name) contextLines.push('Company: ' + company_name);
  if (location) contextLines.push('Location: ' + location);
  if (company_description) contextLines.push('About the company: ' + company_description);
  if (tech_stack && tech_stack.length > 0) contextLines.push('Tech stack: ' + tech_stack.slice(0, 8).join(', '));
  if (aws_services && aws_services.length > 0) contextLines.push('AWS services in use: ' + aws_services.join(', '));
  if (keywords && keywords.length > 0) contextLines.push('Keywords/interests: ' + keywords.slice(0, 6).join(', '));
  if (funding_stage) contextLines.push('Funding stage: ' + funding_stage);
  if (recently_funded) contextLines.push('Recently funded: yes');
  if (hiring_surge) contextLines.push('Hiring surge detected: yes');
  const contextStr = contextLines.join('\n');

  const prompt = 'You are a B2B sales expert writing a short, personalized cold outreach email on behalf of RRIL Solutions, a FinOps consulting firm.\n\nLEAD INFORMATION:\nName: ' + name + '\n' + contextStr + '\n\nOFFER: RRIL Solutions helps companies reduce their AWS/cloud spend through FinOps best practices - cost visibility, rightsizing, commitment strategies, and governance. We typically save clients 20-40% on their cloud bills within 90 days.\n\nTONE: Casual and direct. No fluff. No corporate speak. Sound like a real person who did their homework.\n\nRULES:\n- Subject line: short, specific, references something real about them or their company\n- Body: 3-4 short paragraphs max\n- First line: a specific, personalized observation about their company/role/stack (NOT a generic opener)\n- Second paragraph: one concrete pain point they likely have based on their profile\n- Third paragraph: very brief mention of what RRIL does and a specific result (e.g. "saved [similar company type] 30% in 60 days")\n- CTA: one clear ask - reply to schedule a 15-min call. Keep it low pressure.\n- NO sign-off name - leave that blank, just end with the CTA\n- Do NOT use phrases like "I hope this email finds you well", "I wanted to reach out", "synergy", "leverage", "touch base"\n\nReturn ONLY valid JSON in this exact format, nothing else:\n{ "subject": "subject line here", "body": "full email body here with \\n for line breaks" }';

  try {
    console.log('[draft-email] calling Claude for:', name, company_name);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await resp.json();
    console.log('[draft-email] Claude status:', resp.status);

    // Handle credit/billing errors - fall back to template
    if (!resp.ok) {
      const errMsg = data.error?.message || '';
      const errType = data.error?.type || '';
      console.log('[draft-email] Claude error type:', errType, 'msg:', errMsg.slice(0, 100));

      // Fall back to template for credit/billing issues
      if (errType === 'credit_balance_too_low' || errMsg.toLowerCase().includes('credit') || errMsg.toLowerCase().includes('billing') || resp.status === 529) {
        console.log('[draft-email] credits exhausted - using template fallback');
        return res.status(200).json(buildTemplateDraft(body));
      }

      return res.status(resp.status).json({ error: errMsg || 'Claude API error' });
    }

    const text = data.content?.[0]?.text || '';
    console.log('[draft-email] raw response:', text.slice(0, 200));

    // Parse JSON from Claude response
    let parsed;
    try {
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('[draft-email] JSON parse error:', e.message, 'raw:', text.slice(0, 300));
      // Fall back to template on parse failure too
      console.log('[draft-email] parse failed - using template fallback');
      return res.status(200).json(buildTemplateDraft(body));
    }

    if (!parsed.subject || !parsed.body) {
      console.log('[draft-email] incomplete response - using template fallback');
      return res.status(200).json(buildTemplateDraft(body));
    }

    return res.status(200).json({ subject: parsed.subject, body: parsed.body });

  } catch (err) {
    console.error('[draft-email] error:', err.message);
    // Fall back to template on network/other errors
    console.log('[draft-email] exception - using template fallback');
    return res.status(200).json(buildTemplateDraft(body));
  }
}
