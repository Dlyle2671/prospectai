// ProspectAI — /api/apollo-sequences
// GET → list sequences
// POST → add a contact to a sequence

export default async function handler(req, res) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.APOLLO_API_KEY;
      console.log('[sequences] apiKey present:', !!apiKey, 'length:', apiKey?.length);

  // ── GET: fetch sequences list ──────────────────────────────────────────────
  if (req.method === 'GET') {
          try {
                    // Try without active filter first so we see all sequences
            const url = 'https://api.apollo.io/api/v1/emailer_campaigns?per_page=100';
                    console.log('[sequences] GET', url);
                    const resp = await fetch(url, {
                                method: 'GET',
                                headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
                    });
                    const text = await resp.text();
                    console.log('[sequences] Apollo status:', resp.status, 'body:', text.slice(0, 500));
                    let data;
                    try { data = JSON.parse(text); } catch { data = {}; }
                    if (!resp.ok) {
                                return res.status(resp.status).json({ error: data.message || data.error || 'Failed to fetch sequences', detail: text.slice(0, 300) });
                    }
                    const sequences = (data.emailer_campaigns || []).map(s => ({
                                id: s.id,
                                name: s.name,
                                active: s.active,
                                num_steps: s.num_steps || 0,
                                created_at: s.created_at,
                    }));
                    console.log('[sequences] found', sequences.length, 'sequences');
                    return res.status(200).json(sequences);
          } catch (err) {
                    console.error('[sequences] GET error:', err.message);
                    return res.status(500).json({ error: err.message });
          }
  }

  // ── POST: add contact to sequence ──────────────────────────────────────────
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
                                            body: JSON.stringify({ email, reveal_personal_emails: false }),
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
            const addResp = await fetch(`https://api.apollo.io/api/v1/emailer_campaigns/${sequence_id}/add_contact_ids`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
                        body: JSON.stringify({
                                      contact_ids: [resolvedId],
                                      send_email_from_email_account_id: sendFromMailboxId,
                                      sequence_active_in_other_campaigns: false,
                        }),
            });
                  const addText = await addResp.text();
                  console.log('[sequences] add contact status:', addResp.status, 'body:', addText.slice(0, 500));
                  let addData;
                  try { addData = JSON.parse(addText); } catch { addData = {}; }
                  if (!addResp.ok) return res.status(addResp.status).json({ error: addData.message || addData.error || addText.slice(0, 300) });

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
