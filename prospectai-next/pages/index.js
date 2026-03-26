import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { UserButton, useUser } from '@clerk/nextjs';
import FindLeads from '../components/FindLeads';
import CompanyIntel from '../components/CompanyIntel';
import BulkProspector from '../components/BulkProspector';
import JobChanges from '../components/JobChanges';
import PeopleLookup from '../components/PeopleLookup';
import Credits from '../components/Credits';
import LookalikSearch from '../components/LookalikSearch';
import Settings from '../components/Settings';
import AwsOpportunities from '../components/AwsOpportunities';
import AwsSnapshots from '../components/AwsSnapshots';
import EmailQueue from '../components/EmailQueue';

const ADMIN_USER_ID = process.env.NEXT_PUBLIC_ADMIN_USER_ID;

const TABS = [
  { id: 'leads', label: 'Find Leads' },
  { id: 'company', label: 'Company Intel' },
  { id: 'bulk', label: 'Bulk Prospector' },
  { id: 'jobchanges', label: 'Job Changes' },
  { id: 'people', label: 'People Lookup' },
  { id: 'lookalike', label: 'Lookalike' },
  { id: 'awsopps', label: 'AWS Opportunities' },
  { id: 'awssnapshots', label: 'Snapshots' },
  { id: 'emailqueue', label: 'Email Queue' },
  { id: 'credits', label: 'Credits' },
  { id: 'settings', label: 'Settings' },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState('leads');
  const [loadedSnapshot, setLoadedSnapshot] = useState(null);
  const [checkingOnboard, setCheckingOnboard] = useState(true);
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { setCheckingOnboard(false); return; }
    Promise.all([
      fetch('/api/user-settings?ns=onboarding_complete').then(r => r.json()),
      fetch('/api/user-settings?ns=icp_weights').then(r => r.json()),
      fetch('/api/user-settings?ns=sender_emails').then(r => r.json()),
    ])
      .then(([done, icp, senders]) => {
        const isComplete = done.data || icp.data || senders.data;
        if (!isComplete) { router.replace('/onboarding'); }
        else { setCheckingOnboard(false); }
      })
      .catch(() => setCheckingOnboard(false));
  }, [isLoaded, user]);

  const handleLoadSnapshot = (snapshotData) => {
    setLoadedSnapshot(snapshotData);
    setActiveTab('awsopps');
  };

  const isAdmin = user?.id === ADMIN_USER_ID;

  if (checkingOnboard) {
    return (
      <div style={{ minHeight: '100vh', background: '#020817', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#475569', fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>ProspectAI</title>
        <meta name="description" content="AI-powered prospecting platform" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <div className="app-layout">
        {/* Left Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">Prospect<span>AI</span></div>
          <nav className="sidebar-nav">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`sidebar-btn${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className="sidebar-btn"
                style={{ display: 'block', textAlign: 'left', marginTop: 8, borderTop: '1px solid #1e293b', paddingTop: 12, color: '#818cf8', textDecoration: 'none' }}
              >
                Admin Portal
              </Link>
            )}
          </nav>
          <div className="sidebar-footer">
            {user && (
              <span className="sidebar-email">{user.primaryEmailAddress?.emailAddress}</span>
            )}
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </aside>

        {/* Main content */}
        <main className="app-main">
          {activeTab === 'leads' && <FindLeads />}
          {activeTab === 'company' && <CompanyIntel />}
          {activeTab === 'bulk' && <BulkProspector />}
          {activeTab === 'jobchanges' && <JobChanges />}
          {activeTab === 'people' && <PeopleLookup />}
          {activeTab === 'credits' && <Credits />}
          {activeTab === 'lookalike' && <LookalikSearch />}
          {activeTab === 'awsopps' && <AwsOpportunities initialSnapshot={loadedSnapshot} onSnapshotConsumed={() => setLoadedSnapshot(null)} />}
          {activeTab === 'awssnapshots' && <AwsSnapshots onLoadSnapshot={handleLoadSnapshot} />}
          {activeTab === 'settings' && <Settings />}
          {activeTab === 'emailqueue' && <EmailQueue />}
        </main>
      </div>
    </>
  );
}
