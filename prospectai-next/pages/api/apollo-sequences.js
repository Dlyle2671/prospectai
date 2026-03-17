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
    const email = body.email;
    const sequence_id = body.sequence_id;
    if (!sequence_id) return res.status(400).json({ error: 'sequence_id is required' });
    if (!email) return res.status(400).json({ error: 'email is required' });

    try {
      // Always resolve contact by email in THIS account - never use an ID from another account
      // Step 1: try people/match to find or create the contact
      console.log('[sequences] matching contact by email:', email);
      const matchResp = await fetch('https://api.apollo.io/api/v1/people/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
        body: JSON.stringify({ api_key: apiKey, email: email, reveal_personal_emails: false }),
      });
      const matchText = await matchResp.text();
      console.log('[sequences] match status:', matchResp.status, 'body:', matchText.slice(0, 300));
      let matchData;
      try { matchData = JSON.parse(matchText); } catch (e) { matchData = {}; }
      let resolvedId = (matchData.person && matchData.person.id) ? matchData.person.id : null;

      // Step 2: if not found, create a new contact
      if (!resolvedId) {
        console.log('[sequences] contact not found, creating new contact for email:', email);
        const nameParts = (body.name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const createResp = await fetch('https://api.apollo.io/api/v1/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
          body: JSON.stringify({
            api_key: apiKey,
            first_name: firstName,
            last_name: lastName,
            email: email,
            title: body.title || '',
            organization_name: body.company_name || '',
          }),
        });
        const createText = await createResp.text();
        console.log('[sequences] create contact status:', createResp.status, 'body:', createText.slice(0, 300));
        let createData;
        try { createData = JSON.parse(createText); } catch (e) { createData = {}; }
        resolvedId = (createData.contact && createData.contact.id) ? createData.contact.id : null;
      }

      if (!resolvedId) return res.status(404).json({ error: 'Could not find or create contact in Apollo for email: ' + email });
      console.log('[sequences] resolved contact id:', resolvedId);

      // Step 3: get mailbox
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

      // Step 4: add contact to sequence
      const addUrl = 'https://api.apollo.io/api/v1/emailer_campaigns/' + sequence_id + '/add_contact_ids';
      const addPayload = {
        api_key: apiKey,
        emailer_campaign_id: sequence_id,
        contact_ids: [resolvedId],
        send_email_from_email_account_id: mailboxId,
        sequence_active_in_other_campaigns: false,
      };
      console.log('[sequences] adding to sequence, contact:', resolvedId, 'sequence:', sequence_id);
      const addResp = await fetch(addUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
        body: JSON.stringify(addPayload),
      });
      const addText = await addResp.text();
      console.log('[sequences] add status:', addResp.status, 'body:', addText.slice(0, 600));
      let addData;
      try { addData = JSON.parse(addText); } catch (e) { addData = {}; }

      if (!addResp.ok) {
        return res.status(addResp.status).json({ error: addData.message || addData.error || addText.slice(0, 200) });
      }

      // Check for skipped contacts
      const skipped = addData.skipped_contact_ids || {};
      if (skipped[resolvedId]) {
        return res.status(400).json({ error: 'Apollo skipped this contact: ' + skipped[resolvedId] });
      }

      const contacts = addData.contacts || [];
      const c = contacts[0] || {};
      const statuses = c.contact_campaign_statuses || [];
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
