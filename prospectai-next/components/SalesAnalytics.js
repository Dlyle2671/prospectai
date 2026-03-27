import React, { useState } from 'react';
const SK = 'pai_quotaTracker';
const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CM = new Date().getMonth() + 1;
const CR = { PS: 0.10, FO: 0.07, MS: 0.07 };
const CAT_KEYS = { PS: 'Professional Services', FO: 'FinOps', MS: 'Managed Services' };
const COMPANY_QUOTA = { PS: 6500000, FO: 32000000, MS: 1500000 };

function mrem(m){ return Math.max(1, 13 - m); }
function fmt(n){ if(!n && n!==0) return '$0'; return '$'+Number(n).toLocaleString('en-US',{maximumFractionDigits:0}); }
function pct(n){ return (n*100).toFixed(1)+'%'; }

function ld(){
  try{
    const r = localStorage.getItem(SK);
    if(r){
      const p = JSON.parse(r);
      // Ensure each rep has the required fields
      const reps = (Array.isArray(p.reps)?p.reps:[]).map(rep => ({
        ...rep,
        actuals: rep.actuals || { 'Professional Services':0, 'FinOps':0, 'Managed Services':0 },
        quotas: rep.quotas || { 'Professional Services':0, 'FinOps':0, 'Managed Services':0 },
        psWins: rep.psWins || [],
        recurringDeals: rep.recurringDeals || { 'FinOps':[], 'Managed Services':[] },
      }));
      return { reps, deals: Array.isArray(p.deals)?p.deals:[] };
    }
  }catch(e){}
  return { reps:[], deals:[] };
}

function sd(d){ try{ localStorage.setItem(SK, JSON.stringify(d)); }catch(e){} }
function nid(){ return Date.now()+'_'+Math.random().toString(36).slice(2); }

// Get a rep's actual for a category (PS/FO/MS)
function getActual(rep, cat){ return (rep.actuals && rep.actuals[CAT_KEYS[cat]]) || 0; }
// Get a rep's quota for a category
function getQuota(rep, cat){ return (rep.quotas && rep.quotas[CAT_KEYS[cat]]) || 0; }
// Total actuals across all reps for a category
function totalActualsCat(reps, cat){ return reps.reduce((s,r) => s + getActual(r,cat), 0); }
// Total quota across all reps for a category
function totalQuotaCat(reps, cat){ return reps.reduce((s,r) => s + getQuota(r,cat), 0); }

// Commission on actuals: PS = 10% of fee, FO/MS = 7% of ARR
function repCommission(rep){
  const ps = getActual(rep,'PS') * CR.PS;
  const fo = getActual(rep,'FO') * CR.FO;
  const ms = getActual(rep,'MS') * CR.MS;
  return { ps, fo, ms, tot: ps+fo+ms };
}

