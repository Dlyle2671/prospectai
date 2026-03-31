// ProspectAI — /api/ask-ai
// POST: answer a natural language question about all sales data
// Uses Claude claude-haiku-4-5 with full data context from Redis
import { getAuth } from '@clerk/nextjs/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});
const kvRedis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

async function getUserAnthropicKey(userId) {
  if (!userId) return null;
  try {
    const data = await redis.get('user:' + userId + ':integrations');
    return (data && data.anthropic) || null;
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { question, history } = req.body || {};
  if (!question || !question.trim()) return res.status(400).json({ error: 'question is required' });

  // Load all sales data
  let salesData = { reps: [], deals: [], companyQuotas: { PS: 0, FO: 0, MS: 0 } };
  try {
    const raw = await redis.get('user:' + userId + ':sales_data');
    if (raw) salesData = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (_) {}

  // Load AWS opportunities from cumulative store
  let awsOpps = [];
  try {
    const raw = await kvRedis.get('aws_cumulative_opps');
    if (raw) awsOpps = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (_) {}

  // Load company profile
  let companyProfile = {};
  try {
    const raw = await kvRedis.get('user:' + userId + ':company_profile');
    if (raw) companyProfile = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (_) {}

  const userKey = await getUserAnthropicKey(userId);
  const apiKey = userKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No AI API key configured' });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const deals = salesData.deals || [];
  const closedDeals = deals.filter(d => d.stage === 'Closed Won' || d.status === 'closed');
  const openDeals = deals.filter(d => d.stage !== 'Closed Won' && d.status !== 'closed');

  const repList = salesData.reps || [];
  const dealSummary = deals.slice(0, 200).map(d => ({
    client: d.client || d.name || d.company || '',
    rep: (repList.find(function(r){return r.id===d.repId;})||{}).name || d.rep || '',
    stage: d.stage || '',
    category: d.cat || d.category || '',
    amount: d.amount || 0,
    mrr: d.mrr || 0,
    month: d.month || 0,
    source: d.source || '',
    contractLength: d.contractLength || 0,
    notes: d.notes || ''
  }));

  const reps = salesData.reps || [];
  const repSummary = reps.map(r => ({
    name: r.name,
    role: r.role || '',
    quotaPS: r.quotaPS || r.quota_ps || 0,
    quotaFO: r.quotaFO || r.quota_fo || 0,
    quotaMS: r.quotaMS || r.quota_ms || 0
  }));

  const companyQuotas = salesData.companyQuotas || { PS: 0, FO: 0, MS: 0 };

  const oppSummary = awsOpps.slice(0, 200).map(o => ({
    company: o['Company'] || o['company_name'] || '',
    contact: o['Contact name'] || '',
    stage: o['Stage'] || o['stage'] || '',
    value: o['Value'] || o['value'] || 0,
    awsServices: o['AWS Services'] || o['aws_services'] || '',
    region: o['Region'] || o['region'] || '',
    industry: o['Industry'] || o['industry'] || ''
  }));

  const dataContext = JSON.stringify({
    currentDate: now.toISOString().slice(0, 10),
    currentMonth: monthNames[currentMonth - 1] + ' ' + currentYear,
    companyProfile,
    companyQuotas,
    reps: repSummary,
    deals: dealSummary,
    awsOpportunities: oppSummary,
    dealCount: deals.length,
    awsOppCount: awsOpps.length,
    closedWonCount: closedDeals.length,
    openCount: openDeals.length
  }, null, 0);

  const messages = [];
  if (history && Array.isArray(history)) {
    for (const msg of history.slice(-10)) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
  }
  messages.push({ role: 'user', content: question });

  const systemPrompt = 'You are a sales analytics assistant for ProspectAI. You have access to the user complete sales data below. Answer questions accurately and concisely. When showing numbers, format currency with $ and commas. If data is missing or insufficient, say so clearly.\n\nCURRENT SALES DATA:\n' + dataContext + '\n\nRules:\n- For quota attainment calculations, the YTD quota = annual quota x (current month / 12)\n- PS (Professional Services) deals use the one-time amount field\n- FO (FinOps) and MS (Managed Services) deals use the mrr field (monthly recurring revenue)\n- Rep quotas are stored as annual values (monthly x 12)\n- Be concise but complete. Use bullet points for lists. Format numbers clearly.\n- Deal fields: client, rep, stage (Prospecting/Discovery/Proposal/Negotiation/Closed Won/Closed Lost), category (PS/FO/MS), amount (PS fee), mrr (FO/MS monthly), month, source (Outbound/Inbound/Referral/Partner/Other), contractLength (months), notes\n- Open pipeline = deals NOT in Closed Won or Closed Lost';

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
        system: systemPrompt,
        messages
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      const errMsg = (data.error && data.error.message) || 'Claude API error';
      return res.status(resp.status).json({ error: errMsg });
    }

    const answer = (data.content && data.content[0] && data.content[0].text) || 'No response generated.';
    return res.status(200).json({ answer });
  } catch (err) {
    console.error('[ask-ai] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
