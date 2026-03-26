import { SignUp } from '@clerk/nextjs';

const features = [
  { icon: '⚡', title: 'Smart Lead Scoring', desc: 'Qualify prospects automatically with AI' },
  { icon: '🎯', title: 'Precision Targeting', desc: 'Reach the right buyers at the right time' },
  { icon: '📈', title: 'Pipeline Acceleration', desc: 'Convert more prospects into revenue' },
  ];

const clerkAppearance = {
    variables: {
          colorBackground: 'rgba(14,19,34,0.90)',
          colorText: '#e2e8f0',
          colorTextSecondary: 'rgba(148,163,184,0.75)',
          colorInputBackground: 'rgba(255,255,255,0.04)',
          colorInputText: '#e2e8f0',
          colorPrimary: '#6366f1',
          borderRadius: '10px',
          fontFamily: 'inherit',
    },
    elements: {
          card: {
                  background: 'transparent',
                  boxShadow: 'none',
                  border: 'none',
                  padding: '32px 28px 24px',
          },
          cardBox: {
                  background: 'rgba(14,19,34,0.90)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: '1px solid rgba(99,102,241,0.20)',
                  borderRadius: '20px',
                  boxShadow: '0 0 0 1px rgba(99,102,241,0.04), 0 24px 64px rgba(0,0,0,0.55), 0 0 100px rgba(99,102,241,0.07), inset 0 1px 0 rgba(255,255,255,0.05)',
                  width: '400px',
          },
          headerTitle: {
                  background: 'linear-gradient(135deg, #e2e8f0 0%, #a5b4fc 55%, #c084fc 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  fontSize: '26px',
                  fontWeight: '700',
                  letterSpacing: '-0.5px',
          },
          headerSubtitle: { color: 'rgba(148,163,184,0.75)' },
          socialButtonsBlockButton: {
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: '10px',
                  color: '#e2e8f0',
          },
          dividerLine: { background: 'rgba(255,255,255,0.10)' },
          dividerText: { color: 'rgba(148,163,184,0.5)' },
          formFieldLabel: { color: 'rgba(203,213,225,0.9)', fontSize: '13px', fontWeight: '500' },
          formFieldInput: {
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: '10px',
                  color: '#e2e8f0',
          },
          formButtonPrimary: {
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  borderRadius: '10px',
                  boxShadow: '0 4px 15px rgba(99,102,241,0.35)',
                  fontSize: '14px',
                  fontWeight: '600',
          },
          footerActionLink: { color: '#a5b4fc' },
          footer: { background: 'transparent' },
    },
};

export default function SignUpPage() {
    return (
          <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'row',
            background: '#080c14',
            overflow: 'hidden',
            position: 'relative',
    }}>
      <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: 'radial-gradient(ellipse 70% 60% at 20% 50%, rgba(99,102,241,0.13) 0%, transparent 60%), radial-gradient(ellipse 50% 70% at 80% 30%, rgba(168,85,247,0.10) 0%, transparent 55%)',
}} />

{/* ── Left branding panel ── */}
      <div style={{
                width: '45%', flexShrink: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', padding: '48px 48px 48px 40px',
                position: 'relative', zIndex: 5,
                backgroundImage: 'linear-gradient(rgba(99,102,241,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.035) 1px, transparent 1px)',
                backgroundSize: '44px 44px',
      }}>
        <div style={{
                  position: 'absolute', right: 0, top: '8%', bottom: '8%',
                  width: 1, background: 'linear-gradient(to bottom, transparent, rgba(99,102,241,0.22), transparent)',
      }} />
        <div style={{ maxWidth: 320, width: '100%', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 56 }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                      <defs>
                        <linearGradient id="lg1" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        </defs>
              <rect width="40" height="40" rx="12" fill="url(#lg1)" />
                      <circle cx="20" cy="20" r="5" fill="white" />
                      <path d="M20 10C14.477 10 10 14.477 10 20C10 25.523 14.477 30 20 30" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                      <path d="M20 14C17.239 14 15 16.239 15 19C15 21.761 17.239 24 20 24C22.761 24 25 21.761 25 19" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
        </svg>
            <span style={{
                      fontSize: 21, fontWeight: 700,
                      background: 'linear-gradient(135deg, #e2e8f0, #a5b4fc)',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>ProspectAI</span>
        </div>
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.2, color: '#f1f5f9', margin: '0 0 14px', letterSpacing: '-0.5px' }}>
              Find your next great customer
                </h2>
            <p style={{ fontSize: 15, color: 'rgba(148,163,184,0.78)', lineHeight: 1.65, margin: 0 }}>
              AI-powered prospecting that identifies and qualifies leads so your team can focus on closing.
                </p>
                </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
{features.map(({ icon, title, desc }) => (
                <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                                width: 40, height: 40, background: 'rgba(99,102,241,0.12)',
                                    border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 18, flexShrink: 0,
                }}>{icon}</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 8 }}>
                  <strong style={{ color: '#cbd5e1', fontSize: 14, fontWeight: 600 }}>{title}</strong>
                                <span style={{ color: 'rgba(148,163,184,0.65)', fontSize: 13 }}>{desc}</span>
              </div>
              </div>
                          ))}
</div>
  </div>
  </div>

{/* ── Right: Clerk sign-up card ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative', zIndex: 10 }}>
        <SignUp afterSignUpUrl="/" signInUrl="/sign-in" appearance={clerkAppearance} />
        </div>
        </div>
  );
}
