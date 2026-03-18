import { useState, useMemo } from 'react';
import { paiSave, paiLoad } from '../lib/utils';

const AI_ML_SERVICES = [
  'amazon bedrock', 'bedrock', 'sagemaker', 'rekognition', 'comprehend',
  'textract', 'lex', 'kendra', 'personalize', 'forecast', 'polly', 'transcribe',
];
const SECURITY_SERVICES = [
  'guardduty', 'shield', 'waf', 'secrets manager', 'aws secrets manager',
  'security hub', 'macie', 'inspector', 'iam', 'cognito',
];
const HIGH_VALUE_VERTICALS = ['healthcare', 'financial services', 'fintech', 'insurance'];
const FAST_MOVING_VERTICALS = ['software & internet', 'software', 'saas', 'technology'];

function scoreOpportunity(opp, allOpps) {
  let score = 0;
  const breakdown = [];
  const mrr = parseFloat(opp['Estimated AWS Monthly Recurring Revenue']) || 0;
  if (mrr >= 5000) {
    score += 30; breakdown.push({ label: 'MRR $' + mrr.toLocaleString() + '/mo', points: 30, tier: 'hot' });
  } else if (mrr >= 2000) {
    score += 20; breakdown.push({ label: 'MRR $' + mrr.toLocaleString() + '/mo', points: 20, tier: 'warm' });
  } else if (mrr >= 500) {
    score += 10; breakdown.push({ label: 'MRR $' + mrr.toLocaleString() + '/mo', points: 10, tier: 'cold' });
  }
  const stage = (opp['Stage'] || '').trim().toLowerCase();
  if (stage === 'qualified') {
    score += 20; breakdown.push({ label: 'Stage: Qualified', points: 20, tier: 'hot' });
  } else if (stage === 'prospect') {
    score += 10; breakdown.push({ label: 'Stage: Prospect', points: 10, tier: 'warm' });
  }
  const products = (opp['AWS Products'] || '').toLowerCase();
  const hasAI = AI_ML_SERVICES.some(s => products.includes(s));
  if (hasAI) {
    score += 15; breakdown.push({ label: 'AI/ML Services (Bedrock etc.)', points: 15, tier: 'hot' });
  }
  const hasSecurity = SECURITY_SERVICES.some(s => products.includes(s));
  if (hasSecurity) {
    score += 10; breakdown.push({ label: 'Security Services', points: 10, tier: 'warm' });
  }
  const productList = (opp['AWS Products'] || '').split(';').map(s => s.trim()).filter(Boolean);
  if (productList.length >= 5) {
    score += 10; breakdown.push({ label: productList.length + ' AWS Products in scope', points: 10, tier: 'warm' });
  }
  const vertical = (opp['Industry Vertical'] || '').toLowerCase();
  if (HIGH_VALUE_VERTICALS.some(v => vertical.includes(v))) {
    score += 5; breakdown.push({ label: 'High-value vertical: ' + opp['Industry Vertical'], points: 5, tier: 'warm' });
  } else if (FAST_MOVING_VERTICALS.some(v => vertical.includes(v))) {
    score += 5; breakdown.push({ label: 'Fast-moving vertical: ' + opp['Industry Vertical'], points: 5, tier: 'warm' });
  }
  const created = opp['Date Created'];
  const approved = opp['Date Approved/Rejected'];
  if (created && approved && created === approved) {
    score += 5; breakdown.push({ label: 'Same-day approval', points: 5, tier: 'warm' });
  }
  const customerName = (opp['Customer Company Name'] || '').toLowerCase();
  const multiOpp = allOpps.filter(o => (o['Customer Company Name'] || '').toLowerCase() === customerName).length > 1;
  if (multiOpp) {
    score += 5; breakdown.push({ label: 'Multiple active opportunities', points: 5, tier: 'warm' });
  }
  const capped = Math.min(100, score);
  const label = capped >= 70 ? 'hot' : capped >= 40 ? 'warm' : 'cold';
  return { score: capped, label, breakdown };
}

function parseTSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
}

