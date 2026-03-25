// ProspectAI — /api/email-queue
// CRUD for the email review queue stored in Upstash Redis
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const QUEUE_KEY = 'email_queue';

function parse(val) {
  if (!val) return [];
  if (typeof val === 'string') return JSON.parse(val);
  return val;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET  — list all queue items
    if (req.method === 'GET') {
      const raw = await redis.get(QUEUE_KEY);
      const items = parse(raw);
      return res.status(200).json({ items, total: items.length });
    }

    // POST — add items to queue (array of drafts)
    if (req.method === 'POST') {
      const { items: newItems } = req.body;
      if (!Array.isArray(newItems) || !newItems.length)
        return res.status(400).json({ error: 'items array required' });
      const raw = await redis.get(QUEUE_KEY);
      const existing = parse(raw);
      // Deduplicate by lead email
      const existingEmails = new Set(existing.map(i => i.leadEmail));
      const toAdd = newItems.filter(i => !existingEmails.has(i.leadEmail));
      const merged = [...existing, ...toAdd];
      await redis.set(QUEUE_KEY, JSON.stringify(merged));
      return res.status(200).json({ added: toAdd.length, total: merged.length });
    }

    // PUT — update a single item (edit subject/body, or mark status)
    if (req.method === 'PUT') {
      const { id, subject, body, status } = req.body;
      if (!id) return res.status(400).json({ error: 'id required' });
      const raw = await redis.get(QUEUE_KEY);
      const items = parse(raw);
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Item not found' });
      if (subject !== undefined) items[idx].subject = subject;
      if (body !== undefined) items[idx].body = body;
      if (status !== undefined) items[idx].status = status;
      items[idx].updatedAt = new Date().toISOString();
      await redis.set(QUEUE_KEY, JSON.stringify(items));
      return res.status(200).json({ item: items[idx] });
    }

    // DELETE — remove item(s) by id, or clear all
    if (req.method === 'DELETE') {
      const { id, clearAll } = req.body || req.query;
      if (clearAll === 'true' || clearAll === true) {
        await redis.del(QUEUE_KEY);
        return res.status(200).json({ cleared: true });
      }
      if (!id) return res.status(400).json({ error: 'id or clearAll required' });
      const raw = await redis.get(QUEUE_KEY);
      const items = parse(raw);
      const filtered = items.filter(i => i.id !== id);
      await redis.set(QUEUE_KEY, JSON.stringify(filtered));
      return res.status(200).json({ removed: items.length - filtered.length, total: filtered.length });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[email-queue]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
