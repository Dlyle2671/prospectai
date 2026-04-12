import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import CSVImport from './CSVImport';
const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CM = new Date().getMonth() + 1;
const CR = { PS: 0.10, FO: 0.07, MS: 1.0 };
const CAT_KEYS = { PS: 'Professional Services', FO: 'FinOps', MS: 'Managed Services' };
function mrem(m){ return Math.max(1, 13 - m); }
function fmt(n){ if(!n && n!==0) return '$0'; return '$'+Number(n).toLocaleString('en-US',{maximumFractionDigits:0}); }
function pct(n){ return (n*100).toFixed(1)+'%'; }
// v4
function nid(){ return Date.now()+'_'+Math.random().toString(36).slice(2); }
// ARR calc per deal: PS = one-time fee (not annualized), FO/MS = MRR x months remaining 
function dealARR(d){
  if(d.cat==='PS') return (d.amount||0);
  return (d.mrr||0) * mrem(d.month||CM);
}
// Commission: PS=10% of fee, FO=7% of 1st month MRR, MS=1x MRR
function dealComm(d){
  if(d.cat==='PS') return (d.amount||0) * 0.10;
  if(d.cat==='FO') return (d.mrr||0) * 0.07;
  if(d.cat==='MS') return (d.mrr||0) * 1.0;
  return 0;
}
function getQuota(rep, cat){ return (rep.quotas && rep.quotas[CAT_KEYS[cat]]) || 0; }
function getActualFromDeals(repId, cat, deals){
  return deals.filter(d => d.repId === repId && d.cat === cat && d.stage === 'Closed Won').reduce((s,d) => s + (d.cat==='PS' ? (d.amount||0) : (d.mrr||0)), 0);
}
function getTotalActualFromDeals(cat, reps, deals){
  return reps.reduce((s,r) => s + getActualFromDeals(r.id, cat, deals), 0);
}
function repCommissionFromDeals(rep, deals){
  const myDeals = deals.filter(d => d.repId === rep.id && d.stage === 'Closed Won');
  const ps = myDeals.filter(d=>d.cat==='PS').reduce((s,d)=>s+dealComm(d),0);
  const fo = myDeals.filter(d=>d.cat==='FO').reduce((s,d)=>s+dealComm(d),0);
  const ms = myDeals.filter(d=>d.cat==='MS').reduce((s,d)=>s+dealComm(d),0);
  return { ps, fo, ms, tot: ps+fo+ms };
}
// CRO commission rates: PS=3%, FO=25% of 7% MRR, MS=25% MRR
function croDealComm(d){
  if(d.cat==='PS') return (d.amount||0) * 0.03;
  if(d.cat==='FO') return (d.mrr||0) * 0.07 * 0.25;
  if(d.cat==='MS') return (d.mrr||0) * 0.25;
  return 0;
}
function croCommissionFromDeals(rep, deals){
  const myDeals = deals.filter(d => d.repId === rep.id && d.stage === 'Closed Won');
  const ps = myDeals.filter(d=>d.cat==='PS').reduce((s,d)=>s+croDealComm(d),0);
  const fo = myDeals.filter(d=>d.cat==='FO').reduce((s,d)=>s+croDealComm(d),0);
  const ms = myDeals.filter(d=>d.cat==='MS').reduce((s,d)=>s+croDealComm(d),0);
  return { ps, fo, ms, tot: ps+fo+ms };
}
function AskAITab({messages,setMessages,input,setInput,loading,setLoading}){
  async function send(){
    const q = input.trim();
    if(!q||loading) return;
    const userMsg = {role:'user',content:q};
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);
    try{
      const resp = await fetch('/api/ask-ai',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({question:q, history:messages.slice(-10)})
      });
      const d = await resp.json();
      const answer = d.answer || d.error || 'No response.';
      setMessages([...newMsgs, {role:'assistant',content:answer}]);
    }catch(e){
      setMessages([...newMsgs, {role:'assistant',content:'Error: '+e.message}]);
    }finally{
      setLoading(false);
    }
  }
  return(
    <div style={{maxWidth:800,margin:'0 auto',padding:'0 0 32px'}}>
      <h2 style={{color:'#f1f5f9',fontWeight:700,fontSize:20,marginBottom:16}}>Ask AI About Your Data</h2>
      <div style={{background:'#0f172a',border:'1px solid rgba(255,255,255,.08)',borderRadius:12,padding:24,minHeight:320,maxHeight:480,overflowY:'auto',marginBottom:16,display:'flex',flexDirection:'column',gap:12}}>
        {messages.length===0&&<div style={{color:'#64748b',fontSize:14,textAlign:'center',marginTop:80}}>Ask anything about your deals, reps, pipeline, quota attainment, or AWS opportunities.</div>}
        {messages.map((m,i)=>(
          <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
            <div style={{maxWidth:'80%',padding:'10px 14px',borderRadius:m.role==='user'?'18px 18px 4px 18px':'18px 18px 18px 4px',background:m.role==='user'?'linear-gradient(135deg,#4f46e5,#6366f1)':'rgba(99,102,241,.1)',border:m.role==='user'?'none':'1px solid rgba(99,102,241,.3)',color:'#f1f5f9',fontSize:13,lineHeight:1.6,whiteSpace:'pre-wrap'}}>
              {m.content}
            </div>
          </div>
        ))}
        {loading&&<div style={{display:'flex',justifyContent:'flex-start'}}><div style={{padding:'10px 14px',borderRadius:'18px 18px 18px 4px',background:'rgba(99,102,241,.1)',border:'1px solid rgba(99,102,241,.3)',color:'#818cf8',fontSize:13}}>Thinking...</div></div>}
      </div>
      <div style={{display:'flex',gap:8}}>
        <input className="sa-input" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()} placeholder="Ask about your pipeline, quota, deals, reps..." style={{flex:1,fontSize:14}}/>
        <button className="sa-btn" onClick={send} disabled={loading||!input.trim()} style={{padding:'10px 20px',minWidth:72}}>{loading?'...':'Send'}</button>
      </div>
      {messages.length>0&&<button className="sa-btn sm" onClick={()=>setMessages([])} style={{marginTop:8,opacity:.6}}>Clear chat</button>}
    </div>
  );
}

