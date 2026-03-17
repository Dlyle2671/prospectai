import { useState, useEffect } from 'react';
import { paiSave, paiLoad } from '../lib/utils';

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

const SIZE_OPTIONS = ['1-10','11-25','26-50','51-100','101-250','251+'];

export const DEFAULT_ICP = {
    companySizeWeight: 35,
    industryWeight: 20,
    fundingWeight: 8,
    verifiedEmailBonus: 3,
    linkedinBonus: 2,
    phoneBonus: 2,
    hiringSurgeBonus: 3,
          awsBonus: 3,
    hotThreshold: 75,
    warmThreshold: 50,
    targetSizeRanges: ['51-100','101-250'],
    targetIndustries: ['technology', 'software', 'saas', 'cloud computing', 'cybersecurity', 'fintech', 'financial services', 'healthcare', 'biotech'],
};

const WEIGHT_KEYS = ['companySizeWeight', 'industryWeight', 'fundingWeight', 'verifiedEmailBonus', 'linkedinBonus', 'phoneBonus', 'hiringSurgeBonus', 'awsBonus'];

function calcTotal(icp) {
    return WEIGHT_KEYS.reduce((sum, k) => sum + (Number(icp[k]) || 0), 0);
}

export default function Settings() {
    const [saved, setSaved] = useState({});
    const [emailProvider, setEmailProvider] = useState('office365');
    const [emailUser, setEmailUser] = useState('');
    const [emailPass, setEmailPass] = useState('');
    const [customHost, setCustomHost] = useState('');
    const [customPort, setCustomPort] = useState(587);
    const [emailSaved, setEmailSaved] = useState(false);
    const [icp, setIcp] = useState(() => ({ ...DEFAULT_ICP, ...(paiLoad('icp_weights') || {}) }));
    const [icpSaved, setIcpSaved] = useState(false);

  const total = calcTotal(icp);
    const overBudget = total > 100;

  function handleSave(id) {
        setSaved(prev => ({ ...prev, [id]: true }));
        setTimeout(() => setSaved(prev => ({ ...prev, [id]: false })), 2000);
  }

  function setIcpField(key, rawVal) {
        const val = Number(rawVal);
        setIcp(prev => {
                const next = { ...prev, [key]: val };
                const newTotal = calcTotal(next);
                if (newTotal > 100) {
                          const excess = newTotal - 100;
                          next[key] = Math.max(0, val - excess);
                }
                return next;
        });
  }

  function toggleSizeRange(range) {
        setIcp(prev => {
                const arr = Array.isArray(prev.targetSizeRanges) ? [...prev.targetSizeRanges] : [];
                const idx = arr.indexOf(range);
                if (idx >= 0) arr.splice(idx, 1);
                else arr.push(range);
                return { ...prev, targetSizeRanges: arr };
        });
  }

  function saveIcp() {
        if (overBudget) return;
        paiSave('icp_weights', icp);
        setIcpSaved(true);
        setTimeout(() => setIcpSaved(false), 2000);
  }

  function resetIcp() {
        setIcp({ ...DEFAULT_ICP });
        paiSave('icp_weights', DEFAULT_ICP);
  }

  const selectedProvider = EMAIL_PROVIDERS.find(p => p.id === emailProvider);
    const sliderStyle = { width: '100%', accentColor: '#3b82f6', cursor: 'pointer' };
    const rowStyle = { marginBottom: 18 };
    const labelRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 };
    const labelStyle = { fontSize: 13, color: '#94a3b8', fontWeight: 500 };
    const valStyle = { fontSize: 13, fontWeight: 700, color: '#3b82f6', minWidth: 32, textAlign: 'right' };
    const sectionStyle = { fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, marginBottom: 14, marginTop: 8 };

  return (
        <div className="fade-up">
          <div className="section-title">Settings</div>
        <div className="section-sub">Customize lead scoring to match your ICP, and manage your integrations.</div>

      <div className="settings-card">
            <div className="settings-title">🎯 ICP Lead Scoring</div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          Adjust scoring weights to match your ideal customer profile. All weights must total 100 or less.
            </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>Total weight used</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: overBudget ? '#ef4444' : total === 100 ? '#22c55e' : '#3b82f6' }}>
{total} / 100
  </span>
  </div>
          <div style={{ background: '#0f172a', borderRadius: 6, overflow: 'hidden', height: 8, border: '1px solid #334155' }}>
            <div style={{
                height: '100%',
                width: Math.min(total, 100) + '%',
                background: overBudget ? '#ef4444' : total >= 90 ? '#f59e0b' : 'linear-gradient(90deg,#1d4ed8,#3b82f6)',
                transition: 'width .2s, background .2s',
}} />
  </div>
{overBudget && (
              <div style={{ fontSize: 11, color: '#ef4444', marginTop: 5 }}>
              ⚠️ Total exceeds 100. Reduce weights before saving.
                </div>
          )}
