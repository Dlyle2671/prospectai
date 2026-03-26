import { useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@clerk/nextjs';

const STEPS = ['Welcome', 'Integrations', 'Sender Email', 'ICP Setup', 'Done'];

const DEFAULT_ICP = {
  companySizeWeight: 25, industryWeight: 30, fundingWeight: 15,
  verifiedEmailBonus: 3, linkedinBonus: 2, phoneBonus: 2,
  hiringSurgeBonus: 8, awsBonus: 5, hotThreshold: 75, warmThreshold: 50,
  targetSizeRanges: ['51-100','101-250'],
  targetIndustries: ['technology','software','saas','cloud computing','cybersecurity','fintech','financial services','healthcare','biotech'],
};

async function saveSetting(ns, data) {
  await fetch('/api/user-settings?ns=' + ns, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
}

const card = {
  background: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: 16,
  padding: '40px 48px',
  maxWidth: 600,
  width: '100%',
  boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
};

const inputStyle = {
  width: '100%', background: '#080c14', border: '1px solid #334155',
  borderRadius: 8, color: '#e2e8f0', fontSize: 14, padding: '10px 14px',
  outline: 'none', boxSizing: 'border-box',
};

const btnPrimary = {
  padding: '12px 32px', borderRadius: 10, border: 'none',
  background: '#1d4ed8', color: '#fff', fontSize: 15, fontWeight: 700,
  cursor: 'pointer', transition: 'background .15s',
};

const btnSecondary = {
  padding: '12px 24px', borderRadius: 10, border: '1px solid #334155',
  background: 'transparent', color: '#94a3b8', fontSize: 14,
  cursor: 'pointer',
};

const pill = (active) => ({
  padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
  border: '1px solid', transition: 'all .15s',
  background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
  borderColor: active ? '#3b82f6' : '#334155',
  color: active ? '#93c5fd' : '#64748b',
  fontWeight: active ? 600 : 400,
});

// ─── Step components ────────────────────────────────────────────────────────

function StepWelcome({ user, onNext }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: '#e2e8f0', marginBottom: 12 }}>
        Welcome to ProspectAI{user?.firstName ? ', ' + user.firstName : ''}!
      </h1>
      <p style={{ color: '#64748b', fontSize: 15, lineHeight: 1.7, marginBottom: 32 }}>
        Let's get you set up in just a few steps. We'll connect your tools, add your sender email, and configure your ideal customer profile so leads are scored exactly how you want them.
      </p>
      <button style={btnPrimary} onClick={onNext}>Get Started →</button>
    </div>
  );
}

function StepIntegrations({ onNext, onSkip }) {
  const [hubspotToken, setHubspotToken] = useState('');
  const [apolloKey, setApolloKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    // Save integration tokens as user settings
    const integrations = {};
    if (hubspotToken.trim()) integrations.hubspot_token = hubspotToken.trim();
    if (apolloKey.trim()) integrations.apollo_key = apolloKey.trim();
    if (Object.keys(integrations).length > 0) {
      await saveSetting('integrations', integrations);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => onNext(), 800);
  }

  return (
    <div>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🔌</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', marginBottom: 8 }}>Connect Your Tools</h2>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
        Add your API keys to enable CRM sync and contact enrichment. You can always update these later in Settings.
      </p>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>
          🟠 HubSpot Access Token
        </label>
        <input
          style={inputStyle}
          type="password"
          placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          value={hubspotToken}
          onChange={e => setHubspotToken(e.target.value)}
        />
        <div style={{ fontSize: 11, color: '#475569', marginTop: 5 }}>
          HubSpot → Settings → Integrations → Private Apps
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>
          🚀 Apollo.io API Key
        </label>
        <input
          style={inputStyle}
          type="password"
          placeholder="your apollo api key"
          value={apolloKey}
          onChange={e => setApolloKey(e.target.value)}
        />
        <div style={{ fontSize: 11, color: '#475569', marginTop: 5 }}>
          Apollo → Settings → Integrations → API Keys
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          style={{ ...btnPrimary, background: saved ? '#14532d' : '#1d4ed8', minWidth: 140 }}
          onClick={handleSave}
          disabled={saving}
        >
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save & Continue'}
        </button>
        <button style={btnSecondary} onClick={onSkip}>Skip for now</button>
      </div>
    </div>
  );
}

function StepSenderEmail({ onNext, onSkip }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes('@')) { setError('Please enter a valid email address.'); return; }
    setError('');
    setSaving(true);
    const senderEmails = [{ email: e, name: name.trim(), isDefault: true }];
    await saveSetting('sender_emails', senderEmails);
    setSaving(false);
    setSaved(true);
    setTimeout(() => onNext(), 800);
  }

  return (
    <div>
      <div style={{ fontSize: 36, marginBottom: 12 }}>✉️</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', marginBottom: 8 }}>Add Your Sender Email</h2>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
        This is the email address you send from in Outlook. It's used when drafting AI-personalized emails for leads.
      </p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>
          Your work email address
        </label>
        <input
          style={inputStyle}
          type="email"
          placeholder="you@yourcompany.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
        />
        {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 5 }}>{error}</div>}
      </div>

      <div style={{ marginBottom: 32 }}>
        <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>
          Display name (optional)
        </label>
        <input
          style={inputStyle}
          type="text"
          placeholder="Jane Smith"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          style={{ ...btnPrimary, background: saved ? '#14532d' : '#1d4ed8', minWidth: 140 }}
          onClick={handleSave}
          disabled={saving}
        >
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save & Continue'}
        </button>
        <button style={btnSecondary} onClick={onSkip}>Skip for now</button>
      </div>
    </div>
  );
}