function OppCard({ opp, scored, index }) {
  const [expanded, setExpanded] = useState(false);
  const [hsSent, setHsSent] = useState(false);
  const [hsPushing, setHsPushing] = useState(false);
  const [emailDrafting, setEmailDrafting] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const productList = (opp['AWS Products'] || '').split(';').map(s => s.trim()).filter(Boolean);
  const mrr = parseFloat(opp['Estimated AWS Monthly Recurring Revenue']) || 0;
  const annualARR = mrr * 12;
  const tierColor = scored.label === 'hot' ? '#ef4444' : scored.label === 'warm' ? '#f59e0b' : '#4f8ef7';

  async function handleHubspot() {
    setHsPushing(true);
    try {
      const resp = await fetch('/api/hubspot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: '',
          last_name: opp['Customer Company Name'],
          email: opp['Customer Email'],
          company_name: opp['Customer Company Name'],
          company_domain: opp['Customer Website'],
          title: 'AWS Opportunity Contact',
          score_label: scored.label,
        }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setHsSent(true);
    } catch (err) {
      alert('HubSpot error: ' + err.message);
    } finally {
      setHsPushing(false);
    }
  }

  async function handleDraftEmail() {
    if (!opp['Customer Email']) { setEmailError('No email address for this opportunity.'); return; }
    setEmailDrafting(true);
    setEmailError(null);
    try {
      const resp = await fetch('/api/draft-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: opp['Customer Company Name'],
          first_name: '',
          title: 'Decision Maker',
          company_name: opp['Customer Company Name'],
          company_description: 'They are working on: ' + opp['Partner Project Title'],
          aws_services: productList,
          keywords: [opp['Industry Vertical'], opp['Stage'], 'AWS migration'],
        }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      const subject = encodeURIComponent(data.subject || 'Following up on ' + opp['Partner Project Title']);
      const body = encodeURIComponent((data.body || '') + '\n\nBest,');
      const a = document.createElement('a');
      a.href = 'mailto:' + opp['Customer Email'] + '?subject=' + subject + '&body=' + body;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setEmailError(err.message);
    } finally {
      setEmailDrafting(false);
    }
  }

  return (
    <div className={'card ' + scored.label + ' fade-up'} style={{ animationDelay: (index * 0.05) + 's' }}>
      <div className="card-body">
        <div className="card-top">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="person-name" style={{ fontSize: 15 }}>{opp['Partner Project Title'] || 'Untitled Opportunity'}</div>
            <div className="person-company" style={{ marginTop: 3 }}>{opp['Customer Company Name']}{opp['Customer Website'] ? ' · ' + opp['Customer Website'] : ''}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>ID: {opp['Opportunity id']}</div>
          </div>
          <div className="score-badge">
            <div className={'score-num ' + scored.label}>{scored.score}</div>
            <div className={'score-lbl ' + scored.label}>{scored.label}</div>
            <div className="score-bar-wrap"><div className={'score-bar ' + scored.label} style={{ width: scored.score + '%' }} /></div>
          </div>
        </div>
        <div className="card-meta" style={{ marginTop: 10 }}>
          <span className="meta-tag revenue">💰 ${mrr.toLocaleString()}/mo MRR</span>
          <span className="meta-tag revenue">📅 ~${annualARR.toLocaleString()}/yr ARR</span>
          <span className="meta-tag dept">{opp['Stage']}</span>
          {opp['Industry Vertical'] && <span className="meta-tag">{opp['Industry Vertical']}</span>}
          {opp['Date Approved/Rejected'] && <span className="meta-tag">✅ Approved {opp['Date Approved/Rejected']}</span>}
        </div>
        {productList.length > 0 && (
          <div className="lc-section">
            <div className="lc-label">☁️ AWS Products ({productList.length})</div>
            <div className="aws-services-row">{productList.map((s, i) => <span key={i} className="aws-service-pill">{s}</span>)}</div>
          </div>
        )}
        <div className="lc-section">
          <div className="lc-label">👤 Contact</div>
          <div className="card-meta">{opp['Customer Email'] && <span className="meta-tag email">✉️ {opp['Customer Email']}</span>}</div>
        </div>
        <div className="lc-section">
          <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="lc-label" style={{ margin: 0 }}>📊 Score Breakdown</span>
            <span style={{ fontSize: 10, color: '#64748b' }}>{expanded ? '▲' : '▼'}</span>
          </button>
          {expanded && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {scored.breakdown.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, padding: '4px 8px', background: '#0f172a', borderRadius: 6 }}>
                  <span style={{ color: '#94a3b8' }}>{b.label}</span>
                  <span style={{ fontWeight: 700, color: b.tier === 'hot' ? '#ef4444' : b.tier === 'warm' ? '#f59e0b' : '#4f8ef7', minWidth: 36, textAlign: 'right' }}>+{b.points}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, padding: '6px 8px', borderTop: '1px solid #1e293b', marginTop: 2, color: tierColor }}>
                <span>Total Score</span><span>{scored.score} / 100</span>
              </div>
            </div>
          )}
        </div>
        <div className="card-actions">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className={'btn-sm btn-hs' + (hsSent ? ' sent' : '')} onClick={handleHubspot} disabled={hsPushing || hsSent}>
              {hsSent ? '✓ In HubSpot' : hsPushing ? 'Pushing…' : '⬆ Push to HubSpot'}
            </button>
            <button onClick={handleDraftEmail} disabled={emailDrafting || !opp['Customer Email']}
              style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, background: emailDrafting ? '#164e63' : '#0e7490', color: '#fff', cursor: !opp['Customer Email'] ? 'not-allowed' : emailDrafting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              {emailDrafting ? '✍️ Drafting…' : '✉️ Draft Email'}
            </button>
          </div>
          {emailError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>⚠️ {emailError}</div>}
        </div>
      </div>
    </div>
  );
}

