import { useState } from 'react';
import LeadCard from './LeadCard';
import { paiSave, paiLoad } from '../lib/utils';

const SENIORITY_TO_TITLES = {
  c_suite: ['CEO','CTO','CFO','COO','CMO'],
  founder: ['Founder','Co-Founder'],
  vp: ['VP of Engineering','VP of Sales','VP of Marketing','VP of Product'],
  director: ['Director of Engineering','Director of Sales','Director of Marketing'],
  head: ['Head of Engineering','Head of Growth','Head of Product','Head of Infrastructure'],
  manager: ['Engineering Manager','Sales Manager','Product Manager'],
};

const TITLE_OPTIONS = ['CEO','CTO','CFO','COO','CMO','Founder','VP of Engineering','VP of Sales','VP of Marketing','Head of Growth','Head of Product','Director of Engineering','Director of Sales','Engineering Manager','Solutions Architect','Cloud Architect','DevOps Manager'];
const INDUSTRY_OPTIONS = ['Information Technology','Software Development','Financial Services','Healthcare','Cybersecurity','E-Commerce','Telecommunications','Manufacturing','Education','Media & Entertainment'];
const SIZE_OPTIONS = [{label:'1-10',val:'1,10'},{label:'11-50',val:'11,50'},{label:'51-200',val:'51,200'},{label:'201-500',val:'201,500'},{label:'501-1000',val:'501,1000'},{label:'1001-5000',val:'1001,5000'},{label:'5001+',val:'5001,10000000'}];

function parseInput(val) {
  val = val.trim();
  if (val.includes('linkedin.com/in/')) return { type: 'linkedin_person', value: val };
  if (val.includes('linkedin.com/company/')) return { type: 'linkedin_company', value: val };
  if (val.includes('@') && val.includes('.')) return { type: 'email', value: val };
  if (/^[a-z0-9-]+\.[a-z]{2,}$/.test(val.toLowerCase())) return { type: 'domain', value: val };
  return { type: 'name', value: val };
}

function buildPersonSignals(p) {
  const seniority = p.seniority?.toLowerCase() || '';
  const titles = SENIORITY_TO_TITLES[seniority] || [p.title].filter(Boolean);
  const industries = p.company_industry ? [p.company_industry] : [];
  const size = p.company_size;
  let empRange = '';
  if (size) {
    const n = Number(size);
    if (n <= 10) empRange = '1,10';
    else if (n <= 50) empRange = '11,50';
    else if (n <= 200) empRange = '51,200';
    else if (n <= 500) empRange = '201,500';
    else if (n <= 1000) empRange = '501,1000';
    else if (n <= 5000) empRange = '1001,5000';
    else empRange = '5001,10000000';
  }
  const signals = [];
  if (p.seniority) signals.push({ label: 'Seniority', value: p.seniority });
  if (p.company_industry) signals.push({ label: 'Industry', value: p.company_industry });
  if (size) signals.push({ label: 'Company Size', value: Number(size).toLocaleString() + ' employees' });
  if (p.aws_services?.length > 0) signals.push({ label: 'AWS User', value: 'Yes' });
  return { titles, industries, empRange: empRange ? [empRange] : [], signals };
}

function buildCompanySignals(c) {
  const titles = ['VP of Engineering','CTO','Head of Infrastructure','Cloud Architect','DevOps Manager'];
  const industries = c.industry ? [c.industry] : [];
  const size = c.employee_count;
  let empRange = '';
  if (size) {
    const n = Number(size);
    if (n <= 10) empRange = '1,10'; else if (n <= 50) empRange = '11,50'; else if (n <= 200) empRange = '51,200';
    else if (n <= 500) empRange = '201,500'; else if (n <= 1000) empRange = '501,1000'; else if (n <= 5000) empRange = '1001,5000'; else empRange = '5001,10000000';
  }
  const signals = [];
  if (c.industry) signals.push({ label: 'Industry', value: c.industry });
  if (size) signals.push({ label: 'Company Size', value: Number(size).toLocaleString() + ' employees' });
  if (c.latest_funding_stage) signals.push({ label: 'Funding Stage', value: c.latest_funding_stage });
  if (c.aws_services?.length > 0) signals.push({ label: 'AWS User', value: 'Yes' });
  return { titles, industries, empRange: empRange ? [empRange] : [], signals };
}

