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
      // Step 1: Create or update contact in THIS account via POST /contacts
      // Apollo will return the existing contact if email already exists in the account
      // This guarantees we get an account-scoped contact ID (not a global people ID)
      const nameParts = (body.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      console.log('[sequences] creating/upserting contact for email:', email);
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
      console.log('[sequences] create contact status:', createResp.status, 'body:', createText.slice(0, 400));
      let createData;
      try { createData = JSON.parse(createText); } catch (e) { createData = {}; }

      // Handle duplicate - Apollo returns 422 with existing contact ID in some cases
      // Try to extract contact id from response or error
      let resolvedId = null;
      if (createData.contact && createData.contact.id) {
        resolvedId = createData.contact.id;
      } else if (createData.id) {
        resolvedId = createData.id;
      }

      // If contact creation failed with 422 (duplicate), search for existing contact
      if (!resolvedId) {
        console.log('[sequences] contact create failed, searching by email:', email);
        const searchResp = await fetch('https://api.apollo.io/api/v1/contacts/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
          body: JSON.stringify({ api_key: apiKey, q_keywords: email, per_page: 1 }),
        });
        const searchText = await searchResp.text();
        console.log('[sequences] contact search status:', searchResp.status, 'body:', searchText.slice(0, 400));
        let searchData;
        try { searchData = JSON.parse(searchText); } catch (e) { searchData = {}; }
        const contacts = searchData.contacts || [];
        for (let i = 0; i < contacts.length; i++) {
          if (contacts[i].email && contacts[i].email.toLowerCase() === email.toLowerCase()) {
            resolvedId = contacts[i].id;
            break;
          }
        }
        if (!resolvedId && contacts.length > 0) resolvedId = contacts[0].id;
      }

      if (!resolvedId) return res.status(404).json({ error: 'Could not create or find contact in Apollo for: ' + email });
      console.log('[sequences] resolved contact id:', resolvedId);

      // Step 2: Get mailbox
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

      // Step 3: Add contact to sequence
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

      const cts = addData.contacts || [];
      const c = cts[0] || {};
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
