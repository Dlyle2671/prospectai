import { useState } from 'react';
import LeadCard from './LeadCard';
import { paiSave, paiLoad } from '../lib/utils';

export default function PeopleLookup() {
  const saved = paiLoad('people');
  const [email, setEmail] = useState(saved?.email || '');
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState(saved?.result || null);

  async function doSearch() {
    const e = email.trim();
    if (!e) return;
    setStage(1);
    try {
      const resp = await fetch('/api/apollo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, per_page: 10 }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      const results = Array.isArray(data) ? data : [];
      const exact = results.find(p => p.email?.toLowerCase() === e.toLowerCase()) || results[0] || null;
      setResult(exact);
      paiSave('people', { email: e, result: exact });
      setStage(exact ? 2 : 3);
    } catch (err) {
      setStage(0);
      alert('Lookup failed: ' + err.message);
    }
  }

  return (
    <div className="fade-up">
      <div className="section-title">👤 People Lookup</div>
      <div className="section-sub">Search for an individual by email address to get their full profile — contact details, company intel, tech stack, and more.</div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
        <input
          style={{ flex: 1, padding: '12px 16px', background: '#0d1424', border: '1px solid #1a2540', borderRadius: 10, color: '#c8d4e8', fontSize: 15, fontFamily: 'inherit', outline: 'none' }}
          type="email"
          placeholder="Enter email address (e.g. john@company.com)"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
        />
        <button
          style={{ padding: '12px 28px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#4f8ef7,#2563eb)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
          onClick={doSearch}
          disabled={stage === 1}
        >
          {stage === 1 ? '🔍 Searching…' : '🔍 Look Up Person'}
        </button>
      </div>

      {stage === 1 && <div className="loading-wrap"><span className="spinner" /><p>Looking up person…</p></div>}

      {stage === 3 && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <div>No contact found for <strong>{email}</strong>. Try a different email address.</div>
        </div>
      )}

      {stage === 2 && result && (
        <LeadCard p={result} index={0} />
      )}

      {stage === 0 && result && (
        <LeadCard p={result} index={0} />
      )}
    </div>
  );
}
