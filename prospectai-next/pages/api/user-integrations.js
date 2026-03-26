// ProspectAI -- /api/user-integrations
// Per-user integration keys stored in Redis, keyed by Clerk userId
// GET: returns { apollo: true/false, hubspot: true/false, email_user: 'actual@val', ... }
//   (booleans for secret keys, actual values for non-secret display fields)
// POST { key, value }: save a single key
// POST { bulk: { email_provider, email_user, ... } }: save multiple at once
// DELETE { key }: removes a single key
import { getAuth } from '@clerk/nextjs/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

const ALLOWED_KEYS = [
        'apollo', 'hubspot', 'anthropic', 'news',
        'email_provider', 'email_user', 'email_pass', 'email_host', 'email_port',
      ];

// Keys that should be returned as boolean (sensitive -- never expose value to client)
const SECRET_KEYS = ['apollo', 'hubspot', 'anthropic', 'news', 'email_pass'];

// Keys that can be returned as plain values (non-sensitive)
const PLAIN_KEYS = ['email_provider', 'email_user', 'email_host', 'email_port'];

function integKey(userId) { return `user:${userId}:integrations`; }

export default async function handler(req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') return res.status(200).end();
      
        const { userId } = getAuth(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      
        const KEY = integKey(userId);
      
        try {
                    // GET -- return booleans for secret keys, plain values for display keys
                    if (req.method === 'GET') {
                                    const raw = await redis.get(KEY);
                                    const stored = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
                                    const result = {};
                                    for (const k of SECRET_KEYS) result[k] = !!stored[k];
                                    for (const k of PLAIN_KEYS) result[k] = stored[k] || null;
                                    return res.status(200).json(result);
                    }
              
                    // POST -- save single key OR bulk
                    if (req.method === 'POST') {
                                    const raw = await redis.get(KEY);
                                    const stored = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
                                    const body = req.body || {};
                            
                                    // Bulk save (email config)
                                    if (body.bulk && typeof body.bulk === 'object') {
                                                    let changed = false;
                                                    for (const k of ALLOWED_KEYS) {
                                                                    if (body.bulk[k] !== undefined && body.bulk[k] !== '') {
                                                                                    stored[k] = body.bulk[k];
                                                                                    changed = true;
                                                                    }
                                                    }
                                                    if (changed) await redis.set(KEY, JSON.stringify(stored));
                                                    const result = {};
                                                    for (const k of SECRET_KEYS) result[k] = !!stored[k];
                                                    for (const k of PLAIN_KEYS) result[k] = stored[k] || null;
                                                    return res.status(200).json(result);
                                    }
                            
                                    // Single key save
                                    const { key, value } = body;
                                    if (!key || !ALLOWED_KEYS.includes(key)) {
                                                    return res.status(400).json({ error: 'Invalid key' });
                                    }
                                    if (!value) return res.status(400).json({ error: 'Value cannot be empty' });
                                    stored[key] = value;
                                    await redis.set(KEY, JSON.stringify(stored));
                                    const result = {};
                                    for (const k of SECRET_KEYS) result[k] = !!stored[k];
                                    for (const k of PLAIN_KEYS) result[k] = stored[k] || null;
                                    return res.status(200).json(result);
                    }
              
                    // DELETE -- remove a single key
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

// Helper used by other API routes
// Call from apollo.js, hubspot.js, send-email.js, draft-email.js etc.
export async function getUserIntegrationKey(userId, keyName) {
        try {
                    const raw = await redis.get(integKey(userId));
                    if (!raw) return null;
                    const stored = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    return stored[keyName] || null;
        } catch { return null; }
}
