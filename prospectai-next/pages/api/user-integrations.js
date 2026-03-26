// ProspectAI — /api/user-integrations
// Per-user integration keys stored in Redis, keyed by Clerk userId
// GET  ?keys=apollo,hubspot   → returns { apollo: '***masked***', hubspot: '***masked***', apolloSet: true, hubspotSet: false }
// POST { apollo: 'key', hubspot: 'token', ... }  → saves non-empty values, ignores empty
// DELETE ?key=apollo  → removes a single key

import { getAuth } from '@clerk/nextjs/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

const ALLOWED_KEYS = [
    'apollo', 'hubspot', 'anthropic', 'news',
    'email_provider', 'email_user', 'email_pass',
    'email_host', 'email_port',
  ];

function integKey(userId) {
    return `user:${userId}:integrations`;
}

function mask(val) {
    if (!val || val.length < 8) return '••••••••';
    return val.slice(0, 4) + '••••••••' + val.slice(-4);
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

  const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const KEY = integKey(userId);

  try {
        // GET — return masked values + booleans for which keys are set
      if (req.method === 'GET') {
              const raw = await redis.get(KEY);
              const stored = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
              const result = {};
              for (const k of ALLOWED_KEYS) {
                        result[k + 'Set'] = !!stored[k];
                        result[k + 'Masked'] = stored[k] ? mask(stored[k]) : '';
              }
              return res.status(200).json(result);
      }

      // POST — save keys (only update keys that have a non-empty value)
      if (req.method === 'POST') {
              const raw = await redis.get(KEY);
              const stored = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
              const updates = req.body || {};
              let changed = false;
              for (const k of ALLOWED_KEYS) {
                        if (updates[k] !== undefined && updates[k] !== '') {
                                    stored[k] = updates[k];
                                    changed = true;
                        }
              }
              if (changed) await redis.set(KEY, JSON.stringify(stored));
              return res.status(200).json({ ok: true, changed });
      }

      // DELETE — remove a single key
      if (req.method === 'DELETE') {
              const keyToRemove = req.query.key || req.body?.key;
              if (!keyToRemove || !ALLOWED_KEYS.includes(keyToRemove)) {
                        return res.status(400).json({ error: 'Invalid key' });
              }
              const raw = await redis.get(KEY);
              const stored = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
              delete stored[keyToRemove];
              await redis.set(KEY, JSON.stringify(stored));
              return res.status(200).json({ ok: true });
      }

      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
        console.error('[user-integrations]', err.message);
        return res.status(500).json({ error: err.message });
  }
}

// ── Helper used by other API routes ──────────────────────────────────────────
// Call this from apollo.js, hubspot.js, etc. to get user's own key or fall back to env
export async function getUserIntegrationKey(userId, keyName) {
    try {
          const raw = await redis.get(integKey(userId));
          if (!raw) return null;
          const stored = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return stored[keyName] || null;
    } catch {
          return null;
    }
}
