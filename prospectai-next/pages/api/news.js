// ProspectAI - /api/news
// GET: fetch recent news for a person/company
// Query params: name, company

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'NEWS_API_KEY not configured' });

  const { name, company } = req.query;
  if (!name && !company) return res.status(400).json({ error: 'name or company is required' });

  try {
    // Build search query: prefer "Name" + "Company", fallback to just company
    const terms = [];
    if (name && name.trim()) terms.push('"' + name.trim() + '"');
    if (company && company.trim()) terms.push('"' + company.trim() + '"');
    const q = terms.join(' OR ');

    const url = 'https://newsapi.org/v2/everything?' +
      'q=' + encodeURIComponent(q) +
      '&sortBy=publishedAt' +
      '&pageSize=5' +
      '&language=en' +
      '&apiKey=' + apiKey;

    console.log('[news] fetching for query:', q);
    const resp = await fetch(url);
    const data = await resp.json();
    console.log('[news] status:', resp.status, 'totalResults:', data.totalResults);

    if (!resp.ok) {
      return res.status(resp.status).json({ error: data.message || 'NewsAPI error' });
    }

    const articles = (data.articles || []).map(function(a) {
      return {
        title: a.title,
        description: a.description,
        url: a.url,
        source: a.source && a.source.name ? a.source.name : '',
        publishedAt: a.publishedAt,
        urlToImage: a.urlToImage || null,
      };
    });

    return res.status(200).json({ articles: articles, total: data.totalResults || 0 });
  } catch (err) {
    console.error('[news] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
