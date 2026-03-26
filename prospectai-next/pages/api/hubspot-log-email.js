// ProspectAI — /api/hubspot-log-email
// POST: find or create a HubSpot contact, then log a sent email activity against them
// Called by EmailQueue after a successful send

import { getAuth } from '@clerk/nextjs/server';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return res.status(200).json({ skipped: true, reason: 'No HubSpot token configured' });

  const {
    leadEmail, leadName, leadTitle, leadCompany,
          subject, body,
          fromEmail, fromName,
      } = req.body || {};

  if (!leadEmail) return res.status(400).json({ error: 'leadEmail is required' });

  const h = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
    };

  try {
    // ── 1. Find or create the contact ────────────────────────────────────────
    let contactId = null;

    const searchResp = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
            method: 'POST',
            headers: h,
            body: JSON.stringify({
              filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: leadEmail }] }],
              properties: ['hs_object_id'],
              limit: 1,
      }),
      });
    const searchData = await searchResp.json();
    contactId = searchData.results?.[0]?.id || null;

    if (!contactId) {
      // Create a minimal contact so the email activity has something to associate with
      const nameParts = (leadName || '').split(' ');
      const createResp = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({
          properties: {
            email: leadEmail,
            firstname: nameParts[0] || '',
            lastname: nameParts.slice(1).join(' ') || '',
            jobtitle: leadTitle || '',
            company: leadCompany || '',
},
}),
});
      const createData = await createResp.json();
      if (!createResp.ok) {
        // Contact may already exist with this email (race condition) — try to find again
        const retry = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
          method: 'POST',
          headers: h,
          body: JSON.stringify({
            filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: leadEmail }] }],
            properties: ['hs_object_id'],
            limit: 1,
}),
});
        const retryData = await retry.json();
        contactId = retryData.results?.[0]?.id || null;
} else {
        contactId = createData.id;
}
}

    if (!contactId) {
      return res.status(200).json({ ok: false, reason: 'Could not find or create HubSpot contact' });
}

    // ── 2. Log the sent email as an Email engagement ─────────────────────────
    const emailBody = {
      properties: {
        hs_timestamp: new Date().toISOString(),
        hs_email_direction: 'EMAIL',
        hs_email_status: 'SENT',
        hs_email_subject: subject || '(no subject)',
        hs_email_text: (body || '').replace(/<[^>]+>/g, ''),
        hs_email_html: body || '',
        ...(fromEmail ? { hs_email_from_email: fromEmail } : {}),
        ...(fromName  ? { hs_email_from_firstname: fromName } : {}),
        hs_email_to_email: leadEmail,
        hs_email_to_firstname: (leadName || '').split(' ')[0] || '',
        hs_email_to_lastname: (leadName || '').split(' ').slice(1).join(' ') || '',
},
      associations: [
{
          to: { id: contactId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 198 }],
},
      ],
};

    const emailResp = await fetch('https://api.hubapi.com/crm/v3/objects/emails', {
      method: 'POST',
      headers: h,
      body: JSON.stringify(emailBody),
});
    const emailData = await emailResp.json();

    if (!emailResp.ok) {
      console.error('[hubspot-log-email] email activity error:', emailData);
      return res.status(200).json({ ok: false, contactId, reason: emailData.message || 'Email activity failed' });
}

    return res.status(200).json({ ok: true, contactId, emailActivityId: emailData.id });
} catch (err) {
    console.error('[hubspot-log-email]', err.message);
    return res.status(200).json({ ok: false, reason: err.message });
}
}
