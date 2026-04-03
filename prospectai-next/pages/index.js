import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { UserButton, useUser, useClerk } from '@clerk/nextjs';
import FindLeads from '../components/FindLeads';
import CompanyIntel from '../components/CompanyIntel';
import BulkProspector from '../components/BulkProspector';
import JobChanges from '../components/JobChanges'
import PeopleLookup from '../components/PeopleLookup';
import Credits from '../components/Credits';
import LookalikSearch from '../components/LookalikSearch';
import Settings from '../components/Settings';
import LeadScoring from '../components/AwsOpportunities';
import EmailQueue from '../components/EmailQueue';
import SalesAnalytics from '../components/SalesAnalytics';
import BuyingIntent from '../components/BuyingIntent';
const ADMIN_USER_ID = process.env.NEXT_PUBLIC_ADMIN_USER_ID;
const TABS = [
  { id: 'leads', label: 'Find Leads' },
  { id: 'company', label: 'Company Intel' },
  { id: 'bulk', label: 'Bulk Prospector' },
  { id: 'jobchanges', label: 'Job Changes' },
  { id: 'people', label: 'People Lookup' },
  { id: 'lookalike', label: 'Lookalike' },
  { id: 'awsopps', label: 'Lead Scoring' },
  { id: 'emailqueue', label: 'Email Queue' },
  { id: 'intent', label: '🔥 Buying Intent' },
  { id: 'credits', label: 'Credits' },
  { id: 'salesanalytics', label: 'Sales Analytics' },
  { id: 'settings', label: 'Settings' },
  ];
const FEATURES = [
  { id: 'leads', icon: '🔍', title: 'Find Leads', desc: 'Discover enriched contacts scored by priority. Filter by job title, industry, company size, and geography.', accent: 'linear-gradient(90deg,#6366f1,#818cf8)', iconBg: 'rgba(99,102,241,0.12)' },
  { id: 'company', icon: '🏢', title: 'Company Intel', desc: 'Deep-dive into company profiles, tech stacks, AWS footprint, and firmographics for your target accounts.', accent: 'linear-gradient(90deg,#0ea5e9,#38bdf8)', iconBg: 'rgba(14,165,233,0.12)' },
  { id: 'bulk', icon: '⚡', title: 'Bulk Prospector', desc: 'Upload a list and enrich hundreds of companies at scale. Get scored contacts for every account.', accent: 'linear-gradient(90deg,#f59e0b,#fbbf24)', iconBg: 'rgba(245,158,11,0.12)' },
  { id: 'jobchanges', icon: '📈', title: 'Job Changes', desc: 'Track when key contacts change roles or companies — the ideal trigger for timely outreach.', accent: 'linear-gradient(90deg,#10b981,#34d399)', iconBg: 'rgba(16,185,129,0.12)' },
  { id: 'people', icon: '👤', title: 'People Lookup', desc: 'Search for specific individuals by name, title, or company and pull a full enriched contact profile.', accent: 'linear-gradient(90deg,#8b5cf6,#a78bfa)', iconBg: 'rgba(139,92,246,0.12)' },
  { id: 'lookalike', icon: '🔗', title: 'Lookalike', desc: 'Find companies that look just like your best customers. Surface new accounts that fit your ICP.', accent: 'linear-gradient(90deg,#ec4899,#f472b6)', iconBg: 'rgba(236,72,153,0.12)' },
  { id: 'awsopps', icon: '☁️', title: 'Lead Scoring', desc: 'Score and prioritize your leads by fit, intent, and opportunity signals.', accent: 'linear-gradient(90deg,#f97316,#fb923c)', iconBg: 'rgba(249,115,22,0.12)' },
  { id: 'emailqueue', icon: '📧', title: 'Email Queue', desc: 'Review, edit, and send drafted emails to your prospects. Manage your full outreach pipeline here.', accent: 'linear-gradient(90deg,#a855f7,#c084fc)', iconBg: 'rgba(168,85,247,0.12)' },
  { id: 'intent', icon: '🔥', title: 'Buying Intent', desc: 'Companies actively researching Cloud, AWS & Managed Services right now. Auto-populates daily from Apollo intent signals.', accent: 'linear-gradient(90deg,#ef4444,#f97316)', iconBg: 'rgba(239,68,68,0.12)' },
  { id: 'salesanalytics', icon: '📊', title: 'Sales Analytics', desc: 'Track quota attainment, commissions, and rep performance across PS, FinOps, and Managed Services.', accent: 'linear-gradient(90deg,#6366f1,#34d399)', iconBg: 'rgba(99,102,241,0.12)' },
  ];
