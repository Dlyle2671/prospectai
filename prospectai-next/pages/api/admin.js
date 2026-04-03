// ProspectAI admin API
// Admin-only: list users, get user activity, delete user, set flags, set userType
import { getAuth, clerkClient } from '@clerk/nextjs/server';
import { Redis } from '@upstash/redis';
const redis = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
const ADMIN_USER_ID = 'user_3BSgI2SWsJ9xBJeTxxN4mOWqGRM';
export default async function handler(req, res) {
          const { userId } = getAuth(req);
          if (!userId || userId !== ADMIN_USER_ID) return res.status(403).json({ error: 'Forbidden' });
          const { action } = req.query;
          if (req.method === 'GET' && action === 'users') {
                      try {
                                    const clerk = await clerkClient();
                                    const { data: users } = await clerk.users.getUserList({ limit: 100, orderBy: '-created_at' });
                                    const enriched = await Promise.all(users.map(async u => {
                                                    const uid = u.id;
                                                    const [onboarded, senderEmails, icpWeights, emailQueue, userType] = await Promise.all([
                                                                      redis.get(`user:${uid}:onboarded`),
                                                                      redis.get(`user:${uid}:sender_emails`),
                                                                      redis.get(`user:${uid}:icp_weights`),
                                                                      redis.lrange(`user:${uid}:email_queue`, 0, -1).catch(() => []),
                                                                      redis.get(`user:${uid}:usertype`),
                                                                    ]);
                                                    let emailCount = 0, emailsSent = 0;
                                                    if (Array.isArray(emailQueue)) {
                                                                      const items = emailQueue.map(e => typeof e === 'string' ? JSON.parse(e) : e);
                                                                      emailCount = items.length;
                                                                      emailsSent = items.filter(e => e.status === 'sent').length;
                                                    }
                                                    return {
                                                                      id: uid, firstName: u.firstName || '', lastName: u.lastName || '',
                                                                      email: u.emailAddresses?.[0]?.emailAddress || '', imageUrl: u.imageUrl || '',
                                                                      createdAt: u.createdAt, lastSignInAt: u.lastSignInAt,
                                                                      onboarded: !!onboarded, hasSenderEmail: !!(senderEmails), hasIcp: !!(icpWeights),
                                                                      emailQueueCount: emailCount, emailsSent,
                                                                      userType: userType ? String(userType) : 'independent',
                                                    };
                                    }));
                                    return res.status(200).json({ users: enriched });
                      } catch (err) {
                                    return res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0,5) });
                      }
          }
          if (req.method === 'GET' && action === 'user') {
                      const { uid } = req.query;
                      if (!uid) return res.status(400).json({ error: 'uid required' });
                      const clerk = await clerkClient();
                      const u = await clerk.users.getUser(uid);
                      const [senderEmails, icpWeights, emailQueue, integrations, featureFlags, userType] = await Promise.all([
                                    redis.get(`user:${uid}:sender_emails`),
                                    redis.get(`user:${uid}:icp_weights`),
                                    redis.lrange(`user:${uid}:email_queue`, 0, -1).catch(() => []),
                                    redis.get(`user:${uid}:integrations`),
                                    redis.get(`user:${uid}:feature_flags`),
                                    redis.get(`user:${uid}:usertype`),
                                  ]);
                      const queueItems = (Array.isArray(emailQueue) ? emailQueue : [])
                        .map(e => typeof e === 'string' ? JSON.parse(e) : e)
                        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20);
                      return res.status(200).json({
                                    user: { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.emailAddresses?.[0]?.emailAddress, imageUrl: u.imageUrl, createdAt: u.createdAt, lastSignInAt: u.lastSignInAt },
                                    senderEmails: senderEmails ? (typeof senderEmails === 'string' ? JSON.parse(senderEmails) : senderEmails) : [],
                                    icpWeights: icpWeights ? (typeof icpWeights === 'string' ? JSON.parse(icpWeights) : icpWeights) : null,
                                    integrations: integrations ? (typeof integrations === 'string' ? JSON.parse(integrations) : integrations) : null,
                                    recentEmails: queueItems, emailQueueTotal: Array.isArray(emailQueue) ? emailQueue.length : 0,
                                    featureFlags: featureFlags ? (typeof featureFlags === 'string' ? JSON.parse(featureFlags) : featureFlags) : {},
                                    userType: userType ? String(userType) : 'independent',
                      });
          }
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
          if (req.method === 'POST' && action === 'flags') {
                      const { uid } = req.query;
                      if (!uid) return res.status(400).json({ error: 'uid required' });
                      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
                      const { flags } = body;
                      if (!flags || typeof flags !== 'object') return res.status(400).json({ error: 'flags required' });
                      await redis.set(`user:${uid}:feature_flags`, JSON.stringify(flags));
                      return res.status(200).json({ ok: true, uid, flags });
          }
          if (req.method === 'POST' && action === 'usertype') {
                      const { uid } = req.query;
                      if (!uid) return res.status(400).json({ error: 'uid required' });
                      if (uid === ADMIN_USER_ID) return res.status(400).json({ error: 'Cannot change admin type' });
                      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
                      const { userType } = body;
                      if (!userType || !['independent','managed'].includes(userType)) return res.status(400).json({ error: 'userType must be independent or managed' });
                      await redis.set(`user:${uid}:usertype`, userType);
                      return res.status(200).json({ ok: true, uid, userType });
          }
          return res.status(405).json({ error: 'Method not allowed' });
}
