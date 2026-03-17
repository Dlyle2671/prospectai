// ProspectAI — /api/apollo-sequences
// GET  → list all active sequences
// POST → add a contact to a sequence

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.APOLLO_API_KEY;

  // ── GET: fetch sequences list ──────────────────────────────────────────────
  if (req.method === 'GET') {
        try {
                const resp = await fetch('https://api.apollo.io/api/v1/emailer_campaigns?per_page=100&active=true', {
                          method: 'GET',
                          headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
                });
                const data = await resp.json();
                if (!resp.ok) return res.status(resp.status).json({ error: data.message || 'Failed to fetch sequences' });
                const sequences = (data.emailer_campaigns || []).map(s => ({
                          id: s.id,
                          name: s.name,
                          active: s.active,
                          num_steps: s.num_steps || 0,
                          created_at: s.created_at,
                }));
                return res.status(200).json(sequences);
        } catch (err) {
                console.error('[sequences] GET error:', err.message);
                return res.status(500).json({ error: err.message });
        }
  }

  // ── POST: add contact to sequence ─────────────────────────────────────────
  if (req.method === 'POST') {
        const { contact_id, email, sequence_id, mailbox_id } = req.body;
        if (!sequence_id) return res.status(400).json({ error: 'sequence_id is required' });
        if (!contact_id && !email) return res.status(400).json({ error: 'contact_id or email is required' });

      try {
              // Step 1: resolve or create contact id if we only have email
          let resolvedId = contact_id;
              if (!resolvedId && email) {
                        const matchResp = await fetch('https://api.apollo.io/api/v1/people/match', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
                                    body: JSON.stringify({ email, reveal_personal_emails: false, reveal_phone_number: false }),
                        });
                        const matchData = await matchResp.json();
                        resolvedId = matchData.person?.id || null;
              }

          if (!resolvedId) return res.status(404).json({ error: 'Could not resolve contact in Apollo' });

          // Step 2: get a mailbox to send from (use first active one if not supplied)
          let sendFromMailboxId = mailbox_id;
              if (!sendFromMailboxId) {
                        const mbResp = await fetch('https://api.apollo.io/api/v1/email_accounts?per_page=25', {
                                    method: 'GET',
                                    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
                        });
                        const mbData = await mbResp.json();
                        const active = (mbData.email_accounts || []).find(a => a.active);
                        sendFromMailboxId = active?.id || null;
              }

          if (!sendFromMailboxId) return res.status(400).json({ error: 'No active email account found in Apollo. Connect a mailbox first.' });

          // Step 3: add contact to sequence
          const addResp = await fetch('https://api.apollo.io/api/v1/emailer_campaign_addcontacts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
                    body: JSON.stringify({
                                contact_ids: [resolvedId],
                                send_email_from_email_account_id: sendFromMailboxId,
                                sequence_active_in_other_campaigns: false,
                    }),
          });
              const addData = await addResp.json();
              if (!addResp.ok) return res.status(addResp.status).json({ error: addData.message || addData.error || JSON.stringify(addData) });

          const contact = (addData.contacts || [])[0] || {};
              return res.status(200).json({
                        success: true,
                        contact_id: resolvedId,
                        sequence_id,
                        status: contact.contact_campaign_statuses?.[0]?.status || 'added',
              });
      } catch (err) {
              console.error('[sequences] POST error:', err.message);
              return res.status(500).json({ error: err.message });
      }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