const HOME_STYLES = `
.pai-home{min-height:100vh;background:#0d1117;display:flex;flex-direction:column;font-family:'DM Sans',-apple-system,sans-serif;color:#fff;animation:paiIn 0.4s ease;}
@keyframes paiIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
.pai-home-topbar{display:flex;align-items:center;justify-content:space-between;padding:18px 40px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;}
.pai-home-logo{font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.3px;}
.pai-home-logo span{color:#818cf8;}
.pai-home-user{display:flex;align-items:center;gap:10px;color:#64748b;font-size:13px;position:relative;cursor:pointer;border-radius:8px;padding:6px 10px;transition:background 0.15s ease;}
.pai-home-user:hover{background:rgba(129,140,248,0.08);}
.pai-home-avatar{width:34px;height:34px;border-radius:50%;border:2px solid rgba(129,140,248,0.35);object-fit:cover;}
.pai-home-username{color:#e2e8f0;font-weight:500;}
.pai-home-chevron{color:#64748b;font-size:10px;transition:transform 0.2s ease;line-height:1;}
.pai-home-user.open .pai-home-chevron{transform:rotate(180deg);}
.pai-user-dropdown{display:none;position:absolute;top:calc(100% + 8px);right:0;min-width:200px;background:#131c2e;border:1px solid rgba(255,255,255,0.08);border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.45);z-index:9999;overflow:hidden;animation:dropIn 0.15s ease;}
@keyframes dropIn{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}
.pai-home-user.open .pai-user-dropdown{display:block;}
.pai-user-dropdown-header{padding:14px 16px 12px;border-bottom:1px solid rgba(255,255,255,0.06);}
.pai-user-dropdown-name{font-size:13px;font-weight:600;color:#e2e8f0;margin-bottom:2px;}
.pai-user-dropdown-email{font-size:11px;color:#64748b;}
.pai-user-dropdown-item{display:flex;align-items:center;gap:10px;padding:11px 16px;font-size:13px;color:#94a3b8;cursor:pointer;transition:background 0.12s ease,color 0.12s ease;border:none;background:none;width:100%;text-align:left;font-family:inherit;}
.pai-user-dropdown-item:hover{background:rgba(129,140,248,0.1);color:#e2e8f0;}
.pai-user-dropdown-divider{height:1px;background:rgba(255,255,255,0.06);}
.pai-user-dropdown-item.danger:hover{background:rgba(239,68,68,0.1);color:#f87171;}
.pai-home-hero{padding:52px 40px 40px;text-align:center;flex-shrink:0;}
.pai-home-greeting{font-size:12px;font-weight:600;color:#818cf8;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:14px;}
.pai-home-headline{font-size:40px;font-weight:700;color:#f1f5f9;letter-spacing:-1.2px;line-height:1.15;margin-bottom:16px;}
.pai-home-headline span{background:linear-gradient(135deg,#818cf8,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.pai-home-sub{font-size:15px;color:#475569;max-width:500px;margin:0 auto 52px;line-height:1.65;}
.pai-home-tools-label{font-size:10px;font-weight:700;letter-spacing:1.2px;color:#334155;text-transform:uppercase;margin-bottom:20px;}
.pai-home-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:0 40px 52px;max-width:1100px;margin:0 auto;width:100%;box-sizing:border-box;}
.pai-home-card{background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.065);border-radius:16px;padding:26px 22px 22px;cursor:pointer;transition:all 0.2s cubic-bezier(0.4,0,0.2,1);display:flex;flex-direction:column;gap:10px;text-align:left;position:relative;overflow:hidden;}
.pai-home-card::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--card-accent);opacity:0;transition:opacity 0.2s ease;}
.pai-home-card:hover{background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.12);transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,0.4);}
.pai-home-card:hover::after{opacity:1;}
.pai-home-card-icon{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;background:var(--card-icon-bg);flex-shrink:0;margin-bottom:4px;}
.pai-home-card-title{font-size:15px;font-weight:600;color:#f1f5f9;letter-spacing:-0.2px;}
.pai-home-card-desc{font-size:12.5px;color:#4e6174;line-height:1.6;flex:1;}
.pai-home-card-footer{display:flex;align-items:center;justify-content:flex-end;margin-top:6px;}
.pai-home-card-arrow{font-size:14px;color:#334155;transition:all 0.2s ease;font-weight:600;}
.pai-home-card:hover .pai-home-card-arrow{color:#818cf8;transform:translateX(4px);}
.pai-home-stats{display:flex;align-items:center;justify-content:center;gap:40px;padding:22px 40px;border-top:1px solid rgba(255,255,255,0.05);flex-shrink:0;margin-top:auto;}
.pai-home-stat{text-align:center;}
.pai-home-stat-val{font-size:19px;font-weight:700;color:#818cf8;letter-spacing:-0.3px;}
.pai-home-stat-label{font-size:10px;color:#334155;margin-top:3px;letter-spacing:0.8px;text-transform:uppercase;font-weight:600;}
.pai-home-stat-divider{width:1px;height:36px;background:rgba(255,255,255,0.06);}
`;
const APP_STYLES = `
.sidebar{background:#0d1117;border-right:1px solid rgba(255,255,255,0.07);padding:16px 10px;}
.sidebar-logo{padding:12px 8px 16px 8px;border-bottom:1px solid rgba(255,255,255,0.07);margin-bottom:12px;display:block;}
.sidebar-logo span{color:#818cf8;}
.sidebar-nav{display:flex;flex-direction:column;gap:2px;}
.sidebar-btn{background:transparent;border:none;color:#94a3b8;border-radius:8px;padding:9px 12px;font-size:13px;font-weight:400;text-align:left;cursor:pointer;transition:all 0.15s ease;letter-spacing:0.1px;width:100%;}
.sidebar-btn:hover{background:rgba(255,255,255,0.06);color:#e2e8f0;}
.sidebar-btn.active{background:rgba(99,102,241,0.18);color:#a5b4fc;font-weight:500;}
.app-main{background:#0f1218;padding:36px 44px;}
.section-title{font-size:26px;font-weight:700;color:#f1f5f9;letter-spacing:-0.5px;margin-bottom:8px;}
.section-sub{font-size:13px;color:#64748b;margin-bottom:32px;padding-bottom:28px;border-bottom:1px solid rgba(255,255,255,0.06);}
.filter-group{background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:18px 20px;margin-bottom:12px;}
.filter-label{font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#475569;margin-bottom:12px;}
.pill-row{display:flex;flex-wrap:wrap;gap:6px;}
.pill{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);color:#94a3b8;border-radius:20px;padding:5px 13px;font-size:12.5px;cursor:pointer;transition:all 0.15s ease;}
.pill:hover{background:rgba(99,102,241,0.15);border-color:rgba(99,102,241,0.4);color:#c7d2fe;transform:translateY(-1px);}
.pill.active{background:linear-gradient(135deg,#4f46e5,#6366f1);border-color:transparent;color:#fff;font-weight:500;box-shadow:0 2px 8px rgba(99,102,241,0.35);}
.search-btn{background:linear-gradient(135deg,#4f46e5,#6366f1,#818cf8);border:none;color:#fff;border-radius:10px;padding:13px 44px;font-size:14px;font-weight:600;box-shadow:0 4px 16px rgba(79,70,229,0.45);cursor:pointer;transition:all 0.2s ease;margin-top:8px;}
.search-btn:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(79,70,229,0.6);}
`;
export default function Home() {
    const [activeTab, setActiveTab] = useState('leads');
    const [showHome, setShowHome] = useState(true);
    const [loadedSnapshot, setLoadedSnapshot] = useState(null);
    const [checkingOnboard, setCheckingOnboard] = useState(true);
    const [featureFlags, setFeatureFlags] = useState(null);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const userMenuRef = useRef(null);
    const { user, isLoaded } = useUser();
    const { signOut, openUserProfile } = useClerk();
    const router = useRouter();
    const hour = typeof window !== 'undefined' ? new Date().getHours() : 12;
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const firstName = user?.firstName || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'there';
    const today = typeof window !== 'undefined' ? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    useEffect(() => {
          if (!isLoaded) return;
          if (!user) { setCheckingOnboard(false); return; }
          Promise.all([
                  fetch('/api/user-settings?ns=onboarding_complete').then(r => r.json()),
                  fetch('/api/user-settings?ns=icp_weights').then(r => r.json()),
                  fetch('/api/user-settings?ns=sender_emails').then(r => r.json()),
                  fetch('/api/user-settings?ns=feature_flags').then(r => r.json()),
                ])
          .then(([done, icp, senders, flagsRes]) => {
                  const isComplete = done.data || icp.data || senders.data;
                  if (!isComplete) { router.replace('/onboarding'); }
                  else { setCheckingOnboard(false); const ff = flagsRes?.data || null; setFeatureFlags(ff); }
          })
          .catch(() => setCheckingOnboard(false));
    }, [isLoaded, user]);
    useEffect(() => {
          function handleClickOutside(e) {
                  if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
                            setShowUserMenu(false);
                  }
          }
          document.addEventListener('mousedown', handleClickOutside);
          return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const handleLoadSnapshot = (snapshotData) => { setLoadedSnapshot(snapshotData); setActiveTab('awsopps'); };
    const handleCardClick = (featureId) => { setShowHome(false); setActiveTab(featureId); };
    const isAdmin = user?.id === ADMIN_USER_ID;
    const visibleTabs = featureFlags ? TABS.filter(t => featureFlags[t.id] !== false) : TABS;
    if (checkingOnboard) {
          return (
                  <div style={{ minHeight: '100vh', background: '#020817', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#475569', fontSize: 14 }}>Loading...</div>
  </div>
    );
}
  const UserMenu = () => (
        <div
      ref={userMenuRef}
      className={`pai-home-user${showUserMenu ? ' open' : ''}`}
      onClick={() => setShowUserMenu(v => !v)}
    >
{user?.imageUrl && <img src={user.imageUrl} alt="avatar" className="pai-home-avatar" />}
      <span className="pai-home-username">{user?.fullName || firstName}</span>
      <svg className="pai-home-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
      <div className="pai-user-dropdown" onClick={e => e.stopPropagation()}>
          <div className="pai-user-dropdown-header">
            <div className="pai-user-dropdown-name">{user?.fullName || firstName}</div>
          <div className="pai-user-dropdown-email">{user?.primaryEmailAddress?.emailAddress}</div>
  </div>
        <button className="pai-user-dropdown-item" onClick={() => { setShowUserMenu(false); openUserProfile(); }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 7.5C9.157 7.5 10.5 6.157 10.5 4.5C10.5 2.843 9.157 1.5 7.5 1.5C5.843 1.5 4.5 2.843 4.5 4.5C4.5 6.157 5.843 7.5 7.5 7.5Z" stroke="currentColor" strokeWidth="1.3"/><path d="M2 13C2 11.067 4.462 9.5 7.5 9.5C10.538 9.5 13 11.067 13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          Manage Profile
            </button>
        <div className="pai-user-dropdown-divider" />
                    <button className="pai-user-dropdown-item danger" onClick={() => { setShowUserMenu(false); signOut(); }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M10 1H13C13.552 1 14 1.448 14 2V13C14 13.552 13.552 14 13 14H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M7 10L10 7.5L7 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 7.5H1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          Sign Out
            </button>
            </div>
            </div>
  );
  if (showHome) {
        return (
                <>
                  <Head>
                    <title><img src="/cloudelligent-logo.png" alt="Cloudelligent" style={{height:'28px',width:'auto',filter:'brightness(0) invert(1)'}} /></title>
              <meta name="description" content="AI-powered prospecting platform" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <link rel="icon" href="/favicon.ico" />
              <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
              <style>{HOME_STYLES}</style>
    </Head>
        <div className="pai-home">
              <div className="pai-home-topbar">
                <div className="pai-home-logo"><img src="/cloudelligent-logo.png" alt="Cloudelligent" style={{height:'28px',width:'auto',filter:'brightness(0) invert(1)'}} /></div>
                <UserMenu />
    </div>
          <div className="pai-home-hero">
                <div className="pai-home-greeting">{greeting}, {firstName} 👋</div>
            <div className="pai-home-headline">What would you like to<br /><span>work on today?</span></div>
                <div className="pai-home-sub">Select a tool below to jump right in. Everything you need to find, enrich, and engage your best prospects.</div>
            <div className="pai-home-tools-label">Available tools</div>
    </div>
          <div className="pai-home-grid">
  {FEATURES.map(f => (
                  <div key={f.id} className="pai-home-card"
                                style={{ '--card-accent': f.accent, '--card-icon-bg': f.iconBg }}
                onClick={() => handleCardClick(f.id)}
              >
                <div className="pai-home-card-icon">{f.icon}</div>
                <div className="pai-home-card-title">{f.title}</div>
                <div className="pai-home-card-desc">{f.desc}</div>
                <div className="pai-home-card-footer"><span className="pai-home-card-arrow">→</span></div>
                </div>
            ))}
              </div>
          <div className="pai-home-stats">
                          <div className="pai-home-stat"><div className="pai-home-stat-val">11</div><div className="pai-home-stat-label">Tools Available</div></div>
            <div className="pai-home-stat-divider" />
                          <div className="pai-home-stat"><div className="pai-home-stat-val">AWS</div><div className="pai-home-stat-label">Always Included</div></div>
            <div className="pai-home-stat-divider" />
                          <div className="pai-home-stat"><div className="pai-home-stat-val">Live</div><div className="pai-home-stat-label">Data Status</div></div>
            <div className="pai-home-stat-divider" />
                          <div className="pai-home-stat"><div className="pai-home-stat-val">{today}</div><div className="pai-home-stat-label">Today</div></div>
              </div>
              </div>
              </>
    );
}
  return (
        <>
          <Head>
            <title><img src="/cloudelligent-logo.png" alt="Cloudelligent" style={{height:'28px',width:'auto',filter:'brightness(0) invert(1)'}} /></title>
            <meta name="description" content="AI-powered prospecting platform" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="icon" href="/favicon.ico" />
            <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            <style>{APP_STYLES}</style>
    </Head>
      <div className="app-layout">
            <aside className="sidebar">
              <div className="sidebar-logo" onClick={() => setShowHome(true)} style={{ cursor: 'pointer' }}><img src="/cloudelligent-logo.png" alt="Cloudelligent" style={{height:'28px',width:'auto',filter:'brightness(0) invert(1)'}} /></div>
              <nav className="sidebar-nav">
  {visibleTabs.map(tab => (
                  <button key={tab.id} className={`sidebar-btn${activeTab === tab.id ? ' active' : ''}`} onClick={() => setActiveTab(tab.id)}>
{tab.label}
</button>
            ))}
{isAdmin && (
                <Link href="/admin-portal" className="sidebar-btn" style={{ display: 'block', textAlign: 'left', marginTop: 8, borderTop: '1px solid #1e293b', paddingTop: 12, color: '#818cf8', textDecoration: 'none' }}>
                Admin Portal
                  </Link>
            )}
</nav>
          <div className="sidebar-footer" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
{user && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserButton afterSignOutUrl="/sign-in" />
                  <span className="sidebar-email" style={{ flex: 1 }}>{user.primaryEmailAddress?.emailAddress}</span>
  </div>
            )}
            <button onClick={() => signOut()} style={{ width: '100%', padding: '7px 0', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '.03em' }}>Sign Out</button>
              </div>
              </aside>
        <main className="app-main">
            {activeTab === 'leads' && <FindLeads />}
            {activeTab === 'company' && <CompanyIntel />}
{activeTab === 'bulk' && <BulkProspector />}
{activeTab === 'jobchanges' && <JobChanges />}
{activeTab === 'people' && <PeopleLookup />}
{activeTab === 'credits' && <Credits />}
{activeTab === 'lookalike' && <LookalikSearch />}
{activeTab === 'awsopps' && <LeadScoring initialSnapshot={loadedSnapshot} onSnapshotConsumed={() => setLoadedSnapshot(null)} />}
{activeTab === 'settings' && <Settings />}
{activeTab === 'emailqueue' && <EmailQueue />}
{activeTab === 'salesanalytics' && <SalesAnalytics onBack={() => setShowHome(true)} />}
{activeTab === 'intent' && <BuyingIntent />}
</main>
  </div>
  </>
  );
}
