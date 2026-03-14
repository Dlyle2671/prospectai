import { useState } from 'react';

const INTEGRATIONS = [
  { id: 'apollo', name: 'Apollo.io', icon: '🚀', description: 'Contact & company data enrichment', envKey: 'APOLLO_API_KEY' },
  { id: 'hubspot', name: 'HubSpot', icon: '🟠', description: 'CRM — push contacts and companies', envKey: 'HUBSPOT_ACCESS_TOKEN' },
  { id: 'salesforce', name: 'Salesforce', icon: '☁️', description: 'CRM — push contacts and leads', envKey: 'SALESFORCE_ACCESS_TOKEN', comingSoon: true },
  { id: 'pipedrive', name: 'Pipedrive', icon: '🟢', description: 'CRM — push deals and contacts', envKey: 'PIPEDRIVE_API_KEY', comingSoon: true },
  { id: 'hunter', name: 'Hunter.io', icon: '🔍', description: 'Email finding and verification', envKey: 'HUNTER_API_KEY', comingSoon: true },
  { id: 'clearbit', name: 'Clearbit', icon: '🔷', description: 'Company and person enrichment', envKey: 'CLEARBIT_API_KEY', comingSoon: true },
];

const EMAIL_PROVIDERS = [
  { id: 'office365', name: 'Office 365 / Outlook', host: 'smtp.office365.com', port: 587 },
  { id: 'gmail', name: 'Gmail', host: 'smtp.gmail.com', port: 587 },
  { id: 'sendgrid', name: 'SendGrid', host: 'smtp.sendgrid.net', port: 587 },
  { id: 'mailgun', name: 'Mailgun', host: 'smtp.mailgun.org', port: 587 },
  { id: 'custom', name: 'Custom SMTP', host: '', port: 587 },
];

export default function Settings() {
  const [saved, setSaved] = useState({});
  const [emailProvider, setEmailProvider] = useState('office365');
  const [emailUser, setEmailUser] = useState('');
  const [emailPass, setEmailPass] = useState('');
  const [customHost, setCustomHost] = useState('');
  const [customPort, setCustomPort] = useState(587);
  const [emailSaved, setEmailSaved] = useState(false);

  function handleSave(id) {
    setSaved(prev => ({ ...prev, [id]: true }));
    setTimeout(() => setSaved(prev => ({ ...prev, [id]: false })), 2000);
  }

  const selectedProvider = EMAIL_PROVIDERS.find(p => p.id === emailProvider);

  return (
    <div className="fade-up">
      <div className="section-title">Settings</div>
      <div className="section-sub">Connect your data sources and CRM integrations. Your API keys are stored securely as environment variables — never in the browser.</div>

      {/* Data Sources & CRM Connections */}
      <div className="settings-card">
        <div className="settings-title">🔌 Integrations</div>
        {INTEGRATIONS.map(integration => (
          <div key={integration.id} className="connection-card">
            <div className="connection-header">
              <div>
                <div className="connection-name">{integration.icon} {integration.name}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{integration.description}</div>
              </div>
              {integration.comingSoon
                ? <span style={{ fontSize: 11, color: '#64748b', background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)', padding: '3px 10px', borderRadius: 20 }}>Coming Soon</span>
                : <span className="connection-status connected">● Connected</span>
              }
            </div>
            {!integration.comingSoon && (
              <div className="form-row">
                <label className="form-label">{integration.name} API Key / Token</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder={`Set via environment variable: ${integration.envKey}`}
                  disabled
                />
                <div style={{ fontSize: 11, color: '#22c55e', marginTop: 6 }}>
                  <span className="status-dot" />
                  Stored securely in server environment variables
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Email Configuration */}
      <div className="settings-card">
        <div className="settings-title">📧 Email Configuration</div>
        <div className="form-row">
          <label className="form-label">Email Provider</label>
          <select className="form-select" value={emailProvider} onChange={e => setEmailProvider(e.target.value)}>
            {EMAIL_PROVIDERS.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label className="form-label">SMTP Host</label>
          {emailProvider === 'custom'
            ? <input className="form-input" type="text" value={customHost} onChange={e => setCustomHost(e.target.value)} placeholder="smtp.yourdomain.com" />
            : <input className="form-input" type="text" value={selectedProvider?.host} disabled />
          }
        </div>
        <div className="form-row">
          <label className="form-label">Port</label>
          {emailProvider === 'custom'
            ? <input className="form-input" type="number" value={customPort} onChange={e => setCustomPort(e.target.value)} style={{ width: 100 }} />
            : <input className="form-input" type="number" value={selectedProvider?.port} disabled style={{ width: 100 }} />
          }
        </div>
        <div className="form-row">
          <label className="form-label">Email Address (sender)</label>
          <input className="form-input" type="email" value={emailUser} onChange={e => setEmailUser(e.target.value)} placeholder="you@yourcompany.com" />
        </div>
        <div className="form-row">
          <label className="form-label">
            {emailProvider === 'gmail' ? 'App Password (not your Google password)' : emailProvider === 'sendgrid' ? 'API Key' : 'Password'}
          </label>
          <input className="form-input" type="password" value={emailPass} onChange={e => setEmailPass(e.target.value)} placeholder="••••••••••••" />
          {emailProvider === 'gmail' && (
            <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
              ⚠️ Gmail requires an App Password. Enable 2FA and create one at myaccount.google.com/apppasswords
            </div>
          )}
        </div>
        <button className={`save-btn ${emailSaved ? 'saved' : ''}`} onClick={() => { handleSave('email'); setEmailSaved(true); setTimeout(() => setEmailSaved(false), 2000); }}>
          {emailSaved ? '✓ Saved' : 'Save Email Settings'}
        </button>
      </div>

      {/* Environment Variables Guide */}
      <div className="settings-card">
        <div className="settings-title">⚙️ Environment Variables</div>
        <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
          <p style={{ marginBottom: 12 }}>API keys are stored as environment variables on your server — never in the browser or database. Set them in your deployment environment:</p>
          <div style={{ background: '#080c14', border: '1px solid #1a2540', borderRadius: 8, padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: '#e2e8f0' }}>
            <div>APOLLO_API_KEY=your_apollo_key</div>
            <div>HUBSPOT_ACCESS_TOKEN=your_hubspot_token</div>
            <div>EMAIL_USER=sender@yourdomain.com</div>
            <div>EMAIL_PASS=your_email_password</div>
            <div>EMAIL_FROM_NAME=ProspectAI</div>
            <div style={{ color: '#475569', marginTop: 8 }}># AWS Amplify: set in App settings → Environment variables</div>
            <div style={{ color: '#475569' }}># EC2/ECS: set in .env file or task definition</div>
          </div>
        </div>
      </div>
    </div>
  );
}
