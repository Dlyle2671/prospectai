import { useState, useEffect } from 'react';
import LeadCard from './LeadCard';
import { paiSave, paiLoad, pickPage, addSeenIds, filterSeenIds, makeFilterKey, trackCredits } from '../lib/utils';

const INDUSTRIES = ['Technology','Software','SaaS','Cloud Computing','Cybersecurity','Fintech','Healthcare','Biotech','E-commerce','Marketing','Real Estate','Education','Manufacturing','Logistics','Media'];
const EMP_RANGES = [{label:'1-10',val:'1,10'},{label:'11-50',val:'11,50'},{label:'51-200',val:'51,200'},{label:'201-500',val:'201,500'},{label:'501-1000',val:'501,1000'},{label:'1001-5000',val:'1001,5000'},{label:'5001+',val:'5001,10000000'}];
const TITLE_OPTIONS = ['CEO','CTO','CFO','COO','CMO','VP of Sales','VP of Marketing','VP of Engineering','Director of Sales','Director of Marketing','Head of Growth','Head of Product','Sales Manager','Account Executive','Founder'];
const LIMIT_OPTIONS = [10,25,50,100];
const GEO_OPTIONS = [{label:'United States',val:'United States'},{label:'California',val:'California, United States'},{label:'New York',val:'New York, United States'},{label:'Texas',val:'Texas, United States'},{label:'United Kingdom',val:'United Kingdom'},{label:'Canada',val:'Canada'},{label:'Australia',val:'Australia'},{label:'Germany',val:'Germany'},{label:'India',val:'India'},{label:'Singapore',val:'Singapore'}];

const DEFAULT_STATE = {
    stage: 0, results: [], selectedIndustries: [], selectedEmployeeRanges: [],
    selectedTitles: [], selectedLocations: [], selectedLimit: 25,
    activeResultFilters: [], lastPage: 1,
};

