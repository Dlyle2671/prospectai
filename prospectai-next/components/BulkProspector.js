import { useState } from 'react';
import { paiSave, paiLoad } from '../lib/utils';

const TITLE_OPTIONS = ['VP of Engineering','CTO','Head of Infrastructure','Cloud Architect','DevOps Manager','Director of Engineering','Head of Platform','VP of IT','Chief Information Officer','Engineering Manager','Solutions Architect','Technical Director','Head of DevOps','VP of Technology','Head of Cloud'];
const INDUSTRY_OPTIONS = ['Information Technology','Software Development','Financial Services','Healthcare','E-Commerce','Cybersecurity','Telecommunications','Manufacturing','Logistics','Education','Media & Entertainment','Real Estate','Professional Services','Energy','Retail'];
const SIZE_OPTIONS = ['1-10','11-50','51-200','201-500','501-1000','1001-5000','5001+'];
const LIMIT_OPTIONS = [10,25,50,100];

const DEFAULT = { titles: ['VP of Engineering','CTO','Head of Infrastructure','Cloud Architect','DevOps Manager'], industry: ['Information Technology'], sizes: ['51-200','201-500','501-1000'], limit: 50 };

export default function BulkProspector() {
  const [filters, setFilters] = useState(() => ({ ...DEFAULT, ...paiLoad('bulk_filters') }));
  const [stage, setStage] = useState(0);
  const [results, setResults] = useState(() => paiLoad('bulk_results') || []);
  const [hsSent, setHsSent] = useState({});
  const [progress, setProgress] = useState(0);

  function toggle(key, val) {
    setFilters(prev => {
      const arr = [...prev[key]];
      const i = arr.indexOf(val);
      if (i >= 0) arr.splice(i, 1); else arr.push(val);
      return { ...prev, [key]: arr };
    });
  }

  async function runSearch() {
    if (!filters.titles.length) { alert('Select at least one job title.'); return; }
    setStage(1); setResults([]); setProgress(0); setHsSent({});
    const limit = filters.limit;
    const perPage = 25;
    const pagesNeeded = Math.ceil(limit / perPage);
    const allContacts = [];
    const seenIds = new Set();
    try {
      for (let run = 0; run < pagesNeeded && allContacts.length < limit; run++) {
        const page = Math.floor(Math.random() * 20) + 1;
        const resp = await fetch('/api/apollo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ per_page: perPage, page, person_titles: filters.titles, organization_num_employees_ranges: filters.sizes, industries: filters.industry }),
        });
        const data = await resp.json();
        const contacts = data.people || data.contacts || (Array.isArray(data) ? data : []);
        contacts.forEach(c => { if (!seenIds.has(c.id) && allContacts.length < limit) { seenIds.add(c.id); allContacts.push(c); } });
        setProgress(Math.min(95, Math.round((allContacts.length / limit) * 100)));
        if (contacts.length < perPage) break;
        await new Promise(r => setTimeout(r, 200));
      }
      setResults(allContacts);
      paiSave('bulk_results', allContacts);
      paiSave('bulk_filters', filters);
      setStage(2); setProgress(100);
    } catch (err) { setStage(3); alert('Search failed: ' + err.message); }
  }

  async function pushHS(i) {
    const p = results[i];
    if (!p) return;
    try {
      await fetch('/api/hubspot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: p.email, firstname: p.first_name, lastname: p.last_name, jobtitle: p.title, company: p.organization?.name, phone: p.phone_numbers?.[0]?.raw_number, linkedin: p.linkedin_url }) });
      setHsSent(prev => ({ ...prev, [i]: true }));
    } catch (err) { alert('HubSpot error: ' + err.message); }
  }

  function exportCSV() {
    const rows = [['Name','Title','Company','Email','Phone','LinkedIn','Location']];
    results.forEach(p => rows.push([`${p.first_name||''} ${p.last_name||''}`.trim(), p.title||'', p.organization?.name||'', p.email||'', p.phone_numbers?.[0]?.raw_number||'', p.linkedin_url||'', [p.city,p.state,p.country].filter(Boolean).join(', ')]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = `bulk_prospects_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }

  return (
    <div className="fade-up">
      <div className="section-title">⚡ Bulk Prospector</div>
      <div className="section-sub">Find multiple contacts at once. Export to CSV or push directly to HubSpot.</div>

      {/* Filters */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>Job Titles ({filters.titles.length} selected)</div>
        <div className="pill-row">{TITLE_OPTIONS.map(t => <button key={t} className={`pill ${filters.titles.includes(t) ? 'active' : ''}`} onClick={() => toggle('titles', t)}>{t}</button>)}</div>
      </div>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>Industry ({filters.industry.length} selected)</div>
        <div className="pill-row">{INDUSTRY_OPTIONS.map(t => <button key={t} className={`pill ${filters.industry.includes(t) ? 'active' : ''}`} onClick={() => toggle('industry', t)}>{t}</button>)}</div>
      </div>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>Company Size ({filters.sizes.length} selected)</div>
        <div className="pill-row">{SIZE_OPTIONS.map(t => <button key={t} className={`pill ${filters.sizes.includes(t) ? 'active' : ''}`} onClick={() => toggle('sizes', t)}>{t}</button>)}</div>
      </div>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>Search Settings</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Results limit:</span>
          <select style={{ background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: 13 }} value={filters.limit} onChange={e => setFilters(prev => ({ ...prev, limit: parseInt(e.target.value) }))}>
            {LIMIT_OPTIONS.map(n => <option key={n} value={n}>{n} contacts</option>)}
          </select>
          <span style={{ fontSize: 12, color: '#475569' }}>~{Math.ceil(filters.limit/25)} API calls</span>
        </div>
        <button style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: stage === 1 ? '#334155' : '#1d4ed8', color: stage === 1 ? '#64748b' : '#fff', fontSize: 14, fontWeight: 600, cursor: stage === 1 ? 'not-allowed' : 'pointer' }} onClick={runSearch} disabled={stage === 1}>
          {stage === 1 ? '⚡ Running…' : '⚡ Run Bulk Search'}
        </button>
      </div>

      {/* Progress */}
      {stage === 1 && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 20 }}>
          <div style={{ color: '#94a3b8', fontSize: 14, marginBottom: 12 }}>⚡ Searching for {filters.limit} contacts…</div>
          <div style={{ background: '#0f172a', borderRadius: 6, overflow: 'hidden', height: 8, border: '1px solid #334155' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg,#1d4ed8,#3b82f6)', width: progress + '%', transition: 'width .3s' }} />
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 8, fontStyle: 'italic' }}>{progress}% complete — {results.length} contacts found so far</div>
        </div>
      )}

      {/* Results */}
      {stage === 2 && results.length > 0 && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 12px', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc' }}>⚡ Bulk Results</div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>{results.length} contacts found</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ padding: '8px 16px', borderRadius: 8, background: '#064e3b', color: '#34d399', border: '1px solid #065f46', fontSize: 13, cursor: 'pointer' }} onClick={exportCSV}>📥 Export CSV</button>
              <button style={{ padding: '8px 16px', borderRadius: 8, background: '#ff7a59', color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer' }} onClick={() => results.forEach((_, i) => { if (!hsSent[i]) pushHS(i); })}>⬆ Push All to HubSpot</button>
            </div>
          </div>
          <div style={{ background: '#0f172a', borderTop: '1px solid #334155' }}>
            <div style={{ display: 'flex', gap: 12, padding: '8px 14px', borderBottom: '1px solid #1e293b', fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              <div style={{ width: 32, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 160 }}>Name / Title</div>
              <div style={{ flex: 1, minWidth: 160 }}>Email</div>
              <div style={{ minWidth: 120 }}>Location</div>
              <div style={{ minWidth: 80 }}>Action</div>
            </div>
            {results.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #1e293b', flexWrap: 'wrap' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{((p.first_name || '?')[0] || '?').toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{p.first_name} {p.last_name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.title} · {p.organization?.name}</div>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', flex: 1, minWidth: 160 }}>{p.email || '—'}</div>
                <div style={{ fontSize: 11, color: '#64748b', minWidth: 120 }}>{[p.city,p.state,p.country].filter(Boolean).join(', ') || '—'}</div>
                <button
                  style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: hsSent[i] ? '#14532d' : '#ff7a59', color: hsSent[i] ? '#4ade80' : '#fff', fontSize: 11, cursor: hsSent[i] ? 'default' : 'pointer' }}
                  onClick={() => !hsSent[i] && pushHS(i)}
                  disabled={hsSent[i]}
                >
                  {hsSent[i] ? '✓ Sent' : '⬆ HubSpot'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {stage === 0 && results.length === 0 && (
        <div className="empty-state"><div className="empty-icon">⚡</div><div>Configure your filters above and run a bulk search.</div></div>
      )}
    </div>
  );
}