export default function SalesAnalytics({onBack}){
  const [tab, setTab] = useState('dash');
  const [data, setData] = useState(ld());
  const [filterRep, setFilterRep] = useState('All');

  const save = d => { sd(d); setData(JSON.parse(JSON.stringify(d))); };

  return(<>
  <style>{`
    .sa{display:flex;flex-direction:column;position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff;z-index:1000;overflow:hidden;}
    .sa-hd{background:#1e293b;border-bottom:1px solid rgba(99,102,241,.3);padding:0 24px;display:flex;align-items:center;justify-content:space-between;height:60px;flex-shrink:0;}
    .sa-hd h1{font-size:20px;font-weight:700;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin:0;}
    .sa-x{background:rgba(99,102,241,.2);border:1px solid rgba(99,102,241,.4);color:#fff;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;}
    .sa-tabs{display:flex;gap:4px;background:#1e293b;padding:8px 24px;border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0;overflow-x:auto;}
    .sa-tab{background:transparent;border:none;color:#64748b;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;white-space:nowrap;transition:all .15s;}
    .sa-tab:hover{color:#e2e8f0;background:rgba(255,255,255,.05);}
    .sa-tab.on{background:rgba(99,102,241,.2);color:#818cf8;border:1px solid rgba(99,102,241,.3);}
    .sa-body{flex:1;overflow-y:auto;padding:24px;}
    .sa-card{background:#1e293b;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px;margin-bottom:16px;}
    .sa-card h2{font-size:16px;font-weight:600;color:#f1f5f9;margin:0 0 16px;}
    .sa-g3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px;}
    .sa-g2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:16px;}
    .sa-stat{background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px;}
    .sa-stat .lbl{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#475569;margin-bottom:6px;}
    .sa-stat .val{font-size:22px;font-weight:700;color:#f1f5f9;}
    .sa-stat .sub{font-size:11px;color:#475569;margin-top:4px;}
    .sa-stat .note{font-size:11px;color:#818cf8;margin-top:6px;font-style:italic;}
    .sa-bar{height:6px;background:#1e293b;border-radius:3px;margin-top:10px;overflow:hidden;}
    .sa-bar-fill{height:100%;border-radius:3px;transition:width .4s;}
    .sa-tbl{width:100%;border-collapse:collapse;}
    .sa-tbl th{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#475569;padding:8px 12px;text-align:left;border-bottom:1px solid rgba(255,255,255,.06);}
    .sa-tbl td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.04);font-size:13px;color:#cbd5e1;}
    .sa-tbl tr:last-child td{border-bottom:none;}
    .sa-tbl tr:hover td{background:rgba(255,255,255,.02);}
    .sa-badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;}
    .sa-badge.ahead{background:rgba(16,185,129,.15);color:#34d399;}
    .sa-badge.behind{background:rgba(239,68,68,.15);color:#f87171;}
    .sa-btn{background:linear-gradient(135deg,#4f46e5,#6366f1);border:none;color:#fff;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;transition:all .2s;}
    .sa-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(99,102,241,.4);}
    .sa-btn.sm{padding:6px 14px;font-size:12px;}
    .sa-btn.del{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#f87171;}
    .sa-input{background:#0f172a;border:1px solid rgba(255,255,255,.1);color:#f1f5f9;padding:10px 14px;border-radius:8px;font-size:13px;width:100%;box-sizing:border-box;}
    .sa-input:focus{outline:none;border-color:#6366f1;}
    .sa-select{background:#0f172a;border:1px solid rgba(255,255,255,.1);color:#f1f5f9;padding:10px 14px;border-radius:8px;font-size:13px;width:100%;box-sizing:border-box;}
    .sa-label{font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;display:block;}
    .sa-frow{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px;}
    .sa-shd{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
    .sa-pill{display:inline-flex;align-items:center;background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.25);color:#818cf8;padding:4px 12px;border-radius:20px;font-size:12px;cursor:pointer;}
    .sa-pill.on{background:rgba(99,102,241,.25);border-color:rgba(99,102,241,.5);color:#c7d2fe;}
    .sa-pills{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;}
    .sa-preview{background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:8px;padding:10px 14px;font-size:12px;color:#a5b4fc;margin-top:8px;line-height:1.7;}
  `}</style>
  <div className="sa">
    <div className="sa-hd"><h1>Sales Analytics</h1><button className="sa-x" onClick={()=>onBack&&onBack()}>Back to Home</button></div>
    <div className="sa-tabs">
      {[['dash','Dashboard'],['reps','Reps'],['actuals','Actuals'],['catperf','Category Performance'],['arrcalc','ARR Calc'],['comm','Commissions'],['reports','Reports'],['settings','Settings']].map(([id,label])=>(
        <button key={id} className={`sa-tab${tab===id?' on':''}`} onClick={()=>setTab(id)}>{label}</button>
      ))}
    </div>
    <div className="sa-body">
      {tab==='dash'&&<DashTab data={data}/>}
      {tab==='reps'&&<RepsTab data={data} save={save}/>}
      {tab==='actuals'&&<ActualsTab data={data} save={save}/>}
      {tab==='catperf'&&<CatPerfTab data={data} filterRep={filterRep} setFilterRep={setFilterRep}/>}
      {tab==='arrcalc'&&<ArrCalcTab/>}
      {tab==='comm'&&<CommTab data={data} filterRep={filterRep} setFilterRep={setFilterRep}/>}
      {tab==='reports'&&<ReportsTab data={data}/>}
      {tab==='settings'&&<SettingsTab data={data} save={save}/>}
    </div>
  </div>
  </>);
}

