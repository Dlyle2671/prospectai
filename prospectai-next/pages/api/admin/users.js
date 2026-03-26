// pages/api/admin/users.js
// Admin-only API: list users, delete users, view Redis keys per user
// Gated to ADMIN_USER_ID env var (your Clerk userId)
import { getAuth, clerkClient } from '@clerk/nextjs/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

const ADMIN_ID = process.env.ADMIN_USER_ID;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth check
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!ADMIN_ID || userId !== ADMIN_ID) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const client = await clerkClient();

  // GET -- list all users with their Redis data
  if (req.method === 'GET') {
    try {
      const { data: users } = await client.users.getUserList({ limit: 200, orderBy: '-created_at' });
      const enriched = await Promise.all(users.map(async (u) => {
        let redisData = {};
        try {
          const [integRaw, onboarded, icpRaw, senders] = await Promise.all([
            redis.get(`user:${u.id}:integrations`),
            redis.get(`user:${u.id}:onboarding_complete`),
            redis.get(`user:${u.id}:icp_weights`),
            redis.get(`user:${u.id}:sender_emails`),
          ]);
          const integrations = integRaw
            ? (typeof integRaw === 'string' ? JSON.parse(integRaw) : integRaw)
            : {};
          redisData = {
            onboarded: !!onboarded,
            hasIcp: !!icpRaw,
            hasSenders: !!senders,
            connectedApps: Object.keys(integrations).filter(k => integrations[k]),
          };
        } catch (_) {}
        return {
          id: u.id,
          email: u.emailAddresses?.[0]?.emailAddress || '',
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          imageUrl: u.imageUrl || '',
          createdAt: u.createdAt,
          lastSignInAt: u.lastSignInAt,
          ...redisData,
        };
      }));
      return res.status(200).json({ users: enriched, total: enriched.length });
    } catch (err) {
      console.error('[admin/users GET]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE -- delete a user from Clerk + wipe their Redis keys
  if (req.method === 'DELETE') {
    const targetId = req.query.userId || req.body?.userId;
    if (!targetId) return res.status(400).json({ error: 'userId required' });
    if (targetId === ADMIN_ID) return res.status(400).json({ error: 'Cannot delete admin' });
    try {
      // Delete from Clerk
      await client.users.deleteUser(targetId);
      // Wipe Redis keys
      const keys = [
        `user:${targetId}:integrations`,
        `user:${targetId}:onboarding_complete`,
        `user:${targetId}:icp_weights`,
        `user:${targetId}:sender_emails`,
        `user:${targetId}:credits`,
      ];
      await Promise.allSettled(keys.map(k => redis.del(k)));
      return res.status(200).json({ ok: true, deleted: targetId });
    } catch (err) {
      console.error('[admin/users DELETE]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