const SIZE_OPTIONS = ['1-10','11-25','26-50','51-100','101-250','251+'];
const INDUSTRIES = ['technology','software','saas','cloud computing','cybersecurity','fintech','financial services','healthcare','biotech','e-commerce','media','education'];

function StepICP({ onNext, onSkip }) {
  const [icp, setIcp] = useState({ ...DEFAULT_ICP });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggleSize(s) {
    setIcp(prev => {
      const arr = [...(prev.targetSizeRanges || [])];
      const i = arr.indexOf(s);
      if (i >= 0) arr.splice(i, 1); else arr.push(s);
      return { ...prev, targetSizeRanges: arr };
    });
  }

  function toggleIndustry(ind) {
    setIcp(prev => {
      const arr = [...(prev.targetIndustries || [])];
      const i = arr.indexOf(ind);
      if (i >= 0) arr.splice(i, 1); else arr.push(ind);
      return { ...prev, targetIndustries: arr };
    });
  }

  async function handleSave() {
    setSaving(true);
    await saveSetting('icp_weights', icp);
    setSaving(false);
    setSaved(true);
    setTimeout(() => onNext(), 800);
  }

  return (
    <div>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', marginBottom: 8 }}>Define Your ICP</h2>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
        Tell us who your ideal customer is. Leads will be scored as Hot / Warm / Cold based on this. You can fine-tune everything in Settings later.
      </p>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Target Company Size</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SIZE_OPTIONS.map(s => (
            <button key={s} onClick={() => toggleSize(s)} style={pill(icp.targetSizeRanges.includes(s))}>
              {s} employees
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Target Industries</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {INDUSTRIES.map(ind => (
            <button key={ind} onClick={() => toggleIndustry(ind)} style={pill(icp.targetIndustries.includes(ind))}>
              {ind}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
        <div>
          <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>🔴 Hot threshold (score)</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={icp.hotThreshold} onChange={e => setIcp(p => ({ ...p, hotThreshold: Number(e.target.value) }))}>
            {[55,60,65,70,75,80,85,90].map(v => <option key={v} value={v}>{v}+</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 5 }}>🟡 Warm threshold (score)</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={icp.warmThreshold} onChange={e => setIcp(p => ({ ...p, warmThreshold: Number(e.target.value) }))}>
            {[30,35,40,45,50,55,60,65].filter(v => v < icp.hotThreshold).map(v => <option key={v} value={v}>{v}+</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          style={{ ...btnPrimary, background: saved ? '#14532d' : '#1d4ed8', minWidth: 140 }}
          onClick={handleSave}
          disabled={saving}
        >
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save & Continue'}
        </button>
        <button style={btnSecondary} onClick={onSkip}>Use defaults</button>
      </div>
    </div>
  );
}

function StepDone({ user, onFinish }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🚀</div>
      <h2 style={{ fontSize: 26, fontWeight: 800, color: '#e2e8f0', marginBottom: 12 }}>You're all set!</h2>
      <p style={{ color: '#64748b', fontSize: 15, lineHeight: 1.7, marginBottom: 12 }}>
        ProspectAI is ready to go. Head to <strong style={{ color: '#93c5fd' }}>Find Leads</strong> to run your first search — leads will be automatically enriched and scored against your ICP.
      </p>
      <p style={{ color: '#475569', fontSize: 13, marginBottom: 36 }}>
        You can update your integrations, sender emails, and ICP weights anytime in <strong style={{ color: '#e2e8f0' }}>Settings</strong>.
      </p>
      <button style={{ ...btnPrimary, fontSize: 16, padding: '14px 40px' }} onClick={onFinish}>
        Go to Dashboard →
      </button>
    </div>
  );
}

// ─── Main Onboarding Page ────────────────────────────────────────────────────

export default function Onboarding() {
  const { user } = useUser();
  const router = useRouter();
  const [step, setStep] = useState(0);

  async function markOnboarded() {
    await saveSetting('onboarded', true);
  }

  async function finish() {
    await markOnboarded();
    router.push('/');
  }

  async function next() {
    if (step === STEPS.length - 1) { await finish(); return; }
    if (step === STEPS.length - 2) { await markOnboarded(); }
    setStep(s => s + 1);
  }

  async function skip() {
    if (step === STEPS.length - 2) { await markOnboarded(); }
    setStep(s => s + 1);
  }

  const progressPct = Math.round((step / (STEPS.length - 1)) * 100);

  return (
    <div style={{ minHeight: '100vh', background: '#020817', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      {/* Logo */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.5px' }}>ProspectAI</span>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: 600, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          {STEPS.map((s, i) => (
            <span key={s} style={{ fontSize: 11, fontWeight: i === step ? 700 : 400, color: i === step ? '#3b82f6' : i < step ? '#22c55e' : '#334155', transition: 'color .2s' }}>
              {i < step ? '✓ ' : ''}{s}
            </span>
          ))}
        </div>
        <div style={{ height: 4, background: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: progressPct + '%', background: 'linear-gradient(90deg,#1d4ed8,#3b82f6)', borderRadius: 4, transition: 'width .4s ease' }} />
        </div>
      </div>

      {/* Card */}
      <div style={card}>
        {step === 0 && <StepWelcome user={user} onNext={next} />}
        {step === 1 && <StepIntegrations onNext={next} onSkip={skip} />}
        {step === 2 && <StepSenderEmail onNext={next} onSkip={skip} />}
        {step === 3 && <StepICP onNext={next} onSkip={skip} />}
        {step === 4 && <StepDone user={user} onFinish={finish} />}
      </div>

      {/* Step counter */}
      <div style={{ marginTop: 20, fontSize: 12, color: '#334155' }}>
        Step {step + 1} of {STEPS.length}
      </div>
    </div>
  );
}