export default function SalesAnalytics({onBack}){
  const { user } = useUser();
  const [tab, setTab] = useState('dash');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterRep, setFilterRep] = useState('All');
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showComm, setShowComm] = useState(function(){ try{ return localStorage.getItem('sa_showComm')!=='false'; }catch(e){ return true; } });
  useEffect(() => {
    fetch('/api/sales-data').then(r => r.json()).then(d => {
      setData(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  const save = async d => {
    await fetch('/api/sales-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
    setData(JSON.parse(JSON.stringify(d)));
  };
  if (loading || !data) return <div style={{color:'#fff',padding:'40px',textAlign:'center'}}>Loading...</div>;
  return(<>
    <style>{`
      .sa{display:flex;flex-direction:column;position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff;z-index:1000;overflow:hidden;}
      .sa-hd{background:#1e293b;border-bottom:1px solid rgba(99,102,241,.3);padding:0 24px;display:flex;align-items:center;justify-content:space-between;height:60px;flex-shrink:0;}
      .sa-hd h1{font-size:20px;font-weight:700;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin:0;}
      .sa-x{background:rgba(99,102,241,.2);border:1px solid rgba(99,102,241,.4);color:#fff;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;}
      .sa-tabs{display:flex;gap:4px;background:#1e293b;padding:8px 24px;border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0;overflow-x:auto;}
      .sa-tab{background:transparent;border:none;color:#fff;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;white-space:nowrap;transition:all .15s;}
      .sa-tab:hover{color:#fff;background:rgba(255,255,255,.05);}
      .sa-tab.on{background:rgba(99,102,241,.2);color:#818cf8;border:1px solid rgba(99,102,241,.3);}
      .sa-body{flex:1;overflow-y:auto;padding:24px;}
      .sa-card{background:#1e293b;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px;margin-bottom:16px;}
      .sa-card h2{font-size:16px;font-weight:600;color:#f1f5f9;margin:0 0 16px;}
      .sa-g3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px;}
      .sa-g2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:16px;}
      .sa-stat{background:#0f172a;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px;text-align:center;}
      .sa-stat .lbl{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#fff;margin-bottom:6px;}
      .sa-stat .val{font-size:22px;font-weight:700;color:#f1f5f9;}
      .sa-stat .sub{font-size:11px;color:#fff;margin-top:4px;}
      .sa-stat .note{font-size:11px;color:#818cf8;margin-top:6px;font-style:italic;}
      .sa-bar{height:6px;background:#1e293b;border-radius:3px;margin-top:10px;overflow:hidden;}
      .sa-bar-fill{height:100%;border-radius:3px;transition:width .4s;}
      .sa-tbl{width:100%;border-collapse:collapse;}
      .sa-tbl th{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#fff;padding:8px 12px;text-align:center;border-bottom:1px solid rgba(255,255,255,.06);}
      .sa-tbl td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.04);font-size:13px;color:#fff;text-align:center;}
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
      .sa-label{font-size:11px;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;display:block;}
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
        {[['dash','Dashboard'],['deals','Deals'],['reps','Reps'],['catperf','Category Performance'],['arrcalc','ARR Calc'],['comm','Commissions'],['settings','Settings'],['ai','Ask AI']].map(([id,label])=>(
          <button key={id} className={`sa-tab${tab===id?' on':''}`} onClick={()=>setTab(id)}>{label}</button>
        ))}
      </div>
      <div className="sa-body">
        {tab==='dash'&&<DashTab data={data} showComm={showComm} setShowComm={setShowComm}/>}
        {tab==='deals'&&<DealsTab data={data} save={save}/>}
        {tab==='reps'&&<RepsTab data={data} save={save}/>}
        {tab==='catperf'&&<CatPerfTab data={data} filterRep={filterRep} setFilterRep={setFilterRep} showComm={showComm}/>}
        {tab==='arrcalc'&&<ArrCalcTab/>}
        {tab==='comm'&&<CommTab data={data} filterRep={filterRep} setFilterRep={setFilterRep} showComm={showComm}/>}
        {tab==='settings'&&<SettingsTab data={data} save={save}/>}
        {tab==='ai'&&<AskAITab messages={aiMessages} setMessages={setAiMessages} input={aiInput} setInput={setAiInput} loading={aiLoading} setLoading={setAiLoading}/>}
      </div>
    </div>
  </>);
}
function DashTab({data, showComm, setShowComm}){
  const reps = data.reps;
  const deals = data.deals || [];
  const cats = [
    {id:'PS', label:'Professional Services', color:'#6366f1', note:'One-time project fee | Commission: 10% of fee'},
    {id:'FO', label:'FinOps', color:'#0ea5e9', note:'Recurring MRR x months remaining = ARR | Commission: 7% of 1st month MRR'},
    {id:'MS', label:'Managed Services', color:'#10b981', note:'Recurring MRR x months remaining = ARR | Commission: 1x MRR'},
  ];
  const totalAllClosed = reps.reduce((s,r) => s + getActualFromDeals(r.id,'PS',deals) + getActualFromDeals(r.id,'FO',deals) + getActualFromDeals(r.id,'MS',deals), 0);
  const cq = data.companyQuotas || { PS:0, FO:0, MS:0 };
  const totalAllQuota = (cq.PS||0)+(cq.FO||0)+(cq.MS||0) || reps.reduce((s,r) => s + getQuota(r,'PS') + getQuota(r,'FO') + getQuota(r,'MS'), 0);
  const totalComm = reps.reduce((s,r) => s + repCommissionFromDeals(r,deals).tot, 0);
  return(
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:8}}><button onClick={function(){ var v=!showComm; setShowComm(v); try{localStorage.setItem('sa_showComm',String(v));}catch(e){} }} style={{background:'transparent',border:'1px solid rgba(99,102,241,.4)',color:showComm?'#a5b4fc':'#64748b',padding:'5px 12px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:6}}>{showComm ? 'ð Hide Commission' : 'ð Show Commission'}</button></div>
      <div className="sa-g3">
        {cats.map(c => {
          const closed = getTotalActualFromDeals(c.id, reps, deals);
          const quota = (data.companyQuotas && data.companyQuotas[c.id]) ? data.companyQuotas[c.id] : reps.reduce((s,r) => s + getQuota(r,c.id), 0);
          const p = quota > 0 ? Math.min(1, closed/quota) : 0;
          const pace = CM/12;
          const ytdQ = quota * CM / 12;
          const ytdPct2 = ytdQ > 0 ? Math.min(closed / ytdQ, 9.99) : 0;
          const behind = closed < quota*pace;
          return(
            <div className="sa-stat" key={c.id}>
              <div className="lbl">{c.label}</div>
              <div className="val" style={{color:'#34d399'}}>{fmt(closed)}</div>
              <div className="sub">of {fmt(quota)} quota ({pct(p)} attained)</div>
              <div className="sub" style={{marginTop:3}}>YTD: {fmt(ytdQ)} target ({pct(ytdPct2)} attained)</div>
                            <div className="sa-bar"><div className="sa-bar-fill" style={{width:p*100+'%',background:'#34d399'}}/></div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
                <span style={{fontSize:11,color:'#fff'}}>Pace: {pct(pace)}</span>
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
        {showComm&&<div className="sa-stat">
          <div className="lbl">Total Commissions</div>
          <div className="val" style={{color:'#34d399'}}>{fmt(totalComm)}</div>
          <div className="sub">{reps.length} reps | {deals.length} deals</div>
        </div>}
        <div className="sa-stat">
          <div className="lbl">Pace Check</div>
          <div className="val">{pct(CM/12)}</div>
          
        </div>
      </div>
      <div className="sa-card">
        <h2>Rep Summary</h2>
        <div style={{overflowX:'auto'}}><table className="sa-tbl">
          <thead><tr>
            <th>Rep</th><th>Dept</th>
            <th>PS Closed (YTD)</th><th>PS Quota (YTD)</th><th>PS %</th>
            <th>FO Closed (YTD)</th><th>FO Quota (YTD)</th><th>FO %</th>
            <th>MS Closed (YTD)</th><th>MS Quota (YTD)</th><th>MS %</th>
          <th>Total Closed</th><th>Overall Quota %</th>
          </tr></thead>
          <tbody>
            {reps.map(r => {
              const psA=getActualFromDeals(r.id,'PS',deals), psQ=getQuota(r,'PS')*(CM/12);
              const foA=getActualFromDeals(r.id,'FO',deals), foQ=getQuota(r,'FO')*(CM/12);
              const msA=getActualFromDeals(r.id,'MS',deals), msQ=getQuota(r,'MS')*(CM/12);
                const tot=psA+foA+msA; const totQ=psQ+foQ+msQ;
              return(
                <tr key={r.id}>
                              <td style={{fontWeight:600,color:'#f1f5f9'}}>{r.name}</td>
                  <td>{r.dept||r.department||'â'}</td>
                  <td style={{color:'#34d399'}}>{fmt(psA)}</td>
                              <td style={{color:'#fff',fontSize:11}}>{fmt(psQ)}</td>
                  <td><span className={`sa-badge ${psA>=psQ?'ahead':'behind'}`}>{pct(psQ>0?psA/psQ:0)}</span></td>
                  <td style={{color:'#34d399'}}>{fmt(foA)}</td>
                              <td style={{color:'#fff',fontSize:11}}>{fmt(foQ)}</td>
                  <td><span className={`sa-badge ${foA>=foQ?'ahead':'behind'}`}>{pct(foQ>0?foA/foQ:0)}</span></td>
                  <td style={{color:'#34d399'}}>{fmt(msA)}</td>
                              <td style={{color:'#fff',fontSize:11}}>{fmt(msQ)}</td>
                  <td><span className={`sa-badge ${msA>=msQ?'ahead':'behind'}`}>{pct(msQ>0?msA/msQ:0)}</span></td>
                <td style={{fontWeight:700,color:'#34d399'}}>{fmt(tot)}</td><td><span className={`sa-badge ${tot>=totQ?'ahead':'behind'}`}>{pct(totQ>0?tot/totQ:0)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
function DealsTab({data, save}){
  const [showForm, setShowForm] = useState(false);
  const [editDeal, setEditDeal] = useState(null);
  const [df, setDf] = useState({repId:'',cat:'PS',client:'',month:CM,amount:'',mrr:'',stage:'Closed Won',source:'',contractLength:'',notes:''});
  const [filterCat, setFilterCat] = useState('All');
  const [filterStage, setFilterStage] = useState('All');
  const [filterRep, setFilterRep] = useState('All');
  const [filterSource, setFilterSource] = useState('All');
  const submit = () => {
    if(!df.client.trim() || !df.repId) return;
    const d = JSON.parse(JSON.stringify(data));
    const entry = {
      id: editDeal ? editDeal.id : nid(),
      repId: df.repId, cat: df.cat, client: df.client.trim(),
      month: Number(df.month),
      amount: df.cat==='PS' ? Number(df.amount)||0 : 0,
      mrr: df.cat!=='PS' ? Number(df.mrr)||0 : 0,
      stage: df.stage||'Closed Won', source: df.source||'', contractLength: df.cat!=='PS' ? Number(df.contractLength)||0 : 0, notes: df.notes||'',
    };
    if(editDeal){ d.deals = d.deals.map(x => x.id===editDeal.id ? entry : x); setEditDeal(null); }
    else { d.deals = [...(d.deals||[]), entry]; }
    save(d);
    setDf({repId:'',cat:'PS',client:'',month:CM,amount:'',mrr:'',stage:'Closed Won',source:'',contractLength:'',notes:''});
    setShowForm(false);
  };
  const del = id => {
    if(!window.confirm('Delete this deal?')) return;
    const d = JSON.parse(JSON.stringify(data));
    d.deals = (d.deals||[]).filter(x => x.id !== id);
    save(d);
  };
  const startEdit = deal => {
    setEditDeal(deal);
    setDf({repId:deal.repId, cat:deal.cat, client:deal.client, month:deal.month, amount:deal.amount||'', mrr:deal.mrr||'', stage:deal.stage||'Closed Won', source:deal.source||'', contractLength:deal.contractLength||'', notes:deal.notes||''});
    setShowForm(true);
    const sb = document.querySelector('.sa-body'); if(sb) sb.scrollTo({top:0,behavior:'smooth'});
  };
  const deals = data.deals || [];
  const filtered = deals
    .filter(d => filterCat==='All' || d.cat===filterCat)
    .filter(d => filterStage==='All' || d.stage===filterStage)
    .filter(d => filterRep==='All' || (data.reps||[]).find(r=>r.id===d.repId)?.name===filterRep)
    .filter(d => filterSource==='All' || d.source===filterSource);
  const rem = mrem(Number(df.month));
  const previewARR = df.cat==='PS' ? Number(df.amount)||0 : (Number(df.mrr)||0)*rem;
  const previewMRR = Number(df.mrr)||0;
  // Preview commission: PS=10% fee, FO=7% MRR, MS=1x MRR
  const previewComm = df.cat==='PS' ? (Number(df.amount)||0)*0.10 : df.cat==='FO' ? previewMRR*0.07 : previewMRR*1.0;
  return(
    <div>
      <div style={{background:'rgba(99,102,241,.08)',border:'1px solid rgba(99,102,241,.2)',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#a5b4fc',lineHeight:1.6}}>
                <strong>Deals</strong> â enter each closed deal by client. PS = one-time fee (not annualized). FO/MS = MRR x months remaining = ARR. Commission: PS=10% of fee | FO=7% of 1st month MRR | MS=1x MRR. All deals feed directly into the Dashboard and Commissions.
      </div>
      <div style={{display:'flex',gap:0,alignItems:'flex-start',marginBottom:16}}>
        <div style={{display:'flex',flexDirection:'column',gap:6,flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
            <span style={{fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.8px',minWidth:64}}>Category:</span>
            <div className="sa-pills" style={{marginBottom:0}}>
              {['All','PS','FO','MS'].map(c=>(
                <button key={c} className={`sa-pill${filterCat===c?' on':''}`} onClick={()=>setFilterCat(c)}>
                  {c==='All'?'All Deals':c==='PS'?'Professional Services':c==='FO'?'FinOps':'Managed Services'}
                </button>
              ))}
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
            <span style={{fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.8px',minWidth:64}}>Stage:</span>
            <div className="sa-pills" style={{marginBottom:0}}>
              {['All','Closed Won','Closed Lost','Forecasted','SOW Sent'].map(s=>(
                <button key={s} className={`sa-pill${filterStage===s?' on':''}`} onClick={()=>setFilterStage(s)}>
                  {s==='All'?'All':s}
                </button>
              ))}
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
            <span style={{fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.8px',minWidth:64}}>Rep:</span>
            <div className="sa-pills" style={{marginBottom:0}}>
              {['All',...(data.reps||[]).map(r=>r.name)].map(r=>(
                <button key={r} className={`sa-pill${filterRep===r?' on':''}`} onClick={()=>setFilterRep(r)}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
            <span style={{fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'.8px',minWidth:64}}>Source:</span>
            <div className="sa-pills" style={{marginBottom:0}}>
              {['All',...Array.from(new Set((data.deals||[]).map(d=>d.source).filter(Boolean)))].map(s=>(
                <button key={s} className={`sa-pill${filterSource===s?' on':''}`} onClick={()=>setFilterSource(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <CSVImport data={data} onImport={d=>save(d)} />
          <button className="sa-btn" style={{marginLeft:12,flexShrink:0,alignSelf:'flex-start'}} onClick={()=>{setShowForm(!showForm);setEditDeal(null);setDf({repId:'',cat:'PS',client:'',month:CM,amount:'',mrr:'',stage:'Closed Won',source:'',contractLength:'',notes:''})}}>+ Add Deal</button>
        </div>
      </div>
      {showForm&&(
        <div className="sa-card" style={{marginBottom:16}}>
          <h2>{editDeal?'Edit Deal':'New Deal'}</h2>
          <div className="sa-frow">
            <div>
              <label className="sa-label">Rep</label>
              <select className="sa-select" value={df.repId} onChange={e=>setDf({...df,repId:e.target.value})}>
                <option value="">Select rep...</option>
                {data.reps.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="sa-label">Category</label>
              <select className="sa-select" value={df.cat} onChange={e=>setDf({...df,cat:e.target.value})}>
                <option value="PS">Professional Services (one-time fee)</option>
                <option value="FO">FinOps (recurring MRR)</option>
                <option value="MS">Managed Services (recurring MRR)</option>
              </select>
            </div>
            <div>
              <label className="sa-label">Client Name</label>
              <input className="sa-input" value={df.client} onChange={e=>setDf({...df,client:e.target.value})} placeholder="e.g. Acme Corp"/>
            </div>
          </div>
          <div className="sa-frow">
            <div>
              <label className="sa-label">Month Closed</label>
              <select className="sa-select" value={df.month} onChange={e=>setDf({...df,month:e.target.value})}>
                {MN.map((m,i)=><option key={i} value={i+1}>{m} ({13-(i+1)} months remaining)</option>)}
              </select>
            </div>
            {df.cat==='PS'
              ?<div>
                <label className="sa-label">One-Time Fee ($)</label>
                <input className="sa-input" type="number" value={df.amount} onChange={e=>setDf({...df,amount:e.target.value})} placeholder="e.g. 50000"/>
                <div style={{fontSize:11,color:'#fff',marginTop:4}}>Enter the project fee. Commission = 10% of fee.</div>
              </div>
              :<div>
                <label className="sa-label">Monthly MRR ($)</label>
                <input className="sa-input" type="number" value={df.mrr} onChange={e=>setDf({...df,mrr:e.target.value})} placeholder="e.g. 8000"/>
                <div style={{fontSize:11,color:'#fff',marginTop:4}}>
                  {df.cat==='FO' ? 'Commission = 7% of 1st month MRR.' : 'Commission = 1x MRR (flat).'}
                  {' ARR = MRR x '+rem+' months remaining.'}
                </div>
              </div>
            }

              <div>
                <label className="sa-label">Stage</label>
                <select className="sa-select" value={df.stage} onChange={e=>setDf({...df,stage:e.target.value})}>
                  <option value="Forecasted">Forecasted</option>
                  <option value="SOW Sent">SOW Sent</option>
                  <option value="Closed Won">Closed Won</option>
                  <option value="Closed Lost">Closed Lost</option>


                </select>
              </div>
              <div>
                <label className="sa-label">Deal Source</label>
                <select className="sa-select" value={df.source} onChange={e=>setDf({...df,source:e.target.value})}>
                  <option value="">Select source...</option>
                  <option value="AWS">AWS</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Customer Success">Customer Success</option>
                  <option value="Business Development">Business Development</option>

                </select>
              </div>
              {df.cat!=='PS'&&<div>
                <label className="sa-label">Contract Length (months)</label>
                <input className="sa-input" type="number" value={df.contractLength} onChange={e=>setDf({...df,contractLength:e.target.value})} placeholder="e.g. 12"/>
              </div>}

            <div style={{marginBottom:12}}>
              <label className="sa-label">{df.source==='AWS' ? 'AWS Seller' : 'Deal Source Details'}</label>
              <textarea className="sa-input" value={df.notes} onChange={e=>setDf({...df,notes:e.target.value})} placeholder="Deal source details..." rows={2} style={{resize:'vertical',minHeight:56}}/>
            </div>
            <div style={{display:'flex',alignItems:'flex-end',gap:8}}>
              <button className="sa-btn" onClick={submit}>{editDeal?'Save':'Add Deal'}</button>
              <button className="sa-btn del sm" onClick={()=>{setShowForm(false);setEditDeal(null);}}>Cancel</button>
            </div>
          </div>
          {((df.cat==='PS'&&df.amount)||(df.cat!=='PS'&&df.mrr))&&(
            <div className="sa-preview">
              {df.cat==='PS'
                ? `Fee: ${fmt(Number(df.amount))} | ARR = ${fmt(previewARR)} (one-time) | Commission = ${fmt(previewComm)} (10% of fee)`
                : df.cat==='FO'
                  ? `MRR: ${fmt(previewMRR)} x ${rem} months = ARR ${fmt(previewARR)} | Commission = ${fmt(previewComm)} (7% of 1st month MRR)`
                  : `MRR: ${fmt(previewMRR)} x ${rem} months = ARR ${fmt(previewARR)} | Commission = ${fmt(previewComm)} (1x MRR)`
              }
            </div>
          )}
        </div>
      )}
      <div className="sa-card">
                <h2>Closed Deals {filterCat!=='All'?'â '+(filterCat==='PS'?'Professional Services':filterCat==='FO'?'FinOps':'Managed Services'):''} ({filtered.length})</h2>
        <table className="sa-tbl">
          <thead><tr>
            <th>Rep</th><th>Category</th><th>Client</th><th>Stage</th><th>Source</th><th>Month</th>
            <th>Fee / MRR</th><th>ARR Value</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {filtered.length===0&&(
              <tr><td colSpan={8} style={{textAlign:'center',color:'#fff',padding:24}}>
                                No deals yet â click "+ Add Deal" to log a closed deal.
              </td></tr>
            )}
            {filtered.map(d=>{
              const rep = data.reps.find(r=>r.id===d.repId);
              const arr = dealARR(d), com = dealComm(d);
              const catColor = d.cat==='PS'?'#818cf8':d.cat==='FO'?'#38bdf8':'#34d399';
              const catBg = d.cat==='PS'?'rgba(99,102,241,.2)':d.cat==='FO'?'rgba(14,165,233,.2)':'rgba(16,185,129,.2)';
              return(
                <tr key={d.id}>
                  <td style={{fontWeight:600,color:'#f1f5f9'}}>{rep?rep.name:'Unknown'}</td>
                  <td><span style={{background:catBg,color:catColor,padding:'2px 8px',borderRadius:12,fontSize:11,fontWeight:600}}>{d.cat}</span></td>
                  <td>{d.client}</td>
                  <td><span style={{background:d.stage==='Closed Won'?'rgba(16,185,129,.2)':d.stage==='Closed Lost'?'rgba(239,68,68,.2)':d.stage==='SOW Sent'?'rgba(239,68,68,.2)':d.stage==='Forecasted'?'rgba(245,158,11,.2)':'rgba(99,102,241,.15)',color:d.stage==='Closed Won'?'#34d399':d.stage==='Closed Lost'?'#f87171':d.stage==='SOW Sent'?'#f87171':d.stage==='Forecasted'?'#fbbf24':'#a5b4fc',padding:'2px 8px',borderRadius:12,fontSize:11,whiteSpace:'nowrap'}}>{d.stage||'â'}</span></td>
                  <td style={{fontSize:12,color:'#94a3b8'}}>{d.source||'â'}</td>
                  <td>{MN[(d.month||1)-1]}</td>
                  <td>{d.cat==='PS'?fmt(d.amount)+' fee':fmt(d.mrr)+'/mo MRR'}</td>
                  <td style={{fontWeight:600,color:'#f1f5f9'}}>{fmt(arr)}</td>
                  
                  
                  <td style={{display:'flex',gap:6}}>
                    <button className="sa-btn sm" onClick={()=>startEdit(d)}>Edit</button>
                    <button className="sa-btn del sm" onClick={()=>del(d.id)}>Del</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length>0&&(
          <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid rgba(255,255,255,.06)',display:'flex',gap:24,fontSize:13}}>
            <span style={{color:'#fff'}}>Total MRR: <strong style={{color:'#34d399'}}>{fmt(filtered.filter(d=>d.cat!=='PS').reduce((s,d)=>s+(d.mrr||0),0))}/mo</strong></span><span style={{color:'#fff'}}>Total ARR: <strong style={{color:'#34d399'}}>{fmt(filtered.reduce((s,d)=>s+dealARR(d),0))}</strong></span>
            
          </div>
        )}
      </div>
    </div>
  );
}
function RepDetailModal({rep, deals, onClose}){
  if(!rep) return null;
  const cats=[
    {id:'PS',label:'Professional Services',color:'#818cf8',bg:'rgba(99,102,241,0.18)',border:'#6366f1'},
    {id:'FO',label:'FinOps',color:'#38bdf8',bg:'rgba(14,165,233,0.18)',border:'#0ea5e9'},
    {id:'MS',label:'Managed Services',color:'#34d399',bg:'rgba(16,185,129,0.18)',border:'#10b981'},
  ];
  const myDeals=deals.filter(d=>d.repId===rep.id);
  const totalARR=myDeals.reduce((s,d)=>s+dealARR(d),0);
  const totalComm=myDeals.reduce((s,d)=>s+dealComm(d),0);
  const totalDeals=myDeals.length;
  const psQ=getQuota(rep,'PS'), foQ=getQuota(rep,'FO'), msQ=getQuota(rep,'MS');
  const totalQuota=psQ+foQ+msQ;
  const overallAttain=totalQuota>0?totalARR/totalQuota:0;
  const catData=cats.map(c=>{
    const cd=myDeals.filter(d=>d.cat===c.id);
    return{...c,deals:cd,arr:cd.reduce((s,d)=>s+dealARR(d),0),comm:cd.reduce((s,d)=>s+dealComm(d),0),quota:getQuota(rep,c.id)};
  });
  const styles=`
    .rdm-ov{position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,.72);z-index:9998;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);}
    .rdm-box{background:#0f172a;border:1px solid rgba(99,102,241,.4);border-radius:16px;width:92vw;max-width:1080px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 25px 60px rgba(0,0,0,.6);}
    .rdm-hd{background:#1e293b;border-bottom:1px solid rgba(99,102,241,.3);padding:18px 24px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
    .rdm-hd-title{font-size:20px;font-weight:700;color:#f1f5f9;}
    .rdm-hd-sub{font-size:12px;color:#818cf8;margin-top:3px;}
    .rdm-hd-close{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#f87171;width:34px;height:34px;border-radius:8px;cursor:pointer;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
    .rdm-hd-close:hover{background:rgba(239,68,68,.3);}
    .rdm-body{overflow-y:auto;padding:22px 24px;flex:1;}
    .rdm-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;}
    .rdm-kpi-card{background:#1e293b;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px 16px;}
    .rdm-kpi-lbl{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#818cf8;margin-bottom:6px;}
    .rdm-kpi-val{font-size:20px;font-weight:700;color:#f1f5f9;}
    .rdm-kpi-sub{font-size:11px;color:#ffffff;margin-top:3px;}
    .rdm-sec{font-size:11px;font-weight:700;color:#64748b;letter-spacing:1.2px;text-transform:uppercase;margin:18px 0 10px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,.06);}
    .rdm-qgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:6px;}
    .rdm-qcard{background:#1e293b;border-radius:8px;padding:12px 14px;border:1px solid rgba(255,255,255,.06);}
    .rdm-qcard-lbl{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;}
    .rdm-qcard-val{font-size:16px;font-weight:700;color:#34d399;}
    .rdm-qcard-quota{font-size:11px;color:#ffffff;margin-top:2px;}
    .rdm-bar{height:4px;background:#0f172a;border-radius:3px;margin:6px 0 4px;overflow:hidden;}
    .rdm-bar-fill{height:100%;border-radius:3px;}
    .rdm-badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;}
    .rdm-badge.ahead{background:rgba(16,185,129,.15);color:#34d399;}
    .rdm-badge.behind{background:rgba(239,68,68,.15);color:#f87171;}
    .rdm-cat-block{margin-bottom:14px;}
    .rdm-cat-hd{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;background:#1e293b;border-left:3px solid;margin-bottom:6px;}
    .rdm-cat-name{font-size:13px;font-weight:700;}
    .rdm-cat-meta{margin-left:auto;display:flex;gap:14px;font-size:12px;color:#ffffff;}
    .rdm-tbl{width:100%;border-collapse:collapse;}
    .rdm-tbl th{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#ffffff;padding:7px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,.05);}
    .rdm-tbl td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.04);font-size:13px;color:#f1f5f9;text-align:left;}
    .rdm-tbl tr:last-child td{border-bottom:none;}
    .rdm-tbl tr:hover td{background:rgba(255,255,255,.02);}
    .rdm-tbl tfoot td{color:#ffffff;font-size:11px;font-weight:700;padding-top:10px;}
    .rdm-grand{margin-top:14px;padding:12px 16px;background:#1e293b;border-radius:10px;border:1px solid rgba(99,102,241,.3);display:flex;gap:24px;align-items:center;flex-wrap:wrap;}
    .rdm-no-deals{text-align:center;color:#ffffff;padding:18px;font-size:13px;font-style:italic;}
    .rep-row-link{cursor:pointer;}
    .rep-row-link:hover td{background:rgba(99,102,241,.07)!important;}
    .rep-row-link td:first-child{color:#818cf8!important;text-decoration:underline;text-decoration-color:rgba(129,140,248,.35);}
  `;
  return(
    <div className="rdm-ov" onClick={e=>e.target.className==='rdm-ov'&&onClose()}>
      <style>{styles}</style>
      <div className="rdm-box">
        <div className="rdm-hd">
          <div>
                        <div className="rdm-hd-title">ð {rep.name}</div>
                        <div className="rdm-hd-sub">{rep.dept||rep.department||'Sales'} Â· {totalDeals} deal{totalDeals!==1?'s':''} won Â· {new Date().getFullYear()} Performance</div>
          </div>
                    <button className="rdm-hd-close" onClick={onClose}>â</button>
        </div>
        <div className="rdm-body">
          <div className="rdm-kpi">
            <div className="rdm-kpi-card">
              <div className="rdm-kpi-lbl">Total ARR Closed</div>
              <div className="rdm-kpi-val" style={{color:'#34d399'}}>{fmt(totalARR)}</div>
              <div className="rdm-kpi-sub">{totalDeals} deals across all categories</div>
            </div>
            <div className="rdm-kpi-card">
              <div className="rdm-kpi-lbl">Total Commission</div>
              <div className="rdm-kpi-val" style={{color:'#34d399'}}>{fmt(totalComm)}</div>
              <div className="rdm-kpi-sub">PS + FO + MS combined</div>
            </div>
            <div className="rdm-kpi-card">
              <div className="rdm-kpi-lbl">Quota Attainment</div>
                            <div className="rdm-kpi-val" style={{color:overallAttain>=CM/12?'#34d399':'#f87171'}}>{totalQuota>0?pct(overallAttain):'â'}</div>
              <div className="rdm-kpi-sub">vs. {fmt(totalQuota)} annual quota</div>
            </div>
            <div className="rdm-kpi-card">
              <div className="rdm-kpi-lbl">Pace vs. Attainment</div>
                            <div className="rdm-kpi-val" style={{color:overallAttain>=CM/12?'#34d399':'#f87171'}}>{overallAttain>=CM/12?'â On Track':'â  Behind'}</div>
              <div className="rdm-kpi-sub">Expected pace: {pct(CM/12)}</div>
            </div>
          </div>
          <div className="rdm-sec">Quota Attainment by Category</div>
          <div className="rdm-qgrid">
            {catData.map(c=>(
              <div className="rdm-qcard" key={c.id}>
                <div className="rdm-qcard-lbl">{c.label}</div>
                <div className="rdm-qcard-val">{fmt(c.arr)}</div>
                <div className="rdm-qcard-quota">of {fmt(c.quota)} annual quota</div>
                <div className="rdm-bar"><div className="rdm-bar-fill" style={{width:(c.quota>0?Math.min(100,c.arr/c.quota*100):0)+'%',background:c.color}}/></div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                    <span className={'rdm-badge '+(c.arr>=c.quota*(CM/12)?'ahead':'behind')}>{c.quota>0?pct(c.arr/c.quota):'â'}</span>
                  <span style={{fontSize:10,color:'#ffffff'}}>{fmt(c.comm)} comm</span>
                </div>
              </div>
            ))}
          </div>
          <div className="rdm-sec">Deals Won by Category</div>
          {catData.map(c=>(
            <div className="rdm-cat-block" key={c.id}>
              <div className="rdm-cat-hd" style={{borderLeftColor:c.border}}>
                <span style={{background:c.bg,color:c.color,padding:'2px 8px',borderRadius:12,fontSize:11,fontWeight:700}}>{c.id}</span>
                <span className="rdm-cat-name" style={{color:c.color}}>{c.label}</span>
                <div className="rdm-cat-meta">
                  <span>{c.deals.length} deal{c.deals.length!==1?'s':''}</span>
                  <span style={{color:'#f1f5f9',fontWeight:700}}>{fmt(c.arr)} ARR</span>
                  <span style={{color:'#34d399'}}>{fmt(c.comm)} commission</span>
                </div>
              </div>
              {c.deals.length===0
                ?<div className="rdm-no-deals">No {c.label} deals</div>
                :<table className="rdm-tbl">
                  <thead><tr>
                    <th>Client</th><th>Month Closed</th>
                    <th>{c.id==='PS'?'Fee':'MRR'}</th>
                    <th>Mo. Remaining</th>
                    <th>ARR Value</th><th>Commission</th>
                  </tr></thead>
                  <tbody>
                    {c.deals.map(d=>(
                      <tr key={d.id}>
                        <td style={{fontWeight:600}}>{d.client}</td>
                        <td>{MN[(d.month||1)-1]}</td>
                        <td>{c.id==='PS'
                          ?<span>{fmt(d.amount)} <span style={{color:'#64748b',fontSize:11}}>one-time</span></span>
                          :<span>{fmt(d.mrr)} <span style={{color:'#64748b',fontSize:11}}>/mo MRR</span></span>
                        }</td>
                                                <td style={{color:'#64748b',textAlign:'center'}}>{c.id==='PS'?'â':mrem(d.month)}</td>
                        <td style={{fontWeight:700,color:'#f1f5f9'}}>{fmt(dealARR(d))}</td>
                        <td style={{color:'#34d399',fontWeight:600}}>{fmt(dealComm(d))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr>
                    <td colSpan={4}>TOTALS ({c.deals.length} deal{c.deals.length!==1?'s':''})</td>
                    <td style={{color:'#f1f5f9'}}>{fmt(c.arr)}</td>
                    <td style={{color:'#34d399'}}>{fmt(c.comm)}</td>
                  </tr></tfoot>
                </table>
              }
            </div>
          ))}
          <div className="rdm-grand">
            <span style={{fontSize:13,fontWeight:700,color:'#818cf8'}}>GRAND TOTAL</span>
            <span style={{fontSize:13,color:'#ffffff'}}>{totalDeals} deals won</span>
            <span style={{fontSize:15,fontWeight:700,color:'#34d399'}}>{fmt(totalARR)} ARR</span>
            <span style={{fontSize:15,fontWeight:700,color:'#34d399'}}>{fmt(totalComm)} commission</span>
            <span style={{fontSize:13,color:overallAttain>=CM/12?'#34d399':'#f87171',marginLeft:'auto'}}>{totalQuota>0?pct(overallAttain)+' attainment':'No quota set'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
function RepsTab({data, save}){
  const [showForm, setShowForm] = useState(false);
  const [editRep, setEditRep] = useState(null);
  const [rf, setRf] = useState({name:'',dept:'',psQ:'',foQ:'',msQ:''});
  const [selectedRep, setSelectedRep] = useState(null);
  const submit = () => {
    if(!rf.name.trim()) return;
    const d = JSON.parse(JSON.stringify(data));
    const repData = {
      name: rf.name.trim(), dept: rf.dept.trim(),
      quotas: { 'Professional Services': Number(rf.psQ)||0, 'FinOps': Number(rf.foQ)||0, 'Managed Services': Number(rf.msQ)||0 },
      actuals: {'Professional Services':0,'FinOps':0,'Managed Services':0},
      psWins: [], recurringDeals: {'FinOps':[],'Managed Services':[]},
    };
    if(editRep){ d.reps = d.reps.map(r => r.id===editRep.id ? {...r,...repData} : r); setEditRep(null); }
    else { d.reps = [...d.reps, {id:nid(), ...repData}]; }
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
    setRf({ name:r.name, dept:r.dept||r.department||'', psQ:getQuota(r,'PS')||'', foQ:getQuota(r,'FO')||'', msQ:getQuota(r,'MS')||'' });
    setShowForm(true);
  };
  const deals = data.deals || [];
  return(
    <div>
      {selectedRep&&<RepDetailModal rep={selectedRep} deals={deals} onClose={()=>setSelectedRep(null)}/>}
      <div className="sa-shd">
        <div style={{fontSize:12,color:'#818cf8',fontStyle:'italic'}}>Click any rep name to view their full deal breakdown</div>
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
          <thead><tr><th>Name</th><th>Dept</th><th>Professional Services Closed</th><th>Professional Services Quota</th><th>PS %</th><th>FinOps Closed</th><th>FinOps Quota</th><th>FO %</th><th>Managed Services Closed</th><th>Managed Services Quota</th><th>MS %</th></tr></thead>
          <tbody>
            {data.reps.map(r=>(
              <tr key={r.id} className="rep-row-link" title={`Click to view ${r.name}'s deal breakdown`} onClick={()=>setSelectedRep(r)}>
                <td style={{fontWeight:600,color:'#818cf8',textDecoration:'underline',textDecorationColor:'rgba(129,140,248,.35)',cursor:'pointer'}}>{r.name}</td>
                                <td>{r.dept||r.department||'â'}</td>
                <td style={{color:'#34d399'}}>{fmt(getActualFromDeals(r.id,'PS',deals))}</td>
                <td>{fmt(getQuota(r,'PS')*(CM/12))}</td>
                <td><span className={`sa-badge ${getActualFromDeals(r.id,'PS',deals)>=getQuota(r,'PS')*(CM/12)?'ahead':'behind'}`}>{pct(getQuota(r,'PS')>0?getActualFromDeals(r.id,'PS',deals)/(getQuota(r,'PS')*(CM/12)):0)}</span></td>
                <td style={{color:'#34d399'}}>{fmt(getActualFromDeals(r.id,'FO',deals))}</td>
                <td>{fmt(getQuota(r,'FO')*(CM/12))}</td>
                <td><span className={`sa-badge ${getActualFromDeals(r.id,'FO',deals)>=getQuota(r,'FO')*(CM/12)?'ahead':'behind'}`}>{pct(getQuota(r,'FO')>0?getActualFromDeals(r.id,'FO',deals)/(getQuota(r,'FO')*(CM/12)):0)}</span></td>
                <td style={{color:'#34d399'}}>{fmt(getActualFromDeals(r.id,'MS',deals))}</td>
                <td>{fmt(getQuota(r,'MS')*(CM/12))}</td>
                <td><span className={`sa-badge ${getActualFromDeals(r.id,'MS',deals)>=getQuota(r,'MS')*(CM/12)?'ahead':'behind'}`}>{pct(getQuota(r,'MS')>0?getActualFromDeals(r.id,'MS',deals)/(getQuota(r,'MS')*(CM/12)):0)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function CatPerfTab({data, filterRep, setFilterRep, showComm}){
    const deals = data.deals || [];
  const repsFor = filterRep==='All' ? data.reps : data.reps.filter(r=>r.id===filterRep);
  const dealsFor = filterRep==='All' ? deals : deals.filter(d=>d.repId===filterRep);
  const cats = [
    {id:'PS', label:'Professional Services', color:'#6366f1', note:'One-time project fee | Commission: 10% of fee'},
    {id:'FO', label:'FinOps', color:'#0ea5e9', note:'Recurring MRR x months remaining = ARR | Commission: 7% of 1st month MRR'},
    {id:'MS', label:'Managed Services', color:'#10b981', note:'Recurring MRR x months remaining = ARR | Commission: 1x MRR'},
  ];
  return(
    <div>
      <div className="sa-pills">
        <button className={`sa-pill${filterRep==='All'?' on':''}`} onClick={()=>setFilterRep('All')}>All Reps</button>
        {data.reps.map(r=><button key={r.id} className={`sa-pill${filterRep===r.id?' on':''}`} onClick={()=>setFilterRep(r.id)}>{r.name}</button>)}
      </div>
      {cats.map(c=>{
        const closed = dealsFor.filter(d=>d.cat===c.id&&d.stage==='Closed Won').reduce((s,d)=>s+dealARR(d),0);
        const quota = (filterRep==='All' && data.companyQuotas && data.companyQuotas[c.id]) ? data.companyQuotas[c.id] : repsFor.reduce((s,r)=>s+getQuota(r,c.id),0);
        const comm = dealsFor.filter(d=>d.cat===c.id&&d.stage==='Closed Won').reduce((s,d)=>s+dealComm(d),0);
        const p = quota>0 ? Math.min(1,closed/quota) : 0;
        const remaining = Math.max(0, quota-closed);
        const commLabel = c.id==='PS' ? '10% of fee' : c.id==='FO' ? '7% of 1st month MRR' : '1x MRR';
        const closedMRR = dealsFor.filter(d=>d.cat===c.id&&d.stage==='Closed Won').reduce((s,d)=>s+(Number(d.mrr)||0),0);
      const closedARR = dealsFor.filter(d=>d.cat===c.id&&d.stage==='Closed Won').reduce((s,d)=>s+(dealARR(d)||0),0);
        const mrrQuota = quota > 0 ? quota/12 : 0;
        const mrrP = mrrQuota>0 ? Math.min(1,closedMRR/mrrQuota) : 0;
        const mrrRemaining = Math.max(0, mrrQuota-closedMRR);
        return(
          <div className="sa-card" key={c.id}>
            <h2 style={{color:c.color}}>{c.label}</h2>
            <div style={{fontSize:11,color:'#fff',marginTop:-10,marginBottom:14,fontStyle:'italic'}}>{c.note}</div>
      
            <div className="sa-g3">
              <div className="sa-stat">
                {c.id==='PS' ? (
                  <>
                    <div className="lbl">Closed ARR</div>
                    <div className="val" style={{color:'#34d399'}}>{fmt(closed)}</div>
                    <div className="sub">of {fmt(quota)} quota â {pct(p)} attained</div>
                    <div className="sa-bar"><div className="sa-bar-fill" style={{width:p*100+'%',background:'#34d399'}}/></div>
                    <div style={{fontSize:11,color:'#fff',marginTop:4}}>Pace: {pct(CM/12)}</div>
                  </>
                ) : (
                  <>
                    <div className="lbl">Closed MRR</div>
                    <div className="val" style={{color:'#34d399'}}>{fmt(closedMRR)}</div>
                    <div className="sub">of {fmt(mrrQuota)}/mo quota â {pct(mrrP)} attained</div>
                    <div className="sa-bar"><div className="sa-bar-fill" style={{width:mrrP*100+'%',background:'#34d399'}}/></div>
                    <div style={{fontSize:11,color:'#fff',marginTop:4}}>Pace: {pct(CM/12)}</div>
                  </>
                )}
              </div>
              <div className="sa-stat">
                {c.id==='PS' ? (
                  <>
                    <div className="lbl">Remaining to Quota</div>
                    <div className="val" style={{color:'#f87171'}}>{fmt(remaining)}</div>
                    <div className="sub">{pct(quota>0?remaining/quota:0)} left</div>
                  </>
                ) : (
                  <>
                    <div className="lbl">Closed ARR</div>
                    <div className="val" style={{color:'#60a5fa'}}>{fmt(closedARR)}</div>
                    <div className="sub">annualized run rate</div>
                  </>
                )}
              </div>
              {showComm&&<div className="sa-stat">
                <div className="lbl">Commission Earned</div>
                <div className="val" style={{color:'#34d399'}}>{fmt(comm)}</div>
                <div className="sub">{commLabel}</div>
              </div>}
            </div>
            {dealsFor.filter(d=>d.cat===c.id&&d.stage==='Closed Won').length>0&&(
              <table className="sa-tbl" style={{marginTop:8}}>
                <thead><tr><th>Rep</th><th>Client</th><th>Month</th><th>{c.id==='PS'?'Fee':'MRR'}</th><th>ARR</th>{showComm&&<th>Commission</th>}</tr></thead>
                <tbody>
                  {dealsFor.filter(d=>d.cat===c.id&&d.stage==='Closed Won').map(d=>{
                    const rep=data.reps.find(r=>r.id===d.repId);
                    return(
                      <tr key={d.id}>
                        <td>{rep?rep.name:'Unknown'}</td>
                        <td>{d.client}</td>
                        <td>{MN[(d.month||1)-1]}</td>
                        <td>{c.id==='PS'?fmt(d.amount):fmt(d.mrr)+'/mo'}</td>
                        <td style={{fontWeight:600,color:'#f1f5f9'}}>{fmt(dealARR(d))}</td>
                        {showComm&&<td style={{color:'#34d399'}}>{fmt(dealComm(d))}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
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
    arrVal=amt; commVal=amt*0.10;
    detail=fmt(amt)+' fee | Commission: '+fmt(amt)+' x 10% = '+fmt(commVal);
  } else if(calcCat==='FO'){
    arrVal=amt*rem; commVal=amt*0.07;
    detail=fmt(amt)+' MRR x '+rem+' months = '+fmt(arrVal)+' ARR | Commission: '+fmt(amt)+' x 7% = '+fmt(commVal)+' (1st month MRR only)';
  } else {
    arrVal=amt*rem; commVal=amt*1.0;
    detail=fmt(amt)+' MRR x '+rem+' months = '+fmt(arrVal)+' ARR | Commission: '+fmt(amt)+' x 1 = '+fmt(commVal)+' (1x MRR flat)';
  }
  return(
    <div>
      <div className="sa-card">
        <h2>ARR Calculator</h2>
        <div style={{fontSize:12,color:'#fff',marginBottom:16,fontStyle:'italic',lineHeight:1.7}}>
                     <strong style={{color:'#818cf8'}}>Professional Services:</strong> One-time project fee. Fee is the value â not annualized. Commission = 10% of fee.<br/>
          <strong style={{color:'#38bdf8'}}>FinOps:</strong> Recurring. ARR = MRR x months remaining. Commission = 7% of 1st month MRR.<br/>
          <strong style={{color:'#34d399'}}>Managed Services:</strong> Recurring. ARR = MRR x months remaining. Commission = 1x MRR (flat).<br/>
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
                                {MN.map((m,i)=><option key={i} value={i+1}>{m} â {13-(i+1)} months remaining</option>)}
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
            <div className="sub">{calcCat==='PS'?'10% of fee':calcCat==='FO'?'7% of 1st month MRR':'1x MRR (flat)'}</div>
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
            <thead><tr><th>Month</th><th>Months Remaining</th><th>ARR Value</th><th>Commission</th></tr></thead>
            <tbody>
              {MN.map((m,i)=>{
                const r=mrem(i+1), a=amt*r;
                const c = calcCat==='FO' ? amt*0.07 : amt*1.0;
                const isCur=i+1===Number(calcMonth);
                return(
                  <tr key={i} style={isCur?{background:'rgba(99,102,241,.08)'}:{}}>
                                        <td style={isCur?{color:'#818cf8',fontWeight:600}:{}}>{m}{isCur?' â¼':''}</td>
                    <td>{r}</td>
                    <td style={{fontWeight:isCur?700:400,color:'#fff'}}>{fmt(a)}</td>
                    <td style={{color:'#34d399'}}>{fmt(c)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{fontSize:11,color:'#a5b4fc',marginTop:8,fontStyle:'italic'}}>
                         {calcCat==='FO'?'Note: Commission = 7% of 1st month MRR â same regardless of month closed.':'Note: Commission = 1x MRR flat â same regardless of month closed.'}
          </div>
        </div>
      )}
    </div>
  );
}
function CommTab({data, filterRep, setFilterRep, showComm}){
  const [filterMonth, setFilterMonth] = useState('All');
  const deals = data.deals || [];
  const allMonths = [...new Set(deals.map(d=>d.month||1))].sort((a,b)=>a-b);
  const filteredDeals = filterMonth==='All' ? deals : deals.filter(d=>(d.month||1)===Number(filterMonth));
  const isCRO = filterRep === '__CRO__';
  const repsFor = filterRep==='All'||isCRO ? data.reps : data.reps.filter(r=>r.id===filterRep);
  const commFn = isCRO ? croCommissionFromDeals : repCommissionFromDeals;
  const totalComm = repsFor.reduce((s,r)=>s+commFn(r,filteredDeals).tot,0);
  const earning = repsFor.filter(r=>commFn(r,filteredDeals).tot>0).length;

  // Build summary rows (always by rep)
  let rows = [];
  rows = data.reps.filter(r=>filterRep==='All'||isCRO||r.id===filterRep).map(r=>{
    const c = commFn(r, filteredDeals);
    return { key: r.id, label: r.name, dept: r.dept||r.department||'Sales', ps: c.ps, fo: c.fo, ms: c.ms, tot: c.tot };
  });
    // Deal-level breakdown: show when a specific rep and/or month is chosen
  const showDeals = filterRep!=='All' || filterMonth!=='All';
  const dealRows = filteredDeals
    .filter(d => (filterRep==='All' || d.repId===filterRep) && d.stage==='Closed Won')
    .sort((a,b)=>(a.month||1)-(b.month||1)||(a.client||'').localeCompare(b.client||''));
  const repById = Object.fromEntries((data.reps||[]).map(r=>[r.id, r.name]));

  const selStyle = {background:'#1e293b',border:'1px solid rgba(99,102,241,.4)',color:'#f1f5f9',padding:'6px 10px',borderRadius:8,fontSize:13,cursor:'pointer',outline:'none'};
  const CAT_LABEL = {PS:'Professional Services',FO:'FinOps',MS:'Managed Services'};

  return(
    <div>
      {showComm ? (
      <div className="sa-g3">
        <div className="sa-stat"><div className="lbl">Total Commissions</div><div className="val" style={{color:'#34d399'}}>{fmt(totalComm)}</div><div className="sub">based on closed deals</div></div>
        <div className="sa-stat"><div className="lbl">Reps Earning</div><div className="val">{earning} / {data.reps.length}</div><div className="sub">reps with closed deals</div></div>
        <div className="sa-stat"><div className="lbl">Avg Commission/Rep</div><div className="val">{fmt(data.reps.length>0?totalComm/data.reps.length:0)}</div><div className="sub">across all reps</div></div>
      </div>
      ) : (
      <div style={{padding:'20px 0',textAlign:'center',color:'#64748b',fontSize:13}}>Commission data is hidden. Use the toggle on the Dashboard to show it.</div>
      )}
      <div style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap',marginBottom:16}}>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <label style={{fontSize:12,color:'#ffffff',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px'}}>Rep</label>
          <select style={selStyle} value={filterRep} onChange={e=>setFilterRep(e.target.value)}>
            <option value="All">All Reps</option>
              <option value="__CRO__">CRO View</option>
            {data.reps.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        {allMonths.length>0&&(
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <label style={{fontSize:12,color:'#ffffff',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px'}}>Month</label>
            <select style={selStyle} value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
              <option value="All">All Months</option>
              {allMonths.map(m=><option key={m} value={String(m)}>{MN[m-1]}</option>)}
            </select>
          </div>
        )}
      </div>
      {showComm&&<>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
        <button
          style={{background:'linear-gradient(135deg,#059669,#10b981)',border:'none',color:'#fff',padding:'8px 20px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:6}}
          onClick={()=>exportCommissionXLSX({data,filterRep,filterMonth})}
        >â¬ Export Commission Statement</button>
        <button
          style={{background:'linear-gradient(135deg,#1d4ed8,#3b82f6)',border:'none',color:'#fff',padding:'8px 20px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:6,marginLeft:8}}
          onClick={()=>exportCommissionPDF({data,filterRep,filterMonth})}
        >ð Export PDF</button>
      </div>
      <div className="sa-card">
        <table className="sa-tbl">
          <thead><tr>
            <th>Rep</th><th>Dept</th>
          <th>PS Commission</th>
          <th>FO Commission</th>
          <th>MS Commission</th>
          <th>Total Commission</th>
        </tr></thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.key}>
                <td style={{fontWeight:600,color:'#f1f5f9'}}>{r.label}</td>
              <td>{r.dept}</td>
              <td>{fmt(r.ps)}</td>
              <td>{fmt(r.fo)}</td>
              <td>{fmt(r.ms)}</td>
              <td style={{fontWeight:700,color:'#34d399'}}>{fmt(r.tot)}</td>
            </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDeals&&(
        <div className="sa-card" style={{marginTop:16}}>
          <h2 style={{fontSize:14,fontWeight:700,color:'#f1f5f9',margin:'0 0 14px',display:'flex',alignItems:'center',gap:8}}>
            Deals
            <span style={{fontSize:11,fontWeight:500,color:'#ffffff'}}>
                                               {filterRep!=='All'?repById[filterRep]:''}
            </span>
            <span style={{marginLeft:'auto',fontSize:12,color:'#ffffff'}}>{dealRows.length} deal{dealRows.length!==1?'s':''}</span>
          </h2>
          {dealRows.length===0?(
            <div style={{color:'#64748b',fontSize:13,textAlign:'center',padding:'20px 0'}}>No deals match the current filters.</div>
          ):(
            <table className="sa-tbl">
              <thead><tr>
                {filterRep==='All'&&<th>Rep</th>}
                <th>Client</th>
                <th>Category</th>
                <th>Stage</th>
                {filterMonth==='All'&&<th>Month</th>}
                <th>Amount / MRR</th>
                <th>Commission</th>
              </tr></thead>
              <tbody>
                {dealRows.map(d=>(
                  <tr key={d.id}>
                    {filterRep==='All'&&<td style={{color:'#f1f5f9',fontWeight:500}}>{repById[d.repId]||d.repId}</td>}
                    <td style={{color:'#f1f5f9',fontWeight:500}}>{d.client}</td>
                    <td><span style={{display:'inline-block',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:d.cat==='PS'?'rgba(139,92,246,.2)':d.cat==='FO'?'rgba(59,130,246,.2)':'rgba(16,185,129,.2)',color:d.cat==='PS'?'#a78bfa':d.cat==='FO'?'#60a5fa':'#34d399'}}>{CAT_LABEL[d.cat]||d.cat}</span></td>
                    <td><span style={{display:'inline-block',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:d.stage==='Closed Won'?'rgba(16,185,129,.15)':d.stage==='Forecasted'?'rgba(245,158,11,.15)':d.stage==='SOW Sent'?'rgba(239,68,68,.2)':'rgba(100,116,139,.15)',color:d.stage==='Closed Won'?'#34d399':d.stage==='Forecasted'?'#fbbf24':d.stage==='SOW Sent'?'#f87171':'#94a3b8'}}>{d.stage||'â'}</span></td>
                    {filterMonth==='All'&&<td>{MN[(d.month||1)-1]}</td>}
                    <td>{d.cat==='PS'?fmt(d.amount):fmt(d.mrr)+'/mo'}</td>
                    <td style={{fontWeight:700,color:'#34d399'}}>{fmt(dealComm(d))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      </>}
    </div>
  );
}

async function exportCommissionXLSX({data,filterRep,filterMonth}){
  if(!window.XLSX){ await new Promise((resolve,reject)=>{ const s=document.createElement('script'); s.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'; s.onload=resolve; s.onerror=reject; document.head.appendChild(s); }); }
  const XL=window.XLSX;
  const YEAR=new Date().getFullYear();
  const deals=data.deals||[];
  const reps=data.reps||[];
  const CAT_FULL={PS:'Professional Services',FO:'FinOps',MS:'Managed Services'};
  const CAT_RATE={PS:'10% of fee',FO:'7% of 1st mo MRR',MS:'1x MRR (flat)'};
  // repFilteredDeals: ALL deals for selected rep, NO month filter = YTD
  const isCRO=filterRep==='__CRO__'; const repFilteredDeals=(filterRep==='All'||isCRO)?deals:deals.filter(d=>d.repId===filterRep);
  // monthFilteredDeals: rep+month filtered = deal detail section only
  const monthFilteredDeals=repFilteredDeals.filter(d=>filterMonth==='All'||(d.month||1)===Number(filterMonth));
  const filteredReps=(filterRep==='All'||isCRO)?reps:reps.filter(r=>r.id===filterRep);
  const commFn=isCRO?croCommissionFromDeals:repCommissionFromDeals;
  const repLabel=filterRep==='All'?'All Reps':isCRO?'CRO View':(reps.find(r=>r.id===filterRep)||{name:'Unknown'}).name;
  const moLabel=filterMonth==='All'?'All Months':MN[Number(filterMonth)-1];
  const wb=XL.utils.book_new();
  // SHEET 1: REP SCORECARDS (always YTD)
  const sc=[];
  sc.push(['COMMISSION STATEMENT â YTD '+YEAR+' ('+repLabel+')','','','','','','','']);
  sc.push(['Generated: '+new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})+'  |  Scorecard: Full YTD  |  Deal detail filter: '+moLabel,'','','','','','','']);
  sc.push(['']);
  filteredReps.forEach((r,idx)=>{
    if(idx>0){sc.push(['']);sc.push(['']);}
    const myDeals=repFilteredDeals.filter(d=>d.repId===r.id);
    const psA=myDeals.filter(d=>d.cat==='PS'&&d.stage==='Closed Won').reduce((s,d)=>s+dealARR(d),0);
    const foA=myDeals.filter(d=>d.cat==='FO'&&d.stage==='Closed Won').reduce((s,d)=>s+d.mrr,0);
    const msA=myDeals.filter(d=>d.cat==='MS'&&d.stage==='Closed Won').reduce((s,d)=>s+d.mrr,0);
    const totA=psA+foA+msA;
    const psQ=getQuota(r,'PS'),foQ=getQuota(r,'FO'),msQ=getQuota(r,'MS');
    const totQ=psQ+foQ+msQ;
    const comm=commFn(r,repFilteredDeals);
    const ytdPct=(filterMonth !== 'All' ? Number(filterMonth) : CM)/12;
    const attain=totQ>0?(totA/(totQ*ytdPct)*100).toFixed(1)+'%':'--';
    const status=totQ>0?(totA/(totQ*ytdPct)>=1?'On Track':'Behind Pace'):'--';
    sc.push(['ââ '+r.name.toUpperCase()+' ââ','','','','','','','']);
    sc.push(['Department:',r.dept||r.department||'Sales','','Total Deals Won (YTD):',myDeals.length,'','YTD Period:','Jan â '+MN[CM-1]+' '+YEAR]);
    sc.push(['']);
    sc.push(['KPI SUMMARY â YTD (All Months)','','','','','','','']);
    sc.push(['Total ARR Closed','Total Commission','Quota Attainment','Status','YTD Pace','PS Commission','FO Commission','MS Commission']);
    sc.push([totA,comm.tot,attain,status,(ytdPct*100).toFixed(1)+'%',comm.ps,comm.fo,comm.ms]);
    sc.push(['']);
    sc.push(['CATEGORY BREAKDOWN â YTD','','','','','','','']);
    sc.push(['Category','ARR Closed (YTD)','Annual Quota','YTD Quota','Attainment %','Commission (YTD)','Commission Rate','Deals (YTD)']);
    ['PS','FO','MS'].forEach(cat=>{
      const cA=myDeals.filter(d=>d.cat===cat&&d.stage==='Closed Won').reduce((s,d)=>s+(cat==='PS'?dealARR(d):d.mrr||0),0);
      const cQ=getQuota(r,cat);
      const cComm=cat==='PS'?comm.ps:cat==='FO'?comm.fo:comm.ms;
      sc.push([CAT_FULL[cat],cA,cQ,cQ*(CM/12),cQ>0?(cA/(cQ*(CM/12))*100).toFixed(1)+'%':'--',cComm,CAT_RATE[cat],myDeals.filter(d=>d.cat===cat).length]);
    });
    sc.push(['TOTAL',totA,totQ,totQ*(CM/12),attain,comm.tot,'',myDeals.length]);
    sc.push(['']);
    const dealRows=monthFilteredDeals.filter(d=>d.repId===r.id);
    sc.push(['DEAL BREAKDOWN â '+moLabel,'','','','','','','']);
    sc.push(['Client','Category','Month Closed','Fee / MRR','ARR Value','Commission','Commission Rate','Mo. Remaining']);
    [...dealRows].sort((a,b)=>(a.month||1)-(b.month||1)).forEach(d=>{
      sc.push([d.client,CAT_FULL[d.cat]||d.cat,MN[(d.month||1)-1],d.cat==='PS'?d.amount:d.mrr,dealARR(d),dealComm(d),CAT_RATE[d.cat]||'',d.cat==='PS'?'N/A':mrem(d.month||1)]);
    });
    if(!dealRows.length) sc.push(['(No deals match the selected month filter)']);
    else sc.push(['','','','','Subtotal:',dealRows.reduce((s,d)=>s+dealARR(d),0),'Commission:',dealRows.reduce((s,d)=>s+dealComm(d),0)]);
  });
  const wsS=XL.utils.aoa_to_sheet(sc);
  wsS['!cols']=[{wch:34},{wch:16},{wch:16},{wch:22},{wch:16},{wch:18},{wch:18},{wch:14}];
  XL.utils.book_append_sheet(wb,wsS,'Rep Scorecards');
  // SHEET 2: DEAL DETAIL (month-filtered)
  const dd=[];
  dd.push(['DEAL DETAIL â '+repLabel+' â '+moLabel+' â '+YEAR,'','','','','','','','','']);
  dd.push(['']);
  dd.push(['Rep Name','Department','Client','Category','Month Closed','Fee / MRR','ARR Value','Mo. Remaining','Commission','Commission Rate']);
  const sorted=[...monthFilteredDeals].sort((a,b)=>{ const rA=(reps.find(r=>r.id===a.repId)||{name:''}).name; const rB=(reps.find(r=>r.id===b.repId)||{name:''}).name; if(rA!==rB) return rA.localeCompare(rB); return (a.month||1)-(b.month||1); });
  let lastRep=null;
  sorted.forEach(d=>{ const rep=reps.find(r=>r.id===d.repId); const rn=rep?rep.name:'Unknown'; if(lastRep&&lastRep!==rn) dd.push(['']); lastRep=rn; dd.push([rn,rep?(rep.dept||rep.department||'Sales'):'',d.client,CAT_FULL[d.cat]||d.cat,MN[(d.month||1)-1],d.cat==='PS'?d.amount:d.mrr,dealARR(d),d.cat==='PS'?'N/A':mrem(d.month||1),dealComm(d),CAT_RATE[d.cat]||'']); });
  dd.push(['']);
  dd.push(['TOTALS','',monthFilteredDeals.length+' deals','','','',monthFilteredDeals.reduce((s,d)=>s+dealARR(d),0),'',monthFilteredDeals.reduce((s,d)=>s+dealComm(d),0),'']);
  const wsD=XL.utils.aoa_to_sheet(dd);
  wsD['!cols']=[{wch:22},{wch:12},{wch:28},{wch:22},{wch:12},{wch:14},{wch:14},{wch:14},{wch:14},{wch:16}];
  XL.utils.book_append_sheet(wb,wsD,'Deal Detail');
  // SHEET 3: MONTHLY BREAKDOWN (YTD)
  const ams=[...new Set(repFilteredDeals.map(d=>d.month||1))].sort((a,b)=>a-b);
  const mr=[];
  mr.push(['MONTHLY BREAKDOWN â YTD '+YEAR+' ('+repLabel+')','','','','','','','','','']);
  mr.push(['']);
  mr.push(['Month','PS Commission','FO Commission','MS Commission','Total Commission','PS Deals','FO Deals','MS Deals','Total Deals','Total ARR']);
  ams.forEach(m=>{ const mD=repFilteredDeals.filter(d=>(d.month||1)===m); const ps=mD.filter(d=>d.cat==='PS').reduce((s,d)=>s+dealComm(d),0); const fo=mD.filter(d=>d.cat==='FO').reduce((s,d)=>s+dealComm(d),0); const ms=mD.filter(d=>d.cat==='MS').reduce((s,d)=>s+dealComm(d),0); mr.push([MN[m-1],ps,fo,ms,ps+fo+ms,mD.filter(d=>d.cat==='PS').length,mD.filter(d=>d.cat==='FO').length,mD.filter(d=>d.cat==='MS').length,mD.length,mD.reduce((s,d)=>s+dealARR(d),0)]); });
  mr.push(['']);
  const tPS=repFilteredDeals.filter(d=>d.cat==='PS').reduce((s,d)=>s+dealComm(d),0);
  const tFO=repFilteredDeals.filter(d=>d.cat==='FO').reduce((s,d)=>s+dealComm(d),0);
  const tMS=repFilteredDeals.filter(d=>d.cat==='MS').reduce((s,d)=>s+dealComm(d),0);
  mr.push(['YTD TOTAL',tPS,tFO,tMS,tPS+tFO+tMS,'','','',repFilteredDeals.length,repFilteredDeals.reduce((s,d)=>s+dealARR(d),0)]);
  const wsM=XL.utils.aoa_to_sheet(mr);
  wsM['!cols']=[{wch:12},{wch:16},{wch:16},{wch:16},{wch:18},{wch:10},{wch:10},{wch:10},{wch:12},{wch:16}];
  XL.utils.book_append_sheet(wb,wsM,'Monthly Breakdown');
  // SHEET 4: MONTH-OVER-MONTH TREND
  const allRepsForTrend = data.reps || [];
  const allDealsForTrend = data.deals || [];
  // Get all months that have deals across all reps
  const allMonthNums = [...new Set(allDealsForTrend.map(d => d.month || 1))].sort((a,b)=>a-b);
  // If filtering by rep, show that rep's months; otherwise all months with deals
  const trendReps = filterRep === 'All' ? allRepsForTrend : allRepsForTrend.filter(r => r.id === filterRep);
  const trendDeals = filterRep === 'All' ? allDealsForTrend : allDealsForTrend.filter(d => trendReps.some(r => r.id === d.repId));
  const trendMonths = [...new Set(trendDeals.map(d => d.month || 1))].sort((a,b)=>a-b);
  const MOM = [];
  // Title row
  MOM.push(['MONTH-OVER-MONTH TREND  ' + YEAR + (filterRep !== 'All' ? '  ('+repLabel+')' : '  (All Reps)'),'','','','','','','','','','','','','','']);
  MOM.push(['']);
  // Build header: Month | per-rep columns | Team Totals
  const hdr = ['Month'];
  trendReps.forEach(r => {
    hdr.push(r.name + ' ARR', r.name + ' Comm', r.name + ' Deals');
  });
  hdr.push('Team ARR','Team Commission','Team Deals','YTD ARR (Cumulative)','YTD Commission (Cumulative)');
  MOM.push(hdr);
  // Data rows - one per month
  let ytdARR = 0, ytdComm = 0;
  trendMonths.forEach(m => {
    const mName = MN[m-1] || ('Month ' + m);
    const row = [mName];
    let teamARR = 0, teamComm = 0, teamDeals = 0;
    trendReps.forEach(r => {
      const mDeals = trendDeals.filter(d => d.repId === r.id && (d.month || 1) === m);
      const rARR = mDeals.reduce((s,d) => s + dealARR(d), 0);
      const rComm = mDeals.reduce((s,d) => s + dealComm(d), 0);
      row.push(rARR, rComm, mDeals.length);
      teamARR += rARR;
      teamComm += rComm;
      teamDeals += mDeals.length;
    });
    ytdARR += teamARR;
    ytdComm += teamComm;
    row.push(teamARR, teamComm, teamDeals, ytdARR, ytdComm);
    MOM.push(row);
  });
  // Totals row
  if (trendMonths.length > 1) {
    MOM.push(['']);
    const totRow = ['TOTAL (YTD)'];
    trendReps.forEach(r => {
      const rDeals = trendDeals.filter(d => d.repId === r.id);
      totRow.push(rDeals.reduce((s,d)=>s+dealARR(d),0), rDeals.reduce((s,d)=>s+dealComm(d),0), rDeals.length);
    });
    totRow.push(ytdARR, ytdComm, trendDeals.length, ytdARR, ytdComm);
    MOM.push(totRow);
  }
  const wsMOM = XL.utils.aoa_to_sheet(MOM);
  wsMOM['!cols'] = [{wch:14},...trendReps.flatMap(()=>[{wch:16},{wch:16},{wch:12}]),{wch:16},{wch:20},{wch:14},{wch:22},{wch:26}];
  XL.utils.book_append_sheet(wb,wsMOM,'MoM Trend');
  const dateStr=new Date().toISOString().slice(0,10);
  XL.writeFile(wb,'Commission_'+repLabel.replace(/\s+/g,'_')+'_'+moLabel.replace(/\s+/g,'_')+'_'+YEAR+'_'+dateStr+'.xlsx');
}

function exportCommissionPDF({data,filterRep,filterMonth}){
  const deals = data.deals||[];
  const reps = data.reps||[];
  const YEAR = new Date().getFullYear();
  const CM_now = (filterMonth && filterMonth !== 'All') ? Number(filterMonth) : new Date().getMonth()+1;

  // Normalize filters
  const isCROPdf = filterRep==='__CRO__'; const repAll = !filterRep || filterRep==='All' || isCROPdf;
  const moAll = !filterMonth || filterMonth==='All';
  const repList = repAll ? reps : reps.filter(r=>r.id===filterRep||r.name===filterRep);
  // filterMonth is numeric string ('1'-'12') or month name ('Jan') or 'All'/undefined
  const filterMoNum = moAll ? null : (isNaN(Number(filterMonth)) ? MN.indexOf(filterMonth)+1 : Number(filterMonth));
  const moName = moAll ? '' : (isNaN(Number(filterMonth)) ? filterMonth : MN[Number(filterMonth)-1]);

  const repLabel = isCROPdf ? 'CRO View' : repAll ? 'All Reps' : (repList[0]?.name||filterRep);
  const moLabel  = moAll ? 'YTD (All Months)' : moName+' '+YEAR;

  // Quota helper - rep quotas stored by rep.id
  const catNames={'PS':'Professional Services','FO':'FinOps','MS':'Managed Services'};
  const getQ=(rep,cid)=>{
    const rq=rep.quotas||{};
    return Number(rq[catNames[cid]]||0);
  };

  // deal.month is numeric (1-12), deal.cat is category key
  const dealMo = d => Number(d.month);
  const dealCat = d => d.cat||d.category||'';
  const dealInPeriod = (d,forYTD) => {
    const m = dealMo(d);
    if(forYTD) return m>=1 && m<=CM_now;
    return moAll ? (m>=1 && m<=CM_now) : m===filterMoNum;
  };
  const dealIsRep = (d,rep) => d.repId===rep.id || d.rep===rep.name;

  let sections = '';
  if(isCROPdf){
    // ââ CRO VIEW: single consolidated section ââââââââââââââââââââââââââââââââ
    const allDeals = deals.filter(d => repList.some(rep => dealIsRep(d,rep)) && dealInPeriod(d,false) && d.stage === 'Closed Won');
    let totARR=0, totMRR=0, totComm=0, totPS=0, totFO=0, totMS=0;
    allDeals.forEach(d=>{
      const cat=dealCat(d), fee=Number(d.amount||d.fee||0), mrr=Number(d.mrr||0), rem=mrem(dealMo(d));
      let arr=0,comm=0;
      if(cat==='PS'){arr=fee;comm=fee*0.03;}
      else if(cat==='FO'){arr=mrr*rem;comm=mrr*0.07*0.25;}
      else if(cat==='MS'){arr=mrr*rem;comm=mrr*0.25;}
      totARR+=arr;totMRR+=(cat==='PS'?fee:mrr);totComm+=comm;
      if(cat==='PS')totPS+=comm;else if(cat==='FO')totFO+=comm;else if(cat==='MS')totMS+=comm;
    });
    // Category breakdown
    const cats=[{id:'PS',name:'Professional Services'},{id:'FO',name:'FinOps'},{id:'MS',name:'Managed Services'}];
    let catRows='';
    cats.forEach(c=>{
      const cDeals=allDeals.filter(d=>dealCat(d)===c.id);
      let cMRR=0,cComm=0;
      cDeals.forEach(d=>{
        const fee=Number(d.amount||d.fee||0),mrr=Number(d.mrr||0),rem=mrem(dealMo(d));
        if(c.id==='PS'){cMRR+=fee;cComm+=fee*0.03;}
        else if(c.id==='FO'){cMRR=mrr;cComm+=mrr*0.07*0.25;}
        else if(c.id==='MS'){cMRR=mrr;cComm+=mrr*0.25;}
      });
      catRows+=`<tr><td>${c.name}</td><td class="num">${fmt(cMRR)}</td><td class="num green">${fmt(cComm)}</td><td class="num">${cDeals.length}</td></tr>`;
    });
    catRows+=`<tr class="total-row"><td>TOTAL</td><td class="num">${fmt(totMRR)}</td><td class="num green">${fmt(totComm)}</td><td class="num">${allDeals.length}</td></tr>`;
    // Deal rows
    let dealRows='';
    if(allDeals.length===0){
      dealRows='<tr><td colspan="6" style="text-align:center;color:#888;font-style:italic;">No deals in selected period</td></tr>';
    } else {
      const sorted=[...allDeals].sort((a,b)=>{
        const rA=(repList.find(r=>dealIsRep(a,r))||{name:''}).name;
        const rB=(repList.find(r=>dealIsRep(b,r))||{name:''}).name;
        if(rA!==rB) return rA.localeCompare(rB);
        return (dealMo(a)||1)-(dealMo(b)||1);
      });
      sorted.forEach(d=>{
        const cat=dealCat(d),fee=Number(d.amount||d.fee||0),mrr=Number(d.mrr||0),rem=mrem(dealMo(d));
        let arr=0,comm=0;
        if(cat==='PS'){arr=fee;comm=fee*0.03;}
        else if(cat==='FO'){arr=mrr*rem;comm=mrr*0.07*0.25;}
        else if(cat==='MS'){arr=mrr*rem;comm=mrr*0.25;}
        const repName=(repList.find(r=>dealIsRep(d,r))||{name:'Unknown'}).name;
        const catName=CAT_KEYS[cat]||cat;
        const moName=MN[dealMo(d)-1]||'';
        dealRows+=`<tr><td>${d.client||''}</td><td>${repName}</td><td><span class="badge badge-${cat.toLowerCase()}">${catName}</span></td><td class="num">${cat==='PS'?fmt(fee):fmt(mrr)+'/mo'}</td><td class="num green">${fmt(comm)}</td><td>${moName} ${YEAR}</td></tr>`;
      });
    }
    sections=`<div class="rep-section">
<div class="rep-header"><div class="rep-name">CRO Commission Summary</div><div class="rep-meta">All Reps &nbsp;|&nbsp; Period: ${moLabel} &nbsp;|&nbsp; ${allDeals.length} deals</div></div>
<div class="kpi-grid">
  <div class="kpi-box"><div class="kpi-label">Total MRR</div><div class="kpi-value">${fmt(totMRR)}</div></div>
  <div class="kpi-box"><div class="kpi-label">Total CRO Commission</div><div class="kpi-value green">${fmt(totComm)}</div></div>
  <div class="kpi-box"><div class="kpi-label">Deals</div><div class="kpi-value">${allDeals.length}</div></div>
</div>
<div class="section-title">Commission Breakdown (${moLabel})</div>
<div class="comm-pills">
  <div class="pill"><span class="pill-label">PS Commission (3%)</span><span class="pill-value">${fmt(totPS)}</span></div>
  <div class="pill"><span class="pill-label">FO Commission (1.75%)</span><span class="pill-value">${fmt(totFO)}</span></div>
  <div class="pill"><span class="pill-label">MS Commission (25%)</span><span class="pill-value">${fmt(totMS)}</span></div>
</div>
<div class="section-title">Category Breakdown (${moLabel})</div>
<table><thead><tr><th>Category</th><th>MRR Closed</th><th>CRO Commission</th><th>Deals</th></tr></thead><tbody>${catRows}</tbody></table>
<div class="section-title">Deal Detail${moAll?' (YTD)':' - '+moName+' '+YEAR}</div>
<table><thead><tr><th>Client</th><th>Rep</th><th>Category</th><th>Amount/MRR</th><th>CRO Commission</th><th>Month</th></tr></thead><tbody>${dealRows}</tbody></table>
</div>`;
  } else {
    // ââ INDIVIDUAL REP VIEW âââââââââââââââââââââââââââââââââââââââââââââââââââ
    repList.forEach(rep=>{
      const repDeals = deals.filter(d=>dealIsRep(d,rep) && dealInPeriod(d,false) && d.stage === 'Closed Won');
      let totARR=0,totMRR=0,totComm=0,totPS=0,totFO=0,totMS=0;
      repDeals.forEach(d=>{
        const cat=dealCat(d);
        const fee=Number(d.amount||d.fee||0);
        const mrr=Number(d.mrr||0);
        const rem=mrem(dealMo(d));
        let arr=0,comm=0;
        if(cat==='PS'){arr=fee;comm=fee*CR.PS;}
        else if(cat==='FO'){arr=mrr*rem;comm=mrr*CR.FO;}
        else if(cat==='MS'){arr=mrr*rem;comm=mrr*CR.MS;}
        totARR+=arr;totMRR+=(cat==='PS'?fee:mrr);totComm+=comm;
        if(cat==='PS') totPS+=comm; else if(cat==='FO') totFO+=comm; else if(cat==='MS') totMS+=comm;
      });
      const ytdPct=CM_now/12;
      let totQ=0;
      ['PS','FO','MS'].forEach(cid=>{ totQ+=getQ(rep,cid); });
      const attain=totQ>0?Math.round(totMRR/(totQ*ytdPct)*100):0;
      const status=totQ>0&&totMRR>=(totQ*ytdPct)?'On Track':'Behind Pace';
      const cats=[{id:'PS',name:'Professional Services'},{id:'FO',name:'FinOps'},{id:'MS',name:'Managed Services'}];
      let catRows='';
      cats.forEach(c=>{
        const cDeals=repDeals.filter(d=>dealCat(d)===c.id);
        let cMRR=0,cComm=0;
        cDeals.forEach(d=>{
          const fee=Number(d.amount||d.fee||0);
          const mrr=Number(d.mrr||0);
          const rem=mrem(dealMo(d));
          if(c.id==='PS'){cMRR+=fee;cComm+=fee*CR.PS;}
          else if(c.id==='FO'){cMRR+=mrr;cComm+=mrr*CR.FO;}
          else if(c.id==='MS'){cMRR+=mrr;cComm+=mrr*CR.MS;}
        });
        const cQ=getQ(rep,c.id);
        const ytdQ=Math.round(cQ*ytdPct);
        const cAtt=ytdQ>0?Math.round(cMRR/ytdQ*100):0;
        catRows+=`<tr><td>${c.name}</td><td class="num">${fmt(cMRR)}</td><td class="num green">${fmt(cComm)}</td><td class="num">${fmt(cQ)}</td><td class="num">${fmt(ytdQ)}</td><td class="num ${cAtt>=100?'good':cAtt>=75?'warn':'bad'}">${cAtt}%</td></tr>`;
      });
      catRows+=`<tr class="total-row"><td>TOTAL</td><td class="num">${fmt(totMRR)}</td><td class="num green">${fmt(totComm)}</td><td class="num">${fmt(totQ)}</td><td class="num">${fmt(Math.round(totQ*ytdPct))}</td><td class="num ${attain>=100?'good':attain>=75?'warn':'bad'}">${attain}%</td></tr>`;
      let dealRows='';
      if(repDeals.length===0){
        dealRows='<tr><td colspan="6" style="text-align:center;color:#888;font-style:italic;">No deals in selected period</td></tr>';
      } else {
        repDeals.forEach(d=>{
          const cat=dealCat(d);
          const fee=Number(d.amount||d.fee||0);
          const mrr=Number(d.mrr||0);
          const rem=mrem(dealMo(d));
          let arr=0,comm=0;
          if(cat==='PS'){arr=fee;comm=fee*CR.PS;}
          else if(cat==='FO'){arr=mrr*rem;comm=mrr*CR.FO;}
          else if(cat==='MS'){arr=mrr*rem;comm=mrr*CR.MS;}
          const catName=CAT_KEYS[cat]||cat;
          const moName=MN[dealMo(d)-1]||'';
          dealRows+=`<tr><td>${d.client||''}</td><td><span class="badge badge-${cat.toLowerCase()}">${catName}</span></td><td class="num">${cat==='PS'?fmt(fee):fmt(mrr)+'/mo'}</td><td class="num green">${fmt(comm)}</td><td>${moName} ${YEAR}</td></tr>`;
        });
      }
      sections+=`<div class="rep-section"><div class="rep-header"><div class="rep-name">${rep.name}</div><div class="rep-meta">Dept: ${rep.dept||'Sales'} &nbsp;|&nbsp; Period: ${moLabel}</div></div><div class="kpi-grid"><div class="kpi-box"><div class="kpi-label">Total MRR</div><div class="kpi-value">${fmt(totMRR)}</div></div><div class="kpi-box"><div class="kpi-label">Total Commission</div><div class="kpi-value green">${fmt(totComm)}</div></div><div class="kpi-box"><div class="kpi-label">Quota Attainment</div><div class="kpi-value ${attain>=100?'good':attain>=75?'warn':'bad'}">${attain}%</div></div><div class="kpi-box"><div class="kpi-label">Status</div><div class="kpi-value ${status==='On Track'?'good':'bad'}">${status}</div></div></div><div class="section-title">Commission Breakdown (${moLabel})</div><div class="comm-pills"><div class="pill"><span class="pill-label">PS Commission</span><span class="pill-value">${fmt(totPS)}</span></div><div class="pill"><span class="pill-label">FO Commission</span><span class="pill-value">${fmt(totFO)}</span></div><div class="pill"><span class="pill-label">MS Commission</span><span class="pill-value">${fmt(totMS)}</span></div></div><div class="section-title">Category Breakdown (${moLabel})</div><table><thead><tr><th>Category</th><th>MRR Closed</th><th>Commission</th><th>Annual Quota</th><th>YTD Quota</th><th>Attainment</th></tr></thead><tbody>${catRows}</tbody></table><div class="section-title">Deal Detail${moAll?' (YTD)':' - '+moName+' '+YEAR}</div><table><thead><tr><th>Client</th><th>Category</th><th>Amount/MRR</th><th>Commission</th><th>Month</th></tr></thead><tbody>${dealRows}</tbody></table></div>`;
    });
  }

  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Commission Statement</title><style>@page{margin:18mm 15mm;}*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#1a1a2e;background:#fff;}.page-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #059669;padding-bottom:10px;margin-bottom:18px;}.company-name{font-size:20px;font-weight:700;color:#059669;letter-spacing:1px;}.doc-title{font-size:13px;color:#555;margin-top:4px;}.doc-meta{text-align:right;font-size:11px;color:#555;line-height:1.7;}.doc-meta .period{font-size:13px;font-weight:700;color:#1a1a2e;}.rep-section{margin-bottom:28px;page-break-inside:avoid;}.rep-header{background:#f0fdf4;border-left:4px solid #059669;padding:10px 14px;margin-bottom:14px;border-radius:4px;}.rep-name{font-size:16px;font-weight:700;color:#1a1a2e;}.rep-meta{font-size:11px;color:#666;margin-top:3px;}.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;}.kpi-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;text-align:center;}.kpi-label{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#666;margin-bottom:4px;}.kpi-value{font-size:15px;font-weight:700;color:#1a1a2e;}.section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#059669;border-bottom:1px solid #d1fae5;padding-bottom:4px;margin-bottom:8px;margin-top:14px;}.comm-pills{display:flex;gap:10px;margin-bottom:14px;}.pill{flex:1;background:#f0fdf4;border:1px solid #a7f3d0;border-radius:6px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;}.pill-label{font-size:10px;color:#555;}.pill-value{font-size:13px;font-weight:700;color:#059669;}table{width:100%;border-collapse:collapse;margin-bottom:6px;font-size:10.5px;}thead tr{background:#059669;color:#fff;}thead th{padding:5px 8px;text-align:center;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.3px;}tbody tr:nth-child(even){background:#f8fafc;}td{padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:center;}.num{text-align:center;font-variant-numeric:tabular-nums;}.total-row{background:#e6f7f0!important;font-weight:700;}.green{color:#059669;font-weight:600;}.good{color:#059669;}.warn{color:#d97706;}.bad{color:#dc2626;}.badge{display:inline-block;padding:2px 7px;border-radius:10px;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.3px;}.badge-ps{background:#dbeafe;color:#1d4ed8;}.badge-fo{background:#fef3c7;color:#92400e;}.badge-ms{background:#d1fae5;color:#065f46;}.footer{margin-top:24px;border-top:1px solid #e2e8f0;padding-top:8px;text-align:center;font-size:9px;color:#aaa;}@media print{.rep-section{page-break-inside:avoid;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body><div class="page-header"><div><img src="/cloudelligent-logo.png" alt="Cloudelligent" style="height:36px;width:auto;" /><div class="doc-title">Commission Statement</div></div><div class="doc-meta"><div class="period">${moLabel}</div><div>Generated: ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div><div>Fiscal Year: ${YEAR}</div></div></div>${sections}<div class="footer">Cloudelligent Commission Statement &nbsp;|&nbsp; Confidential &nbsp;|&nbsp; Generated ${new Date().toLocaleString()}</div></body></html>`;

  // Render in fullscreen iframe overlay - no popup required
  const overlay=document.createElement('div');
  overlay.id='pdf-preview-overlay';
  overlay.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:99999;display:flex;flex-direction:column;';
  const toolbar=document.createElement('div');
  toolbar.style.cssText='background:#1e293b;color:#fff;padding:10px 16px;display:flex;align-items:center;gap:12px;flex-shrink:0;';
  toolbar.innerHTML='<span style="font-weight:600;font-size:14px;">Commission Statement Preview</span><button onclick="window.frames[\'pdfFrame\'].print()" style="background:#059669;color:#fff;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;font-weight:600;">ð¨ Print / Save as PDF</button><button onclick="document.getElementById(\'pdf-preview-overlay\').remove()" style="background:#dc2626;color:#fff;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;font-weight:600;margin-left:auto;">â Close</button>';
  const iframe=document.createElement('iframe');
  iframe.name='pdfFrame';
  iframe.style.cssText='flex:1;width:100%;border:none;background:#fff;';
  overlay.appendChild(toolbar);
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
}

function SettingsTab({data, save}){
  const deals = data.deals || [];
  const cq = data.companyQuotas || { PS:0, FO:0, MS:0 };
  const [qf, setQf] = useState({ PS: cq.PS||'', FO: cq.FO||'', MS: cq.MS||'' });
  const [saved, setSaved] = useState(false);
  const totalClosed = data.reps.reduce((s,r)=>s+getActualFromDeals(r.id,'PS',deals)+getActualFromDeals(r.id,'FO',deals)+getActualFromDeals(r.id,'MS',deals),0);
  const totalComm = deals.reduce((s,d)=>s+dealComm(d),0);
  const totalQuota = (Number(qf.PS)||0)+(Number(qf.FO)||0)+(Number(qf.MS)||0);
  const saveQuotas = () => {
    const d = JSON.parse(JSON.stringify(data));
    d.companyQuotas = { PS: Number(qf.PS)||0, FO: Number(qf.FO)||0, MS: Number(qf.MS)||0 };
    save(d);
    setSaved(true);
    setTimeout(()=>setSaved(false), 2000);
  };
  return(
    <div>
      <div className="sa-g3">
        <div className="sa-stat"><div className="lbl">Total Closed ARR</div><div className="val" style={{color:'#34d399'}}>{fmt(totalClosed)}</div><div className="sub">across all reps</div></div>
        <div className="sa-stat"><div className="lbl">Total Company Quota</div><div className="val">{fmt(totalQuota)}</div><div className="sub">PS + FO + MS combined</div></div>
        <div className="sa-stat"><div className="lbl">Total Commissions</div><div className="val" style={{color:'#34d399'}}>{fmt(totalComm)}</div><div className="sub">based on deals</div></div>
      </div>
      <div className="sa-card">
        <h2>Company Quota by Category</h2>
        <div style={{fontSize:13,color:'#a5b4fc',marginBottom:16,lineHeight:1.6}}>
          Set the total annual quota for each category. These drive attainment % on the Dashboard and Category Performance tabs.
        </div>
        <div className="sa-frow">
          <div>
            <label className="sa-label">Professional Services Annual Quota ($)</label>
            <input className="sa-input" type="number" value={qf.PS} onChange={e=>setQf({...qf,PS:e.target.value})} placeholder="e.g. 6500000"/>
            <div style={{fontSize:11,color:'#fff',marginTop:4}}>One-time project fees</div>
          </div>
          <div>
            <label className="sa-label">FinOps Annual Quota ($)</label>
            <input className="sa-input" type="number" value={qf.FO} onChange={e=>setQf({...qf,FO:e.target.value})} placeholder="e.g. 32000000"/>
            <div style={{fontSize:11,color:'#fff',marginTop:4}}>Recurring MRR x months remaining</div>
          </div>
          <div>
            <label className="sa-label">Managed Services Annual Quota ($)</label>
            <input className="sa-input" type="number" value={qf.MS} onChange={e=>setQf({...qf,MS:e.target.value})} placeholder="e.g. 1500000"/>
            <div style={{fontSize:11,color:'#fff',marginTop:4}}>Recurring MRR x months remaining</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12,marginTop:4}}>
          <button className="sa-btn" onClick={saveQuotas}>Save Quotas</button>
          {saved&&<span style={{color:'#34d399',fontSize:13,fontWeight:600}}>Saved!</span>}
          {totalQuota>0&&<span style={{color:'#fff',fontSize:12}}>Total: {fmt(totalQuota)}</span>}
        </div>
      </div>
      <div className="sa-card">
        <h2>Commission Rates</h2>
        <div className="sa-g3">
          {[
            {id:'PS',label:'Professional Services',rate:'10%',note:'10% of one-time project fee'},
            {id:'FO',label:'FinOps',rate:'7% of 1st mo MRR',note:'7% of 1st month MRR (not of full ARR)'},
            {id:'MS',label:'Managed Services',rate:'1x MRR',note:'1x MRR flat (not a % of ARR)'},
          ].map(c=>(
            <div key={c.id} style={{background:'#0f172a',borderRadius:10,padding:16,border:'1px solid rgba(255,255,255,.06)'}}>
              <div style={{fontSize:11,color:'#fff',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{c.label}</div>
              <div style={{fontSize:22,fontWeight:700,color:'#f1f5f9'}}>{c.rate}</div>
              <div style={{fontSize:11,color:'#818cf8',marginTop:4,fontStyle:'italic'}}>{c.note}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="sa-card">
        <h2>Rep Quotas</h2>
        <div style={{fontSize:12,color:'#a5b4fc',marginBottom:12}}>Individual rep quotas are set in the Reps tab.</div>
        <table className="sa-tbl">
          <thead><tr><th>Rep</th><th>Professional Services Quota</th><th>FinOps Quota</th><th>Managed Services Quota</th><th>Total Quota</th></tr></thead>
          <tbody>
            {data.reps.map(r=>(
              <tr key={r.id}>
                <td style={{fontWeight:600,color:'#f1f5f9'}}>{r.name}</td>
                <td>{fmt(getQuota(r,'PS')*(CM/12))}</td>
                <td>{fmt(getQuota(r,'FO')*(CM/12))}</td>
                <td>{fmt(getQuota(r,'MS')*(CM/12))}</td>
                <td style={{fontWeight:600}}>{fmt((getQuota(r,'PS')+getQuota(r,'FO')+getQuota(r,'MS'))*(CM/12))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
