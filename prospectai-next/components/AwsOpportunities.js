import { useState, useMemo } from 'react';
import { paiSave, paiLoad } from '../lib/utils';

// ─── Default Scoring Config ───────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  mrrHigh:       { label: 'MRR ≥ $5,000/mo',                         points: 30, tier: 'hot'  },
  mrrMid:        { label: 'MRR $2,000–$4,999/mo',                    points: 20, tier: 'warm' },
  mrrLow:        { label: 'MRR $500–$1,999/mo',                      points: 10, tier: 'cold' },
  stageQualified:{ label: 'Stage = Qualified',                            points: 20, tier: 'hot'  },
  stageProspect: { label: 'Stage = Prospect',                             points: 10, tier: 'warm' },
  aiMl:          { label: 'AI/ML Services (Bedrock, SageMaker…)',     points: 15, tier: 'hot'  },
  security:      { label: 'Security Services (GuardDuty, Shield…)',   points: 10, tier: 'warm' },
  manyProducts:  { label: '5+ AWS Products in scope',                     points: 10, tier: 'warm' },
  highVertical:  { label: 'High-value vertical (Healthcare, Fintech…)',points: 5, tier: 'warm' },
  fastVertical:  { label: 'Fast-moving vertical (SaaS, Software…)',   points:  5, tier: 'warm' },
  sameDayApproval:{ label: 'Same-day approval',                           points:  5, tier: 'warm' },
  multiOpp:      { label: 'Multiple opps from same customer',             points:  5, tier: 'warm' },
  hotThreshold:  { label: 'Hot threshold (score ≥)',                  points: 70, tier: 'hot'  },
  warmThreshold: { label: 'Warm threshold (score ≥)',                 points: 40, tier: 'warm' },
};

const AI_ML_SERVICES    = ['amazon bedrock','bedrock','sagemaker','rekognition','comprehend','textract','lex','kendra','personalize','forecast','polly','transcribe'];
const SECURITY_SERVICES = ['guardduty','shield','waf','secrets manager','aws secrets manager','security hub','macie','inspector','iam','cognito'];
const HIGH_VALUE_VERTICALS  = ['healthcare','financial services','fintech','insurance'];
const FAST_MOVING_VERTICALS = ['software & internet','software','saas','technology'];

function loadConfig() {
  const saved = paiLoad('aws_scoring_config');
  if (!saved) return DEFAULT_CONFIG;
  // Merge saved points into DEFAULT_CONFIG (preserves labels/tiers)
  const merged = {};
  Object.keys(DEFAULT_CONFIG).forEach(k => {
    merged[k] = { ...DEFAULT_CONFIG[k], points: saved[k] !== undefined ? saved[k] : DEFAULT_CONFIG[k].points };
  });
  return merged;
}

// ─── Scoring Engine ───────────────────────────────────────────────────────────

