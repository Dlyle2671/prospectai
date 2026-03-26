import { useState } from 'react';
import LeadCard from './LeadCard';
import { paiSave, paiLoad, trackCredits } from '../lib/utils';

const TITLE_OPTIONS = [
      'VP of Engineering','CTO','Head of Infrastructure','Cloud Architect',
      'DevOps Manager','Director of Engineering','Head of Platform','VP of IT',
      'Engineering Manager','Solutions Architect',
    ];
const INDUSTRY_OPTIONS = [
      'Information Technology','Software Development','Financial Services',
      'Healthcare','Cybersecurity','Telecommunications',
    ];
const TIME_OPTIONS = [
    { label: 'Last 30 days', val: 30 },
    { label: 'Last 60 days', val: 60 },
    { label: 'Last 90 days', val: 90 },
    { label: 'Last 6 months', val: 180 },
    ];

export default function JobChanges() {
      const saved = paiLoad('jobchanges');
      const [titles, setTitles]         = useState(saved?.titles || []);
      const [industries, setIndustries] = useState(saved?.industries || []);
      const [timeWindow, setTimeWindow] = useState(saved?.timeWindow || 90);
      const [stage, setStage]           = useState(0);
      const [results, setResults]       = useState(saved?.results || []);
      const [senderEmails, setSenderEmails] = useState([]);

  function toggle(arr, setArr, val) {
          const next = arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
          setArr(next);
  }

  async function doSearch() {
          if (!titles.length) { alert('Select at least one job title.'); return; }
          setStage(1);
          try {
                    // Load sender emails for LeadCard draft email feature
            try {
                        const se = await fetch('/api/user-settings?ns=sender_emails').then(r => r.json());
                        setSenderEmails(Array.isArray(se.data) ? se.data : []);
            } catch (_) {}

            const page = Math.floor(Math.random() * 15) + 1;
                    const resp = await fetch('/api/apollo', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                              titles,
                                              industries,
                                              per_page: 25,
                                              page,
                                              changed_jobs_recently: true,
                                }),
                    });
                    const data = await resp.json();
                    if (data.error) throw new Error(data.error);

            const allResults = Array.isArray(data) ? data : [];
                    const filtered = allResults.filter(p => {
                                if (p.time_in_role_months == null) return true;
                                return p.time_in_role_months <= timeWindow / 30;
                    });
                    const final = filtered.length > 0 ? filtered : allResults;
                    setResults(final);
                    paiSave('jobchanges', { titles, industries, timeWindow, results: final });
                    trackCredits('jobchange', final.length, `Job Changes search (${final.length} contacts)`);
                    setStage(2);
          } catch (err) {
                    setStage(0);
                    alert('Search failed: ' + err.message);
          }
  }

  function exportCSV() {
          const rows = [['Name','Title','Company','Email','Previous Title','Previous Company','Time in Role']];
          results.forEach(p => {
                    const prev = p.prev_jobs?.[0];
                    rows.push([
                                `${p.first_name || ''} ${p.last_name || ''}`.trim(),
                                p.title || '', p.company_name || '', p.email || '',
                                prev?.title || '', prev?.company || '',
                                p.time_in_role_months != null ? p.time_in_role_months + 'mo' : '',
                              ]);
          });
          const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
          a.download = `job_changes_${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
  }

  return (
          <div className="fade-up">
            <div className="section-title">🔄 Job Changes</div>
          <div className="section-sub">Find contacts who have recently changed jobs — they are actively evaluating new vendors and tools.</div>

      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>JOB TITLE (REQUIRED)</div>
        <div className="pill-row">
{TITLE_OPTIONS.map(t => (
                <button key={t} className={`pill ${titles.includes(t) ? 'active' : ''}`} onClick={() => toggle(titles, setTitles, t)}>{t}</button>
          ))}
</div>
    </div>

      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>INDUSTRY (OPTIONAL)</div>
        <div className="pill-row">
{INDUSTRY_OPTIONS.map(t => (
                <button key={t} className={`pill ${industries.includes(t) ? 'active' : ''}`} onClick={() => toggle(industries, setIndustries, t)}>{t}</button>
          ))}
</div>
    </div>

      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>TIME WINDOW</div>
        <div className="pill-row">
{TIME_OPTIONS.map(t => (
                <button key={t.val} className={`pill ${timeWindow === t.val ? 'active' : ''}`} onClick={() => setTimeWindow(t.val)}>{t.label}</button>
          ))}
</div>
    </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button className="search-btn" style={{ marginTop: 0 }} onClick={doSearch} disabled={stage === 1}>
{stage === 1 ? 'Searching…' : '🔄 Find Job Changes'}
    </button>
{results.length > 0 && (
              <button style={{ padding: '12px 20px', borderRadius: 10, background: '#064e3b', color: '#34d399', border: '1px solid #065f46', fontSize: 14, cursor: 'pointer' }} onClick={exportCSV}>
                📥 Export CSV
    </button>
        )}
</div>

{stage === 1 && (
            <div className="loading-wrap"><span className="spinner" /><p>Finding recent job changes…</p></div>
          )}

{stage === 2 && results.length > 0 && (
            <div>
              <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 16 }}>
{results.length} contacts who recently changed jobs
    </div>
{results.map((person, i) => (
                <LeadCard
                           key={i}
               p={person}
               index={i}
               onHubspotPush={() => {}}
               sequences={[]}
               senderEmails={senderEmails}
             />
                             ))}
</div>
      )}

{stage === 0 && results.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🔄</div>
           <div>Select job titles and find people who recently changed positions.</div>
    </div>
       )}
</div>
  );
}
