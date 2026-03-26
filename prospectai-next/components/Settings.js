import { useState, useEffect, useMemo } from 'react';

const EMAIL_PROVIDERS = [
  { id: 'office365', name: 'Office 365 / Outlook', host: 'smtp.office365.com', port: 587 },
  { id: 'gmail', name: 'Gmail', host: 'smtp.gmail.com', port: 587 },
  { id: 'sendgrid', name: 'SendGrid', host: 'smtp.sendgrid.net', port: 587 },
  { id: 'mailgun', name: 'Mailgun', host: 'smtp.mailgun.org', port: 587 },
  { id: 'custom', name: 'Custom SMTP', host: '', port: 587 },
  ];

const SIZE_OPTIONS = ['1-10','11-25','26-50','51-100','101-250','251+'];

export const DEFAULT_ICP = {
    companySizeWeight: 25, industryWeight: 30, fundingWeight: 15,
    verifiedEmailBonus: 3, linkedinBonus: 2, phoneBonus: 2,
    hiringSurgeBonus: 8, awsBonus: 5, hotThreshold: 75, warmThreshold: 50,
    targetSizeRanges: ['51-100','101-250'],
    targetIndustries: ['technology','software','saas','cloud computing','cybersecurity','fintech','financial services','healthcare','biotech'],
};

const BUDGET_KEYS = ['companySizeWeight','industryWeight','fundingWeight','verifiedEmailBonus','linkedinBonus','phoneBonus','hiringSurgeBonus','awsBonus'];
const POINT_OPTIONS = Array.from({ length: 101 }, (_, i) => i);
const THRESHOLD_OPTIONS = Array.from({ length: 19 }, (_, i) => (i + 1) * 5);

async function loadSetting(ns) {
    try {
          const res = await fetch(`/api/user-settings?ns=${ns}`);
          if (!res.ok) return null;
          const { data } = await res.json();
          return data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;
    } catch { return null; }
}

async function saveSetting(ns, data) {
    try {
          await fetch(`/api/user-settings?ns=${ns}`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ data }),
          });
    } catch (e) { console.error('saveSetting error', e); }
}

const dropStyle = {
    background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
                                        color: '#e2e8f0', fontSize: 14, fontWeight: 600, padding: '8px 12px',
    cursor: 'pointer', width: '100%', appearance: 'none', WebkitAppearance: 'none',
    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2394a3b8\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 30
};
const rowStyle = { marginBottom: 18 };
const labelRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 };
const labelStyle = { fontSize: 13, color: '#94a3b8', fontWeight: 500 };
const sectionStyle = { fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, marginBottom: 14, marginTop: 8 };

// ─── Integrations Section ────────────────────────────────────────────────────
const INTEGRATION_CARDS = [
  {
        id: 'apollo', label: 'Apollo.io', icon: '🚀', required: true,
        description: 'Contact & company data enrichment',
        placeholder: 'sk-ant-api...',
        docs: 'https://developer.apollo.io/',
  },
  {
        id: 'hubspot', label: 'HubSpot', icon: '🟠', required: false,
        description: 'CRM — push contacts and log emails',
        placeholder: 'pat-na1-...',
        docs: 'https://developers.hubspot.com/docs/api/private-apps',
  },
  {
        id: 'anthropic', label: 'Anthropic (Claude AI)', icon: '🤖', required: false,
        description: 'AI email drafting — uses Claude Haiku',
        placeholder: 'sk-ant-api...',
        docs: 'https://console.anthropic.com/account/keys',
  },
  ];

function maskKey(k) {
    if (!k || k.length < 8) return '••••••••';
    return k.slice(0, 4) + '••••••••' + k.slice(-4);
}

