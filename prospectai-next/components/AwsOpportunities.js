import { useState, useMemo } from 'react';
import { paiSave, paiLoad } from '../lib/utils';

// ─── Default Scoring Config ────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
    mrrHigh:        { label: 'MRR ≥ $5,000/mo',                          points: 30, tier: 'hot'  },
    mrrMid:         { label: 'MRR $2,000–$4,999/mo',                     points: 20, tier: 'warm' },
    mrrLow:         { label: 'MRR $500–$1,999/mo',                       points: 10, tier: 'cold' },
    stageQualified: { label: 'Stage = Qualified',                         points: 20, tier: 'hot'  },
    stageProspect:  { label: 'Stage = Prospect',                          points: 10, tier: 'warm' },
    aiMl:           { label: 'AI/ML Services (Bedrock, SageMaker…)',      points: 15, tier: 'warm' },
    security:       { label: 'Security Services (GuardDuty, Shield…)',    points: 10, tier: 'warm' },
    manyProducts:   { label: '5+ AWS Products in scope',                  points: 10, tier: 'warm' },
    highVertical:   { label: 'High-value vertical (Healthcare, Fintech…)',points:  5, tier: 'warm' },
    fastVertical:   { label: 'Fast-moving vertical (SaaS, Software…)',    points:  5, tier: 'warm' },
    sameDayApproval:{ label: 'Same-day approval',                         points:  5, tier: 'warm' },
    multiOpp:       { label: 'Multiple opps from same customer',          points:  5, tier: 'warm' },
    hotThreshold:   { label: 'Hot threshold (score ≥)',                   points: 70, tier: 'hot'  },
    warmThreshold:  { label: 'Warm threshold (score ≥)',                  points: 40, tier: 'warm' },
};

const AI_ML_SERVICES     = ['amazon bedrock','bedrock','sagemaker','rekognition','comprehend','textract','lex','kendra','personalize','forecast','polly','transcribe'];
const SECURITY_SERVICES  = ['guardduty','shield','waf','secrets manager','aws secrets manager','security hub','macie','inspector','iam','cognito'];
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

// ─── Scoring Engine ────────────────────────────────────────────────────────────

function scoreOpportunity(opp, allOpps, cfg) {
    let score = 0;
    const breakdown = [];

  const mrr = parseFloat(opp['Estimated AWS Monthly Recurring Revenue']) || 0;
    if (mrr >= 5000 && cfg.mrrHigh.points > 0) {
          score += cfg.mrrHigh.points; breakdown.push({ label: 'MRR ≥ $5k/mo', points: cfg.mrrHigh.points, tier: 'hot' });
    } else if (mrr >= 2000 && cfg.mrrMid.points > 0) {
          score += cfg.mrrMid.points; breakdown.push({ label: 'MRR $2k–$5k/mo', points: cfg.mrrMid.points, tier: 'warm' });
    } else if (mrr >= 500 && cfg.mrrLow.points > 0) {
          score += cfg.mrrLow.points; breakdown.push({ label: 'MRR $500–$2k/mo', points: cfg.mrrLow.points, tier: 'cold' });
    }

  const stage = (opp['Stage'] || '').toLowerCase();
    if (stage === 'qualified' && cfg.stageQualified.points > 0) {
          score += cfg.stageQualified.points; breakdown.push({ label: 'Stage = Qualified', points: cfg.stageQualified.points, tier: 'hot' });
    } else if (stage === 'prospect' && cfg.stageProspect.points > 0) {
          score += cfg.stageProspect.points; breakdown.push({ label: 'Stage = Prospect', points: cfg.stageProspect.points, tier: 'warm' });
    }

  const products = (opp['AWS Products'] || '').toLowerCase();
    if (AI_ML_SERVICES.some(s => products.includes(s)) && cfg.aiMl.points > 0) {
          score += cfg.aiMl.points; breakdown.push({ label: 'AI/ML service in scope', points: cfg.aiMl.points, tier: 'warm' });
    }
    if (SECURITY_SERVICES.some(s => products.includes(s)) && cfg.security.points > 0) {
          score += cfg.security.points; breakdown.push({ label: 'Security service in scope', points: cfg.security.points, tier: 'warm' });
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

// ─── CSV/TSV Parser ────────────────────────────────────────────────────────────

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

// ─── Scoring Config Editor ─────────────────────────────────────────────────────

const CRITERIA_KEYS  = ['mrrHigh','mrrMid','mrrLow','stageQualified','stageProspect','aiMl','security','manyProducts','highVertical','fastVertical','sameDayApproval','multiOpp'];
const THRESHOLD_KEYS = ['hotThreshold','warmThreshold'];

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
        <div className="lc-label" style={{ margin: 0 }}>⚙ Scoring Criteria</div>
        <button onClick={onReset} style={{ fontSize: 11, color: '#64748b', background: 'none', border: '1px solid #334155', borderRadius: 6, padding: '3px 10px', cursor: 'pointer'
                                        }}>
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
  </div>
  );
}

