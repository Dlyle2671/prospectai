import { useState } from 'react';
import { paiSave, paiLoad , trackCredits } from '../lib/utils';

const TITLE_OPTIONS = ['VP of Engineering','CTO','Head of Infrastructure','Cloud Architect','DevOps Manager','Director of Engineering','Head of Platform','VP of IT','Engineering Manager','Solutions Architect'];
const INDUSTRY_OPTIONS = ['Information Technology','Software Development','Financial Services','Healthcare','Cybersecurity','Telecommunications'];
const SIZE_OPTIONS = ['1-10','11-50','51-200','201-500','501-1000','1001-5000'];
const TIME_OPTIONS = [{label:'Last 30 days',val:30},{label:'Last 60 days',val:60},{label:'Last 90 days',val:90},{label:'Last 6 months',val:180}];

export default function JobChanges() {
  const saved = paiLoad('jobchanges');
  const [titles, setTitles] = useState(saved?.titles || []);
  const [industries, setIndustries] = useState(saved?.industries || []);
  const [sizes, setSizes] = useState(saved?.sizes || []);
  const [timeWindow, setTimeWindow] = useState(saved?.timeWindow || 90);
  const [stage, setStage] = useState(0);
  const [results, setResults] = useState(saved?.results || []);
  const [hsSent, setHsSent] = useState({});

  function toggle(arr, setArr, val) {
    const i = arr.indexOf(val);
    const next = [...arr];
    if (i >= 0) next.splice(i, 1); else next.push(val);
    setArr(next);
  }

  async function doSearch() {
    if (!titles.length) { alert('Select at least one job title.'); return; }
    setStage(1);
    try {
      const page = Math.floor(Math.random() * 15) + 1;
      const resp = await fetch('/api/apollo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titles, industries, employee_ranges: sizes, per_page: 25, page, changed_jobs_recently: true }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      const allResults = Array.isArray(data) ? data : [];
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - timeWindow);
      const filtered = allResults.filter(p => {
        if (!p.time_in_role_months && p.time_in_role_months !== 0) return true;
        return p.time_in_role_months <= (timeWindow / 30);
      });
      setResults(filtered.length > 0 ? filtered : allResults);
      paiSave('jobchanges', { titles, industries, sizes, timeWindow, results: filtered });
      trackCredits('jobchange', filtered.length, 'Job Changes search (' + filtered.length + ' contacts)');
      setStage(2);
    } catch (err) { setStage(0); alert('Search failed: ' + err.message); }
  }

  async function pushHS(i) {
    const p = results[i];
    if (!p) return;
    try {
      await fetch('/api/hubspot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first_name: p.first_name, last_name: p.last_name, email: p.email, title: p.title, company_name: p.company_name, company_domain: p.company_domain, linkedin_url: p.linkedin_url, score_label: p.score_label }) });
      setHsSent(prev => ({ ...prev, [i]: true }));
    } catch (err) { alert('HubSpot error: ' + err.message); }
  }

  function exportCSV() {
    const rows = [['Name','Title','Company','Email','Previous Title','Previous Company','Time in Role']];
    results.forEach(p => {
      const prev = p.prev_jobs?.[0];
      rows.push([`${p.first_name||''} ${p.last_name||''}`.trim(), p.title||'', p.company_name||'', p.email||'', prev?.title||'', prev?.company||'', p.time_in_role_months != null ? p.time_in_role_months + 'mo' : '']);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = `job_changes_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }

  function getChangeBadge(months) {
    if (months === null || months === undefined) return null;
    if (months <= 2) return { label: '🟢 New', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)' };
    if (months <= 6) return { label: '🟡 Recent', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' };
    return { label: '🔄 Recently Changed', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)' };
  }

  return (
    <div className="fade-up">
      <div className="section-title">🔄 Job Changes</div>
      <div className="section-sub">Find contacts who have recently changed jobs — they are actively evaluating new vendors and tools.</div>

      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>Job Title (required)</div>
        <div className="pill-row">{TITLE_OPTIONS.map(t => <button key={t} className={`pill ${titles.includes(t) ? 'active' : ''}`} onClick={() => toggle(titles, setTitles, t)}>{t}</button>)}</div>
      </div>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>Industry (optional)</div>
        <div className="pill-row">{INDUSTRY_OPTIONS.map(t => <button key={t} className={`pill ${industries.includes(t) ? 'active' : ''}`} onClick={() => toggle(industries, setIndustries, t)}>{t}</button>)}</div>
      </div>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>Time Window</div>
        <div className="pill-row">{TIME_OPTIONS.map(t => <button key={t.val} className={`pill ${timeWindow === t.val ? 'active' : ''}`} onClick={() => setTimeWindow(t.val)}>{t.label}</button>)}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button className="search-btn" style={{ marginTop: 0 }} onClick={doSearch} disabled={stage === 1}>{stage === 1 ? 'Searching…' : '🔄 Find Job Changes'}</button>
        {results.length > 0 && <button style={{ padding: '12px 20px', borderRadius: 10, background: '#064e3b', color: '#34d399', border: '1px solid #065f46', fontSize: 14, cursor: 'pointer' }} onClick={exportCSV}>📥 Export CSV</button>}
      </div>

      {stage === 1 && <div className="loading-wrap"><span className="spinner" /><p>Finding recent job changes…</p></div>}

      {stage === 2 && results.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: '#94a3b8' }}>{results.length} contacts who recently changed jobs</div>
            <button style={{ padding: '8px 16px', borderRadius: 8, background: '#ff7a59', color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer' }} onClick={() => results.forEach((_, i) => { if (!hsSent[i]) pushHS(i); })}>⬆ Push All to HubSpot</button>
          </div>
          {results.map((p, i) => {
            const badge = getChangeBadge(p.time_in_role_months);
            const prev = p.prev_jobs?.[0];
            return (
              <div key={i} className="card fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="avatar">{p.photo_url ? <img src={p.photo_url} alt={p.name} onError={e => { e.target.parentNode.innerHTML = '👤'; }} /> : '👤'}</div>
                <div className="card-body">
                  <div className="card-top">
                    <div>
                      <div className="person-name">{p.name}</div>
                      <div className="person-title">{p.title}</div>
                      <div className="person-company">{p.company_name}</div>
                    </div>
                    {badge && <span style={{ fontSize: 11, fontWeight: 700, color: badge.color, background: badge.bg, border: `1px solid ${badge.border}`, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>{badge.label}</span>}
                  </div>
                  <div className="card-meta">
                    {p.email && <span className="meta-tag email">✅ {p.email}</span>}
                    {p.time_in_role_months != null && <span className="meta-tag">🕐 {p.time_in_role_months}mo in current role</span>}
                    {p.linkedin_url && <span className="meta-tag social"><a href={p.linkedin_url} target="_blank" rel="noopener noreferrer">in ↗</a></span>}
                  </div>
                  {prev && <div className="card-meta"><span className="meta-tag prev-job">↩ Previously: {prev.title}{prev.company ? ' @ ' + prev.company : ''}</span></div>}
                  <div className="card-actions">
                    <button className={`btn-sm btn-hs${hsSent[i] ? ' sent' : ''}`} onClick={() => !hsSent[i] && pushHS(i)} disabled={hsSent[i]}>{hsSent[i] ? '✓ In HubSpot' : '⬆ Push to HubSpot'}</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {stage === 0 && results.length === 0 && (
        <div className="empty-state"><div className="empty-icon">🔄</div><div>Select job titles and find people who recently changed positions.</div></div>
      )}
    </div>
  );
}
