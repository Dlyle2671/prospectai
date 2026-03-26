import { useState } from 'react';
import Head from 'next/head';
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

const TABS = [
  { id: 'leads', label: 'Find Leads' },
  { id: 'company', label: 'Company Intel' },
  { id: 'bulk', label: '⚡ Bulk Prospector' },
  { id: 'jobchanges', label: '🔄 Job Changes' },
  { id: 'people', label: '👤 People Lookup' },
  { id: 'credits', label: '📊 Credits' },
  { id: 'lookalike', label: '🎯 Lookalike' },
  { id: 'awsopps', label: '☁️ AWS Opportunities' },
  { id: 'awssnapshots', label: '💾 Snapshots' },
  { id: 'emailqueue', label: '✉️ Email Queue' },
  { id: 'settings', label: 'Settings' },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState('leads');
  const [loadedSnapshot, setLoadedSnapshot] = useState(null);
  const { user } = useUser();

  const handleLoadSnapshot = (snapshotData) => {
    setLoadedSnapshot(snapshotData);
    setActiveTab('awsopps');
  };

  return (
    <>
      <Head>
        <title>ProspectAI</title>
        <meta name="description" content="AI-powered prospecting platform" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <nav>
        <div className="nav-logo">Prospect<span>AI</span></div>
        <div className="nav-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', paddingRight: 16 }}>
          {user && (
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {user.primaryEmailAddress?.emailAddress}
            </span>
          )}
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </nav>
      <main>
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
    </>
  );
}
