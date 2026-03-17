// ProspectAI - /api/apollo-sequences
// GET: list sequences  
// POST: add a contact to a sequence

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.APOLLO_API_KEY;
  console.log('[sequences] apiKey present:', !!apiKey, 'length:', apiKey ? apiKey.length : 0);

  if (req.method === 'GET') {
    try {
      const searchUrl = 'https://api.apollo.io/api/v1/emailer_campaigns/search';
      console.log('[sequences] POST search', searchUrl);
      const resp = await fetch(searchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
        body: JSON.stringify({ api_key: apiKey, per_page: 100, page: 1 }),
      });
      const text = await resp.text();
      console.log('[sequences] search status:', resp.status, 'body:', text.slice(0, 500));
      let data;
      try { data = JSON.parse(text); } catch (e) { data = {}; }

      if (resp.ok) {
        const sequences = (data.emailer_campaigns || []).map(function(s) {
          return { id: s.id, name: s.name, active: s.active, num_steps: s.num_steps || 0 };
        });
        console.log('[sequences] found', sequences.length, 'via search');
        return res.status(200).json(sequences);
      }

      console.log('[sequences] search failed (' + resp.status + '), trying GET emailer_campaigns');
      const resp2 = await fetch('https://api.apollo.io/api/v1/emailer_campaigns?per_page=100', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      });
      const text2 = await resp2.text();
      console.log('[sequences] fallback status:', resp2.status, 'body:', text2.slice(0, 500));
      let data2;
      try { data2 = JSON.parse(text2); } catch (e) { data2 = {}; }

      if (!resp2.ok) {
        return res.status(resp2.status).json({
          error: (data2.message || data2.error || 'Failed to fetch sequences'),
          detail: text2.slice(0, 300),
          searchDetail: text.slice(0, 300),
        });
      }
      const sequences2 = (data2.emailer_campaigns || []).map(function(s) {
        return { id: s.id, name: s.name, active: s.active, num_steps: s.num_steps || 0 };
      });
      console.log('[sequences] fallback found', sequences2.length);
      return res.status(200).json(sequences2);
    } catch (err) {
      console.error('[sequences] GET error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const contact_id = body.contact_id;
    const email = body.email;
    const sequence_id = body.sequence_id;
    const mailbox_id = body.mailbox_id;
    if (!sequence_id) return res.status(400).json({ error: 'sequence_id is required' });
    if (!contact_id && !email) return res.status(400).json({ error: 'contact_id or email is required' });

    try {
      let resolvedId = contact_id || null;
      if (!resolvedId && email) {
        const matchResp = await fetch('https://api.apollo.io/api/v1/people/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
          body: JSON.stringify({ api_key: apiKey, email: email, reveal_personal_emails: false }),
        });
        const matchData = await matchResp.json();
        resolvedId = (matchData.person && matchData.person.id) ? matchData.person.id : null;
      }
      if (!resolvedId) return res.status(404).json({ error: 'Could not resolve contact in Apollo' });

      let sendFromMailboxId = mailbox_id || null;
      if (!sendFromMailboxId) {
        const mbResp = await fetch('https://api.apollo.io/api/v1/email_accounts?per_page=25', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
        });
        const mbData = await mbResp.json();
        const accounts = mbData.email_accounts || [];
        for (let i = 0; i < accounts.length; i++) {
          if (accounts[i].active) { sendFromMailboxId = accounts[i].id; break; }
        }
      }
      if (!sendFromMailboxId) return res.status(400).json({ error: 'No active email account found. Connect a mailbox in Apollo first.' });

      const addResp = await fetch('https://api.apollo.io/api/v1/emailer_campaigns/' + sequence_id + '/add_contact_ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
        body: JSON.stringify({
          api_key: apiKey,
          contact_ids: [resolvedId],
          send_email_from_email_account_id: sendFromMailboxId,
          sequence_active_in_other_campaigns: false,
        }),
      });
      const addText = await addResp.text();
      console.log('[sequences] add contact status:', addResp.status, 'body:', addText.slice(0, 500));
      let addData;
      try { addData = JSON.parse(addText); } catch (e) { addData = {}; }
      if (!addResp.ok) return res.status(addResp.status).json({ error: addData.message || addData.error || addText.slice(0, 300) });

      const contacts = addData.contacts || [];
      const contact = contacts[0] || {};
      const statuses = contact.contact_campaign_statuses || [];
      return res.status(200).json({
        success: true,
        contact_id: resolvedId,
        sequence_id: sequence_id,
        status: statuses[0] ? statuses[0].status : 'added',
      });
    } catch (err) {
      console.error('[sequences] POST error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
