import nodemailer from 'nodemailer';

// Delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
        const { leads, template, batchSize = 10, delaySeconds = 60 } = req.body;

      if (!leads || !Array.isArray(leads) || leads.length === 0) {
              return res.status(400).json({ error: 'No leads provided' });
      }
        if (!template || !template.subject || !template.body) {
                return res.status(400).json({ error: 'Template subject and body are required' });
        }

      // SMTP transporter using O365
      const transporter = nodemailer.createTransport({
              host: 'smtp.office365.com',
              port: 587,
              secure: false,
              auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS,
              },
              tls: { ciphers: 'SSLv3' },
      });

      const results = [];
        let sent = 0;

      for (let i = 0; i < leads.length; i++) {
              const lead = leads[i];
              if (!lead.email) {
                        results.push({ email: lead.email || 'unknown', status: 'skipped', reason: 'No email address' });
                        continue;
              }

          // Personalize subject and body
          const personalizedSubject = personalizeText(template.subject, lead);
              const personalizedBody = personalizeText(template.body, lead);

          try {
                    await transporter.sendMail({
                                from: `${process.env.EMAIL_FROM_NAME || 'ProspectAI'} <${process.env.EMAIL_USER}>`,
                                to: lead.email,
                                subject: personalizedSubject,
                                html: personalizedBody,
                    });

                // Log to HubSpot
                await logEmailToHubspot(lead, personalizedSubject, personalizedBody);

                results.push({ email: lead.email, name: lead.name, status: 'sent' });
                    sent++;

                // Batch delay: pause after every batchSize emails
                if (sent % batchSize === 0 && i < leads.length - 1) {
                            await delay(delaySeconds * 1000);
                }
          } catch (sendErr) {
                    results.push({ email: lead.email, name: lead.name, status: 'failed', reason: sendErr.message });
          }
      }

      return res.status(200).json({ total: leads.length, sent, results });
  } catch (err) {
        return res.status(500).json({ error: err.message });
  }
}

function personalizeText(text, lead) {
    const firstName = (lead.name || '').split(' ')[0] || 'there';
    return text
      .replace(/\{\{first_name\}\}/gi, firstName)
      .replace(/\{\{name\}\}/gi, lead.name || '')
      .replace(/\{\{company\}\}/gi, lead.company_name || '')
      .replace(/\{\{title\}\}/gi, lead.title || '')
      .replace(/\{\{email\}\}/gi, lead.email || '');
}

async function logEmailToHubspot(lead, subject, body) {
    try {
          // First find or create the contact
      const searchResp = await fetch(
              `https://api.hubapi.com/crm/v3/objects/contacts/search`,
        {
                  method: 'POST',
                  headers: {
                              'Content-Type': 'application/json',
                              Authorization: 'Bearer ' + process.env.HUBSPOT_ACCESS_TOKEN,
                  },
                  body: JSON.stringify({
                              filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: lead.email }] }],
                              properties: ['hs_object_id'],
                              limit: 1,
                  }),
        }
            );
          const searchData = await searchResp.json();
          let contactId = searchData.results && searchData.results[0] ? searchData.results[0].id : null;

      // If no contact found, create one
      if (!contactId) {
              const createResp = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
                        method: 'POST',
                        headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: 'Bearer ' + process.env.HUBSPOT_ACCESS_TOKEN,
                        },
                        body: JSON.stringify({
                                    properties: {
                                                  email: lead.email,
                                                  firstname: (lead.name || '').split(' ')[0],
                                                  lastname: (lead.name || '').split(' ').slice(1).join(' '),
                                                  jobtitle: lead.title || '',
                                                  company: lead.company_name || '',
                                    },
                        }),
              });
              const createData = await createResp.json();
              contactId = createData.id;
      }

      if (!contactId) return;

      // Log email activity on the contact timeline
      await fetch('https://api.hubapi.com/crm/v3/objects/emails', {
              method: 'POST',
              headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer ' + process.env.HUBSPOT_ACCESS_TOKEN,
              },
              body: JSON.stringify({
                        properties: {
                                    hs_timestamp: new Date().toISOString(),
                                    hs_email_direction: 'EMAIL',
                                    hs_email_status: 'SENT',
                                    hs_email_subject: subject,
                                    hs_email_text: body.replace(/<[^>]+>/g, ''),
                                    hs_email_html: body,
                        },
                        associations: [
                          {
                                        to: { id: contactId },
                                        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 198 }],
                          },
                                  ],
              }),
      });
    } catch (e) {
          // Non-fatal: don't block email sending if HubSpot logging fails
      console.error('HubSpot log error:', e.message);
    }
}