export default function FindLeads() {
    const [state, setState] = useState(() => {
          const saved = paiLoad('leads');
          return saved ? { ...DEFAULT_STATE, ...saved, stage: saved.results?.length ? 2 : 0 } : DEFAULT_STATE;
    });

  // Fetch Apollo sequences once on mount
  const [sequences, setSequences] = useState([]);
    useEffect(() => {
          fetch('/api/apollo-sequences')
            .then(r => r.json())
            .then(data => { if (Array.isArray(data)) setSequences(data); })
            .catch(() => {});
    }, []);

  const [draftQueuing, setDraftQueuing] = useState(false);
  const [draftQueueToast, setDraftQueueToast] = useState(null);

  async function draftAllToQueue() {
    const leadsWithEmail = filtered.filter(p => p.email);
    if (!leadsWithEmail.length) { setDraftQueueToast({ msg: 'No leads with email addresses', type: 'error' }); setTimeout(() => setDraftQueueToast(null), 3000); return; }
    setDraftQueuing(true);
    setDraftQueueToast({ msg: 'Drafting ' + leadsWithEmail.length + ' emails…', type: 'info' });
    try {
      const drafts = await Promise.all(leadsWithEmail.map(async p => {
        try {
          const resp = await fetch('/api/draft-email', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: p.name, first_name: p.first_name, title: p.title, company_name: p.company_name, company_description: p.company_description || p.seo_description || '', keywords: p.keywords || [], tech_stack: p.tech_stack || [], aws_services: p.aws_services || [], funding_stage: p.funding_stage || '', recently_funded: p.recently_funded || false, hiring_surge: p.hiring_surge || false, location: [p.city, p.state, p.country].filter(Boolean).join(', '), time_in_role_months: p.time_in_role_months, prev_jobs: p.prev_jobs, headcount_growth: p.headcount_growth, annual_revenue: p.annual_revenue, funding_round_amount: p.funding_round_amount, top_investors: p.top_investors, intent_signals: p.intent_signals }),
          });
          const data = await resp.json();
          if (data.error) return null;
          return { id: p.email + '_' + Date.now() + '_' + Math.random().toString(36).slice(2), leadName: p.name, leadEmail: p.email, leadTitle: p.title || '', leadCompany: p.company_name || '', subject: data.subject, body: data.body, status: 'pending', createdAt: new Date().toISOString() };
        } catch { return null; }
      }));
      const valid = drafts.filter(Boolean);
      if (!valid.length) { setDraftQueueToast({ msg: 'Failed to draft emails', type: 'error' }); setTimeout(() => setDraftQueueToast(null), 3000); return; }
      const qResp = await fetch('/api/email-queue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: valid }) });
      const qData = await qResp.json();
      setDraftQueueToast({ msg: qData.added + ' emails added to queue ✓', type: 'success' });
      setTimeout(() => setDraftQueueToast(null), 4000);
    } catch (e) {
      setDraftQueueToast({ msg: 'Error: ' + e.message, type: 'error' });
      setTimeout(() => setDraftQueueToast(null), 3000);
    } finally {
      setDraftQueuing(false);
    }
  }

  useEffect(() => {
        if (state.results.length > 0) paiSave('leads', { ...state, stage: undefined });
  }, [state.results]);

  function toggle(type, val) {
        setState(prev => {
                const key = { industry: 'selectedIndustries', emp: 'selectedEmployeeRanges', title: 'selectedTitles', geo: 'selectedLocations' }[type];
                if (!key) return prev;
                const arr = [...prev[key]];
                const i = arr.indexOf(val);
                if (i >= 0) arr.splice(i, 1); else arr.push(val);
                return { ...prev, [key]: arr };
        });
  }

  function toggleFilter(val) {
        setState(prev => {
                const arr = [...prev.activeResultFilters];
                const i = arr.indexOf(val);
                if (i >= 0) arr.splice(i, 1); else arr.push(val);
                return { ...prev, activeResultFilters: arr };
        });
  }

  function getFiltered(results, filters) {
        if (!filters.length) return results;
        return results.filter(p => filters.every(f => {
                if (f === 'hot') return p.score_label === 'hot';
                if (f === 'warm') return p.score_label === 'warm';
                if (f === 'cold') return p.score_label === 'cold';
                if (f === 'funded') return p.recently_funded === true;
                if (f === 'hiring') return p.hiring_surge === true;
                return true;
        }));
  }

  async function doSearch() {
        const filterKey = makeFilterKey(state);
        const page = pickPage(filterKey, 30);
        setState(prev => ({ ...prev, stage: 1, lastPage: page }));
        try {
                const resp = await fetch('/api/apollo', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                                      industry: state.selectedIndustries,
                                      employee_ranges: state.selectedEmployeeRanges,
                                      tech_stack: ['AWS'],
                                      titles: state.selectedTitles,
                                      locations: state.selectedLocations,
                                      per_page: state.selectedLimit,
                                      page,
                          }),
                });
                const data = await resp.json();
                if (data.error) throw new Error(data.error);
                const results = Array.isArray(data) ? data : [];
                const fresh = filterSeenIds(results);
                addSeenIds(results.map(r => r.id));
    trackCredits('search', results.length, 'Find Leads search (' + results.length + ' contacts)');
                setState(prev => ({ ...prev, results: fresh.length > 0 ? fresh : results, activeResultFilters: [], stage: 2, lastPage: page }));
        } catch (err) {
                setState(prev => ({ ...prev, stage: 0 }));
                alert('Search failed: ' + err.message);
        }
  }

  const { stage, results, selectedIndustries, selectedEmployeeRanges, selectedTitles, selectedLocations, selectedLimit, activeResultFilters, lastPage } = state;
    const hot = results.filter(p => p.score_label === 'hot').length;
    const warm = results.filter(p => p.score_label === 'warm').length;
    const cold = results.filter(p => p.score_label === 'cold').length;
    const funded = results.filter(p => p.recently_funded).length;
    const hiring = results.filter(p => p.hiring_surge).length;
    const filtered = getFiltered(results, activeResultFilters);

  if (stage === 1) return (
        <div className="loading-wrap fade-up">
          <span className="spinner" />
          <p>Searching & enriching leads…</p>
    </div>
    );

  if (stage === 2) return (
        <div className="fade-up">
          {draftQueueToast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', borderRadius: 10, background: draftQueueToast.type === 'error' ? '#7f1d1d' : draftQueueToast.type === 'info' ? '#1e3a5f' : '#052e16', border: '1px solid ' + (draftQueueToast.type === 'error' ? '#ef4444' : draftQueueToast.type === 'info' ? '#3b82f6' : '#16a34a'), color: draftQueueToast.type === 'error' ? '#fca5a5' : draftQueueToast.type === 'info' ? '#93c5fd' : '#4ade80', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,.5)' }}>
          {draftQueueToast.msg}
        </div>
      )}
      <button className="btn-back" onClick={() => setState(prev => ({ ...prev, stage: 0, activeResultFilters: [] }))}>← Back to filters</button>
      <div className="results-header">
          <div className="results-count">
{filtered.length === results.length ? results.length + ' contacts found' : `Showing ${filtered.length} of ${results.length} contacts`}
{lastPage && <span style={{ color: '#475569', marginLeft: 8 }}>· page {lastPage} of results</span>}
  </div>
        <div className="legend">
            <div className="legend-item"><div className="legend-dot" style={{ background: '#ef4444' }} /> Hot ({hot})</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#f59e0b' }} /> Warm ({warm})</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#4f8ef7' }} /> Cold ({cold})</div>
  
        <button
          onClick={draftAllToQueue}
          disabled={draftQueuing || filtered.filter(p => p.email).length === 0}
          title="AI-draft personalized emails for all visible leads and add to review queue"
          style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: draftQueuing ? '#164e63' : '#0e7490', color: draftQueuing ? '#94a3b8' : '#fff', fontSize: 12, fontWeight: 600, cursor: draftQueuing ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
        >
          {draftQueuing ? '✍️ Drafting…' : '✉️ Draft All to Queue (' + filtered.filter(p => p.email).length + ')'}
        </button></div>
  </div>
      <div className="results-filter-bar">
          <span className="results-filter-label">Filter:</span>
{[['hot','active-hot','🔥 Hot ('+hot+')'],['warm','active-warm','🟡 Warm ('+warm+')'],['cold','active-cold','🔵 Cold ('+cold+')']].map(([val,cls,label]) => (
            <button key={val} className={`rf-chip ${activeResultFilters.includes(val) ? cls : ''}`} onClick={() => toggleFilter(val)}>{label}</button>
        ))}
        <div className="rf-divider" />
        {funded > 0 && <button className={`rf-chip ${activeResultFilters.includes('funded') ? 'active-funded' : ''}`} onClick={() => toggleFilter('funded')}>💰 Funded ({funded})</button>}
{hiring > 0 && <button className={`rf-chip ${activeResultFilters.includes('hiring') ? 'active-hiring' : ''}`} onClick={() => toggleFilter('hiring')}>📈 Hiring ({hiring})</button>}
  </div>
{filtered.length > 0
         ? filtered.map((p, i) => <LeadCard key={p.id || i} p={p} index={i} sequences={sequences} />)
          : <div className="empty-state"><div className="empty-icon">🔍</div><div>No contacts match the current filters.</div></div>
}
</div>
  );

  return (
        <div className="fade-up">
          <div className="section-title">Find Leads</div>
      <div className="section-sub">Search for enriched contacts. AWS is always included. Results are scored and sorted by priority.</div>

      <div className="filter-group">
            <div className="filter-label">Job Title</div>
        <div className="pill-row">
  {TITLE_OPTIONS.map(v => (
                <button key={v} className={`pill ${selectedTitles.includes(v) ? 'active' : ''}`} onClick={() => toggle('title', v)}>{v}</button>
          ))}
</div>
  </div>

      <div className="filter-group">
          <div className="filter-label">Industry</div>
        <div className="pill-row">
{INDUSTRIES.map(v => (
              <button key={v} className={`pill ${selectedIndustries.includes(v) ? 'active' : ''}`} onClick={() => toggle('industry', v)}>{v}</button>
          ))}
</div>
  </div>

      <div className="filter-group">
          <div className="filter-label">Company Size</div>
        <div className="pill-row">
{EMP_RANGES.map(r => (
              <button key={r.val} className={`pill ${selectedEmployeeRanges.includes(r.val) ? 'active' : ''}`} onClick={() => toggle('emp', r.val)}>{r.label}</button>
          ))}
</div>
  </div>

      <div className="filter-group">
          <div className="filter-label">Geography</div>
        <div className="pill-row">
{GEO_OPTIONS.map(g => (
              <button key={g.val} className={`pill ${selectedLocations.includes(g.val) ? 'active' : ''}`} onClick={() => toggle('geo', g.val)}>{g.label}</button>
          ))}
</div>
  </div>

      <div className="filter-group">
          <div className="filter-label">Leads to Return</div>
        <div className="pill-row">
{LIMIT_OPTIONS.map(v => (
              <button key={v} className={`pill ${selectedLimit === v ? 'active' : ''}`} onClick={() => setState(prev => ({ ...prev, selectedLimit: v }))}>{v}</button>
          ))}
</div>
  </div>

      <button className="search-btn" onClick={doSearch}>Search Contacts</button>
  </div>
  );
}
