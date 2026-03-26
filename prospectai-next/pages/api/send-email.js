// ProspectAI — /api/send-email (Next.js API route)
// Multi-provider email support: Office365, Gmail, SendGrid, Mailgun, custom SMTP
// Per-user SMTP credentials from Redis; falls back to env vars
import nodemailer from 'nodemailer';
import { Redis } from '@upstash/redis';
import { getAuth } from '@clerk/nextjs/server';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const delay = ms => new Promise(r => setTimeout(r, ms));

async function getUserIntegrations(userId) {
    if (!userId) return {};
    try {
          const data = await redis.get(`user:${userId}:integrations`);
          return data || {};
    } catch { return {}; }
}

// Build transporter from user-specific or env-var credentials
function getTransporter(integrations) {
    const provider = integrations.email_provider || process.env.EMAIL_PROVIDER || 'office365';
    const user = integrations.email_user || process.env.EMAIL_USER;
    const pass = integrations.email_pass || process.env.EMAIL_PASS;
    const configs = {
          office365: { host: 'smtp.office365.com', port: 587, secure: false, auth: { user, pass }, tls: { ciphers: 'SSLv3' } },
          gmail: { host: 'smtp.gmail.com', port: 587, secure: false, auth: { user, pass } },
          sendgrid: { host: 'smtp.sendgrid.net', port: 587, secure: false, auth: { user: 'apikey', pass } },
          mailgun: { host: 'smtp.mailgun.org', port: 587, secure: false, auth: { user, pass } },
          custom: {
                  host: integrations.email_host || process.env.EMAIL_HOST || 'localhost',
                  port: parseInt(integrations.email_port || process.env.EMAIL_PORT || '587'),
                  secure: false,
                  auth: { user, pass },
          },
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

async function logEmailToHubspot(lead, subject, body, hubspotToken) {
    try {
          const token = hubspotToken || process.env.HUBSPOT_ACCESS_TOKEN;
          if (!token) return;
          const h = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
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
          await fetch('https://api.hubapi.com/crm/v3/objects/emails', {
                  method: 'POST', headers: h,
                  body: JSON.stringify({
                            properties: { hs_timestamp: new Date().toISOString(), hs_email_direction: 'EMAIL', hs_email_status: 'SENT', hs_email_subject: subject, hs_email_text: body.replace(/<[^>]+>/g, ''), hs_email_html: body },
                            associations: [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 198 }] }],
                  }),
          });
    } catch (e) { console.error('HubSpot log error:', e.message); }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
        // Load per-user integrations
      const { userId } = getAuth(req);
        const integrations = await getUserIntegrations(userId);

      const { leads, template, batchSize = 10, delaySeconds = 60 } = req.body;
        if (!leads || !Array.isArray(leads) || !leads.length)
                return res.status(400).json({ error: 'No leads provided' });
        if (!template?.subject || !template?.body)
                return res.status(400).json({ error: 'Template subject and body are required' });

      const transporter = getTransporter(integrations);
        const fromEmail = integrations.email_user || process.env.EMAIL_USER;
        const fromName = process.env.EMAIL_FROM_NAME || 'ProspectAI';
        const hubspotToken = integrations.hubspot || null;

      const results = [];
        let sent = 0;

      for (let i = 0; i < leads.length; i++) {
              const lead = leads[i];
              if (!lead.email) {
                        results.push({ email: lead.email || 'unknown', status: 'skipped', reason: 'No email address' });
                        continue;
              }
              const subject = personalizeText(template.subject, lead);
              const body = personalizeText(template.body, lead);
              try {
                        await transporter.sendMail({ from: `${fromName} <${fromEmail}>`, to: lead.email, subject, html: body });
                        await logEmailToHubspot(lead, subject, body, hubspotToken);
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
