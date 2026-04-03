mport { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { DEFAULT_ICP } from './Settings';

// Full onboarding steps for independent users
const STEPS_FULL = [
  { id: 'welcome', label: 'Welcome', icon: '👋' },
  { id: 'company_profile', label: 'Your Company', icon: '🏢' },
  { id: 'integrations', label: 'Integrations', icon: '🔌' },
  { id: 'icp', label: 'Lead Scoring', icon: '🎯' },
  { id: 'email', label: 'Sender Email', icon: '✉️' },
  { id: 'done', label: 'All Set', icon: '🚀' },
  ];

// Managed user onboarding — email setup only
const STEPS_MANAGED = [
  { id: 'managed_welcome', label: 'Welcome', icon: '👋' },
  { id: 'email', label: 'Sender Email', icon: '✉️' },
  { id: 'done', label: 'All Set', icon: '🚀' },
  ];

const SIZE_OPTIONS = ['1-10','11-25','26-50','51-100','101-250','251+'];
const INDUSTRY_OPTIONS = ['technology','software','saas','cloud computing','cybersecurity','fintech',
                            'financial services','healthcare','biotech','e-commerce','media','education','real estate',
                            'logistics','manufacturing'];

/* shared styles */
const card = { background: '#0d1424', border: '1px solid #1a2540', borderRadius: 16, padding: '32px 36px', maxWidth: 680, width: '100%', margin: '0 auto' };
const label = { fontSize: 12, color: '#6b7a99', fontWeight: 500, display: 'block', marginBottom: 6 };
const input = { width: '100%', padding: '10px 14px', background: '#080c14', border: '1px solid #1a2540', borderRadius: 8, color: '#c8d4e8', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
const pill = (active) => ({ padding: '4px 13px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid', fontFamily: 'inherit', background: active ? 'rgba(79,142,247,0.15)' : 'transparent', borderColor: active ? '#4f8ef7' : '#1a2540', color: active ? '#93c5fd' : '#64748b', fontWeight: active ? 600 : 400, transition: 'all .15s' });
const primaryBtn = (disabled) => ({ padding: '12px 32px', borderRadius: 10, border: 'none', background: disabled ? '#1e293b' : 'linear-gradient(135deg,#4f8ef7,#2563eb)', color: disabled ? '#475569' : '#fff', fontSize: 15, fontWeight: 600, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all .2s' });
const ghostBtn = { padding: '12px 24px', borderRadius: 10, border: '1px solid #1a2540', background: 'transparent', color: '#6b7a99', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' };

async function save(ns, data) {
    await fetch(`/api/user-settings?ns=${ns}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data }),
    });
}
async function saveIntegrations(data) {
    await fetch('/api/user-integrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
    });
}

/* Step: Managed Welcome */
function StepManagedWelcome({ onNext }) {
    return (
          <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🎯</div>
      <h2 style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Welcome to Cloudelligent</h2>
      <p style={{ fontSize: 15, color: '#6b7a99', lineHeight: 1.7, marginBottom: 32, maxWidth: 420, margin: '0 auto 32px' }}>
        Your account is pre-configured with your team&apos;s settings. Just add your sender email and you&apos;re ready to prospect.
          </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360, margin: '0 auto 36px' }}>
{[
  { icon: '✅', text: 'Apollo & integrations: pre-configured' },
  { icon: '✅', text: 'ICP lead scoring: pre-configured' },
  { icon: '✉️', text: 'Add your sender email to complete setup' },
          ].map(({ icon, text }) => (
                      <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#080c14', border: '1px solid #1a2540', borderRadius: 10, padding: '12px 16px', textAlign: 'left' }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
                            <span style={{ fontSize: 14, color: '#c8d4e8' }}>{text}</span>
                </div>
                        ))}
</div>
      <button style={primaryBtn(false)} onClick={onNext}>Get Started →</button>
  </div>
  );
}

/* Step 0: Standard Welcome */
function StepWelcome({ onNext }) {
    return (
          <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🎯</div>
      <h2 style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Welcome to Cloudelligent</h2>
      <p style={{ fontSize: 15, color: '#6b7a99', lineHeight: 1.7, marginBottom: 32, maxWidth: 420, margin: '0 auto 32px' }}>
        Let&apos;s get you set up in 3 minutes. Connect your tools, configure your ICP, and you&apos;ll be finding hot leads right away.
          </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360, margin: '0 auto' }}>
{[
  { icon: '🔌', text: 'Connect Apollo, HubSpot & email' },
  { icon: '🎯', text: 'Set your ICP lead scoring weights' },
  { icon: '✉️', text: 'Add a sender email for outreach' },
  { icon: '🚀', text: 'Start finding hot prospects' },
          ].map(({ icon, text }) => (
                      <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#080c14', border: '1px solid #1a2540', borderRadius: 10, padding: '12px 16px', textAlign: 'left' }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
                            <span style={{ fontSize: 14, color: '#c8d4e8' }}>{text}</span>
                </div>
                        ))}
</div>
      <div style={{ marginTop: 36 }}>
        <button style={primaryBtn(false)} onClick={onNext}>Get Started →</button>
  </div>
  </div>
  );
}

/* Step 1: Company Profile */
function StepCompanyProfile({ onNext, onSkip }) {
    const [profile, setProfile] = useState({ company_name: '', value_prop: '', offer_name: '' });
    const [saving, setSaving] = useState(false);
    const [cpError, setCpError] = useState('');
    async function handleNext() {
          if (!profile.company_name.trim()) { setCpError('Please enter your company name.'); return; }
          setCpError(''); setSaving(true);
          await save('company_profile', profile);
          setSaving(false); onNext();
    }
    const inp = { width: '100%', background: '#0a101e', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#f1f5f9', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
    const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 };
    return (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>🏢 Tell us about your company</h2>
      <p style={{ fontSize: 14, color: '#6b7a99', marginBottom: 24, lineHeight: 1.6 }}>This personalises every AI-drafted email.</p>
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>COMPANY NAME *</label>
        <input style={inp} type="text" placeholder="e.g. Cloudelligent" value={profile.company_name} onChange={e => { setCpError(''); setProfile(p => ({ ...p, company_name: e.target.value })); }} />
{cpError && <div style={{color:'#f87171',fontSize:12,marginTop:4}}>{cpError}</div>}
  </div>
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>WHAT YOU SELL (1–2 sentences)</label>
        <textarea style={{ ...inp, minHeight: 72, resize: 'vertical' }} placeholder="e.g. We help AWS customers cut cloud spend by 18–30%..." value={profile.value_prop} onChange={e => setProfile(p => ({ ...p, value_prop: e.target.value }))} />
  </div>
      <div style={{ marginBottom: 28 }}>
        <label style={lbl}>OFFER / PROGRAM NAME (optional)</label>
        <input style={inp} type="text" placeholder="e.g. AWS FinOps Assessment" value={profile.offer_name} onChange={e => setProfile(p => ({ ...p, offer_name: e.target.value }))} />
  </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #1e293b', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 13 }} onClick={onSkip}>Skip for now</button>
        <button style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: saving || !profile.company_name.trim() ? '#1e293b' : '#4f8ef7', color: saving || !profile.company_name.trim() ? '#475569' : '#fff', cursor: saving || !profile.company_name.trim() ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }} onClick={handleNext} disabled={saving || !profile.company_name.trim()}>
{saving ? 'Saving…' : 'Save & Continue →'}
</button>
  </div>
  </div>
  );
}

/* Integrations step */
const INTEGRATION_CARDS = [
  { id: 'apollo', icon: '🚀', name: 'Apollo.io', description: 'Required — powers all lead search, enrichment & job change tracking', required: true, field: 'apollo', placeholder: 'Apollo API Key', helpUrl: 'https://developer.apollo.io/keys/', helpText: 'Get your key at app.apollo.io → Settings → Integrations → API' },
  { id: 'hubspot', icon: '🟠', name: 'HubSpot', description: 'Push contacts & companies to your CRM', required: false, field: 'hubspot', placeholder: 'HubSpot Private App Access Token', helpUrl: 'https://developers.hubspot.com/docs/api/private-apps', helpText: 'HubSpot → Settings → Integrations → Private Apps' },
  { id: 'email', icon: '📧', name: 'Email (SMTP)', description: 'Send emails directly from the Email Queue', required: false, isEmailBlock: true },
  { id: 'anthropic', icon: '🤖', name: 'Anthropic (Claude AI)', description: 'Powers AI email drafting', required: false, field: 'anthropic', placeholder: 'sk-ant-...', helpUrl: 'https://console.anthropic.com/keys', helpText: 'console.anthropic.com → API Keys' },
  ];
const EMAIL_PROVIDERS = [
  { id: 'office365', name: 'Office 365 / Outlook', host: 'smtp.office365.com', port: 587 },
  { id: 'gmail', name: 'Gmail (App Password)', host: 'smtp.gmail.com', port: 587 },
  { id: 'sendgrid', name: 'SendGrid', host: 'smtp.sendgrid.net', port: 587 },
  { id: 'mailgun', name: 'Mailgun', host: 'smtp.mailgun.org', port: 587 },
  { id: 'custom', name: 'Custom SMTP', host: '', port: 587 },
  ];

function StepIntegrations({ onNext, onSkip }) {
    const [keys, setKeys] = useState({ apollo: '', hubspot: '', anthropic: '' });
    const [emailProvider, setEmailProvider] = useState('office365');
    const [emailUser, setEmailUser] = useState('');
    const [emailPass, setEmailPass] = useState('');
    const [emailHost, setEmailHost] = useState('');
    const [emailPort, setEmailPort] = useState(587);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showPass, setShowPass] = useState({});
    const selectedProvider = EMAIL_PROVIDERS.find(p => p.id === emailProvider);
    async function handleNext() {
          if (!keys.apollo.trim()) { setError('Apollo API key is required.'); return; }
          setSaving(true);
          const payload = {};
          if (keys.apollo.trim()) payload.apollo = keys.apollo.trim();
          if (keys.hubspot.trim()) payload.hubspot = keys.hubspot.trim();
          if (keys.anthropic.trim()) payload.anthropic = keys.anthropic.trim();
          if (emailUser.trim()) {
                  payload.email_provider = emailProvider;
                  payload.email_user = emailUser.trim();
                  if (emailPass.trim()) payload.email_pass = emailPass.trim();
                  payload.email_host = emailProvider === 'custom' ? emailHost.trim() : selectedProvider.host;
                  payload.email_port = String(emailProvider === 'custom' ? emailPort : selectedProvider.port);
          }
          await saveIntegrations(payload);
          setSaving(false); onNext();
    }
    return (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>🔌 Connect your tools</h2>
      <p style={{ fontSize: 14, color: '#6b7a99', marginBottom: 24, lineHeight: 1.6 }}>Apollo is required — everything else is optional.</p>
{INTEGRATION_CARDS.map(intg => (
          <div key={intg.id} style={{ background: '#080c14', border: '1px solid #1a2540', borderRadius: 12, padding: '18px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: intg.isEmailBlock ? 14 : 12 }}>
            <span style={{ fontSize: 22, lineHeight: 1.2 }}>{intg.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{intg.name}</span>
{intg.required && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 20, padding: '1px 8px', fontWeight: 700 }}>Required</span>}
{!intg.required && <span style={{ fontSize: 10, background: 'rgba(100,116,139,0.1)', border: '1px solid #334155', color: '#64748b', borderRadius: 20, padding: '1px 8px' }}>Optional</span>}
  </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 3, lineHeight: 1.5 }}>{intg.description}</div>
  </div>
  </div>
{intg.isEmailBlock ? (
              <div>
                <div style={{ marginBottom: 10 }}>
                <label style={label}>EMAIL PROVIDER</label>
                  <select value={emailProvider} onChange={e => setEmailProvider(e.target.value)} style={{ ...input, cursor: 'pointer', appearance: 'none' }}>
{EMAIL_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
  </select>
  </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                    <label style={label}>SMTP USER / EMAIL ADDRESS</label>
                  <input style={input} type="email" placeholder="you@company.com" value={emailUser} onChange={e => setEmailUser(e.target.value)} />
  </div>
                <div style={{ position: 'relative' }}>
                  <label style={label}>{emailProvider === 'sendgrid' ? 'API KEY' : emailProvider === 'gmail' ? 'APP PASSWORD' : 'PASSWORD'}</label>
                  <input style={input} type={showPass.email ? 'text' : 'password'} placeholder="••••••••••" value={emailPass} onChange={e => setEmailPass(e.target.value)} />
                  <button onClick={() => setShowPass(p => ({ ...p, email: !p.email }))} style={{ position: 'absolute', right: 10, top: 28, background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12 }}>{showPass.email ? 'hide' : 'show'}</button>
  </div>
  </div>
{emailProvider === 'custom' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div><label style={label}>SMTP HOST</label><input style={input} type="text" placeholder="smtp.yourdomain.com" value={emailHost} onChange={e => setEmailHost(e.target.value)} /></div>
                  <div><label style={label}>PORT</label><input style={input} type="number" value={emailPort} onChange={e => setEmailPort(e.target.value)} /></div>
  </div>
              )}
              <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>SMTP host: <span style={{ color: '#64748b' }}>{emailProvider === 'custom' ? (emailHost || 'enter above') : selectedProvider?.host}</span> · Port: {emailProvider === 'custom' ? emailPort : selectedProvider?.port}</div>
                </div>
          ) : (
                        <div>
                          <div style={{ position: 'relative' }}>
                <input style={{ ...input, paddingRight: 52 }} type={showPass[intg.field] ? 'text' : 'password'} placeholder={intg.placeholder} value={keys[intg.field] || ''} onChange={e => { setKeys(k => ({ ...k, [intg.field]: e.target.value })); setError(''); }} />
                                                                                                                                                                                                        <button onClick={() => setShowPass(p => ({ ...p, [intg.field]: !p[intg.field] }))} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12 }}>{showPass[intg.field] ? 'hide' : 'show'}</button>
            </div>
{intg.helpText && <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>{intg.helpText} <a href={intg.helpUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#4f8ef7' }}>↗ Docs</a></div>}
  </div>
          )}
</div>
      ))}
{error && <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef444455', borderRadius: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
        <button style={ghostBtn} onClick={onSkip}>Skip for now</button>
        <button style={primaryBtn(saving)} onClick={handleNext} disabled={saving}>{saving ? 'Saving…' : 'Save & Continue →'}</button>
  </div>
  </div>
  );
}

/* Step ICP */
function StepICP({ onNext, onSkip }) {
    const [icp, setIcp] = useState({ ...DEFAULT_ICP });
    const [saving, setSaving] = useState(false);
    function toggle(field, val) {
          setIcp(prev => { const arr = [...(prev[field] || [])]; const idx = arr.indexOf(val); if (idx >= 0) arr.splice(idx, 1); else arr.push(val); return { ...prev, [field]: arr }; });
    }
    async function handleNext() { setSaving(true); await save('icp_weights', icp); setSaving(false); onNext(); }
    return (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>🎯 Who is your ideal customer?</h2>
      <p style={{ fontSize: 14, color: '#6b7a99', marginBottom: 24, lineHeight: 1.6 }}>These settings control how Cloudelligent scores leads.</p>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: '#6b7a99', fontWeight: 500, marginBottom: 10 }}>TARGET COMPANY SIZE</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
{SIZE_OPTIONS.map(s => <button key={s} style={pill(icp.targetSizeRanges?.includes(s))} onClick={() => toggle('targetSizeRanges', s)}>{s} employees</button>)}
  </div>
  </div>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: '#6b7a99', fontWeight: 500, marginBottom: 10 }}>TARGET INDUSTRIES</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
{INDUSTRY_OPTIONS.map(ind => <button key={ind} style={pill(icp.targetIndustries?.includes(ind))} onClick={() => toggle('targetIndustries', ind)}>{ind}</button>)}
  </div>
  </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        <div>
            <div style={label}>🔴 HOT THRESHOLD (score &gt;=)</div>
          <select style={{ ...input, cursor: 'pointer' }} value={icp.hotThreshold} onChange={e => setIcp(p => ({ ...p, hotThreshold: Number(e.target.value) }))}>
{[55,60,65,70,75,80,85,90].map(v => <option key={v} value={v}>{v}+ pts</option>)}
                               </select>
                               </div>
                                       <div>
                                         <div style={label}>🟡 WARM THRESHOLD (score &gt;=)</div>
                                         <select style={{ ...input, cursor: 'pointer' }} value={icp.warmThreshold} onChange={e => setIcp(p => ({ ...p, warmThreshold: Number(e.target.value) }))}>
{[25,30,35,40,45,50,55,60].map(v => <option key={v} value={v}>{v}+ pts</option>)}
                               </select>
                               </div>
                               </div>
                                     <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                                       <button style={ghostBtn} onClick={onSkip}>Skip for now</button>
                                       <button style={primaryBtn(saving)} onClick={handleNext} disabled={saving}>{saving ? 'Saving…' : 'Save & Continue →'}</button>
                               </div>
                               </div>
                                 );
}

/* Step Sender Email */
function StepEmail({ onNext, onSkip, isManaged }) {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    async function handleNext() {
          const trimmed = email.trim().toLowerCase();
          if (!trimmed || !trimmed.includes('@')) { setError('Please enter a valid email address.'); return; }
          setSaving(true);
          await save('sender_emails', [{ email: trimmed, name: name.trim(), isDefault: true }]);
          setSaving(false); onNext();
    }
    return (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>✉️ Add your sender email</h2>
      <p style={{ fontSize: 14, color: '#6b7a99', marginBottom: 24, lineHeight: 1.6 }}>
{isManaged
          ? 'This is the email address your outreach emails will be sent from. Your team\'s integrations and ICP are already configured.'
            : 'This is the display name and address shown when Cloudelligent drafts outreach emails.'}
</p>
      <div style={{ marginBottom: 16 }}>
        <label style={label}>EMAIL ADDRESS *</label>
        <input style={input} type="email" placeholder="you@company.com" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} />
{error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>{error}</div>}
  </div>
      <div style={{ marginBottom: 28 }}>
        <label style={label}>DISPLAY NAME (optional)</label>
        <input style={input} type="text" placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} />
  </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button style={ghostBtn} onClick={onSkip}>Skip for now</button>
        <button style={primaryBtn(saving)} onClick={handleNext} disabled={saving}>{saving ? 'Saving…' : 'Save & Continue →'}</button>
  </div>
  </div>
  );
}

/* Step Done */
function StepDone({ onFinish }) {
    return (
          <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🚀</div>
      <h2 style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 12 }}>You&apos;re all set!</h2>
      <p style={{ fontSize: 15, color: '#6b7a99', lineHeight: 1.7, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
        Cloudelligent is ready to find your next great customer.
          </p>
      <button style={{ ...primaryBtn(false), fontSize: 16, padding: '14px 40px' }} onClick={onFinish}>Go to Cloudelligent →</button>
          </div>
  );
}

/* Progress bar */
function ProgressBar({ step, steps }) {
    return (
          <div style={{ display: 'flex', gap: 8, marginBottom: 40, justifyContent: 'center', flexWrap: 'wrap' }}>
{steps.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, border: '2px solid', borderColor: i <= step ? '#4f8ef7' : '#1a2540', background: i < step ? '#1a3a7a' : i === step ? 'rgba(79,142,247,0.15)' : 'transparent', color: i <= step ? '#93c5fd' : '#4a5568', fontWeight: 600, transition: 'all .3s' }}>
{i < step ? '✓' : s.icon}
</div>
          <span style={{ fontSize: 12, color: i === step ? '#c8d4e8' : '#4a5568', fontWeight: i === step ? 600 : 400 }}>{s.label}</span>
{i < steps.length - 1 && <div style={{ width: 24, height: 2, background: i < step ? '#1a3a7a' : '#1a2540', borderRadius: 2, transition: 'background .3s' }} />}
  </div>
      ))}
        </div>
  );
}

/* Main wizard */
export default function OnboardingWizard() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [isManaged, setIsManaged] = useState(false);
    const [loadingType, setLoadingType] = useState(true);

  useEffect(() => {
        fetch('/api/user-settings?ns=usertype')
          .then(r => r.json())
          .then(d => {
                    setIsManaged(d.data === 'managed');
                    setLoadingType(false);
          })
          .catch(() => setLoadingType(false));
  }, []);

  const STEPS = isManaged ? STEPS_MANAGED : STEPS_FULL;

  async function markComplete() { await save('onboarding_complete', true); }
    async function finish() { await markComplete(); router.push('/'); }
    async function nextStep() {
          if (step === STEPS.length - 2) { await markComplete(); }
          setStep(s => s + 1);
    }

  if (loadingType) {
        return <div style={{ minHeight: '100vh', background: '#080c14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>Loading…</div>;
}

  return (
        <div style={{ minHeight: '100vh', background: '#080c14', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-.4px' }}>Prospect<span style={{ color: '#4f8ef7' }}>AI</span></div>
    </div>
      <ProgressBar step={step} steps={STEPS} />
          <div style={card} key={step}>
  {/* Managed user steps */}
{isManaged && step === 0 && <StepManagedWelcome onNext={nextStep} />}
{isManaged && STEPS[step]?.id === 'email' && <StepEmail onNext={nextStep} onSkip={nextStep} isManaged={true} />}
{isManaged && STEPS[step]?.id === 'done' && <StepDone onFinish={finish} />}

{/* Independent user steps */}
{!isManaged && step === 0 && <StepWelcome onNext={nextStep} />}
{!isManaged && step === 1 && <StepCompanyProfile onNext={nextStep} onSkip={nextStep} />}
{!isManaged && step === 2 && <StepIntegrations onNext={nextStep} onSkip={nextStep} />}
{!isManaged && step === 3 && <StepICP onNext={nextStep} onSkip={nextStep} />}
{!isManaged && step === 4 && <StepEmail onNext={nextStep} onSkip={nextStep} isManaged={false} />}
{!isManaged && step === 5 && <StepDone onFinish={finish} />}
</div>
 {step > 0 && step < STEPS.length - 1 && (
           <div style={{ marginTop: 20, fontSize: 12, color: '#334155' }}>Step {step} of {STEPS.length - 1}</div>
       )}
</div>
  );
}
