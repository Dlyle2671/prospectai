// ProspectAI — /api/user-settings
// Per-user settings stored in Upstash Redis, keyed by Clerk userId
import { getAuth, clerkClient } from '@clerk/nextjs/server';
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
    let data = await redis.get(key);

    // On first load of feature_flags: check if admin pre-configured flags for this user's email
    if (ns === 'feature_flags' && (data === null || data === undefined)) {
      try {
        const client = await clerkClient();
        const user = await client.users.getUser(userId);
        const email = user.emailAddresses?.[0]?.emailAddress;
        if (email) {
          const inviteKey = `invite:flags:${email.toLowerCase()}`;
          const inviteFlags = await redis.get(inviteKey);
          if (inviteFlags !== null && inviteFlags !== undefined) {
            const flagsObj = typeof inviteFlags === 'string' ? JSON.parse(inviteFlags) : inviteFlags;
            // Promote invite flags to the user's permanent key
            await redis.set(key, JSON.stringify(flagsObj));
            // Clean up the email-keyed entry (one-time use)
            await redis.del(inviteKey);
            data = flagsObj;
          }
        }
      } catch (e) {
        console.error('[user-settings flags migration]', e.message);
      }
    }

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
