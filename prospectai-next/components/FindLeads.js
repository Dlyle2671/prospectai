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
  </div>
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