function IntegrationsCard() {
    const [integrations, setIntegrations] = useState({});
    const [loading, setLoading] = useState(true);
    const [fields, setFields] = useState({});
    const [show, setShow] = useState({});
    const [saving, setSaving] = useState({});
    const [saved, setSavedMap] = useState({});
    const [errors, setErrors] = useState({});

  // Email SMTP
  const [emailProvider, setEmailProvider] = useState('office365');
    const [emailUser, setEmailUser] = useState('');
    const [emailPass, setEmailPass] = useState('');
    const [customHost, setCustomHost] = useState('');
    const [customPort, setCustomPort] = useState(587);
    const [showEmailPass, setShowEmailPass] = useState(false);
    const [emailSaving, setEmailSaving] = useState(false);
    const [emailSaved, setEmailSaved] = useState(false);

  useEffect(() => {
        async function load() {
                setLoading(true);
                try {
                          const res = await fetch('/api/user-integrations');
                          if (res.ok) {
                                      const data = await res.json();
                                      setIntegrations(data);
                                      // Pre-fill email fields if set
                            if (data.email_provider) setEmailProvider(data.email_provider);
                                      if (data.email_user) setEmailUser(data.email_user);
                                      if (data.email_host) setCustomHost(data.email_host);
                                      if (data.email_port) setCustomPort(data.email_port);
                          }
                } catch (e) { console.error(e); }
                setLoading(false);
        }
        load();
  }, []);

  async function saveKey(id) {
        const val = (fields[id] || '').trim();
        if (!val) {
                setErrors(e => ({ ...e, [id]: 'Cannot save an empty key' }));
                return;
        }
        setSaving(s => ({ ...s, [id]: true }));
        setErrors(e => ({ ...e, [id]: null }));
        try {
                const res = await fetch('/api/user-integrations', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ key: id, value: val }),
                });
                if (res.ok) {
                          const updated = await res.json();
                          setIntegrations(updated);
                          setFields(f => ({ ...f, [id]: '' }));
                          setSavedMap(s => ({ ...s, [id]: true }));
                          setTimeout(() => setSavedMap(s => ({ ...s, [id]: false })), 2000);
                } else {
                          const err = await res.json();
                          setErrors(e => ({ ...e, [id]: err.error || 'Save failed' }));
                }
        } catch { setErrors(e => ({ ...e, [id]: 'Network error' })); }
        setSaving(s => ({ ...s, [id]: false }));
  }

  async function removeKey(id) {
        try {
                await fetch('/api/user-integrations', {
                          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ key: id }),
                });
                setIntegrations(prev => { const n = { ...prev }; delete n[id]; return n; });
        } catch (e) { console.error(e); }
  }

  async function saveEmailConfig() {
        setEmailSaving(true);
        try {
                const payload = { email_provider: emailProvider, email_user: emailUser };
                if (emailPass) payload.email_pass = emailPass;
                if (emailProvider === 'custom') {
                          payload.email_host = customHost;
                          payload.email_port = customPort;
                }
                const res = await fetch('/api/user-integrations', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ bulk: payload }),
                });
                if (res.ok) {
                          setEmailSaved(true);
                          setTimeout(() => setEmailSaved(false), 2000);
                }
        } catch (e) { console.error(e); }
        setEmailSaving(false);
  }

  const selectedProvider = EMAIL_PROVIDERS.find(p => p.id === emailProvider);

  if (loading) return <div style={{ padding: '20px 0', color: '#64748b', fontSize: 13 }}>Loading integrations…</div>;

  return (
        <div>
  {INTEGRATION_CARDS.map(card => {
            const isSet = integrations[card.id] === true;
            const maskedVal = isSet ? maskKey('') : null;
            return (
                        <div key={card.id} style={{ background: '#080c14', border: `1px solid ${card.required && !isSet ? '#ef444433' : '#1e293b'}`, borderRadius: 10, padding: '16px 18px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
{card.icon} {card.label}
{card.required && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.15)', border: '1px solid #ef444444', color: '#f87171', borderRadius: 20, padding: '1px 8px', marginLeft: 8, verticalAlign: 'middle' }}>Required</span>}
  </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{card.description}</div>
  </div>
{isSet
                 ? <span style={{ fontSize: 12, background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e44', color: '#4ade80', borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>● Connected</span>
                : <span style={{ fontSize: 12, background: 'rgba(100,116,139,0.1)', border: '1px solid #33415544', color: '#64748b', borderRadius: 20, padding: '3px 10px', flexShrink: 0 }}>Not connected</span>
}
</div>
{isSet && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, color: '#94a3b8', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, padding: '6px 10px' }}>
                  ••••••••••••••••••••
                    </div>
                <button onClick={() => removeKey(card.id)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid #ef444444', background: 'transparent', color: '#f87171', cursor: 'pointer' }}>
                  Remove
                    </button>
                    </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type={show[card.id] ? 'text' : 'password'}
                  placeholder={isSet ? 'Enter new key to replace…' : card.placeholder}
                  value={fields[card.id] || ''}
                  onChange={e => setFields(f => ({ ...f, [card.id]: e.target.value }))}
                                      onKeyDown={e => { if (e.key === 'Enter') saveKey(card.id); }}
                  style={{ width: '100%', background: '#0f172a', border: `1px solid ${errors[card.id] ? '#ef4444' : '#334155'}`, borderRadius: 8, color: '#e2e8f0', fontSize: 13, padding: '8px 36px 8px 12px', boxSizing: 'border-box' }}
                />
                <button onClick={() => setShow(s => ({ ...s, [card.id]: !s[card.id] }))} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14 }}>
{show[card.id] ? '🙈' : '👁'}
</button>
  </div>
              <button
                onClick={() => saveKey(card.id)}
                disabled={saving[card.id] || !fields[card.id]}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: saved[card.id] ? '#14532d' : (saving[card.id] || !fields[card.id]) ? '#1e293b' : '#1d4ed8', color: saved[card.id] ? '#4ade80' : (saving[card.id] || !fields[card.id]) ? '#475569' : '#fff', fontSize: 13, fontWeight: 600, cursor: (saving[card.id] || !fields[card.id]) ? 'not-allowed' : 'pointer', flexShrink: 0 }}
              >
{saved[card.id] ? '✓ Saved' : saving[card.id] ? '…' : 'Save'}
</button>
  </div>
{errors[card.id] && <div style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>{errors[card.id]}</div>}
            <div style={{ fontSize: 11, color: '#334155', marginTop: 8 }}>
              <a href={card.docs} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>📖 Docs / Get API Key</a>
  </div>
  </div>
        );
})}

{/* Email SMTP Config */}
      <div style={{ background: '#080c14', border: '1px solid #1e293b', borderRadius: 10, padding: '16px 18px', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>📧 Email SMTP</div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>Configure how ProspectAI sends emails on your behalf.</div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Provider</label>
                              <select style={dropStyle} value={emailProvider} onChange={e => setEmailProvider(e.target.value)}>
      {EMAIL_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        </div>
{emailProvider === 'custom' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10, marginBottom: 12 }}>
            <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>SMTP Host</label>
              <input className="form-input" type="text" placeholder="smtp.yourdomain.com" value={customHost} onChange={e => setCustomHost(e.target.value)} />
  </div>
            <div>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Port</label>
              <input className="form-input" type="number" value={customPort} onChange={e => setCustomPort(e.target.value)} />
                                                                                       </div>
  </div>
        )}
{emailProvider !== 'custom' && (
            <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>SMTP Host</label>
            <input className="form-input" type="text" value={selectedProvider?.host} disabled />
  </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Email Address (sender)</label>
          <input className="form-input" type="email" placeholder="you@yourcompany.com" value={emailUser} onChange={e => setEmailUser(e.target.value)} />
{integrations.email_user && <div style={{ fontSize: 11, color: '#22c55e', marginTop: 4 }}>● Currently saved: {emailUser || '(set)'}</div>}
  </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
{emailProvider === 'gmail' ? 'App Password' : emailProvider === 'sendgrid' ? 'API Key' : 'Password'}
</label>
          <div style={{ position: 'relative' }}>
            <input
              className="form-input"
              type={showEmailPass ? 'text' : 'password'}
              placeholder={integrations.email_pass ? '••••••••••••  (saved — enter new to change)' : '••••••••••••'}
              value={emailPass}
              onChange={e => setEmailPass(e.target.value)}
                              style={{ paddingRight: 36 }}
            />
            <button onClick={() => setShowEmailPass(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14 }}>
{showEmailPass ? '🙈' : '👁'}
</button>
  </div>
{emailProvider === 'gmail' && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>⚠️ Gmail requires an App Password. Enable 2FA at myaccount.google.com/apppasswords</div>}
  </div>
        <button
          onClick={saveEmailConfig}
          disabled={emailSaving}
          style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: emailSaved ? '#14532d' : emailSaving ? '#1e293b' : '#1d4ed8', color: emailSaved ? '#4ade80' : emailSaving ? '#475569' : '#fff', fontSize: 14, fontWeight: 600, cursor: emailSaving ? 'not-allowed' : 'pointer' }}
        >
{emailSaved ? '✓ Saved' : emailSaving ? 'Saving…' : 'Save Email Config'}
</button>
  </div>
  </div>
  );
}

  // ─── Main Settings Component ─────────────────────────────────────────────────
