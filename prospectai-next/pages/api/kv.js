import { Redis } from '@upstash/redis';

const redis = new Redis({
                url: process.env.KV_REST_API_URL,
                token: process.env.KV_REST_API_TOKEN,
});

const CUMULATIVE_KEY = 'aws_cumulative_opps';

const parseRedisValue = (val) => {
                if (!val) return null;
                if (typeof val === 'string') return JSON.parse(val);
                return val;
};

export default async function handler(req, res) {
                try {
                                        if (req.method === 'POST') {
                                                                        const { opps } = req.body;
                                                                        if (!Array.isArray(opps)) {
                                                                                                                return res.status(400).json({ error: 'opps array is required' });
                                                                                }

                                                // Load existing cumulative opps
                                                const raw = await redis.get(CUMULATIVE_KEY);
                                                                        const existing = raw ? parseRedisValue(raw) : [];

                                                // Merge: deduplicate by 'Opportunity id' if present, otherwise append all
                                                const existingIds = new Set(existing.map(o => o['Opportunity id']).filter(Boolean));
                                                                        const newOpps = opps.filter(o => !o['Opportunity id'] || !existingIds.has(o['Opportunity id']));
                                                                        const merged = [...existing, ...newOpps];

                                                await redis.set(CUMULATIVE_KEY, JSON.stringify(merged));

                                                return res.status(200).json({ success: true, total: merged.length, added: newOpps.length });
                                        }

                        if (req.method === 'GET') {
                                                        const { action } = req.query;

                                                if (action === 'getall') {
                                                                                        const raw = await redis.get(CUMULATIVE_KEY);
                                                                                        const opps = raw ? parseRedisValue(raw) : [];
                                                                                        return res.status(200).json({ opps, total: opps.length });
                                                }

                                                if (action === 'clear') {
                                                                                        await redis.del(CUMULATIVE_KEY);
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
