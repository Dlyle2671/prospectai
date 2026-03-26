import { useState } from 'react';
import { useRouter } from 'next/router';
import { DEFAULT_ICP } from './Settings';

const STEPS = [
  { id: 'welcome',  label: 'Welcome',      icon: '👋' },
  { id: 'icp',      label: 'Lead Scoring', icon: '🎯' },
  { id: 'email',    label: 'Sender Email', icon: '✉️'  },
  { id: 'done',     label: 'All Set',      icon: '🚀' },
  ];

const SIZE_OPTIONS   = ['1-10','11-25','26-50','51-100','101-250','251+'];
const INDUSTRY_OPTIONS = ['technology','software','saas','cloud computing','cybersecurity','fintech',
                            'financial services','healthcare','biotech','e-commerce','media','education','real estate',
                            'logistics','manufacturing'];

/* ─── tiny shared styles ─────────────────────────────────────── */
const card = {
    background: '#0d1424', border: '1px solid #1a2540',
    borderRadius: 16, padding: '32px 36px', maxWidth: 620,
    width: '100%', margin: '0 auto',
};
const label = { fontSize: 12, color: '#6b7a99', fontWeight: 500, display: 'block', marginBottom: 6 };
const input = {
    width: '100%', padding: '10px 14px', background: '#080c14',
    border: '1px solid #1a2540', borderRadius: 8, color: '#c8d4e8',
    fontSize: 14, fontFamily: 'inherit', outline: 'none',
};
const pill = (active) => ({
    padding: '4px 13px', borderRadius: 20, fontSize: 12,
    cursor: 'pointer', border: '1px solid', fontFamily: 'inherit',
    background: active ? 'rgba(79,142,247,0.15)' : 'transparent',
    borderColor: active ? '#4f8ef7' : '#1a2540',
    color: active ? '#93c5fd' : '#64748b', fontWeight: active ? 600 : 400,
    transition: 'all .15s',
});
const primaryBtn = (disabled) => ({
    padding: '12px 32px', borderRadius: 10, border: 'none',
    background: disabled ? '#1e293b' : 'linear-gradient(135deg,#4f8ef7,#2563eb)',
    color: disabled ? '#475569' : '#fff', fontSize: 15, fontWeight: 600,
    fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all .2s',
});
const ghostBtn = {
    padding: '12px 24px', borderRadius: 10, border: '1px solid #1a2540',
    background: 'transparent', color: '#6b7a99', fontSize: 14,
    fontFamily: 'inherit', cursor: 'pointer',
};