// ─── Opportunity Card ──────────────────────────────────────────────────────────

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
        <div className="opp-card fade-up" style={{ animationDelay: index * 40 + 'ms' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
{opp['Customer Company Name'] || '—'}
</div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
{opp['Partner Project Title'] || '—'}
</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
{opp['Stage'] && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#0f172a', color: '#94a3b8', border: '1px solid #1e293b' }}>{opp['Stage']}</span>}
{opp['Industry Vertical'] && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#0f172a', color: '#94a3b8', border: '1px solid #1e293b' }}>{opp['Industry Vertical']}</span>}
{mrr > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#0f172a', color: '#22c55e', border: '1px solid #166534' }}>${mrr.toLocaleString()}/mo MRR</span>}
  </div>
  </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: tierColor, lineHeight: 1 }}>{scored.score}</div>
          <div style={{ fontSize: 10, color: tierColor, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>{scored.label}</div>
  </div>
  </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="btn-action" onClick={() => setExpanded(e => !e)}>
{expanded ? '▲ Less' : '▼ Details'}
</button>
        <button className="btn-action btn-action-hs" onClick={handleHubspot} disabled={hsPushing || hsSent}>
{hsSent ? '✓ Sent to HubSpot' : hsPushing ? 'Pushing…' : '🔗 HubSpot'}
</button>
        <button className="btn-action btn-action-email" onClick={handleDraftEmail} disabled={emailDrafting}>
{emailDrafting ? 'Drafting…' : '✉ Draft Email'}
</button>
{emailError && <div style={{ fontSize: 11, color: '#ef4444', alignSelf: 'center' }}>{emailError}</div>}
  </div>

{expanded && (
          <div style={{ marginTop: 14, borderTop: '1px solid #1e293b', paddingTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8, marginBottom: 14 }}>
{[
                ['Customer Email', opp['Customer Email']],
                ['Customer Website', opp['Customer Website']],
                ['Date Created', opp['Date Created']],
                ['Date Approved', opp['Date Approved/Rejected']],
                ['Annual ARR', annualARR > 0 ? '$' + annualARR.toLocaleString() : '—'],
                ['Opportunity ID', opp['Opportunity id']],
              ].map(([label, val]) => val ? (
                              <div key={label} style={{ background: '#0a0f1a', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{label}</div>
                                <div style={{ fontSize: 12, color: '#cbd5e1' }}>{val}</div>
                </div>
                            ) : null)}
</div>

{productList.length > 0 && (
              <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>AWS Products</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
{productList.map(p => <span key={p} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#0f172a', color: '#7dd3fc', border: '1px solid #0c4a6e' }}>{p}</span>)}
                 </div>
                 </div>
                           )}

          <div>
                        <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Score Breakdown</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
{scored.breakdown.map((b, i) => {
                  const bc = b.tier === 'hot' ? '#ef4444' : b.tier === 'warm' ? '#f59e0b' : '#4f8ef7';
                  return <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#0f172a', color: bc, border: '1px solid ' + bc + '44' }}>+{b.points} {b.label}</span>;
})}
</div>
  </div>
  </div>
      )}
</div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

const SAMPLE_DATA = `Opportunity id\tStage\tCustomer Company Name\tCustomer Email\tCustomer Website\tIndustry Vertical\tPartner Project Title\tAWS Products\tEstimated AWS Monthly Recurring Revenue\tDate Created\tDate Approved/Rejected
opp-001\tQualified\tAcme Corp\tacme@example.com\tacme.com\tFintech\tCloud Migration\tAmazon Bedrock;AWS Shield;Amazon SageMaker;AWS IAM;Amazon S3\t8500\t2026-03-01\t2026-03-01`;

const AWS_STYLES = `
.lc-textarea{width:100%;padding:14px 16px;background:#080c14;border:1px solid #1a2540;border-radius:10px;color:#c8d4e8;font-size:13px;font-family:inherit;outline:none;resize:vertical;transition:border-color .2s;line-height:1.6}
.lc-textarea:focus{border-color:#4f8ef7}
.lc-textarea::placeholder{color:#3a4a6a}
.lc-btn{padding:12px 28px;border-radius:10px;border:none;background:linear-gradient(135deg,#4f8ef7,#2563eb);color:#fff;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}
.lc-btn:hover{opacity:.88}
.lc-btn:disabled{opacity:.5;cursor:not-allowed}
.opp-card{background:#0d1424;border:1px solid #1a2540;border-radius:14px;padding:18px 20px;margin-bottom:10px;transition:border-color .2s}
.opp-card:hover{border-color:#2d3f6b}
.opp-card.hot{border-left:3px solid #ef4444}
.opp-card.warm{border-left:3px solid #f59e0b}
.opp-card.cold{border-left:3px solid #4f8ef7}
`;

export default function AwsOpportunities() {
    const [rawInput, setRawInput]   = useState('');
    const [opps, setOpps]           = useState(() => paiLoad('aws_opps') || []);
    const [stage, setStage]         = useState(() => (paiLoad('aws_opps') || []).length > 0 ? 'results' : 'input');
    const [activeFilters, setActiveFilters] = useState([]);
    const [sortBy, setSortBy]       = useState('score');
    const [config, setConfig]       = useState(() => loadConfig());
    const [configOpen, setConfigOpen] = useState(false);
    const [saving, setSaving]       = useState(false);
    const [saveMsg, setSaveMsg]     = useState(null);

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

  async function addToTotal() {
        if (!opps.length) return;
        setSaving(true);
        setSaveMsg(null);
        try {
                const resp = await fetch('/api/kv', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ opps }),
                });
                const data = await resp.json();
                if (data.error) throw new Error(data.error);
                setSaveMsg(`✓ Added ${data.added} new opportunities (${data.total} total)`);
                setTimeout(() => setSaveMsg(null), 5000);
        } catch (err) {
                setSaveMsg('Error: ' + err.message);
                setTimeout(() => setSaveMsg(null), 4000);
        } finally {
                setSaving(false);
        }
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
    <style dangerouslySetInnerHTML={{ __html: AWS_STYLES }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button className="btn-back" style={{ margin: 0 }} onClick={() => setStage('input')}>← Back / Load New Data</button>
        <button
          onClick={() => setConfigOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid ' + (configOpen ? '#6d28d9' : '#334155'), background:
                        configOpen ? '#1e1b4b' : '#0a0f1a', color: configOpen ? '#a78bfa' : '#64748b', fontSize: 13, cursor: 'pointer' }}
        >
          ⚙ Scoring
            </button>
            </div>

{configOpen && (
          <ScoringConfigEditor config={config} onChange={handleConfigChange} onReset={handleConfigReset} />
        )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, marginTop: configOpen ? 20 : 0 }}>
{[
  { label: 'Total Opps', value: opps.length, color: '#e2e8f0' },
  { label: 'Total MRR', value: '$' + totalMRR.toLocaleString(), color: '#22c55e' },
  { label: 'Est. ARR', value: '$' + (totalMRR * 12).toLocaleString(), color: '#22c55e' },
  { label: '🔥 Hot', value: hot, color: '#ef4444' },
  { label: '🌡 Warm', value: warm, color: '#f59e0b' },
  { label: '🔵 Cold', value: cold, color: '#4f8ef7' },
          ].map(item => (
                      <div key={item.label} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '10px 16px', minWidth: 100 }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>{item.value}</div>
  </div>
        ))}
</div>

      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={addToTotal}
          disabled={saving}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: saving ? '#1e293b' : '#1e40af', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
{saving ? 'Adding…' : '+ Add to Running Total'}
</button>
{saveMsg && (
            <span style={{ fontSize: 13, color: saveMsg.startsWith('Error') ? '#f87171' : '#4ade80' }}>{saveMsg}</span>
        )}
</div>

      <div className="results-filter-bar" style={{ marginBottom: 16 }}>
        <span className="results-filter-label">Filter:</span>
{[['hot','active-hot','🔥 Hot'],['warm','active-warm','🌡 Warm'],['cold','active-cold','🔵 Cold']].map(([val,cls,label]) => (
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
          <style dangerouslySetInnerHTML={{ __html: AWS_STYLES }} />
        <div className="section-title">📋 AWS Co-Sell Opportunity Scorer</div>
        <div className="section-sub">Paste your AWS opportunity data (TSV/CSV with headers) to score and prioritize your pipeline.</div>
        <div className="settings-card">
          <textarea
            className="lc-textarea"
            placeholder={'Paste spreadsheet data here (TSV or CSV with headers)…\n\nExample columns: Opportunity id, Stage, Customer Company Name, AWS Products, Estimated AWS Monthly Recurring Revenue…'}
            value={rawInput}
            onChange={e => setRawInput(e.target.value)}
            style={{ minHeight: 260 }}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="lc-btn" onClick={handleParse}>⚡ Score Opportunities</button>
            {onReset && <button onClick={onReset} className="btn-back" style={{ marginBottom: 0 }}>← Back to Results</button>}
          </div>
        </div>
      </div>
          </div>
  );
}
