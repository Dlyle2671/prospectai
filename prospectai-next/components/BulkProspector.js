import { useState, useRef, useEffect } from 'react';
import { paiSave, paiLoad } from '../lib/utils';

const TITLE_OPTIONS = ['VP of Engineering','CTO','Head of Infrastructure','Cloud Architect','DevOps Manager','Director of Engineering','Head of Platform','VP of IT','Chief Information Officer','Engineering Manager','Solutions Architect','Technical Director','Head of DevOps','VP of Technology','Head of Cloud'];
const INDUSTRY_OPTIONS = ['Information Technology','Software Development','Financial Services','Healthcare','E-Commerce','Cybersecurity','Telecommunications','Manufacturing','Logistics','Education','Media & Entertainment','Real Estate','Professional Services','Energy','Retail'];
const SIZE_OPTIONS = ['1-10','11-50','51-200','201-500','501-1000','1001-5000','5001+'];
const LIMIT_OPTIONS = [10,25,50,100];

const DEFAULT = {
    titles: ['VP of Engineering','CTO','Head of Infrastructure','Cloud Architect','DevOps Manager'],
    industry: ['Information Technology'],
    sizes: ['51-200','201-500','501-1000'],
    limit: 50
};

// ── CSV parser (no external deps) ──────────────────────────────────────────
function parseCsvText(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];
    const header = splitCsvRow(lines[0]).map(h => h.trim().toLowerCase());
    const domainCol = ['domain','website','url','company_domain','company domain','site','homepage','web'].find(k => header.includes(k));
    if (!domainCol) {
          // No header match — try treating entire file as one domain per line
      return lines.flatMap(l => {
              const d = cleanDomain(l.trim());
              return d ? [d] : [];
      }).filter(Boolean);
    }
    const idx = header.indexOf(domainCol);
    return lines.slice(1).map(l => cleanDomain(splitCsvRow(l)[idx] || '')).filter(Boolean);
}

function splitCsvRow(row) {
    const cells = [];
    let cur = '', inQ = false;
    for (let i = 0; i < row.length; i++) {
          const ch = row[i];
          if (ch === '"') {
                  if (inQ && row[i+1] === '"') { cur += '"'; i++; }
                  else inQ = !inQ;
          } else if (ch === ',' && !inQ) {
                  cells.push(cur); cur = '';
          } else {
                  cur += ch;
          }
    }
    cells.push(cur);
    return cells;
}

function cleanDomain(raw) {
    if (!raw) return '';
    let d = raw.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0].split('?')[0];
    return /^[a-z0-9]([a-z0-9\-\.]*[a-z0-9])?\.[a-z]{2,}$/.test(d) ? d : '';
}

                       // ── Minimal XLSX parser ────────────────────────────────────────────────────
// Loads SheetJS from CDN lazily on first use
let _xlsx = null;
async function loadXlsx() {
    if (_xlsx) return _xlsx;
    if (typeof window === 'undefined') return null;
    if (window.XLSX) { _xlsx = window.XLSX; return _xlsx; }
    await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
    });
    _xlsx = window.XLSX;
    return _xlsx;
}

async function parseExcelFile(file) {
    const XLSX = await loadXlsx();
    if (!XLSX) throw new Error('Could not load Excel parser');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (!rows.length) return [];
    const header = (rows[0] || []).map(h => String(h||'').trim().toLowerCase());
    const domainCol = ['domain','website','url','company_domain','company domain','site','homepage','web'].find(k => header.includes(k));
    if (!domainCol) {
          return rows.flatMap(r => {
                  const d = cleanDomain(String(r[0]||''));
                  return d ? [d] : [];
          }).filter(Boolean);
    }
    const idx = header.indexOf(domainCol);
    return rows.slice(1).map(r => cleanDomain(String(r[idx]||''))).filter(Boolean);
}

