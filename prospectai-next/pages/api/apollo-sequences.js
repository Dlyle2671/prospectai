// ProspectAI - /api/apollo-sequences
// GET: list sequences
// POST: add a contact to a sequence

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.APOLLO_API_KEY;

  if (req.method === 'GET') {
    try {
      const resp = await fetch('https://api.apollo.io/api/v1/emailer_campaigns/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
        body: JSON.stringify({ api_key: apiKey, per_page: 100, page: 1 }),
      });
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch (e) { data = {}; }
      if (resp.ok) {
        return res.status(200).json((data.emailer_campaigns || []).map(function(s) {
          return { id: s.id, name: s.name, active: s.active, num_steps: s.num_steps || 0 };
        }));
      }
      // Fallback
      const resp2 = await fetch('https://api.apollo.io/api/v1/emailer_campaigns?per_page=100', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      });
      const text2 = await resp2.text();
      let data2;
      try { data2 = JSON.parse(text2); } catch (e) { data2 = {}; }
      if (!resp2.ok) return res.status(resp2.status).json({ error: data2.error || 'Failed to fetch sequences' });
      return res.status(200).json((data2.emailer_campaigns || []).map(function(s) {
        return { id: s.id, name: s.name, active: s.active, num_steps: s.num_steps || 0 };
      }));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const contact_id = body.contact_id;
    const email = body.email;
    const sequence_id = body.sequence_id;
    if (!sequence_id) return res.status(400).json({ error: 'sequence_id is required' });
    if (!contact_id && !email) return res.status(400).json({ error: 'contact_id or email is required' });

    try {
      // Step 1: resolve contact id
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
      if (!resolvedId) return res.status(404).json({ error: 'Could not resolve contact in Apollo.' });
      console.log('[sequences] contact id:', resolvedId, 'sequence id:', sequence_id);

      // Step 2: get mailbox
      let mailboxId = null;
      const mbResp = await fetch('https://api.apollo.io/api/v1/email_accounts?per_page=25', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      });
      const mbData = await mbResp.json();
      const accounts = mbData.email_accounts || [];
      for (let i = 0; i < accounts.length; i++) {
        if (accounts[i].active) { mailboxId = accounts[i].id; break; }
      }
      if (!mailboxId && accounts.length > 0) mailboxId = accounts[0].id;
      if (!mailboxId) return res.status(400).json({ error: 'No email account found. Connect a mailbox in Apollo first.' });
      console.log('[sequences] mailbox id:', mailboxId);

      // Step 3: Try URL-path endpoint first (add_contact_ids)
      const urlPath = 'https://api.apollo.io/api/v1/emailer_campaigns/' + sequence_id + '/add_contact_ids';
      const bodyPath = {
        api_key: apiKey,
        emailer_campaign_id: sequence_id,
        contact_ids: [resolvedId],
        send_email_from_email_account_id: mailboxId,
        sequence_active_in_other_campaigns: false,
      };
      console.log('[sequences] trying URL-path endpoint:', urlPath);
      const addResp1 = await fetch(urlPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
        body: JSON.stringify(bodyPath),
      });
      const addText1 = await addResp1.text();
      console.log('[sequences] url-path status:', addResp1.status, 'body:', addText1.slice(0, 400));

      if (addResp1.ok) {
        let addData1;
        try { addData1 = JSON.parse(addText1); } catch (e) { addData1 = {}; }
        const contacts = addData1.contacts || [];
        const c = contacts[0] || {};
        const statuses = c.contact_campaign_statuses || [];
        return res.status(200).json({ success: true, contact_id: resolvedId, sequence_id: sequence_id, status: statuses[0] ? statuses[0].status : 'added' });
      }

      // Step 4: Fallback to emailer_campaign_addcontacts (body-only endpoint)
      const urlBody = 'https://api.apollo.io/api/v1/emailer_campaign_addcontacts';
      const bodyAlt = {
        api_key: apiKey,
        emailer_campaign_id: sequence_id,
        contact_ids: [resolvedId],
        send_email_from_email_account_id: mailboxId,
        sequence_active_in_other_campaigns: false,
      };
      console.log('[sequences] trying body endpoint:', urlBody);
      const addResp2 = await fetch(urlBody, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
        body: JSON.stringify(bodyAlt),
      });
      const addText2 = await addResp2.text();
      console.log('[sequences] body-endpoint status:', addResp2.status, 'body:', addText2.slice(0, 400));

      let addData2;
      try { addData2 = JSON.parse(addText2); } catch (e) { addData2 = {}; }
      if (!addResp2.ok) {
        return res.status(addResp2.status).json({
          error: addData2.message || addData2.error || addText2.slice(0, 200),
          urlPathStatus: addResp1.status,
          urlPathError: addText1.slice(0, 200),
        });
      }
      const contacts2 = addData2.contacts || [];
      const c2 = contacts2[0] || {};
      const statuses2 = c2.contact_campaign_statuses || [];
      return res.status(200).json({ success: true, contact_id: resolvedId, sequence_id: sequence_id, status: statuses2[0] ? statuses2[0].status : 'added' });
    } catch (err) {
      console.error('[sequences] POST error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