export default function Settings() {
    const [settingsLoading, setSettingsLoading] = useState(true);
    const [saved, setSaved] = useState({});
    const [icp, setIcp] = useState({ ...DEFAULT_ICP });
    const [icpSaved, setIcpSaved] = useState(false);
    const [senderEmails, setSenderEmails] = useState([]);
    const [newSenderEmail, setNewSenderEmail] = useState('');
    const [newSenderName, setNewSenderName] = useState('');
    const [senderSaved, setSenderSaved] = useState(false);

  useEffect(() => {
        async function loadAll() {
                setSettingsLoading(true);
                const [icpData, senderData] = await Promise.all([
                          loadSetting('icp_weights'),
                          loadSetting('sender_emails'),
                        ]);
                if (icpData) setIcp({ ...DEFAULT_ICP, ...icpData });
                if (senderData) setSenderEmails(senderData);
                setSettingsLoading(false);
        }
        loadAll();
  }, []);

  const total = useMemo(() => BUDGET_KEYS.reduce((sum, k) => sum + (Number(icp[k]) || 0), 0), [icp]);
    const remaining = 100 - total;
    const overBudget = total > 100;
    const nearBudget = total >= 85 && total <= 100;
    const totalColor = overBudget ? '#ef4444' : nearBudget ? '#f59e0b' : total === 100 ? '#22c55e' : '#3b82f6';
    const remainingLabel = overBudget ? `${Math.abs(remaining)} pts over budget` : remaining === 0 ? 'Budget fully allocated' : `${remaining} pts remaining`;

  function setIcpField(key, val) { setIcp(prev => ({ ...prev, [key]: Number(val) })); }

  function toggleSizeRange(range) {
        setIcp(prev => {
                const arr = Array.isArray(prev.targetSizeRanges) ? [...prev.targetSizeRanges] : [];
                const idx = arr.indexOf(range);
                if (idx >= 0) arr.splice(idx, 1); else arr.push(range);
                return { ...prev, targetSizeRanges: arr };
        });
  }

  async function saveIcp() {
        if (overBudget) return;
        await saveSetting('icp_weights', icp);
        setIcpSaved(true);
        setTimeout(() => setIcpSaved(false), 2000);
  }

  async function resetIcp() {
        setIcp({ ...DEFAULT_ICP });
        await saveSetting('icp_weights', DEFAULT_ICP);
  }

  async function addSenderEmail() {
        const email = newSenderEmail.trim().toLowerCase();
        const name = newSenderName.trim();
        if (!email || !email.includes('@')) return;
        if (senderEmails.find(s => s.email === email)) return;
        const updated = [...senderEmails, { email, name, isDefault: senderEmails.length === 0 }];
        setSenderEmails(updated);
        await saveSetting('sender_emails', updated);
        setNewSenderEmail('');
        setNewSenderName('');
        setSenderSaved(true);
        setTimeout(() => setSenderSaved(false), 2000);
  }

  async function removeSenderEmail(email) {
        let updated = senderEmails.filter(s => s.email !== email);
        if (updated.length > 0 && !updated.find(s => s.isDefault)) updated[0] = { ...updated[0], isDefault: true };
        setSenderEmails(updated);
        await saveSetting('sender_emails', updated);
  }

  async function setDefaultSender(email) {
        const updated = senderEmails.map(s => ({ ...s, isDefault: s.email === email }));
        setSenderEmails(updated);
        await saveSetting('sender_emails', updated);
  }

  function fieldDrop(key) {
        const val = icp[key];
        return (
                <select style={{ ...dropStyle, borderColor: overBudget && val > 0 ? '#ef444488' : '#334155' }} value={val} onChange={e => setIcpField(key, e.target.value)}>
{POINT_OPTIONS.map(v => <option key={v} value={v}>{v} points</option>)}
                   </select>
                       );
}

  if (settingsLoading) {
        return (
                <div className="fade-up">
                  <div className="section-title">Settings</div>
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569', fontSize: 14 }}>Loading your settings…</div>
    </div>
    );
}

  return (
        <div className="fade-up">
          <div className="section-title">Settings</div>
      <div className="section-sub">Customize lead scoring to match your ICP, manage integrations, and configure sending.</div>

{/* ICP Lead Scoring */}
      <div className="settings-card">
                <div className="settings-title">🎯 ICP Lead Scoring</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Assign point values to each category. All points must total 100 or less.</div>
        <div style={{ background: '#080c14', border: `1px solid ${totalColor}44`, borderRadius: 10, padding: '14px 18px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>Points budget</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: totalColor, letterSpacing: '-0.5px' }}>
      {total} <span style={{ fontSize: 14, color: '#475569', fontWeight: 500 }}>/ 100</span>
        </span>
        </div>
          <div style={{ background: '#1e293b', borderRadius: 6, height: 10, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ height: '100%', width: Math.min(total, 100) + '%', background: overBudget ? '#ef4444' : nearBudget ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : total === 100 ? '#22c55e' : 'linear-gradient(90deg,#1d4ed8,#3b82f6)', borderRadius: 6, transition: 'width 0.2s, background 0.2s' }} />
        </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
{BUDGET_KEYS.map(k => {
                const v = Number(icp[k]) || 0;
                if (!v) return null;
                const labels = { companySizeWeight:'Size', industryWeight:'Industry', fundingWeight:'Funding', verifiedEmailBonus:'Email', linkedinBonus:'LinkedIn', phoneBonus:'Phone', hiringSurgeBonus:'Hiring', awsBonus:'AWS' };
                return (<span key={k} style={{ fontSize: 11, background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: '2px 10px', color: '#94a3b8' }}>{labels[k]}: <strong style={{ color: '#e2e8f0' }}>{v}pts</strong></span>);
})}
</div>
          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: totalColor }}>
{overBudget ? `⚠️ ${remainingLabel} — reduce points before saving` : remaining === 0 ? '✓ Budget fully allocated' : `ℹ️ ${remainingLabel}`}
</div>
  </div>
        <div style={sectionStyle}>Score Weights</div>
        <div style={rowStyle}>
            <div style={labelRowStyle}><span style={labelStyle}>Company Size</span><span style={{ fontSize: 13, fontWeight: 700, color: totalColor }}>{icp.companySizeWeight} pts</span></div>
{fieldDrop('companySizeWeight')}
          <div style={{ fontSize: 11, color: '#475569', marginTop: 6, marginBottom: 8 }}>Select which headcount ranges are ideal for your ICP.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
  {SIZE_OPTIONS.map(s => {
                  const active = Array.isArray(icp.targetSizeRanges) && icp.targetSizeRanges.includes(s);
                  return (<button key={s} onClick={() => toggleSizeRange(s)} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid', background: active ? 'rgba(59,130,246,0.15)' : 'transparent', borderColor: active ? '#3b82f6' : '#334155', color: active ? '#93c5fd' : '#64748b', fontWeight: active ? 600 : 400, transition: 'all .15s' }}>{s} employees</button>);
})}
  </div>
  </div>
        <div style={rowStyle}>
            <div style={labelRowStyle}><span style={labelStyle}>Industry Match</span><span style={{ fontSize: 13, fontWeight: 700, color: totalColor }}>{icp.industryWeight} pts</span></div>
{fieldDrop('industryWeight')}
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Points when company industry matches your target industries</div>
            </div>
        <div style={rowStyle}>
                      <div style={labelRowStyle}><span style={labelStyle}>Recent Funding</span><span style={{ fontSize: 13, fontWeight: 700, color: totalColor }}>{icp.fundingWeight} pts</span></div>
{fieldDrop('fundingWeight')}
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
                                      <div style={labelRowStyle}><span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{label}</span><span style={{ fontSize: 12, fontWeight: 700, color: totalColor }}>{icp[key]} pts</span></div>
                            {fieldDrop(key)}
                         <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{hint}</div>
            </div>
          ))}
            </div>
        <div style={sectionStyle}>Score Thresholds</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div>
                        <div style={labelRowStyle}><span style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>🔴 Hot threshold</span><span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>{icp.hotThreshold}+</span></div>
            <select style={{ ...dropStyle, borderColor: '#ef444455' }} value={icp.hotThreshold} onChange={e => setIcp(prev => ({ ...prev, hotThreshold: Number(e.target.value) }))}>
          {THRESHOLD_OPTIONS.filter(v => v > icp.warmThreshold).map(v => <option key={v} value={v}>{v}+</option>)}
                                                                    </select>
                                                                    </div>
                                                                              <div>
                                                                                <div style={labelRowStyle}><span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>🟡 Warm threshold</span><span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>{icp.warmThreshold}+</span></div>
                                                                                <select style={{ ...dropStyle, borderColor: '#f59e0b55' }} value={icp.warmThreshold} onChange={e => setIcp(prev => ({ ...prev, warmThreshold: Number(e.target.value) }))}>
          {THRESHOLD_OPTIONS.filter(v => v < icp.hotThreshold).map(v => <option key={v} value={v}>{v}+</option>)}
                                                                   </select>
                                                                   </div>
                                                                   </div>
                                                                           <div style={sectionStyle}>Target Industries</div>
                                                                           <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>Companies in these industries get full industry points. Others get 5 pts.</div>
                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
{['technology','software','saas','cloud computing','cybersecurity','fintech','financial services','healthcare','biotech','e-commerce','media','education','real estate','logistics','manufacturing'].map(ind => {
              const active = icp.targetIndustries.includes(ind);
              return (<button key={ind} onClick={() => { const arr = active ? icp.targetIndustries.filter(i => i !== ind) : [...icp.targetIndustries, ind]; setIcp(prev => ({ ...prev, targetIndustries: arr })); }} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid', background: active ? 'rgba(59,130,246,0.15)' : 'transparent', borderColor: active ? '#3b82f6' : '#334155', color: active ? '#93c5fd' : '#64748b', fontWeight: active ? 600 : 400 }}>{ind}</button>);
})}
  </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={saveIcp} disabled={overBudget} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: overBudget ? '#1e293b' : icpSaved ? '#14532d' : '#1d4ed8', color: overBudget ? '#475569' : icpSaved ? '#4ade80' : '#fff', fontSize: 14, fontWeight: 600, cursor: overBudget ? 'not-allowed' : 'pointer', transition: 'all .2s' }}>
{icpSaved ? '✓ Saved' : 'Save ICP Settings'}
</button>
          <button onClick={resetIcp} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#64748b', fontSize: 14, cursor: 'pointer' }}>Reset to Defaults</button>
{overBudget && <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>Reduce points to save</span>}
  </div>
  </div>