async function save(ns, data) {
    await fetch(`/api/user-settings?ns=${ns}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data }),
    });
}

/* ─── Step 0 — Welcome ───────────────────────────────────────── */
function StepWelcome({ onNext }) {
    return (
          <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🎯</div>
      <h2 style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
        Welcome to ProspectAI
          </h2>
      <p style={{ fontSize: 15, color: '#6b7a99', lineHeight: 1.7, marginBottom: 32, maxWidth: 420, margin: '0 auto 32px' }}>
        Let&apos;s get you set up in 2 minutes. We&apos;ll configure your ideal customer profile and
        sending email so you can start finding hot leads right away.
          </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 340, margin: '0 auto' }}>
{[
  { icon: '🎯', text: 'Set your ICP lead scoring weights' },
  { icon: '✉️', text: 'Add a sender email for outreach' },
  { icon: '🚀', text: 'Start finding hot prospects' },
          ].map(({ icon, text }) => (
                      <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12,
                                                         background: '#080c14', border: '1px solid #1a2540', borderRadius: 10,
                                                         padding: '12px 16px', textAlign: 'left' }}>
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

/* ─── Step 1 — ICP ───────────────────────────────────────────── */
function StepICP({ onNext, onSkip }) {
    const [icp, setIcp] = useState({ ...DEFAULT_ICP });
    const [saving, setSaving] = useState(false);

  function toggle(field, val) {
        setIcp(prev => {
                const arr = [...(prev[field] || [])];
                const idx = arr.indexOf(val);
                if (idx >= 0) arr.splice(idx, 1); else arr.push(val);
                return { ...prev, [field]: arr };
        });
  }

  async function handleNext() {
        setSaving(true);
        await save('icp_weights', icp);
        setSaving(false);
        onNext();
  }

  return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
        🎯 Who is your ideal customer?
          </h2>
      <p style={{ fontSize: 14, color: '#6b7a99', marginBottom: 24, lineHeight: 1.6 }}>
        These settings control how ProspectAI scores leads. You can always refine them in Settings.
          </p>

{/* Company Size */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ ...label, marginBottom: 10 }}>TARGET COMPANY SIZE</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
{SIZE_OPTIONS.map(s => (
              <button key={s} style={pill(icp.targetSizeRanges?.includes(s))}
              onClick={() => toggle('targetSizeRanges', s)}>
              {s} employees
                </button>
          ))}
            </div>
            </div>

{/* Industries */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ ...label, marginBottom: 10 }}>TARGET INDUSTRIES</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
{INDUSTRY_OPTIONS.map(ind => (
              <button key={ind} style={pill(icp.targetIndustries?.includes(ind))}
              onClick={() => toggle('targetIndustries', ind)}>
              {ind}
                </button>
          ))}
            </div>
            </div>

{/* Thresholds */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        <div>
                  <div style={label}>🔴 HOT THRESHOLD (score {'>'}=)</div>
                                                                <select style={{ ...input, cursor: 'pointer' }}
                    value={icp.hotThreshold}
            onChange={e => setIcp(p => ({ ...p, hotThreshold: Number(e.target.value) }))}>
            {[55,60,65,70,75,80,85,90].map(v => <option key={v} value={v}>{v}+ pts</option>)}
                                           </select>
                                           </div>
                                                   <div>
                                                     <div style={label}>🟡 WARM THRESHOLD (score {'>'}=)</div>
                                                                                                    <select style={{ ...input, cursor: 'pointer' }}
                                                       value={icp.warmThreshold}
            onChange={e => setIcp(p => ({ ...p, warmThreshold: Number(e.target.value) }))}>
            {[25,30,35,40,45,50,55,60].map(v => <option key={v} value={v}>{v}+ pts</option>)}
                                           </select>
                                           </div>
                                           </div>

                                                 <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                                                   <button style={ghostBtn} onClick={onSkip}>Skip for now</button>
                                                   <button style={primaryBtn(saving)} onClick={handleNext} disabled={saving}>
                                           {saving ? 'Saving…' : 'Save & Continue →'}
                                           </button>
                                           </div>
                                           </div>
                                             );
}

/* ─── Step 2 — Sender Email ──────────────────────────────────── */
function StepEmail({ onNext, onSkip }) {
    const [email, setEmail] = useState('');
    const [name,  setName]  = useState('');
    const [saving, setSaving] = useState(false);
    const [error,  setError]  = useState('');

  async function handleNext() {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed || !trimmed.includes('@')) { setError('Please enter a valid email address.'); return; }
        setSaving(true);
        await save('sender_emails', [{ email: trimmed, name: name.trim(), isDefault: true }]);
        setSaving(false);
        onNext();
  }

  return (
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
        ✉️ Add your sender email
          </h2>
      <p style={{ fontSize: 14, color: '#6b7a99', marginBottom: 24, lineHeight: 1.6 }}>
        This is the email address ProspectAI will use when drafting outreach emails for your leads.
                  You can add more in Settings.
          </p>

      <div style={{ marginBottom: 16 }}>
        <label style={label}>EMAIL ADDRESS *</label>
        <input style={input} type="email" placeholder="you@company.com"
          value={email} onChange={e => { setEmail(e.target.value); setError(''); }} />
{error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>{error}</div>}
  </div>

      <div style={{ marginBottom: 28 }}>
        <label style={label}>DISPLAY NAME (optional)</label>
        <input style={input} type="text" placeholder="Jane Smith"
          value={name} onChange={e => setName(e.target.value)} />
        <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>
          Shown as the sender name in email drafts.
            </div>
            </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button style={ghostBtn} onClick={onSkip}>Skip for now</button>
        <button style={primaryBtn(saving)} onClick={handleNext} disabled={saving}>
          {saving ? 'Saving…' : 'Save & Continue →'}
</button>
  </div>
  </div>
  );
}

/* ─── Step 3 — Done ──────────────────────────────────────────── */
function StepDone({ onFinish }) {
    return (
          <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🚀</div>
      <h2 style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
        You&apos;re all set!
          </h2>
      <p style={{ fontSize: 15, color: '#6b7a99', lineHeight: 1.7, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
        ProspectAI is ready to find your next great customer. Start by searching for leads using your ICP,
                  or explore the other tools in the nav.
          </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 36 }}>
{[
  { icon: '🔍', label: 'Find Leads', desc: 'Search by title, industry & more' },
  { icon: '⚡', label: 'Bulk Prospector', desc: 'Enrich a list of companies at once' },
  { icon: '🔄', label: 'Job Changes', desc: 'Catch contacts moving to new roles' },
          ].map(({ icon, label: l, desc }) => (
                      <div key={l} style={{ background: '#080c14', border: '1px solid #1a2540',
                                                      borderRadius: 12, padding: '16px 20px', width: 160, textAlign: 'left' }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{l}</div>
                            <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.5 }}>{desc}</div>
                </div>
                        ))}
</div>
      <button style={{ ...primaryBtn(false), fontSize: 16, padding: '14px 40px' }} onClick={onFinish}>
          Go to ProspectAI →
  </button>
  </div>
  );
}

/* ─── Progress bar ───────────────────────────────────────────── */
function ProgressBar({ step, total }) {
    return (
          <div style={{ display: 'flex', gap: 8, marginBottom: 40, justifyContent: 'center' }}>
{STEPS.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
              width: 32, height: 32, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 14,
              border: '2px solid',
              borderColor: i < step ? '#4f8ef7' : i === step ? '#4f8ef7' : '#1a2540',
              background: i < step ? '#1a3a7a' : i === step ? 'rgba(79,142,247,0.15)' : 'transparent',
              color: i <= step ? '#93c5fd' : '#4a5568',
              fontWeight: 600, transition: 'all .3s',
}}>
{i < step ? '✓' : s.icon}
</div>
          <span style={{ fontSize: 12, color: i === step ? '#c8d4e8' : '#4a5568',
                                   fontWeight: i === step ? 600 : 400, display: step > 0 || i === 0 ? 'block' : 'none' }}>
{s.label}
</span>
{i < STEPS.length - 1 && (
              <div style={{ width: 32, height: 2, background: i < step ? '#1a3a7a' : '#1a2540',
                                        borderRadius: 2, transition: 'background .3s' }} />
          )}
</div>
      ))}
        </div>
  );
}

/* ─── Main wizard ────────────────────────────────────────────── */
export default function OnboardingWizard() {
    const router = useRouter();
    const [step, setStep] = useState(0);

  async function markComplete() {
        await save('onboarding_complete', true);
  }

  async function finish() {
        await markComplete();
        router.push('/');
  }

  async function nextStep() {
        if (step === STEPS.length - 2) {
                // About to reach Done step — mark complete now
          await markComplete();
        }
        setStep(s => s + 1);
  }

  return (
        <div style={{
          minHeight: '100vh', background: '#080c14',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '40px 24px',
          fontFamily: "'DM Sans', sans-serif",
  }}>
{/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-.4px' }}>
          Prospect<span style={{ color: '#4f8ef7' }}>AI</span>
            </div>
            </div>

      <ProgressBar step={step} total={STEPS.length} />

                  <div style={card} className="fade-up" key={step}>
          {step === 0 && <StepWelcome onNext={nextStep} />}
           {step === 1 && <StepICP onNext={nextStep} onSkip={nextStep} />}
            {step === 2 && <StepEmail onNext={nextStep} onSkip={nextStep} />}
             {step === 3 && <StepDone onFinish={finish} />}
              </div>

              {step > 0 && step < STEPS.length - 1 && (
                        <div style={{ marginTop: 20, fontSize: 12, color: '#334155' }}>
                       Step {step} of {STEPS.length - 1}
           </div>
                 )}
            </div>
  );
}
