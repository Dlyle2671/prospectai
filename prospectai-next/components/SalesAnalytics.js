import React, { useState, useEffect } from 'react';
const SK = 'pai_quotaTracker';
const CQ = { PS: 6500000, FO: 32000000, MS: 1500000 };
const CR = { PS: 0.10, FO: 0.07, MS: 0.07 };
const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CM = new Date().getMonth() + 1;
function mrem(m){ return Math.max(1, 13 - m); }
function fmt(n){ if(!n && n!==0) return '$0'; return '$'+Number(n).toLocaleString('en-US',{maximumFractionDigits:0}); }
function pct(n){ return (n*100).toFixed(1)+'%'; }
function ld(){
  try{
    var r=localStorage.getItem(SK);
    if(r){
      var p=JSON.parse(r);
      return {
        reps:Array.isArray(p.reps)?p.reps:[],
        deals:Array.isArray(p.deals)?p.deals:[],
        actuals:Array.isArray(p.actuals)?p.actuals:[]
      };
    }
  }catch(e){}
  return {reps:[],deals:[],actuals:[]};
}
function sd(d){ try{ localStorage.setItem(SK,JSON.stringify(d)); }catch(e){} }
function nid(){ return Date.now()+'_'+Math.random().toString(36).slice(2); }
function dealARR(d){
  if(d.cat==='PS') return (d.amount||0);
  return (d.mrr||0)*mrem(d.month||CM);
}
function dealComm(d){
  if(d.cat==='PS') return (d.amount||0)*CR.PS;
  if(d.cat==='FO') return (d.mrr||0)*mrem(d.month||CM)*CR.FO;
  if(d.cat==='MS') return (d.mrr||0)*mrem(d.month||CM)*CR.MS;
  return 0;
}
function crs(rep,deals){
  var my=deals.filter(d=>d.repId===rep.id);
  var ps=0,fo=0,ms=0,psc=0,foc=0,msc=0;
  my.forEach(d=>{
    var arr=dealARR(d),com=dealComm(d);
    if(d.cat==='PS'){ps+=arr;psc+=com;}
    else if(d.cat==='FO'){fo+=arr;foc+=com;}
    else if(d.cat==='MS'){ms+=arr;msc+=com;}
  });
  return {ps,fo,ms,psc,foc,msc,deals:my};
}
function repActuals(repId, cat, actuals){
  return actuals.filter(a=>a.repId===repId&&a.cat===cat).reduce((s,a)=>s+(a.arr||0),0);
}
function totalActuals(cat, actuals){
  return actuals.filter(a=>a.cat===cat).reduce((s,a)=>s+(a.arr||0),0);
}