{/* Sender Emails */}
      <div className="settings-card">
                <div className="settings-title">✉️ Sender Emails</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
            Add the email addresses you send from. The default is used when drafting emails for leads.
              </div>
{senderEmails.length > 0 && (
            <div style={{ marginBottom: 16 }}>
{senderEmails.map(s => (
                <div key={s.email} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#080c14', border: `1px solid ${s.isDefault ? '#3b82f6' : '#1e293b'}`, borderRadius: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{s.email}</div>
{s.name && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.name}</div>}
  </div>
{s.isDefault
                    ? <span style={{ fontSize: 11, background: 'rgba(59,130,246,0.15)', border: '1px solid #3b82f6', color: '#93c5fd', borderRadius: 20, padding: '2px 10px', flexShrink: 0 }}>Default</span>
                  : <button onClick={() => setDefaultSender(s.email)} style={{ fontSize: 11, background: 'transparent', border: '1px solid #334155', color: '#64748b', borderRadius: 20, padding: '2px 10px', cursor: 'pointer', flexShrink: 0 }}>Set default</button>
}
                <button onClick={() => removeSenderEmail(s.email)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px', flexShrink: 0 }}>×</button>
                  </div>
            ))}
              </div>
        )}
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: 180 }}>
            <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Email address</label>
            <input className="form-input" type="email" placeholder="you@company.com" value={newSenderEmail} onChange={e => setNewSenderEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSenderEmail(); }} />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Display name (optional)</label>
            <input className="form-input" type="text" placeholder="Robyn R." value={newSenderName} onChange={e => setNewSenderName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSenderEmail(); }} />
          </div>
          <button onClick={addSenderEmail} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: senderSaved ? '#14532d' : '#1d4ed8', color: senderSaved ? '#4ade80' : '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0, marginBottom: 1 }}>
{senderSaved ? '✓ Added' : '+ Add'}
          </button>
            </div>
{senderEmails.length === 0 && <div style={{ fontSize: 12, color: '#475569', marginTop: 12, fontStyle: 'italic' }}>No sender emails yet. Add at least one to use the Draft Email feature.</div>}
  </div>

{/* Integrations */}
      <div className="settings-card">
                <div className="settings-title">🔌 Integrations</div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          Manage your API keys and SMTP credentials. Keys are stored encrypted per-user in Redis.
            </div>
        <IntegrationsCard />
            </div>
            </div>
  );
}
