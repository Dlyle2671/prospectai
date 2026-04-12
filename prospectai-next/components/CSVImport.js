import React, { useRef, useState } from 'react';

const REP_MAP = {
  'cameron criner':  'rep_1',
  'zoe behrens':     'rep_2',
  'chris stoker':    'rep_3',
  'dwayne lyle':     '1775061054888_17y4wgyfoih',
  'house':           '1775246862797_jdxy9g0mxip',
};

const VALID_CATS    = ['PS', 'FO', 'MS'];
const VALID_STAGES  = ['Closed Won', 'Closed Lost', 'Forecasted', 'SOW Sent'];
const VALID_SOURCES = ['AWS', 'Marketing', 'Customer Success', 'Business Development'];
const MONTHS        = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MONTH_NAMES   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function nid() { return Date.now()+'_csv'+Math.random().toString(36).slice(2,8); }

function resolveMonth(val) {
  const n = parseInt(val);
  if (!isNaN(n) && n >= 1 && n <= 12) return n;
  const m = MONTHS.indexOf((val||'').toLowerCase().substring(0,3));
  return m !== -1 ? m + 1 : null;
}

function parseCSV(text) {
  const lines   = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z_]/g,''));
  return lines.slice(1).filter(l => l.trim()).map((line, i) => {
    const vals = line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map(v => v.replace(/^"|"$/g,'').trim()) || line.split(',').map(v => v.trim());
    const row  = {};
    headers.forEach((h, j) => row[h] = vals[j] || '');
    row._lineNum = i + 2;
    return row;
  });
}

function validateAndMap(rows) {
  const valid = [], errors = [];
  rows.forEach(row => {
    const errs   = [];
    const repKey = (row.rep || '').toLowerCase().trim();
    const repId  = REP_MAP[repKey];
    const cat    = (row.category || '').toUpperCase().trim();
    const stage  = VALID_STAGES.find(s => s.toLowerCase() === (row.stage||'').toLowerCase().trim());
    const source = VALID_SOURCES.find(s => s.toLowerCase() === (row.source||'').toLowerCase().trim());
    const month  = resolveMonth(row.month || '');
    const fee    = parseFloat(row.fee)  || 0;
    const mrr    = parseFloat(row.mrr)  || 0;

    if (!repId)                              errs.push('Unknown rep: "'+row.rep+'"');
    if (!VALID_CATS.includes(cat))           errs.push('Invalid category: "'+row.category+'" (use PS, FO, or MS)');
    if (!row.client?.trim())                 errs.push('Missing client name');
    if (!stage)                              errs.push('Invalid stage: "'+row.stage+'"');
    if (!source)                             errs.push('Invalid source: "'+row.source+'"');
    if (!month)                              errs.push('Invalid month: "'+row.month+'" (use 1-12 or Jan-Dec)');
    if (cat==='PS' && fee <= 0)              errs.push('PS deals require a fee > 0');
    if ((cat==='FO'||cat==='MS') && mrr<=0)  errs.push('FO/MS deals require MRR > 0');

    if (errs.length > 0) {
      errors.push({ line: row._lineNum, client: row.client||'—', errors: errs });
    } else {
      valid.push({
        id: nid(), repId, cat, client: row.client.trim(),
        stage, source, month,
        amount: cat==='PS' ? fee : 0,
        mrr:    cat!=='PS' ? mrr : 0,
        contractLength: 0, notes: '',
      });
    }
  });
  return { valid, errors };
}

function fmtVal(d) {
  return d.mrr > 0 ? '$'+d.mrr.toLocaleString()+'/mo' : '$'+d.amount.toLocaleString()+' fee';
}

function downloadTemplate() {
  const csv = [
    'rep,category,client,stage,source,month,fee,mrr',
    'Cameron Criner,PS,Acme Corp,Closed Won,AWS,Jan,50000,0',
    'Zoe Behrens,FO,Beta Inc,Closed Won,Marketing,Feb,0,8000',
    'HOUSE,MS,Gamma LLC,Forecasted,Customer Success,Mar,0,3000',
    'Dwayne Lyle,FO,Delta Ltd,SOW Sent,Business Development,Apr,0,5000',
  ].join('\n');
  const a   = document.createElement('a');
  a.href    = 'data:text/csv,'+encodeURIComponent(csv);
  a.download = 'deals_import_template.csv';
  a.click();
}

