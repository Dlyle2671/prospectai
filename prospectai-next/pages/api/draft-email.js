// ProspectAI - /api/draft-email
// POST: use Claude to draft a personalized FinOps outreach email

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const body = req.body || {};
  const { name, first_name, title, company_name, company_description, keywords, tech_stack, aws_services, funding_stage, recently_funded, hiring_surge, location } = body;

  if (!name) return res.status(400).json({ error: 'name is required' });

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

  const prompt = `You are a B2B sales expert writing a short, personalized cold outreach email on behalf of RRIL Solutions, a FinOps consulting firm.

LEAD INFORMATION:
Name: ${name}
${contextStr}

OFFER:
RRIL Solutions helps companies reduce their AWS/cloud spend through FinOps best practices - cost visibility, rightsizing, commitment strategies, and governance. We typically save clients 20-40% on their cloud bills within 90 days.

TONE: Casual and direct. No fluff. No corporate speak. Sound like a real person who did their homework.

RULES:
- Subject line: short, specific, references something real about them or their company
- Body: 3-4 short paragraphs max
- First line: a specific, personalized observation about their company/role/stack (NOT a generic opener)
- Second paragraph: one concrete pain point they likely have based on their profile
- Third paragraph: very brief mention of what RRIL does and a specific result (e.g. "saved [similar company type] 30% in 60 days")
- CTA: one clear ask - reply to schedule a 15-min call. Keep it low pressure.
- NO sign-off name - leave that blank, just end with the CTA
- Do NOT use phrases like "I hope this email finds you well", "I wanted to reach out", "synergy", "leverage", "touch base"

Return ONLY valid JSON in this exact format, nothing else:
{
  "subject": "subject line here",
  "body": "full email body here with \\n for line breaks"
}`;

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

    if (!resp.ok) {
      return res.status(resp.status).json({ error: data.error?.message || 'Claude API error' });
    }

    const text = data.content?.[0]?.text || '';
    console.log('[draft-email] raw response:', text.slice(0, 200));

    // Parse JSON from Claude response
    let parsed;
    try {
      // Strip markdown code fences if present
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('[draft-email] JSON parse error:', e.message, 'raw:', text.slice(0, 300));
      return res.status(500).json({ error: 'Failed to parse Claude response', raw: text.slice(0, 500) });
    }

    if (!parsed.subject || !parsed.body) {
      return res.status(500).json({ error: 'Claude returned incomplete response', raw: text.slice(0, 500) });
    }

    return res.status(200).json({ subject: parsed.subject, body: parsed.body });
  } catch (err) {
    console.error('[draft-email] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
