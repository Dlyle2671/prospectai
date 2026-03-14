// ProspectAI — /api/send-email (Next.js API route)
// Multi-provider email support: Office365, Gmail, SendGrid, Mailgun, custom SMTP
import nodemailer from 'nodemailer';

const delay = ms => new Promise(r => setTimeout(r, ms));

// Build transporter based on EMAIL_PROVIDER env var
function getTransporter() {
  const provider = process.env.EMAIL_PROVIDER || 'office365';
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  const configs = {
    office365: { host: 'smtp.office365.com', port: 587, secure: false, auth: { user, pass }, tls: { ciphers: 'SSLv3' } },
    gmail:     { host: 'smtp.gmail.com',      port: 587, secure: false, auth: { user, pass } },
    sendgrid:  { host: 'smtp.sendgrid.net',   port: 587, secure: false, auth: { user: 'apikey', pass } },
    mailgun:   { host: 'smtp.mailgun.org',    port: 587, secure: false, auth: { user, pass } },
    custom:    { host: process.env.EMAIL_HOST || 'localhost', port: parseInt(process.env.EMAIL_PORT || '587'), secure: false, auth: { user, pass } },
  };

  const config = configs[provider] || configs.office365;
  return nodemailer.createTransport(config);
}

function personalizeText(text, lead) {
  const firstName = (lead.name || '').split(' ')[0] || 'there';
  return text
    .replace(/{{first_name}}/gi, firstName)
    .replace(/{{name}}/gi, lead.name || '')
    .replace(/{{company}}/gi, lead.company_name || '')
    .replace(/{{title}}/gi, lead.title || '')
    .replace(/{{email}}/gi, lead.email || '');
}

async function logEmailToHubspot(lead, subject, body) {
  try {
    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!token) return;
    const h = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
    // Find or create contact
    const searchResp = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
      method: 'POST', headers: h,
      body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: lead.email }] }], properties: ['hs_object_id'], limit: 1 }),
    });
    const searchData = await searchResp.json();
    let contactId = searchData.results?.[0]?.id || null;
    if (!contactId) {
      const createResp = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST', headers: h,
        body: JSON.stringify({ properties: { email: lead.email, firstname: (lead.name || '').split(' ')[0], lastname: (lead.name || '').split(' ').slice(1).join(' '), jobtitle: lead.title || '', company: lead.company_name || '' } }),
      });
      const cd = await createResp.json();
      contactId = cd.id;
    }
    if (!contactId) return;
    // Log email activity
    await fetch('https://api.hubapi.com/crm/v3/objects/emails', {
      method: 'POST', headers: h,
      body: JSON.stringify({
        properties: { hs_timestamp: new Date().toISOString(), hs_email_direction: 'EMAIL', hs_email_status: 'SENT', hs_email_subject: subject, hs_email_text: body.replace(/<[^>]+>/g, ''), hs_email_html: body },
        associations: [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 198 }] }],
      }),
    });
  } catch (e) {
    console.error('HubSpot log error:', e.message);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { leads, template, batchSize = 10, delaySeconds = 60 } = req.body;
    if (!leads || !Array.isArray(leads) || !leads.length) return res.status(400).json({ error: 'No leads provided' });
    if (!template?.subject || !template?.body) return res.status(400).json({ error: 'Template subject and body are required' });

    const transporter = getTransporter();
    const fromName = process.env.EMAIL_FROM_NAME || 'ProspectAI';
    const fromEmail = process.env.EMAIL_USER;

    const results = [];
    let sent = 0;

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      if (!lead.email) { results.push({ email: lead.email || 'unknown', status: 'skipped', reason: 'No email address' }); continue; }
      const subject = personalizeText(template.subject, lead);
      const body = personalizeText(template.body, lead);
      try {
        await transporter.sendMail({ from: `${fromName} <${fromEmail}>`, to: lead.email, subject, html: body });
        await logEmailToHubspot(lead, subject, body);
        results.push({ email: lead.email, name: lead.name, status: 'sent' });
        sent++;
        if (sent % batchSize === 0 && i < leads.length - 1) await delay(delaySeconds * 1000);
      } catch (err) {
        results.push({ email: lead.email, name: lead.name, status: 'failed', reason: err.message });
      }
    }

    return res.status(200).json({ total: leads.length, sent, results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
