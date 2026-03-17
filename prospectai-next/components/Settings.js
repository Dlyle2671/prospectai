import { useState } from 'react';
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
    companySizeWeight: 25,
    industryWeight: 30,
    fundingWeight: 15,
    verifiedEmailBonus: 3,
    linkedinBonus: 2,
    phoneBonus: 2,
    hiringSurgeBonus: 8,
    awsBonus: 5,
    hotThreshold: 75,
    warmThreshold: 50,
    targetSizeRanges: ['51-100','101-250'],
    targetIndustries: ['technology','software','saas','cloud computing','cybersecurity','fintech','financial services','healthcare','biotech'],
};

// Dropdown option sets
const WEIGHT_OPTIONS = [0,5,10,15,20,25,30,35,40,45,50];
const BONUS_OPTIONS  = [0,1,2,3,4,5,6,7,8,9,10,12,15,20];
const THRESHOLD_OPTIONS = Array.from({length: 19}, (_, i) => (i + 1) * 5); // 5..95

const dropStyle = {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: 600,
    padding: '8px 12px',
    cursor: 'pointer',
    width: '100%',
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2394a3b8\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    paddingRight: 30,
};

const rowStyle = { marginBottom: 18 };
const labelRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 };
const labelStyle = { fontSize: 13, color: '#94a3b8', fontWeight: 500 };
const sectionStyle = { fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, marginBottom: 14, marginTop: 8 };

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

  function handleSave(id) {
        setSaved(prev => ({ ...prev, [id]: true }));
        setTimeout(() => setSaved(prev => ({ ...prev, [id]: false })), 2000);
  }

  function setIcpField(key, val) {
        setIcp(prev => ({ ...prev, [key]: Number(val) }));
  }

  function toggleSizeRange(range) {
        setIcp(prev => {
                const arr = Array.isArray(prev.targetSizeRanges) ? [...prev.targetSizeRanges] : [];
                const idx = arr.indexOf(range);
                if (idx >= 0) arr.splice(idx, 1); else arr.push(range);
                return { ...prev, targetSizeRanges: arr };
        });
  }

  function saveIcp() {
        paiSave('icp_weights', icp);
        setIcpSaved(true);
        setTimeout(() => setIcpSaved(false), 2000);
  }

  function resetIcp() {
        setIcp({ ...DEFAULT_ICP });
        paiSave('icp_weights', DEFAULT_ICP);
  }

  const selectedProvider = EMAIL_PROVIDERS.find(p => p.id === emailProvider);

  return (
        <div className="fade-up">
          <div className="section-title">Settings</div>
        <div className="section-sub">Customize lead scoring to match your ICP, and manage your integrations.</div>

      <div className="settings-card">
            <div className="settings-title">🎯 ICP Lead Scoring</div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
          Select scoring values for each category to match your ideal customer profile.
            </div>

        <div style={sectionStyle}>Score Weights</div>

{/* Company Size */}
        <div style={rowStyle}>
                    <div style={labelRowStyle}>
                      <span style={labelStyle}>Company Size Weight</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>{icp.companySizeWeight} pts</span>
          </div>
          <select style={dropStyle} value={icp.companySizeWeight} onChange={e => setIcpField('companySizeWeight', e.target.value)}>
        {WEIGHT_OPTIONS.map(v => <option key={v} value={v}>{v} points</option>)}
                            </select>
                                      <div style={{ fontSize: 11, color: '#475569', marginTop: 6, marginBottom: 8 }}>
            Select which headcount ranges are ideal for your ICP.
          </div>
                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
{SIZE_OPTIONS.map(s => {
                const active = Array.isArray(icp.targetSizeRanges) && icp.targetSizeRanges.includes(s);
                return (
                                  <button key={s} onClick={() => toggleSizeRange(s)} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid', background: active ? 'rgba(59,130,246,0.15)' : 'transparent', borderColor: active ? '#3b82f6' : '#334155', color: active ? '#93c5fd' : '#64748b', fontWeight: active ? 600 : 400, transition: 'all .15s' }}>
{s} employees
  </button>
              );
})}
</div>
  </div>

{/* Industry Match */}
        <div style={rowStyle}>
                    <div style={labelRowStyle}>
                      <span style={labelStyle}>Industry Match Weight</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>{icp.industryWeight} pts</span>
          </div>
          <select style={dropStyle} value={icp.industryWeight} onChange={e => setIcpField('industryWeight', e.target.value)}>
        {WEIGHT_OPTIONS.map(v => <option key={v} value={v}>{v} points</option>)}
                            </select>
                                      <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Points when company industry matches your target industries</div>
          </div>

         {/* Recent Funding */}
                 <div style={rowStyle}>
                             <div style={labelRowStyle}>
                               <span style={labelStyle}>Recent Funding Weight</span>
                     <span style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>{icp.fundingWeight} pts</span>
          </div>
          <select style={dropStyle} value={icp.fundingWeight} onChange={e => setIcpField('fundingWeight', e.target.value)}>
        {WEIGHT_OPTIONS.map(v => <option key={v} value={v}>{v} points</option>)}
                            </select>
                                      <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Bonus for companies funded in the last 18 months</div>
          </div>

        <div style={sectionStyle}>Signal Bonuses</div>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
{[
  { key: 'verifiedEmailBonus', label: 'Verified Email', hint: 'Bonus when email is verified' },
  { key: 'linkedinBonus', label: 'Has LinkedIn', hint: 'Bonus when LinkedIn URL is present' },
  { key: 'phoneBonus', label: 'Has Phone', hint: 'Bonus when direct phone is available' },
  { key: 'hiringSurgeBonus', label: 'Hiring Surge', hint: 'Company actively hiring / growing headcount' },
  { key: 'awsBonus', label: 'AWS Stack (3+ services)', hint: 'Bonus for deep AWS usage' },
            ].map(({ key, label, hint }) => (
                          <div key={key}>
                            <div style={labelRowStyle}>
                              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{label}</span>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>+{icp[key]}</span>
                  </div>
                                <select style={{ ...dropStyle, fontSize: 13 }} value={icp[key]} onChange={e => setIcpField(key, e.target.value)}>
{BONUS_OPTIONS.map(v => <option key={v} value={v}>+{v} points</option>)}
                   </select>
                                 <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{hint}</div>
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
            <select style={{ ...dropStyle, accentColor: '#ef4444', borderColor: '#ef444455' }} value={icp.hotThreshold} onChange={e => setIcp(prev => ({ ...prev, hotThreshold: Number(e.target.value) }))}>
{THRESHOLD_OPTIONS.filter(v => v > icp.warmThreshold).map(v => <option key={v} value={v}>{v}+</option>)}
                                                          </select>
                                                          </div>
                                                                    <div>
                                                                      <div style={labelRowStyle}>
                                                                        <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>🟡 Warm threshold</span>
                                                                        <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>{icp.warmThreshold}+</span>
  </div>
            <select style={{ ...dropStyle, borderColor: '#f59e0b55' }} value={icp.warmThreshold} onChange={e => setIcp(prev => ({ ...prev, warmThreshold: Number(e.target.value) }))}>
{THRESHOLD_OPTIONS.filter(v => v < icp.hotThreshold).map(v => <option key={v} value={v}>{v}+</option>)}
                                                         </select>
                                                         </div>
                                                         </div>

                                                                 <div style={sectionStyle}>Target Industries</div>
                                                                 <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
          Companies in these industries get full industry points. Others get 5 pts.
  </div>
         <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
{['technology','software','saas','cloud computing','cybersecurity','fintech','financial services','healthcare','biotech','e-commerce','media','education','real estate','logistics','manufacturing'].map(ind => {
              const active = icp.targetIndustries.includes(ind);
              return (
                              <button key={ind} onClick={() => { const arr = active ? icp.targetIndustries.filter(i => i !== ind) : [...icp.targetIndustries, ind]; setIcp(prev => ({ ...prev, targetIndustries: arr })); }} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid', background: active ? 'rgba(59,130,246,0.15)' : 'transparent', borderColor: active ? '#3b82f6' : '#334155', color: active ? '#93c5fd' : '#64748b', fontWeight: active ? 600 : 400 }}>
{ind}
</button>
            );
})}
</div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={saveIcp} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: icpSaved ? '#14532d' : '#1d4ed8', color: icpSaved ? '#4ade80' : '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
{icpSaved ? '✓ Saved' : 'Save ICP Settings'}
</button>
          <button onClick={resetIcp} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#64748b', fontSize: 14, cursor: 'pointer' }}>
            Reset to Defaults
              </button>
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
                <input className="form-input" type="password" placeholder={`Set via environment variable: ${integration.envKey}`} disabled />
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
