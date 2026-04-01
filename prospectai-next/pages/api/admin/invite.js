// pages/api/admin/invite.js
// Admin-only: create a Clerk invitation and store pending invite in Redis
// POST { email, redirectUrl? } -> returns { ok, invitationId, email }
// GET -> returns list of pending invites from Redis
// DELETE ?inviteId=xxx -> revokes an invite

import { getAuth, clerkClient } from '@clerk/nextjs/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

const ADMIN_ID = process.env.ADMIN_USER_ID;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!ADMIN_ID || userId !== ADMIN_ID) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const client = await clerkClient();

  // GET -- list pending invites stored in Redis
  if (req.method === 'GET') {
    try {
      const raw = await redis.get('admin:invites');
      const invites = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
      return res.status(200).json({ invites });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST -- create a new invitation (Clerk sends the invite email automatically)
  if (req.method === 'POST') {
    const { email, redirectUrl } = req.body || {};
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    try {
      const invitation = await client.invitations.createInvitation({
        emailAddress: email,
        redirectUrl: redirectUrl || ((process.env.NEXT_PUBLIC_APP_URL || '') + '/sign-up'),
        publicMetadata: { invitedByAdmin: true },
        notify: true,
        ignoreExisting: false,
      });

      const raw = await redis.get('admin:invites');
      const invites = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
      invites.unshift({
        id: invitation.id,
        email,
        status: 'pending',
        createdAt: new Date().toISOString(),
        invitedBy: userId,
      });
      if (invites.length > 200) invites.length = 200;
      await redis.set('admin:invites', JSON.stringify(invites));

      return res.status(200).json({ ok: true, email, invitationId: invitation.id, status: invitation.status });
    } catch (err) {
      console.error('[admin/invite POST]', err.message);
      if (err.errors?.[0]?.code === 'duplicate_record') {
        return res.status(409).json({ error: 'An invitation for this email already exists, or the user already has an account.' });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE -- revoke an invite by Clerk invitation id
  if (req.method === 'DELETE') {
    const { inviteId } = req.query;
    if (!inviteId) return res.status(400).json({ error: 'inviteId required' });
    try {
      try { await client.invitations.revokeInvitation(inviteId); } catch (_) {}
      const raw = await redis.get('admin:invites');
      const invites = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
      await redis.set('admin:invites', JSON.stringify(invites.filter(i => i.id !== inviteId)));
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