function scoreOpportunity(opp, allOpps, cfg) {
  let score = 0;
  const breakdown = [];

  const mrr = parseFloat(opp['Estimated AWS Monthly Recurring Revenue']) || 0;
  if (mrr >= 5000 && cfg.mrrHigh.points > 0) {
    score += cfg.mrrHigh.points; breakdown.push({ label: 'MRR $' + mrr.toLocaleString() + '/mo (≥$5k)', points: cfg.mrrHigh.points, tier: 'hot' });
  } else if (mrr >= 2000 && cfg.mrrMid.points > 0) {
    score += cfg.mrrMid.points; breakdown.push({ label: 'MRR $' + mrr.toLocaleString() + '/mo ($2k–$5k)', points: cfg.mrrMid.points, tier: 'warm' });
  } else if (mrr >= 500 && cfg.mrrLow.points > 0) {
    score += cfg.mrrLow.points; breakdown.push({ label: 'MRR $' + mrr.toLocaleString() + '/mo ($500–$2k)', points: cfg.mrrLow.points, tier: 'cold' });
  }

  const stage = (opp['Stage'] || '').trim().toLowerCase();
  if (stage === 'qualified' && cfg.stageQualified.points > 0) {
    score += cfg.stageQualified.points; breakdown.push({ label: 'Stage: Qualified', points: cfg.stageQualified.points, tier: 'hot' });
  } else if (stage === 'prospect' && cfg.stageProspect.points > 0) {
    score += cfg.stageProspect.points; breakdown.push({ label: 'Stage: Prospect', points: cfg.stageProspect.points, tier: 'warm' });
  }

  const products = (opp['AWS Products'] || '').toLowerCase();
  if (AI_ML_SERVICES.some(s => products.includes(s)) && cfg.aiMl.points > 0) {
    score += cfg.aiMl.points; breakdown.push({ label: 'AI/ML Services (Bedrock etc.)', points: cfg.aiMl.points, tier: 'hot' });
  }
  if (SECURITY_SERVICES.some(s => products.includes(s)) && cfg.security.points > 0) {
    score += cfg.security.points; breakdown.push({ label: 'Security Services', points: cfg.security.points, tier: 'warm' });
  }

  const productList = (opp['AWS Products'] || '').split(';').map(s => s.trim()).filter(Boolean);
  if (productList.length >= 5 && cfg.manyProducts.points > 0) {
    score += cfg.manyProducts.points; breakdown.push({ label: productList.length + ' AWS Products in scope', points: cfg.manyProducts.points, tier: 'warm' });
  }

  const vertical = (opp['Industry Vertical'] || '').toLowerCase();
  if (HIGH_VALUE_VERTICALS.some(v => vertical.includes(v)) && cfg.highVertical.points > 0) {
    score += cfg.highVertical.points; breakdown.push({ label: 'High-value vertical: ' + opp['Industry Vertical'], points: cfg.highVertical.points, tier: 'warm' });
  } else if (FAST_MOVING_VERTICALS.some(v => vertical.includes(v)) && cfg.fastVertical.points > 0) {
    score += cfg.fastVertical.points; breakdown.push({ label: 'Fast-moving vertical: ' + opp['Industry Vertical'], points: cfg.fastVertical.points, tier: 'warm' });
  }

  if (opp['Date Created'] && opp['Date Approved/Rejected'] && opp['Date Created'] === opp['Date Approved/Rejected'] && cfg.sameDayApproval.points > 0) {
    score += cfg.sameDayApproval.points; breakdown.push({ label: 'Same-day approval', points: cfg.sameDayApproval.points, tier: 'warm' });
  }

  const customerName = (opp['Customer Company Name'] || '').toLowerCase();
  if (allOpps.filter(o => (o['Customer Company Name'] || '').toLowerCase() === customerName).length > 1 && cfg.multiOpp.points > 0) {
    score += cfg.multiOpp.points; breakdown.push({ label: 'Multiple active opportunities', points: cfg.multiOpp.points, tier: 'warm' });
  }

  const capped = Math.min(100, score);
  const label = capped >= cfg.hotThreshold.points ? 'hot' : capped >= cfg.warmThreshold.points ? 'warm' : 'cold';
  return { score: capped, label, breakdown };
}

// ─── CSV/TSV Parser ───────────────────────────────────────────────────────────

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

// ─── Scoring Config Editor ────────────────────────────────────────────────────

const CRITERIA_KEYS   = ['mrrHigh','mrrMid','mrrLow','stageQualified','stageProspect','aiMl','security','manyProducts','highVertical','fastVertical','sameDayApproval','multiOpp'];
const THRESHOLD_KEYS  = ['hotThreshold','warmThreshold'];