const SAMPLE_DATA = [
  'Opportunity id\tCreated By\tDate Created\tLast Updated Date\tCustomer Company Name\tCustomer Email\tPartner Project Title\tAWS Products\tStage\tEstimated AWS Monthly Recurring Revenue\tCustomer Website\tDate Approved/Rejected\tIndustry Vertical',
  'O17379160\tAWS Sync Service Account\t3/18/26\t3/18/26\tAthena Index\tdivinee@athenaindex.com\tAthena Index - Website Hosting & Content Delivery Modernization\tAWS Shield;Amazon GuardDuty;Amazon Route 53;Amazon CloudFront;AWS Amplify\tQualified\t1700\tathenaindex.com\t3/18/26\tSoftware & Internet',
  'O17379105\tAWS Sync Service Account\t3/18/26\t3/18/26\tAthena Index\tdivinee@athenaindex.com\tAthena Index - AI Processing & Claim Analysis Platform Migration\tAWS Secrets Manager;AWS WAF - Web Application Firewall;Amazon CloudWatch;Amazon API Gateway;AWS Lambda;Amazon Bedrock - Knowledge Bases;Amazon Bedrock - Guardrails;Amazon Bedrock\tQualified\t9200\tathenaindex.com\t3/18/26\tSoftware & Internet',
  'O17378986\tAWS Sync Service Account\t3/18/26\t3/18/26\tAthena Index\tdivinee@athenaindex.com\tAthena Index - Storage Optimization & Historical Archive Migration\tAmazon S3;Cross-Region Data Transfer;S3 Glacier Deep Archive;S3 Intelligent-Tiering\tQualified\t2350\tathenaindex.com\t3/18/26\tSoftware & Internet',
].join('\n');

