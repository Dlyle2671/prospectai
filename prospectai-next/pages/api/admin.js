// ProspectAI — /api/admin
// Admin-only API: list users, get user activity, delete user
// Gated to ADMIN_USER_ID only
import { getAuth, clerkClient } from '@clerk/nextjs/server';
import { Redis } from '@upstash/redis';
const redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});
const ADMIN_USER_ID = 'user_3BSgI2SWsJ9xBJeTxxN4mOWqGRM';
export default async function handler(req, res) {
    const { userId } = getAuth(req);
    if (!userId || userId !== ADMIN_USER_ID) {
          return res.status(403).json({ error: 'Forbidden' });
    }
    const { action } = req.query;
    // GET /api/admin?action=users — list all users with Redis stats
  if (req.method === 'GET' && action === 'users') {
        try {
                const clerk = await clerkClient();
                const { data: users } = await clerk.users.getUserList({ limit: 100, orderBy: '-created_at' });
                const enriched = await Promise.all(users.map(async u => {
                          const uid = u.id;
                          const [onboarded, senderEmails, icpWeights, emailQueue] = await Promise.all([
                                      redis.get(`user:${uid}:onboarded`),
                                      redis.get(`user:${uid}:sender_emails`),
                                      redis.get(`user:${uid}:icp_weights`),
                                      redis.lrange(`user:${uid}:email_queue`, 0, -1),
                                    ]);
                          let emailCount = 0;
                          let emailsSent = 0;
                          if (Array.isArray(emailQueue)) {
                                      const items = emailQueue.map(e => typeof e === 'string' ? JSON.parse(e) : e);
                                      emailCount = items.length;
                                      emailsSent = items.filter(e => e.status === 'sent').length;
                          }
                          return {
                                      id: uid,
                                      firstName: u.firstName || '',
                                      lastName: u.lastName || '',
                                      email: u.emailAddresses?.[0]?.emailAddress || '',
                                      imageUrl: u.imageUrl || '',
                                      createdAt: u.createdAt,
                                      lastSignInAt: u.lastSignInAt,
                                      onboarded: !!onboarded,
                                      hasSenderEmail: !!(senderEmails),
                                      hasIcp: !!(icpWeights),
                                      emailQueueCount: emailCount,
                                      emailsSent,
                          };
                }));
                return res.status(200).json({ users: enriched });
        } catch (err) {
                console.error('[admin/users] Error:', err);
                return res.status(500).json({ error: err.message || String(err), stack: err.stack?.split('\n').slice(0,5) });
        }
  }
    // GET /api/admin?action=user&uid=xxx — single user detail
  if (req.method === 'GET' && action === 'user') {
        const { uid } = req.query;
        if (!uid) return res.status(400).json({ error: 'uid required' });
        const clerk = await clerkClient();
        const u = await clerk.users.getUser(uid);
        const [senderEmails, icpWeights, emailQueue, integrations, featureFlags] = await Promise.all([
                redis.get(`user:${uid}:sender_emails`),
                redis.get(`user:${uid}:icp_weights`),
                redis.lrange(`user:${uid}:email_queue`, 0, -1),
                redis.get(`user:${uid}:integrations`),
                redis.get(`user:${uid}:feature_flags`),
              ]);
        const queueItems = (Array.isArray(emailQueue) ? emailQueue : [])
          .map(e => typeof e === 'string' ? JSON.parse(e) : e)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 20);
        return res.status(200).json({
                user: {
                          id: u.id,
                          firstName: u.firstName,
                          lastName: u.lastName,
                          email: u.emailAddresses?.[0]?.emailAddress,
                          imageUrl: u.imageUrl,
                          createdAt: u.createdAt,
                          lastSignInAt: u.lastSignInAt,
                },
                senderEmails: senderEmails ? (typeof senderEmails === 'string' ? JSON.parse(senderEmails) : senderEmails) : [],
                icpWeights: icpWeights ? (typeof icpWeights === 'string' ? JSON.parse(icpWeights) : icpWeights) : null,
                integrations: integrations ? (typeof integrations === 'string' ? JSON.parse(integrations) : integrations) : null,
                recentEmails: queueItems,
                emailQueueTotal: Array.isArray(emailQueue) ? emailQueue.length : 0,
                featureFlags: featureFlags ? (typeof featureFlags === 'string' ? JSON.parse(featureFlags) : featureFlags) : {},
        });
  }
    // DELETE /api/admin?action=user&uid=xxx — delete user from Clerk + wipe Redis
  if (req.method === 'DELETE' && action === 'user') {
        const { uid } = req.query;
        if (!uid) return res.status(400).json({ error: 'uid required' });
        if (uid === ADMIN_USER_ID) return res.status(400).json({ error: 'Cannot delete admin' });
        const keys = await redis.keys(`user:${uid}:*`);
        if (keys.length > 0) await redis.del(...keys);
        const clerk = await clerkClient();
        await clerk.users.deleteUser(uid);
        return res.status(200).json({ ok: true, deleted: uid, redisKeysRemoved: keys.length });
  }
    // POST /api/admin?action=flags&uid=xxx — set feature flags for a user
  if (req.method === 'POST' && action === 'flags') {
        const { uid } = req.query;
        if (!uid) return res.status(400).json({ error: 'uid required' });
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { flags } = body;
        if (!flags || typeof flags !== 'object') return res.status(400).json({ error: 'flags object required' });
        await redis.set(`user:${uid}:feature_flags`, JSON.stringify(flags));
        return res.status(200).json({ ok: true, uid, flags });
  }
    return res.status(405).json({ error: 'Method not allowed' });
}
