import { getAuth } from '@clerk/nextjs/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

const DEFAULT_DATA = {
  reps: [],
  deals: [],
  companyQuotas: { PS: 0, FO: 0, MS: 0 },
};

export default async function handler(req, res) {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const key = `user:${userId}:sales_data`;

  if (req.method === 'GET') {
    try {
      const raw = await redis.get(key);
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return res.status(200).json(parsed);
      }
      return res.status(200).json(DEFAULT_DATA);
    } catch (e) {
      return res.status(200).json(DEFAULT_DATA);
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      await redis.set(key, JSON.stringify(body));
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Save failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