function DashTab({data}){
  const reps = data.reps;
  const cats = [
    {id:'PS', label:'Professional Services', color:'#6366f1', note:'One-time project fee | Commission: 10% of fee'},
    {id:'FO', label:'FinOps', color:'#0ea5e9', note:'Recurring MRR x months remaining = ARR | Commission: 7% x ARR'},
    {id:'MS', label:'Managed Services', color:'#10b981', note:'Recurring MRR x months remaining = ARR | Commission: 7% x ARR'},
  ];
  const totalAllClosed = reps.reduce((s,r) => s + getActual(r,'PS') + getActual(r,'FO') + getActual(r,'MS'), 0);
  const totalAllQuota = reps.reduce((s,r) => s + getQuota(r,'PS') + getQuota(r,'FO') + getQuota(r,'MS'), 0);
  const totalComm = reps.reduce((s,r) => s + repCommission(r).tot, 0);
  return(
    <div>
      <div className="sa-g3">
        {cats.map(c => {
          const closed = totalActualsCat(reps, c.id);
          const quota = totalQuotaCat(reps, c.id);
          const p = quota > 0 ? Math.min(1, closed/quota) : 0;
          const pace = CM/12;
          const behind = closed < quota*pace;
          return(
            <div className="sa-stat" key={c.id}>
              <div className="lbl">{c.label}</div>
              <div className="val" style={{color:'#34d399'}}>{fmt(closed)}</div>
              <div className="sub">of {fmt(quota)} quota ({pct(p)} attained)</div>
              <div className="note">{c.note}</div>
              <div className="sa-bar"><div className="sa-bar-fill" style={{width:p*100+'%',background:'#34d399'}}/></div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
                <span style={{fontSize:11,color:'#475569'}}>Pace: {pct(pace)}</span>
                <span className={`sa-badge ${behind?'behind':'ahead'}`}>{behind?'Behind':'On Track'}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="sa-g3">
        <div className="sa-stat">
          <div className="lbl">Total Closed ARR</div>
          <div className="val" style={{color:'#34d399'}}>{fmt(totalAllClosed)}</div>
          <div className="sub">of {fmt(totalAllQuota)} total quota ({pct(totalAllQuota>0?totalAllClosed/totalAllQuota:0)})</div>
          <div className="sa-bar"><div className="sa-bar-fill" style={{width:Math.min(100,totalAllQuota>0?totalAllClosed/totalAllQuota*100:0)+'%',background:'#34d399'}}/></div>
        </div>
        <div className="sa-stat">
          <div className="lbl">Total Commissions</div>
          <div className="val" style={{color:'#34d399'}}>{fmt(totalComm)}</div>
          <div className="sub">{reps.length} reps</div>
        </div>
        <div className="sa-stat">
          <div className="lbl">Pace Check</div>
          <div className="val">{pct(CM/12)}</div>
          <div className="sub">Month {CM} of 12 — where you should be</div>
        </div>
      </div>
      <div className="sa-card">
        <h2>Rep Summary</h2>
        <table className="sa-tbl">
          <thead><tr>
            <th>Rep</th><th>Dept</th>
            <th>PS Closed</th><th>PS Quota</th><th>PS %</th>
            <th>FO Closed</th><th>FO Quota</th><th>FO %</th>
            <th>MS Closed</th><th>MS Quota</th><th>MS %</th>
            <th>Total Closed</th><th>Commission</th>
          </tr></thead>
          <tbody>
            {reps.map(r => {
              const psA=getActual(r,'PS'), psQ=getQuota(r,'PS');
              const foA=getActual(r,'FO'), foQ=getQuota(r,'FO');
              const msA=getActual(r,'MS'), msQ=getQuota(r,'MS');
              const tot=psA+foA+msA;
              const totQ=psQ+foQ+msQ;
              const comm=repCommission(r);
              const behind=tot<totQ*(CM/12);
              return(
                <tr key={r.id}>
                  <td style={{fontWeight:600,color:'#f1f5f9'}}>{r.name}</td>
                  <td>{r.dept||r.department||'—'}</td>
                  <td style={{color:'#34d399'}}>{fmt(psA)}</td>
                  <td style={{color:'#475569',fontSize:11}}>{fmt(psQ)}</td>
                  <td><span className={`sa-badge ${psA>=psQ*(CM/12)?'ahead':'behind'}`}>{pct(psQ>0?psA/psQ:0)}</span></td>
                  <td style={{color:'#34d399'}}>{fmt(foA)}</td>
                  <td style={{color:'#475569',fontSize:11}}>{fmt(foQ)}</td>
                  <td><span className={`sa-badge ${foA>=foQ*(CM/12)?'ahead':'behind'}`}>{pct(foQ>0?foA/foQ:0)}</span></td>
                  <td style={{color:'#34d399'}}>{fmt(msA)}</td>
                  <td style={{color:'#475569',fontSize:11}}>{fmt(msQ)}</td>
                  <td><span className={`sa-badge ${msA>=msQ*(CM/12)?'ahead':'behind'}`}>{pct(msQ>0?msA/msQ:0)}</span></td>
                  <td style={{fontWeight:700,color:'#34d399'}}>{fmt(tot)}</td>
                  <td style={{color:'#34d399'}}>{fmt(comm.tot)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActualsTab({data, save}){
  const [showForm, setShowForm] = useState(false);
  const [editRep, setEditRep] = useState('');
  const [editCat, setEditCat] = useState('PS');
  const [editAmt, setEditAmt] = useState('');
  const [editNote, setEditNote] = useState('');

  const submit = () => {
    if(!editRep || !editAmt) return;
    const d = JSON.parse(JSON.stringify(data));
    const rep = d.reps.find(r => r.id === editRep);
    if(!rep) return;
    if(!rep.actuals) rep.actuals = {'Professional Services':0,'FinOps':0,'Managed Services':0};
    rep.actuals[CAT_KEYS[editCat]] = Number(editAmt) || 0;
    save(d);
    setShowForm(false);
    setEditRep(''); setEditCat('PS'); setEditAmt(''); setEditNote('');
  };

  const cats = ['PS','FO','MS'];

  return(
    <div>
      <div style={{background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.2)',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#6ee7b7',lineHeight:1.6}}>
        <strong>Actuals</strong> — enter the real closed amounts for each rep per category. These drive quota attainment on the Dashboard.
        PS = one-time project fee. FO/MS = MRR x months remaining in the year.
      </div>
      <div className="sa-shd">
        <div/>
        <button className="sa-btn" onClick={()=>{setShowForm(!showForm);setEditRep('');setEditCat('PS');setEditAmt('');setEditNote('');}}>+ Update Actual</button>
      </div>
      {showForm&&(
        <div className="sa-card" style={{marginBottom:16}}>
          <h2>Update Actual</h2>
          <div className="sa-frow">
            <div>
              <label className="sa-label">Rep</label>
              <select className="sa-select" value={editRep} onChange={e=>setEditRep(e.target.value)}>
                <option value="">Select rep...</option>
                {data.reps.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="sa-label">Category</label>
              <select className="sa-select" value={editCat} onChange={e=>setEditCat(e.target.value)}>
                <option value="PS">Professional Services</option>
                <option value="FO">FinOps</option>
                <option value="MS">Managed Services</option>
              </select>
            </div>
            <div>
              <label className="sa-label">{editCat==='PS'?'Total Project Fees Closed ($)':'Total ARR Closed ($)'}</label>
              <input className="sa-input" type="number" value={editAmt}
                onChange={e=>setEditAmt(e.target.value)}
                placeholder={editCat==='PS'?'e.g. 115300':'e.g. 282000'}/>
              <div style={{fontSize:11,color:'#475569',marginTop:4}}>
                {editCat==='PS'
                  ?'Enter total PS fees closed YTD. Commission = total x 10%.'
                  :'Enter total ARR closed YTD (MRR x months remaining per deal). Commission = total x 7%.'}
              </div>
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="sa-btn" onClick={submit}>Save</button>
            <button className="sa-btn del sm" onClick={()=>setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}
      <div className="sa-card">
        <h2>Current Actuals by Rep</h2>
        <table className="sa-tbl">
          <thead><tr>
            <th>Rep</th><th>Dept</th>
            <th>PS Closed</th><th>PS Quota</th><th>PS %</th>
            <th>FO Closed</th><th>FO Quota</th><th>FO %</th>
            <th>MS Closed</th><th>MS Quota</th><th>MS %</th>
            <th>Total Closed</th>
          </tr></thead>
          <tbody>
            {data.reps.map(r=>{
              const psA=getActual(r,'PS'), psQ=getQuota(r,'PS');
              const foA=getActual(r,'FO'), foQ=getQuota(r,'FO');
              const msA=getActual(r,'MS'), msQ=getQuota(r,'MS');
              const tot=psA+foA+msA;
              return(
                <tr key={r.id}>
                  <td style={{fontWeight:600,color:'#f1f5f9'}}>{r.name}</td>
                  <td>{r.dept||r.department||'—'}</td>
                  <td style={{color:'#34d399'}}>{fmt(psA)}</td>
                  <td style={{color:'#475569',fontSize:11}}>{fmt(psQ)}</td>
                  <td><span className={`sa-badge ${psA>=psQ*(CM/12)?'ahead':'behind'}`}>{pct(psQ>0?psA/psQ:0)}</span></td>
                  <td style={{color:'#34d399'}}>{fmt(foA)}</td>
                  <td style={{color:'#475569',fontSize:11}}>{fmt(foQ)}</td>
                  <td><span className={`sa-badge ${foA>=foQ*(CM/12)?'ahead':'behind'}`}>{pct(foQ>0?foA/foQ:0)}</span></td>
                  <td style={{color:'#34d399'}}>{fmt(msA)}</td>
                  <td style={{color:'#475569',fontSize:11}}>{fmt(msQ)}</td>
                  <td><span className={`sa-badge ${msA>=msQ*(CM/12)?'ahead':'behind'}`}>{pct(msQ>0?msA/msQ:0)}</span></td>
                  <td style={{fontWeight:700,color:'#34d399'}}>{fmt(tot)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RepsTab({data, save}){
  const [showForm, setShowForm] = useState(false);
  const [editRep, setEditRep] = useState(null);
  const [rf, setRf] = useState({name:'',dept:'',psQ:'',foQ:'',msQ:''});

  const submit = () => {
    if(!rf.name.trim()) return;
    const d = JSON.parse(JSON.stringify(data));
    const repData = {
      name: rf.name.trim(),
      dept: rf.dept.trim(),
      quotas: {
        'Professional Services': Number(rf.psQ)||0,
        'FinOps': Number(rf.foQ)||0,
        'Managed Services': Number(rf.msQ)||0,
      },
      actuals: {'Professional Services':0,'FinOps':0,'Managed Services':0},
      psWins: [],
      recurringDeals: {'FinOps':[],'Managed Services':[]},
    };
    if(editRep){
      d.reps = d.reps.map(r => r.id===editRep.id ? {...r,...repData} : r);
      setEditRep(null);
    } else {
      d.reps = [...d.reps, {id:nid(), ...repData}];
    }
    save(d);
    setRf({name:'',dept:'',psQ:'',foQ:'',msQ:''});
    setShowForm(false);
  };

  const del = id => {
    if(!window.confirm('Delete rep?')) return;
    const d = JSON.parse(JSON.stringify(data));
    d.reps = d.reps.filter(r => r.id !== id);
    save(d);
  };

  const startEdit = r => {
    setEditRep(r);
    setRf({
      name: r.name,
      dept: r.dept||r.department||'',
      psQ: getQuota(r,'PS')||'',
      foQ: getQuota(r,'FO')||'',
      msQ: getQuota(r,'MS')||'',
    });
    setShowForm(true);
  };

  return(
    <div>
      <div className="sa-shd">
        <div/>
        <button className="sa-btn" onClick={()=>{setShowForm(!showForm);setEditRep(null);setRf({name:'',dept:'',psQ:'',foQ:'',msQ:''});}}>+ Add Rep</button>
      </div>
      {showForm&&(
        <div className="sa-card" style={{marginBottom:16}}>
          <h2>{editRep?'Edit Rep':'New Rep'}</h2>
          <div className="sa-frow">
            <div><label className="sa-label">Name</label><input className="sa-input" value={rf.name} onChange={e=>setRf({...rf,name:e.target.value})} placeholder="Full name"/></div>
            <div><label className="sa-label">Department</label><input className="sa-input" value={rf.dept} onChange={e=>setRf({...rf,dept:e.target.value})} placeholder="e.g. Sales"/></div>
            <div/>
          </div>
          <div className="sa-frow">
            <div><label className="sa-label">PS Annual Quota ($)</label><input className="sa-input" type="number" value={rf.psQ} onChange={e=>setRf({...rf,psQ:e.target.value})} placeholder="e.g. 1200000"/></div>
            <div><label className="sa-label">FO Annual Quota ($)</label><input className="sa-input" type="number" value={rf.foQ} onChange={e=>setRf({...rf,foQ:e.target.value})} placeholder="e.g. 7020000"/></div>
            <div><label className="sa-label">MS Annual Quota ($)</label><input className="sa-input" type="number" value={rf.msQ} onChange={e=>setRf({...rf,msQ:e.target.value})} placeholder="e.g. 390000"/></div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="sa-btn" onClick={submit}>{editRep?'Save':'Add Rep'}</button>
            <button className="sa-btn del sm" onClick={()=>{setShowForm(false);setEditRep(null);}}>Cancel</button>
          </div>
        </div>
      )}
      <div className="sa-card">
        <table className="sa-tbl">
          <thead><tr><th>Name</th><th>Dept</th><th>PS Quota</th><th>FO Quota</th><th>MS Quota</th><th>PS Closed</th><th>FO Closed</th><th>MS Closed</th><th>Actions</th></tr></thead>
          <tbody>
            {data.reps.map(r=>(
              <tr key={r.id}>
                <td style={{fontWeight:600,color:'#f1f5f9'}}>{r.name}</td>
                <td>{r.dept||r.department||'—'}</td>
                <td style={{color:'#475569'}}>{fmt(getQuota(r,'PS'))}</td>
                <td style={{color:'#475569'}}>{fmt(getQuota(r,'FO'))}</td>
                <td style={{color:'#475569'}}>{fmt(getQuota(r,'MS'))}</td>
                <td style={{color:'#34d399'}}>{fmt(getActual(r,'PS'))}</td>
                <td style={{color:'#34d399'}}>{fmt(getActual(r,'FO'))}</td>
                <td style={{color:'#34d399'}}>{fmt(getActual(r,'MS'))}</td>
                <td style={{display:'flex',gap:6}}>
                  <button className="sa-btn sm" onClick={()=>startEdit(r)}>Edit</button>
                  <button className="sa-btn del sm" onClick={()=>del(r.id)}>Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CatPerfTab({data, filterRep, setFilterRep}){
  const repsFor = filterRep==='All' ? data.reps : data.reps.filter(r=>r.id===filterRep);
  const cats = [
    {id:'PS', label:'Professional Services', color:'#6366f1', note:'One-time project fee | Commission: 10% of fee'},
    {id:'FO', label:'FinOps', color:'#0ea5e9', note:'Recurring MRR x months remaining = ARR | Commission: 7% x ARR'},
    {id:'MS', label:'Managed Services', color:'#10b981', note:'Recurring MRR x months remaining = ARR | Commission: 7% x ARR'},
  ];
  return(
    <div>
      <div className="sa-pills">
        <button className={`sa-pill${filterRep==='All'?' on':''}`} onClick={()=>setFilterRep('All')}>All Reps</button>
        {data.reps.map(r=><button key={r.id} className={`sa-pill${filterRep===r.id?' on':''}`} onClick={()=>setFilterRep(r.id)}>{r.name}</button>)}
      </div>
      {cats.map(c=>{
        const closed = repsFor.reduce((s,r)=>s+getActual(r,c.id),0);
        const quota = repsFor.reduce((s,r)=>s+getQuota(r,c.id),0);
        const comm = repsFor.reduce((s,r)=>s+repCommission(r)[c.id.toLowerCase()],0);
        const p = quota>0 ? Math.min(1,closed/quota) : 0;
        const remaining = Math.max(0, quota-closed);
        return(
          <div className="sa-card" key={c.id}>
            <h2 style={{color:c.color}}>{c.label}</h2>
            <div style={{fontSize:11,color:'#475569',marginTop:-10,marginBottom:14,fontStyle:'italic'}}>{c.note}</div>
            <div className="sa-g3">
              <div className="sa-stat">
                <div className="lbl">Closed ARR</div>
                <div className="val" style={{color:'#34d399'}}>{fmt(closed)}</div>
                <div className="sub">of {fmt(quota)} quota — {pct(p)} attained</div>
                <div className="sa-bar"><div className="sa-bar-fill" style={{width:p*100+'%',background:'#34d399'}}/></div>
                <div style={{fontSize:11,color:'#475569',marginTop:4}}>Pace: {pct(CM/12)}</div>
              </div>
              <div className="sa-stat">
                <div className="lbl">Remaining to Quota</div>
                <div className="val" style={{color:'#f87171'}}>{fmt(remaining)}</div>
                <div className="sub">{pct(quota>0?remaining/quota:0)} left</div>
              </div>
              <div className="sa-stat">
                <div className="lbl">Commission Earned</div>
                <div className="val" style={{color:'#34d399'}}>{fmt(comm)}</div>
                <div className="sub">{c.id==='PS'?'10% of fees':'7% of ARR'}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ArrCalcTab(){
  const [calcCat, setCalcCat] = useState('PS');
  const [calcAmt, setCalcAmt] = useState('');
  const [calcMonth, setCalcMonth] = useState(CM);
  const amt = Number(calcAmt)||0;
  const rem = mrem(Number(calcMonth));
  let arrVal=0, commVal=0, detail='';
  if(calcCat==='PS'){
    arrVal=amt; commVal=amt*CR.PS;
    detail=fmt(amt)+' fee | Commission: '+fmt(amt)+' x 10% = '+fmt(commVal);
  } else {
    arrVal=amt*rem; commVal=arrVal*CR[calcCat];
    detail=fmt(amt)+' MRR x '+rem+' months = '+fmt(arrVal)+' ARR | Commission: '+fmt(arrVal)+' x 7% = '+fmt(commVal);
  }
  return(
    <div>
      <div className="sa-card">
        <h2>ARR Calculator</h2>
        <div style={{fontSize:12,color:'#475569',marginBottom:16,fontStyle:'italic',lineHeight:1.7}}>
          <strong style={{color:'#818cf8'}}>Professional Services:</strong> One-time project fee. Fee is the value — not annualized. Commission = 10% of fee.<br/>
          <strong style={{color:'#38bdf8'}}>FinOps &amp; Managed Services:</strong> Recurring. ARR = MRR x months remaining in the year.<br/>
          January close = 12 months = max ARR. November close = 2 months.
        </div>
        <div className="sa-frow">
          <div><label className="sa-label">Category</label>
            <select className="sa-select" value={calcCat} onChange={e=>setCalcCat(e.target.value)}>
              <option value="PS">Professional Services (one-time fee)</option>
              <option value="FO">FinOps (recurring MRR)</option>
              <option value="MS">Managed Services (recurring MRR)</option>
            </select>
          </div>
          {calcCat==='PS'
            ?<div><label className="sa-label">One-Time Fee ($)</label><input className="sa-input" type="number" value={calcAmt} onChange={e=>setCalcAmt(e.target.value)} placeholder="e.g. 50000"/></div>
            :<div><label className="sa-label">Monthly MRR ($)</label><input className="sa-input" type="number" value={calcAmt} onChange={e=>setCalcAmt(e.target.value)} placeholder="e.g. 8000"/></div>
          }
          {calcCat!=='PS'&&(
            <div><label className="sa-label">Month Closed</label>
              <select className="sa-select" value={calcMonth} onChange={e=>setCalcMonth(Number(e.target.value))}>
                {MN.map((m,i)=><option key={i} value={i+1}>{m} — {13-(i+1)} months remaining</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="sa-g3">
          <div className="sa-stat">
            <div className="lbl">{calcCat==='PS'?'Fee Value':'ARR Value'}</div>
            <div className="val">{fmt(arrVal)}</div>
            <div className="sub">{calcCat==='PS'?'One-time (not annualized)':'MRR x '+rem+' months'}</div>
          </div>
          <div className="sa-stat">
            <div className="lbl">Commission</div>
            <div className="val" style={{color:'#34d399'}}>{fmt(commVal)}</div>
            <div className="sub">{calcCat==='PS'?'10% of fee':'7% of ARR'}</div>
          </div>
          <div className="sa-stat">
            <div className="lbl">{calcCat==='PS'?'Type':'Months Remaining'}</div>
            <div className="val">{calcCat==='PS'?'1x':rem}</div>
            <div className="sub">{calcCat==='PS'?'One-time project':MN[Number(calcMonth)-1]+' close'}</div>
          </div>
        </div>
        {amt>0&&<div className="sa-preview">{detail}</div>}
      </div>
      {calcCat!=='PS'&&(
        <div className="sa-card">
          <h2>Time-Weighted ARR by Month (MRR = {fmt(amt)})</h2>
          <table className="sa-tbl">
            <thead><tr><th>Month</th><th>Months Remaining</th><th>ARR Value</th><th>Commission (7%)</th></tr></thead>
            <tbody>
              {MN.map((m,i)=>{
                const r=mrem(i+1), a=amt*r, c=a*CR[calcCat];
                const isCur=i+1===Number(calcMonth);
                return(
                  <tr key={i} style={isCur?{background:'rgba(99,102,241,.08)'}:{}}>
                    <td style={isCur?{color:'#818cf8',fontWeight:600}:{}}>{m}{isCur?' ◄':''}</td>
                    <td>{r}</td>
                    <td style={{fontWeight:isCur?700:400,color:isCur?'#f1f5f9':'#cbd5e1'}}>{fmt(a)}</td>
                    <td style={{color:'#34d399'}}>{fmt(c)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CommTab({data, filterRep, setFilterRep}){
  const repsFor = filterRep==='All' ? data.reps : data.reps.filter(r=>r.id===filterRep);
  const totalComm = repsFor.reduce((s,r)=>s+repCommission(r).tot,0);
  const earning = repsFor.filter(r=>repCommission(r).tot>0).length;
  return(
    <div>
      <div className="sa-g3">
        <div className="sa-stat"><div className="lbl">Total Commissions</div><div className="val" style={{color:'#34d399'}}>{fmt(totalComm)}</div><div className="sub">based on closed actuals</div></div>
        <div className="sa-stat"><div className="lbl">Reps Earning</div><div className="val">{earning} / {data.reps.length}</div><div className="sub">reps with closed deals</div></div>
        <div className="sa-stat"><div className="lbl">Avg Commission/Rep</div><div className="val">{fmt(data.reps.length>0?totalComm/data.reps.length:0)}</div><div className="sub">across all reps</div></div>
      </div>
      <div className="sa-pills">
        <button className={`sa-pill${filterRep==='All'?' on':''}`} onClick={()=>setFilterRep('All')}>All Reps</button>
        {data.reps.map(r=><button key={r.id} className={`sa-pill${filterRep===r.id?' on':''}`} onClick={()=>setFilterRep(r.id)}>{r.name}</button>)}
      </div>
      <div className="sa-card">
        <table className="sa-tbl">
          <thead><tr><th>Rep</th><th>Dept</th><th>PS Comm (10% of fee)</th><th>FO Comm (7% of ARR)</th><th>MS Comm (7% of ARR)</th><th>Total Commission</th></tr></thead>
          <tbody>
            {data.reps.filter(r=>filterRep==='All'||r.id===filterRep).map(r=>{
              const c = repCommission(r);
              return(
                <tr key={r.id}>
                  <td style={{fontWeight:600,color:'#f1f5f9'}}>{r.name}</td>
                  <td>{r.dept||r.department||'—'}</td>
                  <td>{fmt(c.ps)}</td>
                  <td>{fmt(c.fo)}</td>
                  <td>{fmt(c.ms)}</td>
                  <td style={{fontWeight:700,color:'#34d399'}}>{fmt(c.tot)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsTab({data}){
  const exportCSV = rep => {
    const rows = [['Category','Closed ARR','Quota','Attainment %','Commission']];
    ['PS','FO','MS'].forEach(cat => {
      const closed = getActual(rep, cat);
      const quota = getQuota(rep, cat);
      const comm = repCommission(rep)[cat.toLowerCase()];
      rows.push([CAT_KEYS[cat], closed, quota, quota>0?(closed/quota*100).toFixed(1)+'%':'0%', comm]);
    });
    const csv = rows.map(r=>r.join(',')).join('\n');
    const el = document.createElement('a');
    el.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
    el.download = rep.name.replace(/\s+/g,'_')+'_actuals.csv';
    el.click();
  };
  return(
    <div>
      <div className="sa-card">
        <h2>Export Rep Reports</h2>
        <p style={{color:'#64748b',fontSize:13,marginTop:-8,marginBottom:16}}>Download closed actuals and attainment for each rep as CSV.</p>
        {data.reps.map(r=>{
          const tot = getActual(r,'PS')+getActual(r,'FO')+getActual(r,'MS');
          const comm = repCommission(r).tot;
          return(
            <div key={r.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',background:'#0f172a',borderRadius:10,marginBottom:8,border:'1px solid rgba(255,255,255,.06)'}}>
              <div>
                <div style={{fontWeight:600,color:'#f1f5f9'}}>{r.name}</div>
                <div style={{fontSize:12,color:'#475569',marginTop:3}}>{r.dept||r.department||'—'} | Total Closed: {fmt(tot)} | Commission: {fmt(comm)}</div>
              </div>
              <button className="sa-btn sm" onClick={()=>exportCSV(r)}>Export CSV</button>
            </div>
          );
        })}
        {data.reps.length===0&&<div style={{color:'#475569',textAlign:'center',padding:24}}>No reps added yet.</div>}
      </div>
    </div>
  );
}

function SettingsTab({data, save}){
  const totalClosed = data.reps.reduce((s,r)=>s+getActual(r,'PS')+getActual(r,'FO')+getActual(r,'MS'),0);
  const totalComm = data.reps.reduce((s,r)=>s+repCommission(r).tot,0);
  const totalQuota = data.reps.reduce((s,r)=>s+getQuota(r,'PS')+getQuota(r,'FO')+getQuota(r,'MS'),0);
  return(
    <div>
      <div className="sa-g3">
        <div className="sa-stat"><div className="lbl">Total Closed ARR</div><div className="val" style={{color:'#34d399'}}>{fmt(totalClosed)}</div><div className="sub">across all reps</div></div>
        <div className="sa-stat"><div className="lbl">Total Quota</div><div className="val">{fmt(totalQuota)}</div><div className="sub">combined all reps all categories</div></div>
        <div className="sa-stat"><div className="lbl">Total Commissions</div><div className="val" style={{color:'#34d399'}}>{fmt(totalComm)}</div><div className="sub">based on actuals</div></div>
      </div>
      <div className="sa-card">
        <h2>Commission Rates</h2>
        <div className="sa-g3">
          {[
            {id:'PS',label:'Professional Services',note:'10% of one-time project fee'},
            {id:'FO',label:'FinOps',note:'7% of time-weighted ARR (MRR x months remaining)'},
            {id:'MS',label:'Managed Services',note:'7% of time-weighted ARR (MRR x months remaining)'},
          ].map(c=>(
            <div key={c.id} style={{background:'#0f172a',borderRadius:10,padding:16,border:'1px solid rgba(255,255,255,.06)'}}>
              <div style={{fontSize:11,color:'#475569',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{c.label}</div>
              <div style={{fontSize:22,fontWeight:700,color:'#f1f5f9'}}>{pct(CR[c.id])}</div>
              <div style={{fontSize:11,color:'#818cf8',marginTop:4,fontStyle:'italic'}}>{c.note}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="sa-card">
        <h2>Rep Quotas</h2>
        <table className="sa-tbl">
          <thead><tr><th>Rep</th><th>PS Quota</th><th>FO Quota</th><th>MS Quota</th><th>Total Quota</th></tr></thead>
          <tbody>
            {data.reps.map(r=>(
              <tr key={r.id}>
                <td style={{fontWeight:600,color:'#f1f5f9'}}>{r.name}</td>
                <td>{fmt(getQuota(r,'PS'))}</td>
                <td>{fmt(getQuota(r,'FO'))}</td>
                <td>{fmt(getQuota(r,'MS'))}</td>
                <td style={{fontWeight:600}}>{fmt(getQuota(r,'PS')+getQuota(r,'FO')+getQuota(r,'MS'))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
