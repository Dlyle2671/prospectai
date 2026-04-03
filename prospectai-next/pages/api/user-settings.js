// ProspectAI — /api/user-settings
// Per-user settings stored in Upstash Redis, keyed by Clerk userId
// Managed users (userType === 'managed') inherit admin settings for
// icp_weights, integrations, and company_profile — but keep their own
// sender_emails, onboarding_complete, and feature_flags.
import { getAuth, clerkClient } from '@clerk/nextjs/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

const ADMIN_USER_ID = process.env.ADMIN_USER_ID || 'user_3BSgI2SWsJ9xBJeTxxN4mOWqGRM';

// Namespaces that managed users inherit from admin instead of storing their own
const MANAGED_INHERIT_NS = ['icp_weights', 'integrations', 'company_profile'];

// Namespaces that managed users can write/read their own values for
const MANAGED_OWN_NS = ['sender_emails', 'onboarding_complete', 'feature_flags', 'usertype'];

function userKey(userId, ns) {
    return `user:${userId}:${ns}`;
}

async function getUserType(userId) {
    try {
          const raw = await redis.get(userKey(userId, 'usertype'));
          if (raw) return typeof raw === 'string' ? raw : String(raw);
    } catch (_) {}
    return 'independent';
}

export default async function handler(req, res) {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { ns } = req.query;
    if (!ns) return res.status(400).json({ error: 'ns (namespace) required' });

  // Determine if this is a managed user and whether this ns is inherited
  const userType = await getUserType(userId);
    const isManaged = userType === 'managed';
    const isInherited = isManaged && MANAGED_INHERIT_NS.includes(ns);

  // For inherited namespaces on managed users: GET reads admin's key, POST/DELETE are blocked
  if (isInherited) {
        if (req.method === 'GET') {
                const adminKey = userKey(ADMIN_USER_ID, ns);
                const data = await redis.get(adminKey).catch(() => null);
                return res.status(200).json({ data: data ?? null, inherited: true });
        }
        // Block writes to inherited namespaces for managed users
      return res.status(403).json({ error: 'This setting is managed by your admin and cannot be changed.' });
  }

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
                                                  await redis.set(key, JSON.stringify(flagsObj));
                                                  await redis.del(inviteKey);
                                                  data = flagsObj;
                                    }
                        }
              } catch (e) {
                        console.error('[user-settings flags migration]', e.message);
              }
      }

      // On first load of usertype: check if admin stored a userType for this user's email at invite time
      if (ns === 'usertype' && (data === null || data === undefined)) {
              try {
                        const client = await clerkClient();
                        const user = await client.users.getUser(userId);
                        const email = user.emailAddresses?.[0]?.emailAddress;
                        if (email) {
                                    const inviteTypeKey = `invite:usertype:${email.toLowerCase()}`;
                                    const inviteType = await redis.get(inviteTypeKey);
                                    if (inviteType !== null && inviteType !== undefined) {
                                                  const typeStr = typeof inviteType === 'string' ? inviteType : String(inviteType);
                                                  await redis.set(key, typeStr);
                                                  await redis.del(inviteTypeKey);
                                                  data = typeStr;
                                    }
                        }
              } catch (e) {
                        console.error('[user-settings usertype migration]', e.message);
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