</div>

        <div style={sectionStyle}>Score Weights</div>

        <div style={rowStyle}>
            <div style={labelRowStyle}>
              <span style={labelStyle}>Company Size</span>
            <span style={valStyle}>{icp.companySizeWeight}</span>
  </div>
          <input type="range" min={0} max={60} value={icp.companySizeWeight}
            onChange={e => setIcpField('companySizeWeight', e.target.value)} style={sliderStyle} />
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 6, marginBottom: 8 }}>
            Select which headcount ranges are ideal for your ICP.
              </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
{SIZE_OPTIONS.map(s => {
                            const active = Array.isArray(icp.targetSizeRanges) && icp.targetSizeRanges.includes(s);
                return (
                              <button key={s} onClick={() => toggleSizeRange(s)} style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid',
                    background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                    borderColor: active ? '#3b82f6' : '#334155',
                    color: active ? '#93c5fd' : '#64748b',
                    fontWeight: active ? 600 : 400, transition: 'all .15s',
}}>{s} employees</button>
              );
})}
</div>
  </div>

        <div style={rowStyle}>
            <div style={labelRowStyle}>
              <span style={labelStyle}>Industry Match</span>
            <span style={valStyle}>{icp.industryWeight}</span>
  </div>
          <input type="range" min={0} max={50} value={icp.industryWeight}
            onChange={e => setIcpField('industryWeight', e.target.value)} style={sliderStyle} />
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>Points when company industry matches your target industries</div>
              </div>

        <div style={rowStyle}>
                        <div style={labelRowStyle}>
                          <span style={labelStyle}>Recent Funding</span>
            <span style={valStyle}>{icp.fundingWeight}</span>
              </div>
          <input type="range" min={0} max={30} value={icp.fundingWeight}
            onChange={e => setIcpField('fundingWeight', e.target.value)} style={sliderStyle} />
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>Bonus for companies funded in the last 18 months</div>
              </div>

        <div style={sectionStyle}>Signal Bonuses</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
{[
  { key: 'verifiedEmailBonus', label: 'Verified Email', max: 15 },
  { key: 'linkedinBonus', label: 'Has LinkedIn', max: 15 },
  { key: 'phoneBonus', label: 'Has Phone', max: 15 },
  { key: 'hiringSurgeBonus', label: 'Hiring Surge', max: 20 },
  { key: 'awsBonus', label: 'AWS Stack (3+ services)', max: 20 },
            ].map(({ key, label, max }) => (
                          <div key={key}>
                            <div style={labelRowStyle}>
                              <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>+{icp[key]}</span>
                  </div>
                                <input type="range" min={0} max={max} value={icp[key]}
                onChange={e => setIcpField(key, e.target.value)} style={sliderStyle} />
                  </div>
           ))}