export default function LookalikSearch() {
  const [input, setInput] = useState('');
  const [stage, setStage] = useState(0);
  const [resolvedProfile, setResolvedProfile] = useState(null);
  const [resolvedType, setResolvedType] = useState('');
  const [extractedSignals, setExtractedSignals] = useState([]);
  const [editTitles, setEditTitles] = useState([]);
  const [editIndustries, setEditIndustries] = useState([]);
  const [editEmpRange, setEditEmpRange] = useState([]);
  const [editLimit, setEditLimit] = useState(25);
  const [results, setResults] = useState([]);

  async function resolve() {
    const parsed = parseInput(input);
    setStage(1);
    try {
      let profile, type;
      if (parsed.type === 'email') {
        const resp = await fetch('/api/apollo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: parsed.value, per_page: 5 }) });
        const data = await resp.json();
        profile = Array.isArray(data) ? data[0] : null;
        type = 'person';
      } else {
        let domain = parsed.value;
        if (parsed.type === 'linkedin_company') { const m = domain.match(/company\/([^/?#]+)/); domain = m ? m[1] + '.com' : domain; }
        if (parsed.type === 'linkedin_person') {
          const resp = await fetch('/api/apollo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ linkedin_url: parsed.value, per_page: 5 }) });
          const data = await resp.json();
          profile = Array.isArray(data) ? data[0] : null;
          type = 'person';
        } else {
          const resp = await fetch('/api/company', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain }) });
          profile = await resp.json();
          type = 'company';
        }
      }
      if (!profile) throw new Error('Could not resolve profile');
      const sig = type === 'person' ? buildPersonSignals(profile) : buildCompanySignals(profile);
      setResolvedProfile(profile);
      setResolvedType(type);
      setExtractedSignals(sig.signals);
      setEditTitles(sig.titles);
      setEditIndustries(sig.industries);
      setEditEmpRange(sig.empRange);
      setStage(2);
    } catch (err) { setStage(5); console.error(err); }
  }

  async function doSearch() {
    setStage(3);
    try {
      const page = Math.floor(Math.random() * 15) + 1;
      const resp = await fetch('/api/apollo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titles: editTitles, industries: editIndustries, employee_ranges: editEmpRange, per_page: editLimit, page, tech_stack: ['AWS'] }) });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setResults(Array.isArray(data) ? data : []);
      setStage(4);
    } catch (err) { setStage(5); alert('Search failed: ' + err.message); }
  }

  function toggleArr(arr, setArr, val) {
    const i = arr.indexOf(val);
    const next = [...arr];
    if (i >= 0) next.splice(i, 1); else next.push(val);
    setArr(next);
  }

  return (
    <div className="fade-up">
      <div className="section-title">🎯 Lookalike Search</div>
      <div className="section-sub">Paste a LinkedIn URL, email, or company domain — we'll extract their profile signals and find similar contacts.</div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <input
          style={{ flex: 1, padding: '12px 16px', background: '#0d1424', border: '1px solid #1a2540', borderRadius: 10, color: '#c8d4e8', fontSize: 15, fontFamily: 'inherit', outline: 'none' }}
          placeholder="Paste LinkedIn URL, email, or domain (e.g. stripe.com)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && stage === 0 && resolve()}
        />
        <button style={{ padding: '12px 28px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#4f8ef7,#2563eb)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }} onClick={() => { setStage(0); setResults([]); resolve(); }}>
          🎯 Analyze
        </button>
      </div>

      {stage === 0 && <div className="empty-state"><div className="empty-icon">🎯</div><div>Enter a LinkedIn URL, email, or company domain to find lookalike contacts.</div></div>}

      {stage === 1 && <div className="loading-wrap"><span className="spinner" /><p>Resolving profile…</p></div>}

      {stage === 2 && resolvedProfile && (
        <div>
          {/* Resolved profile chip */}
          <div style={{ background: '#0d1424', border: '1px solid #1a2540', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#4f8ef7', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>✅ Profile Resolved</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>{resolvedProfile.name || resolvedProfile.company_name || resolvedProfile.domain}</div>
            {resolvedProfile.title && <div style={{ fontSize: 13, color: '#94a3b8' }}>{resolvedProfile.title} at {resolvedProfile.company_name}</div>}
          </div>

          {/* Extracted signals */}
          <div style={{ background: '#0d1424', border: '1px solid #1a2540', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#4f8ef7', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>⚡ Extracted Signals</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {extractedSignals.map((s, i) => (
                <span key={i} style={{ fontSize: 12, background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.2)', color: '#60a5fa', padding: '4px 12px', borderRadius: 20 }}>
                  <strong>{s.label}:</strong> {s.value}
                </span>
              ))}
            </div>
          </div>

          {/* Editable filters */}
          <div style={{ background: '#0d1424', border: '1px solid #1a2540', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#4f8ef7', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>🔧 Refine Search Filters</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#6b7a99', marginBottom: 8 }}>Job Titles ({editTitles.length} selected)</div>
              <div className="pill-row">{TITLE_OPTIONS.map(t => <button key={t} className={`pill ${editTitles.includes(t) ? 'active' : ''}`} onClick={() => toggleArr(editTitles, setEditTitles, t)}>{t}</button>)}</div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#6b7a99', marginBottom: 8 }}>Industry ({editIndustries.length} selected)</div>
              <div className="pill-row">{INDUSTRY_OPTIONS.map(t => <button key={t} className={`pill ${editIndustries.includes(t) ? 'active' : ''}`} onClick={() => toggleArr(editIndustries, setEditIndustries, t)}>{t}</button>)}</div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#6b7a99', marginBottom: 8 }}>Company Size</div>
              <div className="pill-row">{SIZE_OPTIONS.map(s => <button key={s.val} className={`pill ${editEmpRange.includes(s.val) ? 'active' : ''}`} onClick={() => toggleArr(editEmpRange, setEditEmpRange, s.val)}>{s.label}</button>)}</div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#6b7a99' }}>Results:</span>
              {[10,25,50].map(n => <button key={n} className={`pill ${editLimit === n ? 'active' : ''}`} onClick={() => setEditLimit(n)}>{n}</button>)}
            </div>
          </div>

          <button style={{ padding: '12px 32px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#4f8ef7,#2563eb)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }} onClick={doSearch}>
            🎯 Find Lookalike Contacts
          </button>
        </div>
      )}

      {stage === 3 && <div className="loading-wrap"><span className="spinner" /><p>Finding lookalike contacts…</p></div>}

      {stage === 4 && results.length > 0 && (
        <div>
          <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 16 }}>{results.length} lookalike contacts found</div>
          {results.map((p, i) => <LeadCard key={p.id || i} p={p} index={i} />)}
        </div>
      )}

      {stage === 5 && <div className="empty-state" style={{ color: '#f87171' }}><div className="empty-icon">❌</div><div>Could not resolve profile. Check the URL or domain and try again.</div></div>}
    </div>
  );
}
