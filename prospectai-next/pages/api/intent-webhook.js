// ProspectAI — /api/intent-webhook
// Receives Apollo Workflow webhook POSTs when companies show buying intent.
// Stores domain -> intent data in Redis (Upstash) for use by the main apollo.js pipeline.
//
// Apollo Workflow setup:
//   Trigger:  Company has Buying Intent (High) on your 6 configured topics
//   Action:   Send Webhook → POST https://prospectai-woad.vercel.app/api/intent-webhook
//             Include a secret header: x-webhook-secret = process.env.INTENT_WEBHOOK_SECRET
//
// Redis key format:  intent:<primary_domain>
// TTL:               7 days (intent signals are time-sensitive)

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const INTENT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-webhook-secret');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Validate webhook secret if configured
  const webhookSecret = process.env.INTENT_WEBHOOK_SECRET;
  if (webhookSecret) {
    const incomingSecret = req.headers['x-webhook-secret'];
    if (incomingSecret !== webhookSecret) {
      console.log('[intent-webhook] Unauthorized — bad secret');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const body = req.body;
    console.log('[intent-webhook] Received payload:', JSON.stringify(body).slice(0, 500));

    // Apollo webhooks can send a single object or an array of objects
    const payloads = Array.isArray(body) ? body : [body];
    const stored = [];
    const errors = [];

    for (const payload of payloads) {
      // Apollo sends org data nested under different keys depending on workflow version
      const org = payload.organization || payload.account || payload.company || payload;

      const domain =
        org.primary_domain ||
        org.domain ||
        org.website_url?.replace(/^https?:\/\//,'').replace(/\/.*$/,'').toLowerCase() ||
        null;

      if (!domain) {
        console.log('[intent-webhook] No domain found in payload, skipping');
        errors.push({ reason: 'no_domain', payload: JSON.stringify(payload).slice(0, 200) });
        continue;
      }

      // Extract intent strength — Apollo sends 'high', 'medium', 'low' or numeric
      const rawStrength = org.intent_strength || payload.intent_strength || null;
      // Normalize to string label
      let intent_strength = null;
      if (rawStrength) {
        const s = String(rawStrength).toLowerCase();
        if (s === 'high' || Number(rawStrength) >= 70) intent_strength = 'high';
        else if (s === 'medium' || Number(rawStrength) >= 40) intent_strength = 'medium';
        else intent_strength = 'low';
      } else {
        // If no explicit strength in payload, this is a High Intent trigger (Apollo only fires on High)
        intent_strength = 'high';
      }

      // Extract intent topics/signals
      const rawTopics = org.intent_signals || org.buying_intent_topics || payload.intent_topics || [];
      const intent_signals = rawTopics.map(t =>
        typeof t === 'string' ? { type: 'intent', label: t } : { type: 'intent', label: t.topic || t.name || t.label || '' }
      ).filter(s => s.label);

      const intentData = {
        intent_strength,
        intent_signals,
        org_name: org.name || '',
        updated_at: new Date().toISOString(),
        source: 'apollo_webhook',
      };

      const redisKey = `intent:${domain}`;
      await redis.setex(redisKey, INTENT_TTL_SECONDS, JSON.stringify(intentData));

      console.log(`[intent-webhook] Stored intent for ${domain}: strength=${intent_strength}, signals=${intent_signals.length}`);
      stored.push({ domain, intent_strength, signals: intent_signals.length });
    }

    return res.status(200).json({
      ok: true,
      stored,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('[intent-webhook] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