function ScoringConfigEditor({ config, onChange, onReset }) {
  const inputStyle = {
    width: 60, padding: '4px 6px', borderRadius: 6, border: '1px solid #334155',
    background: '#0a0f1a', color: '#e2e8f0', fontSize: 13, fontWeight: 700,
    textAlign: 'center', outline: 'none',
  };
  const rowStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '7px 10px', borderRadius: 6, background: '#0a0f1a', gap: 10,
  };

  function handleChange(key, val) {
    const num = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
    onChange({ ...config, [key]: { ...config[key], points: num } });
  }

  return (
    <div style={{ marginTop: 24, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="lc-label" style={{ margin: 0 }}>⚙️ Scoring Criteria</div>
        <button onClick={onReset} style={{ fontSize: 11, color: '#64748b', background: 'none', border: '1px solid #334155', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
          Reset to defaults
        </button>
      </div>

      <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, paddingLeft: 10 }}>Point Values (0–100)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
        {CRITERIA_KEYS.map(key => {
          const item = config[key];
          const tierColor = item.tier === 'hot' ? '#ef4444' : item.tier === 'warm' ? '#f59e0b' : '#4f8ef7';
          return (
            <div key={key} style={rowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: tierColor, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{item.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number" min={0} max={100}
                  value={item.points}
                  onChange={e => handleChange(key, e.target.value)}
                  style={{ ...inputStyle, color: item.points === 0 ? '#475569' : tierColor }}
                />
                <span style={{ fontSize: 11, color: '#475569', width: 20 }}>pts</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, paddingLeft: 10 }}>Tier Thresholds</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {THRESHOLD_KEYS.map(key => {
          const item = config[key];
          const tierColor = item.tier === 'hot' ? '#ef4444' : '#f59e0b';
          return (
            <div key={key} style={rowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: tierColor, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{item.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number" min={0} max={100}
                  value={item.points}
                  onChange={e => handleChange(key, e.target.value)}
                  style={{ ...inputStyle, color: tierColor }}
                />
                <span style={{ fontSize: 11, color: '#475569', width: 20 }}>pts</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: '#475569', paddingLeft: 10 }}>
        Set any criterion to 0 to disable it. Changes apply instantly and persist across sessions.
      </div>
    </div>
  );
}

// ─── OppCard ─────────────────────────────────────────────────────────────────

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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: '', last_name: opp['Customer Company Name'], email: opp['Customer Email'], company_name: opp['Customer Company Name'], company_domain: opp['Customer Website'], title: 'AWS Opportunity Contact', score_label: scored.label }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setHsSent(true);
    } catch (err) { alert('HubSpot error: ' + err.message); }
    finally { setHsPushing(false); }
  }

  async function handleDraftEmail() {
    if (!opp['Customer Email']) { setEmailError('No email address for this opportunity.'); return; }
    setEmailDrafting(true); setEmailError(null);
    try {
      const resp = await fetch('/api/draft-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: opp['Customer Company Name'], first_name: '', title: 'Decision Maker', company_name: opp['Customer Company Name'], company_description: 'They are working on: ' + opp['Partner Project Title'], aws_services: productList, keywords: [opp['Industry Vertical'], opp['Stage'], 'AWS migration'] }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      const subject = encodeURIComponent(data.subject || 'Following up on ' + opp['Partner Project Title']);
      const body = encodeURIComponent((data.body || '') + '\n\nBest,');
      const a = document.createElement('a');
      a.href = 'mailto:' + opp['Customer Email'] + '?subject=' + subject + '&body=' + body;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (err) { setEmailError(err.message); }
    finally { setEmailDrafting(false); }
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

// ─── Sample Data ──────────────────────────────────────────────────────────────

const SAMPLE_DATA = [
  'Opportunity id\tCreated By\tDate Created\tLast Updated Date\tCustomer Company Name\tCustomer Email\tPartner Project Title\tAWS Products\tStage\tEstimated AWS Monthly Recurring Revenue\tCustomer Website\tDate Approved/Rejected\tIndustry Vertical',
  'O17379160\tAWS Sync Service Account\t3/18/26\t3/18/26\tAthena Index\tdivinee@athenaindex.com\tAthena Index - Website Hosting & Content Delivery Modernization\tAWS Shield;Amazon GuardDuty;Amazon Route 53;Amazon CloudFront;AWS Amplify\tQualified\t1700\tathenaindex.com\t3/18/26\tSoftware & Internet',
  'O17379105\tAWS Sync Service Account\t3/18/26\t3/18/26\tAthena Index\tdivinee@athenaindex.com\tAthena Index - AI Processing & Claim Analysis Platform Migration\tAWS Secrets Manager;AWS WAF - Web Application Firewall;Amazon CloudWatch;Amazon API Gateway;AWS Lambda;Amazon Bedrock - Knowledge Bases;Amazon Bedrock - Guardrails;Amazon Bedrock\tQualified\t9200\tathenaindex.com\t3/18/26\tSoftware & Internet',
  'O17378986\tAWS Sync Service Account\t3/18/26\t3/18/26\tAthena Index\tdivinee@athenaindex.com\tAthena Index - Storage Optimization & Historical Archive Migration\tAmazon S3;Cross-Region Data Transfer;S3 Glacier Deep Archive;S3 Intelligent-Tiering\tQualified\t2350\tathenaindex.com\t3/18/26\tSoftware & Internet',
].join('\n');

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AwsOpportunities() {
  const [rawInput, setRawInput] = useState('');
  const [opps, setOpps] = useState(() => paiLoad('aws_opps') || []);
  const [stage, setStage] = useState(() => (paiLoad('aws_opps') || []).length > 0 ? 'results' : 'input');
  const [activeFilters, setActiveFilters] = useState([]);
  const [sortBy, setSortBy] = useState('score');
  const [config, setConfig] = useState(() => loadConfig());
  const [configOpen, setConfigOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);

  function handleConfigChange(newCfg) {
    setConfig(newCfg);
    // Persist just the points values
    const toSave = {};
    Object.keys(newCfg).forEach(k => { toSave[k] = newCfg[k].points; });
    paiSave('aws_scoring_config', toSave);
  }

  function handleConfigReset() {
    setConfig(DEFAULT_CONFIG);
    paiSave('aws_scoring_config', null);
  }

  async function saveSnapshot() {
    const name = snapshotName.trim() || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    setSaving(true);
    try {
      const resp = await fetch('/api/kv', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, opps }) });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setSnapshotName('');
      alert('Saved: ' + name);
    } catch (err) { alert('Save error: ' + err.message); } finally { setSaving(false); }
  }

  async function loadSnapshots() {
    setSnapshotsLoading(true);
    try {
      const resp = await fetch('/api/kv?action=list');
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setSnapshots(data.snapshots || []);
      setSnapshotsOpen(true);
    } catch (err) { alert('Load error: ' + err.message); } finally { setSnapshotsLoading(false); }
  }

  async function loadSnapshot(key) {
    try {
      const resp = await fetch('/api/kv?action=load&key=' + encodeURIComponent(key));
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setOpps(data.opps); paiSave('aws_opps', data.opps); setStage('results'); setActiveFilters([]); setSnapshotsOpen(false);
    } catch (err) { alert('Load error: ' + err.message); }
  }

  async function deleteSnapshot(key) {
    if (!confirm('Delete this snapshot?')) return;
    try {
      const resp = await fetch('/api/kv?action=delete&key=' + encodeURIComponent(key));
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setSnapshots(prev => prev.filter(s => s.key !== key));
    } catch (err) { alert('Delete error: ' + err.message); }
  }

  const scoredOpps = useMemo(() => opps.map(opp => ({ opp, scored: scoreOpportunity(opp, opps, config) })), [opps, config]);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button className="btn-back" style={{ margin: 0 }} onClick={() => setStage('input')}>← Back / Load New Data</button>
        <button
          onClick={() => setConfigOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid ' + (configOpen ? '#6d28d9' : '#334155'), background: configOpen ? 'rgba(109,40,217,0.15)' : 'transparent', color: configOpen ? '#a78bfa' : '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          ⚙️ Scoring Criteria {configOpen ? '▲' : '▼'}
        </button>
      </div>

      {configOpen && (
        <ScoringConfigEditor config={config} onChange={handleConfigChange} onReset={handleConfigReset} />
      )}

      {/* Save Snapshot Controls */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={snapshotName}
            onChange={e => setSnapshotName(e.target.value)}
            placeholder="Snapshot name (optional)…"
            style={{ flex: 1, minWidth: 180, padding: '7px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0a0f1a', color: '#e2e8f0', fontSize: 12, outline: 'none' }}
          />
          <button onClick={saveSnapshot} disabled={saving} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, background: saving ? '#1e3a5f' : '#1d4ed8', color: '#fff', cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? '💾 Saving…' : '💾 Save Snapshot'}
          </button>
        </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, marginTop: configOpen ? 20 : 0 }}>
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
          <div className="legend-item"><div className="legend-dot" style={{ background: '#ef4444' }} /> Hot (≥{config.hotThreshold.points})</div>
          <div className="legend-item"><div className="legend-dot" style={{ background: '#f59e0b' }} /> Warm (≥{config.warmThreshold.points})</div>
          <div className="legend-item"><div className="legend-dot" style={{ background: '#4f8ef7' }} /> Cold (&lt;{config.warmThreshold.points})</div>
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
        <button onClick={loadSnapshots} disabled={snapshotsLoading} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #1d4ed8', background: 'transparent', color: '#60a5fa', fontSize: 14, cursor: snapshotsLoading ? 'wait' : 'pointer' }}>
          {snapshotsLoading ? '⏳ Loading…' : '📂 Saved Results'}
        </button>
        {snapshotsOpen && snapshots.length === 0 && (
          <div style={{ marginTop: 12, color: '#64748b', fontSize: 13 }}>No saved snapshots yet.</div>
        )}
        {snapshotsOpen && snapshots.length > 0 && (
          <div style={{ marginTop: 12, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>Saved Snapshots</div>
            {snapshots.map(s => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1e293b', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{s.count} opps · {new Date(s.savedAt).toLocaleDateString()}</div>
                </div>
                <button onClick={() => loadSnapshot(s.key)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#1d4ed8', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Load</button>
                <button onClick={() => deleteSnapshot(s.key)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #334155', background: 'transparent', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => setConfigOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 20, padding: '8px 14px', borderRadius: 8, border: '1px solid ' + (configOpen ? '#6d28d9' : '#334155'), background: configOpen ? 'rgba(109,40,217,0.15)' : 'transparent', color: configOpen ? '#a78bfa' : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
      >
        ⚙️ Configure Scoring Criteria {configOpen ? '▲' : '▼'}
      </button>

      {configOpen && <ScoringConfigEditor config={config} onChange={handleConfigChange} onReset={handleConfigReset} />}
    </div>
  );
}