</div>

        <div style={sectionStyle}>Score Thresholds</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div>
              <div style={labelRowStyle}>
                <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>🔴 Hot threshold</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>{icp.hotThreshold}+</span>
  </div>
            <input type="range" min={50} max={95} value={icp.hotThreshold}
              onChange={e => setIcp(prev => ({ ...prev, hotThreshold: Number(e.target.value) }))}
                              style={{ ...sliderStyle, accentColor: '#ef4444' }} />
                </div>
          <div>
              <div style={labelRowStyle}>
                              <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>🟡 Warm threshold</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>{icp.warmThreshold}+</span>
                </div>
            <input type="range" min={20} max={74} value={icp.warmThreshold}
              onChange={e => setIcp(prev => ({ ...prev, warmThreshold: Number(e.target.value) }))}
                              style={{ ...sliderStyle, accentColor: '#f59e0b' }} />
                </div>
                </div>

        <div style={sectionStyle}>Target Industries</div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
          Companies in these industries get full industry points. Others get 5 pts.
            </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
{['technology', 'software', 'saas', 'cloud computing', 'cybersecurity', 'fintech', 'financial services',
              'healthcare', 'biotech', 'e-commerce', 'media', 'education', 'real estate', 'logistics', 'manufacturing'].map(ind => {
                            const active = icp.targetIndustries.includes(ind);
                            return (
                                            <button key={ind} onClick={() => {
                                              const arr = active ? icp.targetIndustries.filter(i => i !== ind) : [...icp.targetIndustries, ind];
                                              setIcp(prev => ({ ...prev, targetIndustries: arr }));
                            }} style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid',
                  background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                  borderColor: active ? '#3b82f6' : '#334155',
                  color: active ? '#93c5fd' : '#64748b',
                  fontWeight: active ? 600 : 400,
}}>{ind}</button>
            );
})}
</div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={saveIcp} disabled={overBudget} style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: overBudget ? '#374151' : icpSaved ? '#14532d' : '#1d4ed8',
              color: overBudget ? '#6b7280' : icpSaved ? '#4ade80' : '#fff',
              fontSize: 14, fontWeight: 600, cursor: overBudget ? 'not-allowed' : 'pointer',
}}>
{icpSaved ? '✓ Saved' : 'Save ICP Settings'}
</button>
          <button onClick={resetIcp} style={{
              padding: '10px 20px', borderRadius: 8, border: '1px solid #334155',
              background: 'transparent', color: '#64748b', fontSize: 14, cursor: 'pointer',
}}>
            Reset to Defaults
              </button>
{overBudget && <span style={{ fontSize: 12, color: '#ef4444' }}>Reduce weights to save</span>}
  </div>
  </div>

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
                <input className="form-input" type="password"
                  placeholder={`Set via environment variable: ${integration.envKey}`} disabled />
                                    <div style={{ fontSize: 11, color: '#22c55e', marginTop: 6 }}>
                  <span className="status-dot" /> Stored securely in server environment variables
                    </div>
                    </div>
            )}
</div>
        ))}
          </div>

      <div className="settings-card">
                  <div className="settings-title">📧 Email Configuration</div>
        <div className="form-row">
                    <label className="form-label">Email Provider</label>
          <select className="form-select" value={emailProvider} onChange={e => setEmailProvider(e.target.value)}>
        {EMAIL_PROVIDERS.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
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
  {emailProvider === 'gmail' ? 'App Password (not your Google password)'
                 : emailProvider === 'sendgrid' ? 'API Key' : 'Password'}
  </label>
          <input className="form-input" type="password" value={emailPass} onChange={e => setEmailPass(e.target.value)} placeholder="••••••••••••" />
{emailProvider === 'gmail' && (
              <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
                ⚠️ Gmail requires an App Password. Enable 2FA and create one at myaccount.google.com/apppasswords
  </div>
          )}
</div>
        <button className={`save-btn ${emailSaved ? 'saved' : ''}`} onClick={() => {
          handleSave('email');
                      setEmailSaved(true);
                      setTimeout(() => setEmailSaved(false), 2000);
          }}>
{emailSaved ? '✓ Saved' : 'Save Email Settings'}
</button>
  </div>

      <div className="settings-card">
          <div className="settings-title">⚙️ Environment Variables</div>
        <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
          <p style={{ marginBottom: 12 }}>API keys are stored as environment variables on your server — never in the browser or database.</p>
          <div style={{ background: '#080c14', border: '1px solid #1a2540', borderRadius: 8, padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: '#e2e8f0' }}>
            <div>APOLLO_API_KEY=your_apollo_key</div>
            <div>HUBSPOT_ACCESS_TOKEN=your_hubspot_token</div>
            <div>EMAIL_USER=sender@yourdomain.com</div>
            <div>EMAIL_PASS=your_email_password</div>
            <div>EMAIL_FROM_NAME=ProspectAI</div>
  </div>
  </div>
  </div>
  </div>
  );
}
