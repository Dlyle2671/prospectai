import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

const SNAPSHOTS_INDEX_KEY = 'aws_snapshots_index';

export default async function handler(req, res) {
    try {
          if (req.method === 'POST') {
                  // Save a snapshot: { name, opps }
            const { name, opps } = req.body;
                  if (!name || !Array.isArray(opps)) {
                            return res.status(400).json({ error: 'name and opps are required' });
                  }
                  const key = 'aws_snapshot:' + Date.now();
                  const snapshot = { key, name, opps, savedAt: new Date().toISOString() };
                  await redis.set(key, JSON.stringify(snapshot));

            // Update the index of snapshot keys
            const indexRaw = await redis.get(SNAPSHOTS_INDEX_KEY);
                  const index = indexRaw ? JSON.parse(indexRaw) : [];
                  index.unshift({ key, name, savedAt: snapshot.savedAt, count: opps.length });
                  // Keep last 50 snapshots in index
            if (index.length > 50) index.splice(50);
                  await redis.set(SNAPSHOTS_INDEX_KEY, JSON.stringify(index));

            return res.status(200).json({ success: true, key });
          }

      if (req.method === 'GET') {
              const { action, key } = req.query;

            if (action === 'list') {
                      // Return the index of snapshots (no opp data, just metadata)
                const indexRaw = await redis.get(SNAPSHOTS_INDEX_KEY);
                      const index = indexRaw ? JSON.parse(indexRaw) : [];
                      return res.status(200).json({ snapshots: index });
            }

            if (action === 'load' && key) {
                      // Return the full snapshot data
                const raw = await redis.get(key);
                      if (!raw) return res.status(404).json({ error: 'Snapshot not found' });
                      return res.status(200).json(JSON.parse(raw));
            }

            if (action === 'delete' && key) {
                      await redis.del(key);
                      // Remove from index
                const indexRaw = await redis.get(SNAPSHOTS_INDEX_KEY);
                      const index = indexRaw ? JSON.parse(indexRaw) : [];
                      const updated = index.filter(s => s.key !== key);
                      await redis.set(SNAPSHOTS_INDEX_KEY, JSON.stringify(updated));
                      return res.status(200).json({ success: true });
            }

            return res.status(400).json({ error: 'Unknown action' });
      }

      res.setHeader('Allow', ['GET', 'POST']);
          return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
          console.error('KV error:', err);
          return res.status(500).json({ error: err.message });
    }
}