export default function SalesAnalytics({onBack}){
  const [tab,setTab]=useState('dash');
  const [data,setData]=useState(ld());
  const [showAddRep,setShowAddRep]=useState(false);
  const [showAddDeal,setShowAddDeal]=useState(false);
  const [editRep,setEditRep]=useState(null);
  const [editDeal,setEditDeal]=useState(null);
  const [calcCat,setCalcCat]=useState('PS');
  const [calcAmt,setCalcAmt]=useState('');
  const [calcMonth,setCalcMonth]=useState(CM);
  const [filterCat,setFilterCat]=useState('All');
  const [filterRep,setFilterRep]=useState('All');
  const [rf,setRf]=useState({name:'',dept:''});
  const [df,setDf]=useState({repId:'',cat:'PS',client:'',month:CM,amount:'',mrr:''});
  const save=d=>{sd(d);setData(JSON.parse(JSON.stringify(d)));};
  const actuals=data.actuals||[];
  const totalComm=data.deals.reduce((a,d)=>a+dealComm(d),0);
  const dashCards=[
    {id:'PS',label:'Professional Services',color:'#6366f1',quota:CQ.PS,actArr:totalActuals('PS',actuals),note:'One-time project fee | Commission: 10% of fee'},
    {id:'FO',label:'FinOps',color:'#0ea5e9',quota:CQ.FO,actArr:totalActuals('FO',actuals),note:'Recurring MRR x months remaining = ARR | Commission: 7% x ARR'},
    {id:'MS',label:'Managed Services',color:'#10b981',quota:CQ.MS,actArr:totalActuals('MS',actuals),note:'Recurring MRR x months remaining = ARR | Commission: 7% x ARR'},
  ];
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
    .sa-act-row{background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.15);border-radius:8px;padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;}
  `}</style>
  <div className="sa">
    <div className="sa-hd"><h1>Sales Analytics</h1><button className="sa-x" onClick={()=>onBack&&onBack()}>Back to Home</button></div>
    <div className="sa-tabs">
      {[['dash','Dashboard'],['reps','Reps'],['deals','Pipeline'],['actuals','Actuals'],['catperf','Category Performance'],['arrcalc','ARR Calc'],['comm','Commissions'],['reports','Reports'],['settings','Settings']].map(([id,label])=>(
        <button key={id} className={`sa-tab${tab===id?' on':''}`} onClick={()=>setTab(id)}>{label}</button>
      ))}
    </div>
    <div className="sa-body">
      {tab==='dash'&&<DashTab data={data} dashCards={dashCards} totalComm={totalComm}/>}
      {tab==='reps'&&<RepsTab data={data} save={save} showAddRep={showAddRep} setShowAddRep={setShowAddRep} editRep={editRep} setEditRep={setEditRep} rf={rf} setRf={setRf}/>}
      {tab==='deals'&&<DealsTab data={data} save={save} showAddDeal={showAddDeal} setShowAddDeal={setShowAddDeal} editDeal={editDeal} setEditDeal={setEditDeal} df={df} setDf={setDf} filterCat={filterCat} setFilterCat={setFilterCat}/>}
      {tab==='actuals'&&<ActualsTab data={data} save={save}/>}
      {tab==='catperf'&&<CatPerfTab data={data} filterRep={filterRep} setFilterRep={setFilterRep}/>}
      {tab==='arrcalc'&&<ArrCalcTab calcCat={calcCat} setCalcCat={setCalcCat} calcAmt={calcAmt} setCalcAmt={setCalcAmt} calcMonth={calcMonth} setCalcMonth={setCalcMonth}/>}
      {tab==='comm'&&<CommTab data={data} filterRep={filterRep} setFilterRep={setFilterRep}/>}
      {tab==='reports'&&<ReportsTab data={data}/>}
      {tab==='settings'&&<SettingsTab data={data} save={save}/>}
    </div>
  </div>
  </>);
}

function DashTab({data,dashCards,totalComm}){
  const actuals=data.actuals||[];
  const totalQuota=CQ.PS+CQ.FO+CQ.MS;
  const totalActualARR=totalActuals('PS',actuals)+totalActuals('FO',actuals)+totalActuals('MS',actuals);
  return(
    <div>
      <div className="sa-g3">
        {dashCards.map(c=>{
          const pAct=c.quota>0?Math.min(1,c.actArr/c.quota):0;
          const pace=CM/12;
          const behind=c.actArr<c.quota*pace;
          return(
            <div className="sa-stat" key={c.id}>
              <div className="lbl">{c.label}</div>
              <div className="val" style={{color:'#34d399'}}>{fmt(c.actArr)}</div>
              <div className="sub">of {fmt(c.quota)} annual quota ({pct(pAct)} attained)</div>
              <div className="note">{c.note}</div>
              <div className="sa-bar"><div className="sa-bar-fill" style={{width:pAct*100+'%',background:'#34d399'}}/></div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
                <span style={{fontSize:11,color:'#475569'}}>Pace: {pct(pace)}</span>
                <span className={`sa-badge ${behind?'behind':'ahead'}`}>{behind?'Behind':'On Track'}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="sa-g2">
        <div className="sa-stat">
          <div className="lbl">Total Closed ARR</div>
          <div className="val" style={{color:'#34d399'}}>{fmt(totalActualARR)}</div>
          <div className="sub">of {fmt(totalQuota)} combined quota ({pct(totalQuota>0?totalActualARR/totalQuota:0)} attained)</div>
          <div className="sa-bar"><div className="sa-bar-fill" style={{width:Math.min(100,totalActualARR/totalQuota*100)+'%',background:'#34d399'}}/></div>
        </div>
        <div className="sa-stat">
          <div className="lbl">Total Commissions</div>
          <div className="val">{fmt(totalComm)}</div>
          <div className="sub">pipeline | {data.reps.length} reps</div>
        </div>
      </div>
      <div className="sa-card">
        <h2>Rep Summary</h2>
        <table className="sa-tbl">
          <thead><tr><th>Rep</th><th>Dept</th><th>PS Closed</th><th>FO Closed</th><th>MS Closed</th><th>Total Closed</th><th>Attainment</th><th>Status</th></tr></thead>
          <tbody>
            {data.reps.map(r=>{
              const psAct=repActuals(r.id,'PS',actuals);
              const foAct=repActuals(r.id,'FO',actuals);
              const msAct=repActuals(r.id,'MS',actuals);
              const totAct=psAct+foAct+msAct;
              const avgQ=(CQ.PS+CQ.FO+CQ.MS)/Math.max(1,data.reps.length);
              const behind=totAct<avgQ*(CM/12);
              return(
                <tr key={r.id}>
                  <td style={{fontWeight:600,color:'#f1f5f9'}}>{r.name}</td>
                  <td>{r.dept||'—'}</td>
                  <td style={{color:'#34d399'}}>{fmt(psAct)}</td>
                  <td style={{color:'#34d399'}}>{fmt(foAct)}</td>
                  <td style={{color:'#34d399'}}>{fmt(msAct)}</td>
                  <td style={{fontWeight:700,color:'#34d399'}}>{fmt(totAct)}</td>
                  <td><span style={{fontSize:12,color:'#a5b4fc'}}>{pct(avgQ>0?totAct/avgQ:0)}</span></td>
                  <td><span className={`sa-badge ${behind?'behind':'ahead'}`}>{behind?'Behind':'On Track'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActualsTab({data,save}){
  const CM2=new Date().getMonth()+1;
  const [showForm,setShowForm]=useState(false);
  const [editActual,setEditActual]=useState(null);
  const [af,setAf]=useState({repId:'',cat:'PS',month:CM2,arr:'',note:''});
  const actuals=data.actuals||[];

  const submit=()=>{
    if(!af.repId||!af.arr) return;
    const d=JSON.parse(JSON.stringify(data));
    if(!Array.isArray(d.actuals)) d.actuals=[];
    const entry={
      id:editActual?editActual.id:nid(),
      repId:af.repId,
      cat:af.cat,
      month:Number(af.month),
      arr:Number(af.arr)||0,
      note:af.note||''
    };
    if(editActual){
      d.actuals=d.actuals.map(a=>a.id===editActual.id?entry:a);
      setEditActual(null);
    } else {
      d.actuals=[...d.actuals,entry];
    }
    save(d);
    setAf({repId:'',cat:'PS',month:CM2,arr:'',note:''});
    setShowForm(false);
  };

  const del=id=>{
    if(!window.confirm('Delete actual entry?'))return;
    const d=JSON.parse(JSON.stringify(data));
    if(!Array.isArray(d.actuals)) d.actuals=[];
    d.actuals=d.actuals.filter(a=>a.id!==id);
    save(d);
  };

  const startEdit=a=>{
    setEditActual(a);
    setAf({repId:a.repId,cat:a.cat,month:a.month,arr:a.arr,note:a.note||''});
    setShowForm(true);
  };

  const catList=[
    {id:'PS',label:'Professional Services',color:'#6366f1',quota:CQ.PS},
    {id:'FO',label:'FinOps',color:'#0ea5e9',quota:CQ.FO},
    {id:'MS',label:'Managed Services',color:'#10b981',quota:CQ.MS},
  ];

  return(
    <div>
      <div style={{background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.2)',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#6ee7b7',lineHeight:1.6}}>
        <strong>Actuals</strong> are real closed deal amounts entered when a deal closes. Quota attainment = Actuals / Annual Quota.
        <br/>PS: enter the one-time project fee. FO/MS: enter MRR x months remaining in the year.
      </div>
      <div className="sa-shd">
        <div/>
        <button className="sa-btn" onClick={()=>{setShowForm(!showForm);setEditActual(null);setAf({repId:'',cat:'PS',month:CM2,arr:'',note:''});}}>+ Add Actual</button>
      </div>
      {showForm&&(
        <div className="sa-card" style={{marginBottom:16}}>
          <h2>{editActual?'Edit Actual':'Enter Actual'}</h2>
          <div className="sa-frow">
            <div>
              <label className="sa-label">Rep</label>
              <select className="sa-select" value={af.repId} onChange={e=>setAf(prev=>({...prev,repId:e.target.value}))}>
                <option value="">Select rep...</option>
                {data.reps.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="sa-label">Category</label>
              <select className="sa-select" value={af.cat} onChange={e=>setAf(prev=>({...prev,cat:e.target.value}))}>
                <option value="PS">Professional Services</option>
                <option value="FO">FinOps</option>
                <option value="MS">Managed Services</option>
              </select>
            </div>
            <div>
              <label className="sa-label">Month Closed</label>
              <select className="sa-select" value={af.month} onChange={e=>setAf(prev=>({...prev,month:e.target.value}))}>
                {MN.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="sa-frow">
            <div>
              <label className="sa-label">{af.cat==='PS'?'Project Fee ($)':'ARR Amount ($)'}</label>
              <input className="sa-input" type="number" value={af.arr} onChange={e=>setAf(prev=>({...prev,arr:e.target.value}))} placeholder={af.cat==='PS'?'e.g. 50000':'e.g. 96000'}/>
              <div style={{fontSize:11,color:'#475569',marginTop:4}}>
                {af.cat==='PS'
                  ?'PS: enter the one-time project fee amount. Commission = fee x 10%.'
                  :'FO/MS: enter MRR x months remaining. E.g. $8k MRR closed Jan = $8,000 x 12 = $96,000.'}
              </div>
            </div>
            <div>
              <label className="sa-label">Notes (optional)</label>
              <input className="sa-input" value={af.note} onChange={e=>setAf(prev=>({...prev,note:e.target.value}))} placeholder="e.g. Acme Corp project"/>
            </div>
            <div style={{display:'flex',alignItems:'flex-end',gap:8}}>
              <button className="sa-btn" onClick={submit}>{editActual?'Save':'Add'}</button>
              <button className="sa-btn del sm" onClick={()=>{setShowForm(false);setEditActual(null);}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <div className="sa-g3" style={{marginBottom:16}}>
        {catList.map(c=>{
          const act=totalActuals(c.id,actuals);
          const p=c.quota>0?Math.min(1,act/c.quota):0;
          const pace=CM/12;
          return(
            <div className="sa-stat" key={c.id}>
              <div className="lbl">{c.label}</div>
              <div className="val" style={{color:c.color}}>{fmt(act)}</div>
              <div className="sub">of {fmt(c.quota)} annual quota</div>
              <div className="sa-bar"><div className="sa-bar-fill" style={{width:p*100+'%',background:c.color}}/></div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
                <span style={{fontSize:11,color:'#a5b4fc',fontWeight:600}}>{pct(p)} attained</span>
                <span style={{fontSize:11,color:'#475569'}}>Pace: {pct(pace)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="sa-card">
        <h2>Quota Attainment by Rep</h2>
        <table className="sa-tbl">
          <thead>
            <tr>
              <th>Rep</th><th>Dept</th>
              <th>PS Closed</th><th>PS Quota</th><th>PS %</th>
              <th>FO Closed</th><th>FO Quota</th><th>FO %</th>
              <th>MS Closed</th><th>MS Quota</th><th>MS %</th>
              <th>Total Closed</th>
            </tr>
          </thead>
          <tbody>
            {data.reps.map(r=>{
              const psQ=CQ.PS/Math.max(1,data.reps.length);
              const foQ=CQ.FO/Math.max(1,data.reps.length);
              const msQ=CQ.MS/Math.max(1,data.reps.length);
              const psA=repActuals(r.id,'PS',actuals);
              const foA=repActuals(r.id,'FO',actuals);
              const msA=repActuals(r.id,'MS',actuals);
              const tot=psA+foA+msA;
              return(
                <tr key={r.id}>
                  <td style={{fontWeight:600,color:'#f1f5f9'}}>{r.name}</td>
                  <td>{r.dept||'—'}</td>
                  <td style={{color:'#34d399'}}>{fmt(psA)}</td>
                  <td style={{color:'#475569'}}>{fmt(psQ)}</td>
                  <td><span className={`sa-badge ${psA>=psQ*(CM/12)?'ahead':'behind'}`}>{pct(psQ>0?psA/psQ:0)}</span></td>
                  <td style={{color:'#34d399'}}>{fmt(foA)}</td>
                  <td style={{color:'#475569'}}>{fmt(foQ)}</td>
                  <td><span className={`sa-badge ${foA>=foQ*(CM/12)?'ahead':'behind'}`}>{pct(foQ>0?foA/foQ:0)}</span></td>
                  <td style={{color:'#34d399'}}>{fmt(msA)}</td>
                  <td style={{color:'#475569'}}>{fmt(msQ)}</td>
                  <td><span className={`sa-badge ${msA>=msQ*(CM/12)?'ahead':'behind'}`}>{pct(msQ>0?msA/msQ:0)}</span></td>
                  <td style={{fontWeight:700,color:'#34d399'}}>{fmt(tot)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="sa-card">
        <h2>Actuals Log</h2>
        {actuals.length===0&&<div style={{color:'#475569',textAlign:'center',padding:24}}>No actuals entered yet. Click "+ Add Actual" to log closed deals.</div>}
        <table className="sa-tbl">
          <thead><tr><th>Rep</th><th>Category</th><th>Month</th><th>Amount</th><th>Notes</th><th>Actions</th></tr></thead>
          <tbody>
            {actuals.map(a=>{
              const rep=data.reps.find(r=>r.id===a.repId);
              const catColor=a.cat==='PS'?'#818cf8':a.cat==='FO'?'#38bdf8':'#34d399';
              const catBg=a.cat==='PS'?'rgba(99,102,241,.2)':a.cat==='FO'?'rgba(14,165,233,.2)':'rgba(16,185,129,.2)';
              return(
                <tr key={a.id}>
                  <td style={{fontWeight:600,color:'#f1f5f9'}}>{rep?rep.name:'Unknown'}</td>
                  <td><span style={{background:catBg,color:catColor,padding:'2px 8px',borderRadius:12,fontSize:11,fontWeight:600}}>{a.cat}</span></td>
                  <td>{MN[(a.month||1)-1]}</td>
                  <td style={{fontWeight:700,color:'#34d399'}}>{fmt(a.arr)}</td>
                  <td style={{color:'#64748b'}}>{a.note||'—'}</td>
                  <td style={{display:'flex',gap:6}}>
                    <button className="sa-btn sm" onClick={()=>startEdit(a)}>Edit</button>
                    <button className="sa-btn del sm" onClick={()=>del(a.id)}>Del</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RepsTab({data,save,showAddRep,setShowAddRep,editRep,setEditRep,rf,setRf}){
  const submit=()=>{
    if(!rf.name.trim()) return;
    const d=JSON.parse(JSON.stringify(data));
    if(editRep){d.reps=d.reps.map(r=>r.id===editRep.id?{...r,...rf}:r);setEditRep(null);}
    else d.reps=[...d.reps,{id:nid(),...rf}];
    save(d);setRf({name:'',dept:''});setShowAddRep(false);
  };
  const del=id=>{if(!window.confirm('Delete rep?'))return;const d=JSON.parse(JSON.stringify(data));d.reps=d.reps.filter(r=>r.id!==id);save(d);};
  const startEdit=r=>{setEditRep(r);setRf({name:r.name,dept:r.dept||''});setShowAddRep(true);};
  const actuals=data.actuals||[];
  return(
    <div>
      <div className="sa-shd">
        <div/>
        <button className="sa-btn" onClick={()=>{setShowAddRep(!showAddRep);setEditRep(null);setRf({name:'',dept:''});}}>+ Add Rep</button>
      </div>
      {showAddRep&&(
        <div className="sa-card" style={{marginBottom:16}}>
          <h2>{editRep?'Edit Rep':'New Rep'}</h2>
          <div className="sa-frow">
            <div><label className="sa-label">Name</label><input className="sa-input" value={rf.name} onChange={e=>setRf({...rf,name:e.target.value})} placeholder="Full name"/></div>
            <div><label className="sa-label">Department</label><input className="sa-input" value={rf.dept} onChange={e=>setRf({...rf,dept:e.target.value})} placeholder="e.g. Sales, PS, FinOps"/></div>
            <div style={{display:'flex',alignItems:'flex-end',gap:8}}>
              <button className="sa-btn" onClick={submit}>{editRep?'Save':'Add Rep'}</button>
              <button className="sa-btn del sm" onClick={()=>{setShowAddRep(false);setEditRep(null);}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <div className="sa-card">
        <table className="sa-tbl">
          <thead><tr><th>Name</th><th>Dept</th><th>PS Closed</th><th>FO Closed</th><th>MS Closed</th><th>Total Closed</th></tr></thead>
          <tbody>
            {data.reps.map(r=>{
              const psA=repActuals(r.id,'PS',actuals);
              const foA=repActuals(r.id,'FO',actuals);
              const msA=repActuals(r.id,'MS',actuals);
              const tot=psA+foA+msA;
              return(
                <tr key={r.id}>
                  <td style={{fontWeight:600,color:'#f1f5f9'}}>{r.name}</td>
                  <td>{r.dept||'—'}</td>
                  <td style={{color:'#34d399'}}>{fmt(psA)}</td>
                  <td style={{color:'#34d399'}}>{fmt(foA)}</td>
                  <td style={{color:'#34d399'}}>{fmt(msA)}</td>
                  <td style={{fontWeight:700,color:'#34d399'}}>{fmt(tot)}</td>
                  <td style={{display:'flex',gap:6}}>
                    <button className="sa-btn sm" onClick={()=>startEdit(r)}>Edit</button>
                    <button className="sa-btn del sm" onClick={()=>del(r.id)}>Del</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DealsTab({data,save,showAddDeal,setShowAddDeal,editDeal,setEditDeal,df,setDf,filterCat,setFilterCat}){
  const submit=()=>{
    if(!df.client.trim()||!df.repId) return;
    const d=JSON.parse(JSON.stringify(data));
    const entry={
      id:editDeal?editDeal.id:nid(),
      repId:df.repId,cat:df.cat,client:df.client,
      month:Number(df.month),
      amount:df.cat==='PS'?Number(df.amount)||0:0,
      mrr:df.cat!=='PS'?Number(df.mrr)||0:0,
    };
    if(editDeal){d.deals=d.deals.map(x=>x.id===editDeal.id?entry:x);setEditDeal(null);}
    else d.deals=[...d.deals,entry];
    save(d);setDf({repId:'',cat:'PS',client:'',month:CM,amount:'',mrr:''});setShowAddDeal(false);
  };
  const del=id=>{if(!window.confirm('Delete deal?'))return;const d=JSON.parse(JSON.stringify(data));d.deals=d.deals.filter(x=>x.id!==id);save(d);};
  const startEdit=deal=>{setEditDeal(deal);setDf({repId:deal.repId,cat:deal.cat,client:deal.client,month:deal.month,amount:deal.amount||'',mrr:deal.mrr||''});setShowAddDeal(true);};
  const filtered=filterCat==='All'?data.deals:data.deals.filter(d=>d.cat===filterCat);
  const rem=mrem(Number(df.month));
  return(
    <div>
      <div style={{background:'rgba(99,102,241,.08)',border:'1px solid rgba(99,102,241,.2)',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#a5b4fc',lineHeight:1.6}}>
        <strong>Pipeline / Forecast</strong> — track expected upcoming deals here. When a deal closes, log it in the <strong>Actuals</strong> tab instead.
      </div>
      <div className="sa-pills">
        {['All','PS','FO','MS'].map(c=>(
          <button key={c} className={`sa-pill${filterCat===c?' on':''}`} onClick={()=>setFilterCat(c)}>
            {c==='All'?'All':c==='PS'?'Professional Services':c==='FO'?'FinOps':'Managed Services'}
          </button>
        ))}
        <button className="sa-btn" style={{marginLeft:'auto'}} onClick={()=>{setShowAddDeal(!showAddDeal);setEditDeal(null);setDf({repId:'',cat:'PS',client:'',month:CM,amount:'',mrr:''});}}>+ Add Deal</button>
      </div>
      {showAddDeal&&(
        <div className="sa-card" style={{marginBottom:16}}>
          <h2>{editDeal?'Edit Deal':'New Deal'}</h2>
          <div className="sa-frow">
            <div><label className="sa-label">Rep</label>
              <select className="sa-select" value={df.repId} onChange={e=>setDf({...df,repId:e.target.value})}>
                <option value="">Select rep...</option>
                {data.reps.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div><label className="sa-label">Category</label>
              <select className="sa-select" value={df.cat} onChange={e=>setDf({...df,cat:e.target.value})}>
                <option value="PS">Professional Services (one-time fee)</option>
                <option value="FO">FinOps (recurring MRR)</option>
                <option value="MS">Managed Services (recurring MRR)</option>
              </select>
            </div>
            <div><label className="sa-label">Client</label><input className="sa-input" value={df.client} onChange={e=>setDf({...df,client:e.target.value})} placeholder="Client name"/></div>
          </div>
          <div className="sa-frow">
            <div><label className="sa-label">Month Expected Close</label>
              <select className="sa-select" value={df.month} onChange={e=>setDf({...df,month:e.target.value})}>
                {MN.map((m,i)=><option key={i} value={i+1}>{m} ({13-(i+1)} months remaining)</option>)}
              </select>
            </div>
            {df.cat==='PS'
              ?<div><label className="sa-label">One-Time Fee ($)</label><input className="sa-input" type="number" value={df.amount} onChange={e=>setDf({...df,amount:e.target.value})} placeholder="e.g. 50000"/></div>
              :<div><label className="sa-label">Monthly MRR ($)</label><input className="sa-input" type="number" value={df.mrr} onChange={e=>setDf({...df,mrr:e.target.value})} placeholder="e.g. 8000"/></div>
            }
            <div style={{display:'flex',alignItems:'flex-end',gap:8}}>
              <button className="sa-btn" onClick={submit}>{editDeal?'Save':'Add Deal'}</button>
              <button className="sa-btn del sm" onClick={()=>{setShowAddDeal(false);setEditDeal(null);}}>Cancel</button>
            </div>
          </div>
          {df.cat==='PS'&&df.amount&&<div className="sa-preview">Fee: {fmt(Number(df.amount))} | Est. Commission = {fmt(Number(df.amount)*CR.PS)} (10% of fee)</div>}
          {df.cat!=='PS'&&df.mrr&&<div className="sa-preview">ARR = {fmt(Number(df.mrr)*rem)} ({rem} months remaining x {fmt(Number(df.mrr))} MRR) | Est. Commission = {fmt(Number(df.mrr)*rem*CR[df.cat])} ({pct(CR[df.cat])})</div>}
        </div>
      )}
      <div className="sa-card">
        <table className="sa-tbl">
          <thead><tr><th>Rep</th><th>Cat</th><th>Client</th><th>Month</th><th>Amount/MRR</th><th>Est. Value</th><th>Est. Commission</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length===0&&<tr><td colSpan={8} style={{textAlign:'center',color:'#475569',padding:24}}>No pipeline deals yet</td></tr>}
            {filtered.map(d=>{
              const rep=data.reps.find(r=>r.id===d.repId);
              const arr=dealARR(d),com=dealComm(d);
              const catColor=d.cat==='PS'?'#818cf8':d.cat==='FO'?'#38bdf8':'#34d399';
              const catBg=d.cat==='PS'?'rgba(99,102,241,.2)':d.cat==='FO'?'rgba(14,165,233,.2)':'rgba(16,185,129,.2)';
              return(
                <tr key={d.id}>
                  <td>{rep?rep.name:'Unknown'}</td>
                  <td><span style={{background:catBg,color:catColor,padding:'2px 8px',borderRadius:12,fontSize:11,fontWeight:600}}>{d.cat}</span></td>
                  <td>{d.client}</td>
                  <td>{MN[(d.month||1)-1]}</td>
                  <td>{d.cat==='PS'?fmt(d.amount)+' (fee)':fmt(d.mrr)+'/mo'}</td>
                  <td style={{fontWeight:600,color:'#f1f5f9'}}>{fmt(arr)}</td>
                  <td style={{color:'#34d399'}}>{fmt(com)}</td>
                  <td style={{display:'flex',gap:6}}>
                    <button className="sa-btn sm" onClick={()=>startEdit(d)}>Edit</button>
                    <button className="sa-btn del sm" onClick={()=>del(d.id)}>Del</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CatPerfTab({data,filterRep,setFilterRep}){
  const actualsFor=filterRep==='All'?(data.actuals||[]):(data.actuals||[]).filter(a=>a.repId===filterRep);
  const cats=[
    {id:'PS',label:'Professional Services',color:'#6366f1',quota:CQ.PS,calcNote:'One-time project fee (not annualized)',rateNote:'Commission: 10% of fee amount'},
    {id:'FO',label:'FinOps',color:'#0ea5e9',quota:CQ.FO,calcNote:'ARR = MRR x months remaining in year',rateNote:'Commission: 7% of time-weighted ARR'},
    {id:'MS',label:'Managed Services',color:'#10b981',quota:CQ.MS,calcNote:'ARR = MRR x months remaining in year',rateNote:'Commission: 7% of time-weighted ARR'},
  ];
  return(
    <div>
      <div className="sa-pills">
        <button className={`sa-pill${filterRep==='All'?' on':''}`} onClick={()=>setFilterRep('All')}>All Reps</button>
        {data.reps.map(r=><button key={r.id} className={`sa-pill${filterRep===r.id?' on':''}`} onClick={()=>setFilterRep(r.id)}>{r.name}</button>)}
      </div>
      {cats.map(c=>{
        const act=actualsFor.filter(a=>a.cat===c.id).reduce((s,a)=>s+(a.arr||0),0);
        const pAct=c.quota>0?Math.min(1,act/c.quota):0;
        return(
          <div className="sa-card" key={c.id}>
            <h2 style={{color:c.color}}>{c.label}</h2>
            <div style={{fontSize:11,color:'#475569',marginTop:-10,marginBottom:14,fontStyle:'italic'}}>{c.calcNote} | {c.rateNote}</div>
            <div className="sa-g2">
              <div className="sa-stat">
                <div className="lbl">Closed ARR</div>
                <div className="val" style={{color:'#34d399'}}>{fmt(act)}</div>
                <div className="sub">of {fmt(c.quota)} annual quota</div>
                <div className="sa-bar"><div className="sa-bar-fill" style={{width:pAct*100+'%',background:'#34d399'}}/></div>
                <div style={{fontSize:11,color:'#475569',marginTop:4}}>{pct(pAct)} attained | Pace: {pct(CM/12)}</div>
              </div>
              <div className="sa-stat">
                <div className="lbl">Remaining to Quota</div>
                <div className="val" style={{color:'#f87171'}}>{fmt(Math.max(0,c.quota-act))}</div>
                <div className="sub">{pct(Math.max(0,1-pAct))} remaining</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ArrCalcTab({calcCat,setCalcCat,calcAmt,setCalcAmt,calcMonth,setCalcMonth}){
  const amt=Number(calcAmt)||0;
  const rem=mrem(Number(calcMonth));
  let arrVal=0,commVal=0,detail='';
  if(calcCat==='PS'){
    arrVal=amt; commVal=amt*CR.PS;
    detail=fmt(amt)+' fee | Commission: '+fmt(amt)+' x 10% = '+fmt(commVal);
  } else {
    arrVal=amt*rem; commVal=arrVal*CR[calcCat];
    detail=fmt(amt)+' MRR x '+rem+' months remaining = '+fmt(arrVal)+' ARR | Commission: '+pct(CR[calcCat])+' x '+fmt(arrVal)+' = '+fmt(commVal);
  }
  return(
    <div>
      <div className="sa-card">
        <h2>ARR Calculator</h2>
        <div style={{fontSize:12,color:'#475569',marginBottom:16,fontStyle:'italic',lineHeight:1.6}}>
          <strong style={{color:'#818cf8'}}>Professional Services:</strong> One-time project fee. Fee is the value — NOT annualized. Commission = 10% of fee.<br/>
          <strong style={{color:'#38bdf8'}}>FinOps &amp; Managed Services:</strong> Recurring monthly revenue. ARR = MRR x months remaining in the year.<br/>
          A deal closed in <strong>January</strong> = 12 months = maximum ARR. A deal closed in <strong>November</strong> = 2 months = much lower ARR.
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
            <div className="sub">{calcCat==='PS'?'One-time fee (not annualized)':'MRR x '+rem+' months'}</div>
          </div>
          <div className="sa-stat">
            <div className="lbl">Commission Earned</div>
            <div className="val" style={{color:'#34d399'}}>{fmt(commVal)}</div>
            <div className="sub">{calcCat==='PS'?'10% of fee':pct(CR[calcCat])+' of ARR'}</div>
          </div>
          <div className="sa-stat">
            <div className="lbl">{calcCat==='PS'?'Type':'Months Remaining'}</div>
            <div className="val">{calcCat==='PS'?'1x':rem}</div>
            <div className="sub">{calcCat==='PS'?'One-time, not recurring':MN[Number(calcMonth)-1]+' -> '+rem+' months'}</div>
          </div>
        </div>
        {amt>0&&<div className="sa-preview">{detail}</div>}
      </div>
      {calcCat!=='PS'&&(
        <div className="sa-card">
          <h2>Time-Weighted ARR by Month (MRR = {fmt(amt)})</h2>
          <div style={{fontSize:11,color:'#475569',marginBottom:12}}>Earlier deals = more months = higher ARR contribution.</div>
          <table className="sa-tbl">
            <thead><tr><th>Month</th><th>Months Remaining</th><th>ARR Value</th><th>Commission ({pct(CR[calcCat])})</th></tr></thead>
            <tbody>
              {MN.map((m,i)=>{
                const r=mrem(i+1),a=amt*r,c=a*CR[calcCat];
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

function CommTab({data,filterRep,setFilterRep}){
  const actuals=data.actuals||[];
  const totalActARR=totalActuals('PS',actuals)+totalActuals('FO',actuals)+totalActuals('MS',actuals);
  // Commissions based on actuals for PS (10% of fee), FO/MS (7% of ARR)
  function actComm(repId){
    const ps=repActuals(repId,'PS',actuals)*CR.PS;
    const fo=repActuals(repId,'FO',actuals)*CR.FO;
    const ms=repActuals(repId,'MS',actuals)*CR.MS;
    return {ps,fo,ms,tot:ps+fo+ms};
  }
  const totalComm=data.reps.reduce((s,r)=>s+actComm(r.id).tot,0);
  const earning=data.reps.filter(r=>actComm(r.id).tot>0).length;
  const avgComm=data.reps.length>0?totalComm/data.reps.length:0;
  return(
    <div>
      <div className="sa-g3">
        <div className="sa-stat"><div className="lbl">Total Commissions</div><div className="val">{fmt(totalComm)}</div><div className="sub">based on closed actuals</div></div>
        <div className="sa-stat"><div className="lbl">Reps Earning</div><div className="val">{earning} / {data.reps.length}</div><div className="sub">reps with closed deals</div></div>
        <div className="sa-stat"><div className="lbl">Avg Commission/Rep</div><div className="val">{fmt(avgComm)}</div><div className="sub">across all reps</div></div>
      </div>
      <div className="sa-pills">
        <button className={`sa-pill${filterRep==='All'?' on':''}`} onClick={()=>setFilterRep('All')}>All Reps</button>
        {data.reps.map(r=><button key={r.id} className={`sa-pill${filterRep===r.id?' on':''}`} onClick={()=>setFilterRep(r.id)}>{r.name}</button>)}
      </div>
      <div className="sa-card">
        <table className="sa-tbl">
          <thead><tr><th>Rep</th><th>Dept</th><th>PS Comm (10% of fee)</th><th>FO Comm (7% of ARR)</th><th>MS Comm (7% of ARR)</th><th>Total</th></tr></thead>
          <tbody>
            {data.reps.filter(r=>filterRep==='All'||r.id===filterRep).map(r=>{
              const c=actComm(r.id);
              return(
                <tr key={r.id}>
                  <td style={{fontWeight:600,color:'#f1f5f9'}}>{r.name}</td>
                  <td>{r.dept||'—'}</td>
                  <td>{fmt(c.ps)}</td><td>{fmt(c.fo)}</td><td>{fmt(c.ms)}</td>
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
  const actuals=data.actuals||[];
  const exportCSV=rep=>{
    const repActualsData=actuals.filter(a=>a.repId===rep.id);
    const rows=[['Category','Month','Amount','Notes']];
    repActualsData.forEach(a=>{
      rows.push([a.cat,MN[(a.month||1)-1],a.arr,a.note||'']);
    });
    const csv=rows.map(r=>r.join(',')).join('\n');
    const el=document.createElement('a');
    el.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
    el.download=rep.name.replace(/\s+/g,'_')+'_actuals.csv';
    el.click();
  };
  return(
    <div>
      <div className="sa-card">
        <h2>Export Actuals by Rep</h2>
        <p style={{color:'#64748b',fontSize:13,marginTop:-8,marginBottom:16}}>Download closed deal actuals for each rep as CSV.</p>
        {data.reps.map(r=>{
          const repActs=actuals.filter(a=>a.repId===r.id);
          const tot=repActs.reduce((s,a)=>s+(a.arr||0),0);
          return(
            <div key={r.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',background:'#0f172a',borderRadius:10,marginBottom:8,border:'1px solid rgba(255,255,255,.06)'}}>
              <div>
                <div style={{fontWeight:600,color:'#f1f5f9'}}>{r.name}</div>
                <div style={{fontSize:12,color:'#475569',marginTop:3}}>{r.dept||'No dept'} | {repActs.length} closed entries | Total closed: {fmt(tot)}</div>
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

function SettingsTab({data,save}){
  const actuals=data.actuals||[];
  const totalClosed=actuals.reduce((s,a)=>s+(a.arr||0),0);
  return(
    <div>
      <div className="sa-g2">
        <div className="sa-card">
          <h2>Company Annual Quotas</h2>
          {[{id:'PS',label:'Professional Services',color:'#6366f1'},{id:'FO',label:'FinOps',color:'#0ea5e9'},{id:'MS',label:'Managed Services',color:'#10b981'}].map(c=>(
            <div key={c.id} style={{background:'#0f172a',borderRadius:10,padding:16,marginBottom:10,border:'1px solid rgba(255,255,255,.06)'}}>
              <div style={{fontWeight:700,color:c.color,fontSize:11,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{c.label}</div>
              <div style={{fontSize:26,fontWeight:700,color:'#f1f5f9'}}>{fmt(CQ[c.id])}</div>
              <div style={{fontSize:11,color:'#475569',marginTop:2}}>Annual Quota</div>
            </div>
          ))}
        </div>
        <div className="sa-card">
          <h2>Data Summary</h2>
          <div style={{background:'#0f172a',borderRadius:10,padding:16,marginBottom:10,border:'1px solid rgba(255,255,255,.06)'}}>
            <div style={{fontSize:11,color:'#475569',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Reps</div>
            <div style={{fontSize:26,fontWeight:700,color:'#f1f5f9'}}>{data.reps.length}</div>
          </div>
          <div style={{background:'#0f172a',borderRadius:10,padding:16,marginBottom:10,border:'1px solid rgba(255,255,255,.06)'}}>
            <div style={{fontSize:11,color:'#475569',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Closed Actuals</div>
            <div style={{fontSize:26,fontWeight:700,color:'#34d399'}}>{actuals.length}</div>
            <div style={{fontSize:12,color:'#475569',marginTop:2}}>Total Closed: {fmt(totalClosed)}</div>
          </div>
          <div style={{background:'#0f172a',borderRadius:10,padding:16,marginBottom:10,border:'1px solid rgba(255,255,255,.06)'}}>
            <div style={{fontSize:11,color:'#475569',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Pipeline Deals</div>
            <div style={{fontSize:26,fontWeight:700,color:'#f1f5f9'}}>{data.deals.length}</div>
          </div>
        </div>
      </div>
      <div className="sa-card">
        <h2>Commission Rates</h2>
        <div className="sa-g3">
          {[
            {id:'PS',label:'Professional Services',note:'10% of one-time fee amount'},
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
    </div>
  );
}