export default function CSVImport({ data, onImport }) {
  const fileRef = useRef();
  const [preview,  setPreview]  = useState(null);
  const [imported, setImported] = useState(null);
  const [err,      setErr]      = useState(null);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImported(null); setErr(null);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const rows = parseCSV(ev.target.result);
        if (!rows.length) { setErr('CSV is empty or has no data rows.'); return; }
        setPreview({ ...validateAndMap(rows), total: rows.length });
      } catch(e) { setErr('Could not parse CSV: '+e.message); }
    };
    reader.readAsText(file);
  }

  function handleConfirm() {
    if (!preview?.valid?.length) return;
    const updated = JSON.parse(JSON.stringify(data));
    updated.deals = [...(updated.deals||[]), ...preview.valid];
    onImport(updated);
    setImported(preview.valid.length);
    setPreview(null);
    fileRef.current.value = '';
  }

  function handleCancel() { setPreview(null); fileRef.current.value = ''; }

  return (
    <>
      <input ref={fileRef} type="file" accept=".csv" style={{display:'none'}} onChange={handleFile} />

      <button className="sa-btn sm"
        style={{background:'rgba(99,102,241,.2)',border:'1px solid rgba(99,102,241,.4)'}}
        onClick={()=>fileRef.current.click()}>
        ↑ Import CSV
      </button>
      <button className="sa-btn sm"
        style={{background:'transparent',border:'1px solid rgba(255,255,255,.1)',color:'#64748b'}}
        onClick={downloadTemplate}>
        ↓ Template
      </button>

      {imported!==null && (
        <span style={{fontSize:12,color:'#34d399',marginLeft:8}}>
          ✓ {imported} deal{imported!==1?'s':''} imported
        </span>
      )}

      {err && (
        <div style={{position:'fixed',bottom:24,right:24,background:'rgba(239,68,68,.15)',
          border:'1px solid rgba(239,68,68,.3)',borderRadius:8,padding:'10px 16px',
          color:'#f87171',fontSize:13,zIndex:9999}}>
          {err}
        </div>
      )}

      {preview && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div style={{background:'#1e293b',border:'1px solid rgba(99,102,241,.3)',
            borderRadius:12,padding:24,width:560,maxHeight:'82vh',overflowY:'auto',
            boxShadow:'0 24px 60px rgba(0,0,0,.5)'}}>

            <h3 style={{margin:'0 0 4px',color:'#f1f5f9',fontSize:16}}>Import Preview</h3>
            <p style={{margin:'0 0 16px',fontSize:12,color:'#64748b'}}>{preview.total} rows parsed</p>

            <div style={{marginBottom:10,padding:'10px 14px',borderRadius:8,
              background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.2)'}}>
              <span style={{color:'#34d399',fontWeight:600,fontSize:13}}>
                ✓ {preview.valid.length} deal{preview.valid.length!==1?'s':''} ready to import
              </span>
            </div>

            {preview.errors.length > 0 && (
              <div style={{marginBottom:14,padding:'10px 14px',borderRadius:8,
                background:'rgba(239,68,68,.07)',border:'1px solid rgba(239,68,68,.2)'}}>
                <div style={{color:'#f87171',fontWeight:600,fontSize:13,marginBottom:8}}>
                  ✗ {preview.errors.length} row{preview.errors.length!==1?'s':''} will be skipped:
                </div>
                {preview.errors.map((e,i)=>(
                  <div key={i} style={{fontSize:11,color:'#fca5a5',marginBottom:5,
                    paddingLeft:8,borderLeft:'2px solid rgba(239,68,68,.3)'}}>
                    <strong>Row {e.line} ({e.client}):</strong> {e.errors.join(' · ')}
                  </div>
                ))}
              </div>
            )}

            {preview.valid.length > 0 && (
              <table className="sa-tbl" style={{marginBottom:16,fontSize:12}}>
                <thead>
                  <tr><th>REP</th><th>CLIENT</th><th>CAT</th><th>STAGE</th><th>MO</th><th>VALUE</th></tr>
                </thead>
                <tbody>
                  {preview.valid.slice(0,8).map(d=>(
                    <tr key={d.id}>
                      <td style={{color:'#818cf8'}}>
                        {Object.entries(REP_MAP).find(([,v])=>v===d.repId)?.[0]
                          ?.split(' ').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ')}
                      </td>
                      <td style={{color:'#f1f5f9',fontWeight:500}}>{d.client}</td>
                      <td>
                        <span style={{padding:'1px 6px',borderRadius:4,fontSize:10,fontWeight:700,
                          background:d.cat==='FO'?'rgba(139,92,246,.2)':d.cat==='MS'?'rgba(14,116,144,.2)':'rgba(99,102,241,.2)',
                          color:d.cat==='FO'?'#a78bfa':d.cat==='MS'?'#38bdf8':'#818cf8'}}>
                          {d.cat}
                        </span>
                      </td>
                      <td style={{color:d.stage==='Closed Won'?'#34d399':d.stage==='Closed Lost'?'#f87171':'#fbbf24',fontSize:11}}>
                        {d.stage}
                      </td>
                      <td style={{color:'#94a3b8'}}>{MONTH_NAMES[d.month-1]}</td>
                      <td style={{color:'#f1f5f9',fontWeight:600}}>{fmtVal(d)}</td>
                    </tr>
                  ))}
                  {preview.valid.length > 8 && (
                    <tr><td colSpan={6} style={{color:'#475569',fontStyle:'italic',textAlign:'center'}}>
                      …and {preview.valid.length-8} more
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}

            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="sa-btn sm del" onClick={handleCancel}>Cancel</button>
              <button className="sa-btn sm" onClick={handleConfirm}
                disabled={!preview.valid.length}
                style={{opacity:preview.valid.length?1:0.4}}>
                Import {preview.valid.length} Deal{preview.valid.length!==1?'s':''}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