export default function BulkProspector() {
    const [filters, setFilters] = useState(() => ({ ...DEFAULT, ...paiLoad('bulk_filters') }));
    const [stage, setStage] = useState(0);
    const [results, setResults] = useState(() => paiLoad('bulk_results') || []);
    const [hsSent, setHsSent] = useState({});
    const [progress, setProgress] = useState(0);
    const [progressMsg, setProgressMsg] = useState('');

  // File upload state
  const [domains, setDomains] = useState(() => paiLoad('bulk_domains') || []);
    const [fileError, setFileError] = useState('');
    const [fileName, setFileName] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);
    const fileRef = useRef(null);

  function toggle(key, val) {
        setFilters(prev => {
                const arr = [...prev[key]];
                const i = arr.indexOf(val);
                if (i >= 0) arr.splice(i, 1); else arr.push(val);
                return { ...prev, [key]: arr };
        });
  }

  async function handleFile(file) {
        if (!file) return;
        setFileError('');
        setFileName(file.name);
        try {
                let parsed = [];
                const name = file.name.toLowerCase();
                if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm')) {
                          parsed = await parseExcelFile(file);
                } else {
                          const text = await file.text();
                          parsed = parseCsvText(text);
                }
                if (!parsed.length) {
                          setFileError('No valid domains found. Make sure your file has a column named "domain", "website", or "url".');
                          return;
                }
                const unique = [...new Set(parsed)];
                setDomains(unique);
                paiSave('bulk_domains', unique);
        } catch (e) {
                setFileError('Failed to parse file: ' + e.message);
        }
  }

  function onFileInput(e) {
        handleFile(e.target.files[0]);
        e.target.value = '';
  }

  function onDrop(e) {
        e.preventDefault();
        setIsDragOver(false);
        handleFile(e.dataTransfer.files[0]);
  }

  function removeDomain(i) {
        const next = domains.filter((_, idx) => idx !== i);
        setDomains(next);
        paiSave('bulk_domains', next);
  }

  function clearDomains() {
        setDomains([]);
        setFileName('');
        paiSave('bulk_domains', []);
  }

  async function runSearch() {
        const hasDomains = domains.length > 0;
        if (!filters.titles.length) { alert('Select at least one job title.'); return; }
        if (!hasDomains) { alert('Upload a CSV or Excel file with company domains first.'); return; }

      setStage(1);
        setResults([]);
        setProgress(0);
        setHsSent({});

      const allContacts = [];
        const seenIds = new Set();
        const total = domains.length;

      try {
              for (let di = 0; di < total; di++) {
                        const domain = domains[di];
                        setProgressMsg(`Searching domain ${di + 1} of ${total}: ${domain}`);
                        setProgress(Math.round((di / total) * 95));

                const resp = await fetch('/api/apollo', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                          per_page: Math.min(filters.limit, 25),
                                          page: 1,
                                          person_titles: filters.titles,
                                          organization_num_employees_ranges: filters.sizes,
                                          organization_domains: [domain],
                            }),
                });
                        const data = await resp.json();
                        const contacts = Array.isArray(data) ? data : (data.people || data.contacts || []);
                        contacts.forEach(c => {
                                    if (!seenIds.has(c.id)) {
                                                  seenIds.add(c.id);
                                                  allContacts.push(c);
                                    }
                        });
                        await new Promise(r => setTimeout(r, 150));
              }

          setResults(allContacts);
              paiSave('bulk_results', allContacts);
              paiSave('bulk_filters', filters);
              setStage(2);
              setProgress(100);
              setProgressMsg('');
      } catch (err) {
              setStage(3);
              alert('Search failed: ' + err.message);
      }
  }

  async function pushHS(i) {
        const p = results[i];
        if (!p) return;
        try {
                await fetch('/api/hubspot', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                                      email: p.email,
                                      firstname: p.first_name,
                                      lastname: p.last_name,
                                      jobtitle: p.title,
                                      company: p.organization?.name || p.company_name,
                                      phone: p.phone_numbers?.[0]?.raw_number || p.personal_phone,
                                      linkedin: p.linkedin_url,
                          }),
                });
                setHsSent(prev => ({ ...prev, [i]: true }));
        } catch (err) {
                alert('HubSpot error: ' + err.message);
        }
  }

  function exportCSV() {
        const rows = [['Name','Title','Company','Domain','Email','Phone','LinkedIn','Location']];
        results.forEach(p => rows.push([
                `${p.first_name||''} ${p.last_name||''}`.trim(),
                p.title||'',
                p.organization?.name || p.company_name || '',
                p.company_domain || p.organization?.primary_domain || '',
                p.email||'',
                p.phone_numbers?.[0]?.raw_number || p.personal_phone || '',
                p.linkedin_url||'',
                [p.city,p.state,p.country].filter(Boolean).join(', '),
              ]));
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
        a.download = `bulk_prospects_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
  }

  const boxStyle = { background:'#1e293b', border:'1px solid #334155', borderRadius:10, padding:20, marginBottom:16 };
    const labelStyle = { fontSize:13, fontWeight:600, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:14 };

  return (
        <div className="fade-up">
          <div className="section-title">⚡ Bulk Prospector</div>
        <div className="section-sub">Upload a CSV or Excel file of company domains, then search for contacts at each company.</div>

  {/* ── File Upload ─────────────────────────────────────── */}
        <div style={boxStyle}>
                  <div style={labelStyle}>Step 1 — Upload Company Domains</div>
          <div style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>
          Your file needs a column named <strong style={{color:'#94a3b8'}}>domain</strong>, <strong style={{color:'#94a3b8'}}>website</strong>, or <strong style={{color:'#94a3b8'}}>url</strong>. Supports CSV and Excel (.xlsx).
            </div>

{/* Drop Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
                        border: `2px dashed ${isDragOver ? '#3b82f6' : '#334155'}`,
                        borderRadius: 10,
                        padding: '28px 20px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: isDragOver ? 'rgba(59,130,246,0.07)' : '#0f172a',
                        transition: 'all .2s',
                        marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>
{fileName ? `✅ ${fileName}` : 'Drag & drop your file here, or click to browse'}
</div>
          <div style={{ fontSize: 11, color: '#475569' }}>CSV or Excel (.xlsx) — max 500 domains</div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,.xlsm"
            style={{ display:'none' }}
            onChange={onFileInput}
          />
              </div>

{fileError && (
            <div style={{ fontSize:12, color:'#f87171', background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:6, padding:'8px 12px', marginBottom:10 }}>
            ⚠ {fileError}
</div>
        )}

{domains.length > 0 && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontSize:13, color:'#22c55e', fontWeight:600 }}>✅ {domains.length} domain{domains.length !== 1 ? 's' : ''} loaded</div>
              <button onClick={clearDomains} style={{ background:'none', border:'none', color:'#64748b', fontSize:12, cursor:'pointer', textDecoration:'underline' }}>Clear all</button>
  </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, maxHeight:120, overflowY:'auto', padding:4 }}>
{domains.slice(0, 50).map((d, i) => (
                  <div key={i} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'#94a3b8', background:'#111827', border:'1px solid #1e293b', borderRadius:5, padding:'2px 8px' }}>
                          {d}
                                            <span onClick={() => removeDomain(i)} style={{ cursor:'pointer', color:'#475569', marginLeft:2 }}>×</span>
  </div>
              ))}
{domains.length > 50 && <div style={{ fontSize:11, color:'#475569', padding:'2px 8px' }}>…and {domains.length - 50} more</div>}
  </div>
  </div>
        )}
</div>

{/* ── Job Titles ──────────────────────────────────────── */}
      <div style={boxStyle}>
                <div style={labelStyle}>Step 2 — Job Titles ({filters.titles.length} selected)</div>
        <div className="pill-row">
      {TITLE_OPTIONS.map(t => (
                    <button key={t} className={`pill ${filters.titles.includes(t) ? 'active' : ''}`} onClick={() => toggle('titles', t)}>{t}</button>
          ))}
</div>
  </div>

{/* ── Company Size ────────────────────────────────────── */}
      <div style={boxStyle}>
                <div style={labelStyle}>Step 3 — Company Size ({filters.sizes.length} selected)</div>
        <div className="pill-row">
      {SIZE_OPTIONS.map(t => (
                    <button key={t} className={`pill ${filters.sizes.includes(t) ? 'active' : ''}`} onClick={() => toggle('sizes', t)}>{t}</button>
          ))}
</div>
  </div>

{/* ── Run Search ──────────────────────────────────────── */}
      <div style={boxStyle}>
                <div style={labelStyle}>Step 4 — Run Search</div>
        <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:12, color:'#94a3b8' }}>Contacts per company:</span>
          <select
            style={{ background:'#0f172a', border:'1px solid #334155', color:'#e2e8f0', borderRadius:6, padding:'6px 10px', fontSize:13 }}
            value={filters.limit}
            onChange={e => setFilters(prev => ({ ...prev, limit: parseInt(e.target.value) }))}
                        >
            {LIMIT_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                               </select>
                               {domains.length > 0 && (
                          <span style={{ fontSize:12, color:'#475569' }}>~{domains.length} API calls ({domains.length} domains)</span>
          )}
</div>
        <button
          style={{ padding:'10px 24px', borderRadius:8, border:'none', background: stage === 1 ? '#334155' : '#1d4ed8', color: stage === 1 ? '#64748b' : '#fff', fontSize:14, fontWeight:600, cursor: stage === 1 ? 'not-allowed' : 'pointer' }}
          onClick={runSearch}
          disabled={stage === 1}
        >
          {stage === 1 ? '⚡ Running…' : `⚡ Run Bulk Search${domains.length ? ` (${domains.length} companies)` : ''}`}
            </button>
            </div>

{/* ── Progress ────────────────────────────────────────── */}
{stage === 1 && (
          <div style={boxStyle}>
            <div style={{ color:'#94a3b8', fontSize:14, marginBottom:12 }}>{progressMsg || `⚡ Searching across ${domains.length} companies…`}</div>
          <div style={{ background:'#0f172a', borderRadius:6, overflow:'hidden', height:8, border:'1px solid #334155' }}>
            <div style={{ height:'100%', background:'linear-gradient(90deg,#1d4ed8,#3b82f6)', width:progress+'%', transition:'width .3s' }} />
  </div>
          <div style={{ fontSize:12, color:'#64748b', marginTop:8, fontStyle:'italic' }}>{progress}% — {results.length} contacts found so far</div>
  </div>
      )}

{/* ── Results ─────────────────────────────────────────── */}
{stage === 2 && results.length > 0 && (
          <div style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:10, overflow:'hidden' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px 12px', flexWrap:'wrap', gap:8 }}>
            <div>
                <div style={{ fontSize:15, fontWeight:600, color:'#f8fafc' }}>⚡ Bulk Results</div>
              <div style={{ fontSize:13, color:'#94a3b8' }}>{results.length} contacts found across {domains.length} companies</div>
  </div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ padding:'8px 16px', borderRadius:8, background:'#064e3b', color:'#34d399', border:'1px solid #065f46', fontSize:13, cursor:'pointer' }} onClick={exportCSV}>
                  📥 Export CSV
  </button>
              <button style={{ padding:'8px 16px', borderRadius:8, background:'#ff7a59', color:'#fff', border:'none', fontSize:13, cursor:'pointer' }} onClick={() => results.forEach((_,i) => { if(!hsSent[i]) pushHS(i); })}>
                ⬆ Push All to HubSpot
                  </button>
                  </div>
                  </div>
          <div style={{ background:'#0f172a', borderTop:'1px solid #334155' }}>
            <div style={{ display:'flex', gap:12, padding:'8px 14px', borderBottom:'1px solid #1e293b', fontSize:11, color:'#475569', fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em' }}>
              <div style={{ width:32, flexShrink:0 }} />
              <div style={{ flex:1, minWidth:160 }}>Name / Title</div>
              <div style={{ flex:1, minWidth:140 }}>Company / Domain</div>
              <div style={{ flex:1, minWidth:160 }}>Email</div>
              <div style={{ minWidth:80 }}>Action</div>
                  </div>
{results.map((p, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderBottom:'1px solid #1e293b', flexWrap:'wrap' }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'#1d4ed8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0 }}>
             {((p.first_name||'?')[0]||'?').toUpperCase()}
</div>
                <div style={{ flex:1, minWidth:160 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#f1f5f9' }}>{p.first_name} {p.last_name}</div>
                  <div style={{ fontSize:11, color:'#94a3b8' }}>{p.title}</div>
  </div>
                <div style={{ flex:1, minWidth:140 }}>
                  <div style={{ fontSize:12, color:'#c8d4e8' }}>{p.organization?.name || p.company_name || '—'}</div>
                  <div style={{ fontSize:11, color:'#475569' }}>{p.company_domain || p.organization?.primary_domain || ''}</div>
  </div>
                <div style={{ fontSize:11, color:'#64748b', flex:1, minWidth:160 }}>{p.email||'—'}</div>
                <button
                  style={{ padding:'5px 10px', borderRadius:6, border:'none', background: hsSent[i] ? '#14532d' : '#ff7a59', color: hsSent[i] ? '#4ade80' : '#fff', fontSize:11, cursor: hsSent[i] ? 'default' : 'pointer' }}
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

{stage === 2 && results.length === 0 && (
          <div className="empty-state"><div className="empty-icon">🔍</div><div>No contacts found for the uploaded domains with the selected filters.</div></div>
       )}

{stage === 0 && (
          <div className="empty-state"><div className="empty-icon">⚡</div><div>Upload a domain list above to get started.</div></div>
       )}
</div>
  );
}
