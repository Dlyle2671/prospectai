// ProspectAI — /api/user-settings
// Per-user settings stored in Upstash Redis, keyed by Clerk userId
import { getAuth } from '@clerk/nextjs/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function userKey(userId, ns) {
  return `user:${userId}:${ns}`;
}

export default async function handler(req, res) {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { ns } = req.query; // e.g. icp_weights, sender_emails, integrations
  if (!ns) return res.status(400).json({ error: 'ns (namespace) required' });

  const key = userKey(userId, ns);

  if (req.method === 'GET') {
    const data = await redis.get(key);
    return res.status(200).json({ data: data ?? null });
  }

  if (req.method === 'POST') {
    const { data } = req.body;
    await redis.set(key, JSON.stringify(data));
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await redis.del(key);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).json({ error: 'Method not allowed' });
}