export default function AwsOpportunities() {
  const [rawInput, setRawInput] = useState('');
  const [opps, setOpps] = useState(() => paiLoad('aws_opps') || []);
  const [stage, setStage] = useState(() => (paiLoad('aws_opps') || []).length > 0 ? 'results' : 'input');
  const [activeFilters, setActiveFilters] = useState([]);
  const [sortBy, setSortBy] = useState('score');

  const scoredOpps = useMemo(() => opps.map(opp => ({ opp, scored: scoreOpportunity(opp, opps) })), [opps]);

  const sorted = useMemo(() => [...scoredOpps].sort((a, b) => {
    if (sortBy === 'mrr') return (parseFloat(b.opp['Estimated AWS Monthly Recurring Revenue']) || 0) - (parseFloat(a.opp['Estimated AWS Monthly Recurring Revenue']) || 0);
    if (sortBy === 'date') return new Date(b.opp['Date Created']) - new Date(a.opp['Date Created']);
    return b.scored.score - a.scored.score;
  }), [scoredOpps, sortBy]);

  const filtered = useMemo(() => !activeFilters.length ? sorted : sorted.filter(s => activeFilters.includes(s.scored.label)), [sorted, activeFilters]);

  function handleParse() {
    const text = rawInput.trim() || SAMPLE_DATA;
    const parsed = parseTSV(text);
    if (!parsed.length) { alert('Could not parse data. Paste the spreadsheet rows with headers.'); return; }
    setOpps(parsed);
    paiSave('aws_opps', parsed);
    setStage('results');
    setActiveFilters([]);
  }

  function toggleFilter(f) {
    setActiveFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  }

  const hot  = scoredOpps.filter(s => s.scored.label === 'hot').length;
  const warm = scoredOpps.filter(s => s.scored.label === 'warm').length;
  const cold = scoredOpps.filter(s => s.scored.label === 'cold').length;
  const totalMRR = scoredOpps.reduce((sum, s) => sum + (parseFloat(s.opp['Estimated AWS Monthly Recurring Revenue']) || 0), 0);

  if (stage === 'results') return (
    <div className="fade-up">
      <button className="btn-back" onClick={() => setStage('input')}>← Back / Load New Data</button>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: 'Total Opps', value: opps.length, color: '#e2e8f0' },
          { label: 'Total MRR', value: '$' + totalMRR.toLocaleString(), color: '#22c55e' },
          { label: 'Est. ARR', value: '$' + (totalMRR * 12).toLocaleString(), color: '#22c55e' },
          { label: '🔥 Hot', value: hot, color: '#ef4444' },
          { label: '🟡 Warm', value: warm, color: '#f59e0b' },
          { label: '🔵 Cold', value: cold, color: '#4f8ef7' },
        ].map(item => (
          <div key={item.label} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '10px 16px', minWidth: 100 }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>
      <div className="results-filter-bar" style={{ marginBottom: 16 }}>
        <span className="results-filter-label">Filter:</span>
        {[['hot','active-hot','🔥 Hot'],['warm','active-warm','🟡 Warm'],['cold','active-cold','🔵 Cold']].map(([val,cls,label]) => (
          <button key={val} className={'rf-chip ' + (activeFilters.includes(val) ? cls : '')} onClick={() => toggleFilter(val)}>{label}</button>
        ))}
        <div className="rf-divider" />
        <span className="results-filter-label" style={{ marginLeft: 8 }}>Sort:</span>
        {[['score','⭐ Score'],['mrr','💰 MRR'],['date','📅 Date']].map(([val,label]) => (
          <button key={val} className={'rf-chip ' + (sortBy === val ? 'active-warm' : '')} onClick={() => setSortBy(val)}>{label}</button>
        ))}
      </div>
      <div className="results-header">
        <div className="results-count">{filtered.length === scoredOpps.length ? scoredOpps.length + ' opportunities scored' : 'Showing ' + filtered.length + ' of ' + scoredOpps.length + ' opportunities'}</div>
        <div className="legend">
          <div className="legend-item"><div className="legend-dot" style={{ background: '#ef4444' }} /> Hot (70+)</div>
          <div className="legend-item"><div className="legend-dot" style={{ background: '#f59e0b' }} /> Warm (40–69)</div>
          <div className="legend-item"><div className="legend-dot" style={{ background: '#4f8ef7' }} /> Cold (&lt;40)</div>
        </div>
      </div>
      {filtered.map((item, i) => <OppCard key={item.opp['Opportunity id'] || i} opp={item.opp} scored={item.scored} index={i} />)}
    </div>
  );

  return (
    <div className="fade-up">
      <div className="section-title">☁️ AWS Opportunities</div>
      <div className="section-sub">Paste opportunity data from your AWS Partner Portal (copy rows from the spreadsheet, including headers). Opportunities are automatically scored and ranked by priority.</div>
      <div className="filter-group">
        <div className="filter-label">Paste Opportunity Data</div>
        <textarea value={rawInput} onChange={e => setRawInput(e.target.value)}
          placeholder="Paste your AWS opportunity spreadsheet rows here (tab-separated with headers).&#10;&#10;Leave blank to load the 3 sample Athena Index opportunities."
          style={{ width: '100%', minHeight: 180, background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 10, padding: '12px 14px', fontSize: 12, fontFamily: 'monospace', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
        <button className="search-btn" onClick={handleParse}>Score Opportunities →</button>
        {opps.length > 0 && (
          <button onClick={() => setStage('results')} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: 14, cursor: 'pointer' }}>
            View Last Results ({opps.length})
          </button>
        )}
      </div>
      <div style={{ marginTop: 32, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '18px 20px' }}>
        <div className="lc-label" style={{ marginBottom: 12 }}>📐 Scoring Rubric</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            ['MRR ≥ $5,000/mo', '+30', 'hot'],
            ['MRR $2,000–$4,999/mo', '+20', 'warm'],
            ['MRR $500–$1,999/mo', '+10', 'cold'],
            ['Stage = Qualified', '+20', 'hot'],
            ['Stage = Prospect', '+10', 'warm'],
            ['AI/ML Services (Bedrock, SageMaker…)', '+15', 'hot'],
            ['Security Services (GuardDuty, Shield, WAF…)', '+10', 'warm'],
            ['5+ AWS Products in scope', '+10', 'warm'],
            ['High-value vertical (Healthcare, Fintech…)', '+5', 'warm'],
            ['Fast-moving vertical (SaaS, Software…)', '+5', 'warm'],
            ['Same-day approval', '+5', 'warm'],
            ['Multiple opportunities from same customer', '+5', 'warm'],
          ].map(([lbl, pts, tier]) => (
            <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 8px', borderRadius: 6, background: '#0a0f1a' }}>
              <span style={{ color: '#94a3b8' }}>{lbl}</span>
              <span style={{ fontWeight: 700, color: tier === 'hot' ? '#ef4444' : tier === 'warm' ? '#f59e0b' : '#4f8ef7' }}>{pts}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: '#475569' }}>🔥 Hot = 70+ · 🟡 Warm = 40–69 · 🔵 Cold = &lt;40 · Max: 100</div>
      </div>
    </div>
  );
}
