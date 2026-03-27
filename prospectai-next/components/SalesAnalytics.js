import { useState, useEffect } from 'react';

const SK = 'pai_quotaTracker';
const CQ = { PS: 6500000, FO: 32000000, MS: 1500000 };
const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CM = new Date().getMonth() + 1;
function gm(m){ return 13-m; }
function pFO(){ var t=0; for(var m=1;m<=CM;m++) t+=gm(m); return t/78; }
function fmt(n){ if(!n && n!==0) return '$0'; return '$'+Number(n).toLocaleString('en-US',{maximumFractionDigits:0}); }
function pct(n){ return (n*100).toFixed(1)+'%'; }
function ld(){ try{ var r=localStorage.getItem(SK); if(r) return JSON.parse(r); }catch(e){} return {reps:[],deals:[]}; }
function sd(d){ try{ localStorage.setItem(SK,JSON.stringify(d)); }catch(e){} }
function nid(){ return Date.now()+'_'+Math.random().toString(36).slice(2); }

function crs(rep,deals){
  var my=deals.filter(function(d){ return d.repId===rep.id; });
  var ps=0,fo=0,ms=0,psc=0,foc=0,msc=0;
  my.forEach(function(d){
    if(d.cat==='PS'){ ps+=d.amount*12; psc+=d.amount*0.1; }
    else if(d.cat==='FO'){ fo+=d.mrr*gm(d.month); foc+=d.mrr*0.07; }
    else if(d.cat==='MS'){ ms+=d.mrr*gm(d.month); msc+=d.mrr; }
  });
  return {ps:ps,fo:fo,ms:ms,psc:psc,foc:foc,msc:msc,deals:my};
}

function cc(deals){
  var ps=0,fo=0,ms=0;
  deals.forEach(function(d){
    if(d.cat==='PS') ps+=d.amount*12;
    else if(d.cat==='FO') fo+=d.mrr*gm(d.month);
    else if(d.cat==='MS') ms+=d.mrr*gm(d.month);
  });
  return {ps:ps,fo:fo,ms:ms};
}
var ST = `
.sa{position:fixed;inset:0;background:#0f172a;z-index:10000;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff;overflow:hidden}
.sa-hd{background:#1e293b;border-bottom:1px solid rgba(99,102,241,.3);padding:0 24px;display:flex;align-items:center;justify-content:space-between;height:60px;flex-shrink:0}
.sa-hd h1{font-size:20px;font-weight:700;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:0}
.sa-x{background:rgba(99,102,241,.2);border:1px solid rgba(99,102,241,.4);color:#fff;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600}
.sa-x:hover{background:rgba(99,102,241,.4)}
.sa-tabs{display:flex;gap:4px;background:#1e293b;padding:8px 24px;border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0;overflow-x:auto}
.sa-tab{padding:8px 18px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap;background:transparent;color:rgba(255,255,255,.5)}
.sa-tab:hover{color:#fff;background:rgba(99,102,241,.15)}
.sa-tab.on{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}
.sa-body{flex:1;overflow-y:auto;padding:24px}
.sa-card{background:#1e293b;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:20px;margin-bottom:16px}
.sa-card h3{margin:0 0 16px;font-size:15px;color:rgba(255,255,255,.7);font-weight:600}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px}
.g2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:16px}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px}
.met{background:#0f172a;border-radius:10px;padding:16px}
.met .lbl{font-size:11px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
.met .val{font-size:22px;font-weight:700;color:#fff}
.met .sub{font-size:12px;color:rgba(255,255,255,.4);margin-top:4px}
.pb{background:rgba(255,255,255,.1);border-radius:999px;height:8px;overflow:hidden;margin-top:8px}
.pb-f{height:100%;border-radius:999px;background:linear-gradient(90deg,#6366f1,#8b5cf6);transition:width .5s}
.pb-f.warn{background:linear-gradient(90deg,#f59e0b,#ef4444)}
.pb-f.good{background:linear-gradient(90deg,#10b981,#6366f1)}
.sa-tbl{width:100%;border-collapse:collapse;font-size:13px}
.sa-tbl th{text-align:left;padding:10px 12px;color:rgba(255,255,255,.5);font-weight:600;font-size:11px;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.07)}
.sa-tbl td{padding:10px 12px;color:#fff;border-bottom:1px solid rgba(255,255,255,.04)}
.sa-tbl tr:hover td{background:rgba(99,102,241,.05)}
.bdg{display:inline-flex;align-items:center;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700}
.bdg.g{background:rgba(16,185,129,.15);color:#10b981}
.bdg.y{background:rgba(245,158,11,.15);color:#f59e0b}
.bdg.r{background:rgba(239,68,68,.15);color:#ef4444}
.btn{padding:9px 20px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:600}
.btn-p{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}
.btn-p:hover{opacity:.9}
.btn-s{background:rgba(99,102,241,.15);color:#818cf8;border:1px solid rgba(99,102,241,.3)}
.btn-d{background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3)}
.inp{background:#0f172a;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#fff;padding:9px 12px;font-size:13px;width:100%;box-sizing:border-box}
.inp:focus{outline:none;border-color:#6366f1}
.sel{background:#0f172a;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#fff;padding:9px 12px;font-size:13px;width:100%;box-sizing:border-box}
.lbl{display:block;font-size:12px;color:rgba(255,255,255,.6);margin-bottom:6px;font-weight:600}
.fr3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px}
.fr2{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:12px}
.mo{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:20000;display:flex;align-items:center;justify-content:center}
.mo-box{background:#1e293b;border:1px solid rgba(99,102,241,.3);border-radius:16px;padding:28px;width:560px;max-width:90vw;max-height:85vh;overflow-y:auto}
.mo-box h2{margin:0 0 20px;font-size:18px;color:#fff}
.fb{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;align-items:center}
.chip{padding:6px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.15);background:transparent;color:rgba(255,255,255,.6);font-size:12px;cursor:pointer}
.chip.on{background:rgba(99,102,241,.3);border-color:#6366f1;color:#fff}
.empty{text-align:center;padding:40px;color:rgba(255,255,255,.3);font-size:14px}
`;
function TabDash({reps,deals}){
  var tot=cc(deals);
  var ppS=CM/12, ppFO=pFO();
  function bar(val,quota,pace){
    var p=quota>0?Math.min(val/quota,1.5):0;
    var cls=p>=pace?'good':p>=pace*0.8?'':'warn';
    return React.createElement('div',{className:'pb'},React.createElement('div',{className:'pb-f '+cls,style:{width:(Math.min(p,1)*100)+'%'}}));
  }
  return React.createElement('div',null,
    React.createElement('div',{className:'g3'},
      React.createElement('div',{className:'met'},
        React.createElement('div',{className:'lbl'},'PS ARR'),
        React.createElement('div',{className:'val'},fmt(tot.ps)),
        React.createElement('div',{className:'sub'},pct(CQ.PS>0?tot.ps/CQ.PS:0)+' of '+fmt(CQ.PS)),
        bar(tot.ps,CQ.PS,ppS)
      ),
      React.createElement('div',{className:'met'},
        React.createElement('div',{className:'lbl'},'FinOps ARR'),
        React.createElement('div',{className:'val'},fmt(tot.fo)),
        React.createElement('div',{className:'sub'},pct(CQ.FO>0?tot.fo/CQ.FO:0)+' of '+fmt(CQ.FO)),
        bar(tot.fo,CQ.FO,ppFO)
      ),
      React.createElement('div',{className:'met'},
        React.createElement('div',{className:'lbl'},'MS ARR'),
        React.createElement('div',{className:'val'},fmt(tot.ms)),
        React.createElement('div',{className:'sub'},pct(CQ.MS>0?tot.ms/CQ.MS:0)+' of '+fmt(CQ.MS)),
        bar(tot.ms,CQ.MS,ppFO)
      )
    ),
    React.createElement('div',{className:'sa-card'},
      React.createElement('h3',null,'Rep Summary'),
      React.createElement('table',{className:'sa-tbl'},
        React.createElement('thead',null,React.createElement('tr',null,
          React.createElement('th',null,'Rep'),React.createElement('th',null,'Dept'),
          React.createElement('th',null,'PS ARR'),React.createElement('th',null,'FO ARR'),React.createElement('th',null,'MS ARR'),
          React.createElement('th',null,'Total ARR'),React.createElement('th',null,'Status')
        )),
        React.createElement('tbody',null, reps.length===0?
          React.createElement('tr',null,React.createElement('td',{colSpan:7,style:{textAlign:'center',color:'rgba(255,255,255,.3)',padding:'30px'}},'No reps added yet')):
          reps.map(function(r){
            var s=crs(r,deals);
            var tot2=s.ps+s.fo+s.ms;
            var quota=(r.psQ||0)*12+(r.foQ||0)*12+(r.msQ||0)*12;
            var ratio=quota>0?tot2/quota:0;
            var pace=r.dept==='PS'?ppS:ppFO;
            var bdg=ratio>=pace?'g':ratio>=pace*0.8?'y':'r';
            var lbl=ratio>=pace?'On Track':ratio>=pace*0.8?'At Risk':'Behind';
            return React.createElement('tr',{key:r.id},
              React.createElement('td',null,React.createElement('strong',null,r.name)),
              React.createElement('td',null,r.dept||'-'),
              React.createElement('td',null,fmt(s.ps)),
              React.createElement('td',null,fmt(s.fo)),
              React.createElement('td',null,fmt(s.ms)),
              React.createElement('td',null,React.createElement('strong',null,fmt(tot2))),
              React.createElement('td',null,React.createElement('span',{className:'bdg '+bdg},lbl))
            );
          })
        )
      )
    )
  );
}
function TabReps({reps,deals,setData}){
  var [showAdd,setShowAdd]=useState(false);
  var [editRep,setEditRep]=useState(null);
  var [form,setForm]=useState({name:'',dept:'Sales',psQ:'',foQ:'',msQ:''});
  var depts=['Sales','Marketing','Alliances','Customer Success'];
  function openAdd(){ setForm({name:'',dept:'Sales',psQ:'',foQ:'',msQ:''}); setEditRep(null); setShowAdd(true); }
  function openEdit(r){ setForm({name:r.name,dept:r.dept||'Sales',psQ:r.psQ||'',foQ:r.foQ||'',msQ:r.msQ||''}); setEditRep(r); setShowAdd(true); }
  function save(){
    if(!form.name.trim()) return;
    var d=ld();
    if(editRep){
      d.reps=d.reps.map(function(r){ return r.id===editRep.id?Object.assign({},r,{name:form.name,dept:form.dept,psQ:parseFloat(form.psQ)||0,foQ:parseFloat(form.foQ)||0,msQ:parseFloat(form.msQ)||0}):r; });
    } else {
      d.reps.push({id:nid(),name:form.name,dept:form.dept,psQ:parseFloat(form.psQ)||0,foQ:parseFloat(form.foQ)||0,msQ:parseFloat(form.msQ)||0});
    }
    sd(d); setData(d); setShowAdd(false);
  }
  function del(id){
    if(!confirm('Delete this rep and all their deals?')) return;
    var d=ld();
    d.reps=d.reps.filter(function(r){ return r.id!==id; });
    d.deals=d.deals.filter(function(x){ return x.repId!==id; });
    sd(d); setData(d);
  }
  return React.createElement('div',null,
    React.createElement('div',{style:{display:'flex',justifyContent:'flex-end',marginBottom:'16px'}},
      React.createElement('button',{className:'btn btn-p',onClick:openAdd},'+ Add Rep')
    ),
    React.createElement('div',{className:'sa-card'},
      React.createElement('table',{className:'sa-tbl'},
        React.createElement('thead',null,React.createElement('tr',null,
          React.createElement('th',null,'Name'),React.createElement('th',null,'Dept'),
          React.createElement('th',null,'PS Quota'),React.createElement('th',null,'FO Quota'),React.createElement('th',null,'MS Quota'),
          React.createElement('th',null,'Deals'),React.createElement('th',null,'Actions')
        )),
        React.createElement('tbody',null, reps.length===0?
          React.createElement('tr',null,React.createElement('td',{colSpan:7,style:{textAlign:'center',color:'rgba(255,255,255,.3)',padding:'30px'}},'No reps yet. Add one!')):
          reps.map(function(r){
            var s=crs(r,deals);
            return React.createElement('tr',{key:r.id},
              React.createElement('td',null,React.createElement('strong',null,r.name)),
              React.createElement('td',null,r.dept||'-'),
              React.createElement('td',null,r.psQ?fmt(r.psQ)+'/mo':'-'),
              React.createElement('td',null,r.foQ?fmt(r.foQ)+'/mo':'-'),
              React.createElement('td',null,r.msQ?fmt(r.msQ)+'/mo':'-'),
              React.createElement('td',null,s.deals.length),
              React.createElement('td',null,
                React.createElement('button',{className:'btn btn-s',style:{marginRight:'8px'},onClick:function(){ openEdit(r); }},'Edit'),
                React.createElement('button',{className:'btn btn-d',onClick:function(){ del(r.id); }},'Del')
              )
            );
          })
        )
      )
    ),
    showAdd && React.createElement('div',{className:'mo'},
      React.createElement('div',{className:'mo-box'},
        React.createElement('h2',null,editRep?'Edit Rep':'Add Rep'),
        React.createElement('div',{className:'fr2'},
          React.createElement('div',null,React.createElement('label',{className:'lbl'},'Name'),React.createElement('input',{className:'inp',value:form.name,onChange:function(e){ setForm(Object.assign({},form,{name:e.target.value})); }})),
          React.createElement('div',null,React.createElement('label',{className:'lbl'},'Dept'),React.createElement('select',{className:'sel',value:form.dept,onChange:function(e){ setForm(Object.assign({},form,{dept:e.target.value})); }},depts.map(function(d){ return React.createElement('option',{key:d,value:d},d); })))
        ),
        React.createElement('p',{style:{color:'rgba(255,255,255,.5)',fontSize:'12px',margin:'0 0 12px'}},'Monthly quotas (used for pace calculations):'),
        React.createElement('div',{className:'fr3'},
          React.createElement('div',null,React.createElement('label',{className:'lbl'},'PS Monthly Quota'),React.createElement('input',{className:'inp',type:'number',value:form.psQ,onChange:function(e){ setForm(Object.assign({},form,{psQ:e.target.value})); }})),
          React.createElement('div',null,React.createElement('label',{className:'lbl'},'FinOps MRR Quota'),React.createElement('input',{className:'inp',type:'number',value:form.foQ,onChange:function(e){ setForm(Object.assign({},form,{foQ:e.target.value})); }})),
          React.createElement('div',null,React.createElement('label',{className:'lbl'},'MS MRR Quota'),React.createElement('input',{className:'inp',type:'number',value:form.msQ,onChange:function(e){ setForm(Object.assign({},form,{msQ:e.target.value})); }}))
        ),
        React.createElement('div',{style:{display:'flex',gap:'10px',justifyContent:'flex-end',marginTop:'20px'}},
          React.createElement('button',{className:'btn btn-s',onClick:function(){ setShowAdd(false); }},'Cancel'),
          React.createElement('button',{className:'btn btn-p',onClick:save},'Save')
        )
      )
    )
  );
}
function TabDeals({reps,deals,setData}){
  var [showAdd,setShowAdd]=useState(false);
  var [editDeal,setEditDeal]=useState(null);
  var [filter,setFilter]=useState('all');
  var [form,setForm]=useState({repId:'',cat:'PS',client:'',amount:'',mrr:'',month:String(CM)});
  function openAdd(){ if(reps.length===0){ alert('Add a rep first.'); return; } setForm({repId:reps[0].id,cat:'PS',client:'',amount:'',mrr:'',month:String(CM)}); setEditDeal(null); setShowAdd(true); }
  function openEdit(d){ setForm({repId:d.repId,cat:d.cat,client:d.client,amount:d.amount||'',mrr:d.mrr||'',month:String(d.month||CM)}); setEditDeal(d); setShowAdd(true); }
  function save(){
    if(!form.client.trim()) return;
    var d=ld();
    var nd={id:editDeal?editDeal.id:nid(),repId:form.repId,cat:form.cat,client:form.client,month:parseInt(form.month),amount:parseFloat(form.amount)||0,mrr:parseFloat(form.mrr)||0,date:editDeal?editDeal.date:new Date().toISOString().slice(0,10)};
    if(editDeal){ d.deals=d.deals.map(function(x){ return x.id===editDeal.id?nd:x; }); }
    else { d.deals.push(nd); }
    sd(d); setData(d); setShowAdd(false);
  }
  function del(id){
    if(!confirm('Delete this deal?')) return;
    var d=ld(); d.deals=d.deals.filter(function(x){ return x.id!==id; }); sd(d); setData(d);
  }
  var shown=filter==='all'?deals:deals.filter(function(d){ return d.cat===filter; });
  var repMap={}; reps.forEach(function(r){ repMap[r.id]=r.name; });
  return React.createElement('div',null,
    React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}},
      React.createElement('div',{className:'fb',style:{margin:0}},
        React.createElement('button',{className:'chip '+(filter==='all'?'on':''),onClick:function(){ setFilter('all'); }},'All'),
        React.createElement('button',{className:'chip '+(filter==='PS'?'on':''),onClick:function(){ setFilter('PS'); }},'PS'),
        React.createElement('button',{className:'chip '+(filter==='FO'?'on':''),onClick:function(){ setFilter('FO'); }},'FinOps'),
        React.createElement('button',{className:'chip '+(filter==='MS'?'on':''),onClick:function(){ setFilter('MS'); }},'MS')
      ),
      React.createElement('button',{className:'btn btn-p',onClick:openAdd},'+ Add Deal')
    ),
    React.createElement('div',{className:'sa-card'},
      React.createElement('table',{className:'sa-tbl'},
        React.createElement('thead',null,React.createElement('tr',null,
          React.createElement('th',null,'Rep'),React.createElement('th',null,'Cat'),React.createElement('th',null,'Client'),
          React.createElement('th',null,'Month'),React.createElement('th',null,'Amount/MRR'),React.createElement('th',null,'ARR Value'),
          React.createElement('th',null,'Commission'),React.createElement('th',null,'Actions')
        )),
        React.createElement('tbody',null, shown.length===0?
          React.createElement('tr',null,React.createElement('td',{colSpan:8,style:{textAlign:'center',color:'rgba(255,255,255,.3)',padding:'30px'}},'No deals yet')):
          shown.map(function(d){
            var arr=d.cat==='PS'?d.amount*12:d.mrr*gm(d.month);
            var com=d.cat==='PS'?d.amount*0.1:d.cat==='FO'?d.mrr*0.07:d.mrr;
            return React.createElement('tr',{key:d.id},
              React.createElement('td',null,repMap[d.repId]||'?'),
              React.createElement('td',null,React.createElement('span',{className:'bdg '+(d.cat==='PS'?'g':d.cat==='FO'?'y':'r')},d.cat)),
              React.createElement('td',null,d.client),
              React.createElement('td',null,MN[d.month-1]||d.month),
              React.createElement('td',null,d.cat==='PS'?fmt(d.amount)+'/mo':fmt(d.mrr)+' MRR'),
              React.createElement('td',null,React.createElement('strong',null,fmt(arr))),
              React.createElement('td',null,fmt(com)),
              React.createElement('td',null,
                React.createElement('button',{className:'btn btn-s',style:{marginRight:'8px'},onClick:function(){ openEdit(d); }},'Edit'),
                React.createElement('button',{className:'btn btn-d',onClick:function(){ del(d.id); }},'Del')
              )
            );
          })
        )
      )
    ),
    showAdd && React.createElement('div',{className:'mo'},
      React.createElement('div',{className:'mo-box'},
        React.createElement('h2',null,editDeal?'Edit Deal':'Add Deal'),
        React.createElement('div',{className:'fr3'},
          React.createElement('div',null,React.createElement('label',{className:'lbl'},'Rep'),React.createElement('select',{className:'sel',value:form.repId,onChange:function(e){ setForm(Object.assign({},form,{repId:e.target.value})); }},reps.map(function(r){ return React.createElement('option',{key:r.id,value:r.id},r.name); }))),
          React.createElement('div',null,React.createElement('label',{className:'lbl'},'Category'),React.createElement('select',{className:'sel',value:form.cat,onChange:function(e){ setForm(Object.assign({},form,{cat:e.target.value})); }},['PS','FO','MS'].map(function(c){ return React.createElement('option',{key:c,value:c},c==='PS'?'Professional Services':c==='FO'?'FinOps':'Managed Services'); }))),
          React.createElement('div',null,React.createElement('label',{className:'lbl'},'Close Month'),React.createElement('select',{className:'sel',value:form.month,onChange:function(e){ setForm(Object.assign({},form,{month:e.target.value})); }},MN.map(function(m,i){ return React.createElement('option',{key:i,value:String(i+1)},m); })))
        ),
        React.createElement('div',{className:'fr2'},
          React.createElement('div',null,React.createElement('label',{className:'lbl'},'Client Name'),React.createElement('input',{className:'inp',value:form.client,onChange:function(e){ setForm(Object.assign({},form,{client:e.target.value})); }})),
          form.cat==='PS'?
            React.createElement('div',null,React.createElement('label',{className:'lbl'},'Monthly Amount ($)'),React.createElement('input',{className:'inp',type:'number',value:form.amount,onChange:function(e){ setForm(Object.assign({},form,{amount:e.target.value})); }})):
            React.createElement('div',null,React.createElement('label',{className:'lbl'},'MRR ($)'),React.createElement('input',{className:'inp',type:'number',value:form.mrr,onChange:function(e){ setForm(Object.assign({},form,{mrr:e.target.value})); }}))
        ),
        form.cat!=='PS' && React.createElement('p',{style:{color:'rgba(255,255,255,.5)',fontSize:'12px',margin:'0 0 12px'}},
          'ARR = MRR x '+(13-parseInt(form.month||CM))+' ('+MN[(parseInt(form.month||CM))-1]+' multiplier) = '+fmt((parseFloat(form.mrr)||0)*(13-parseInt(form.month||CM)))
        ),
        form.cat==='PS' && React.createElement('p',{style:{color:'rgba(255,255,255,.5)',fontSize:'12px',margin:'0 0 12px'}},
          'ARR = Monthly x 12 = '+fmt((parseFloat(form.amount)||0)*12)
        ),
        React.createElement('div',{style:{display:'flex',gap:'10px',justifyContent:'flex-end',marginTop:'20px'}},
          React.createElement('button',{className:'btn btn-s',onClick:function(){ setShowAdd(false); }},'Cancel'),
          React.createElement('button',{className:'btn btn-p',onClick:save},'Save')
        )
      )
    )
  );
}
function TabCatPerf({reps,deals}){
  var [selRep,setSelRep]=useState('all');
  var filtered=selRep==='all'?deals:deals.filter(function(d){ return d.repId===selRep; });
  var tot=cc(filtered);
  var ppS=CM/12, ppFO=pFO();
  function catDeals(cat){ return filtered.filter(function(d){ return d.cat===cat; }); }
  function catARR(cat){ return catDeals(cat).reduce(function(s,d){ return s+(cat==='PS'?d.amount*12:d.mrr*gm(d.month)); },0); }
  function catCom(cat){ return catDeals(cat).reduce(function(s,d){ return s+(cat==='PS'?d.amount*0.1:cat==='FO'?d.mrr*0.07:d.mrr); },0); }
  var cats=[{id:'PS',lbl:'Professional Services',quota:CQ.PS,pace:ppS,color:'#6366f1'},{id:'FO',lbl:'FinOps',quota:CQ.FO,pace:ppFO,color:'#8b5cf6'},{id:'MS',lbl:'Managed Services',quota:CQ.MS,pace:ppFO,color:'#10b981'}];
  return React.createElement('div',null,
    React.createElement('div',{className:'fb'},
      React.createElement('button',{className:'chip '+(selRep==='all'?'on':''),onClick:function(){ setSelRep('all'); }},'All Reps'),
      reps.map(function(r){ return React.createElement('button',{key:r.id,className:'chip '+(selRep===r.id?'on':''),onClick:function(){ setSelRep(r.id); }},r.name); })
    ),
    cats.map(function(cat){
      var arr=catARR(cat.id);
      var ratio=cat.quota>0?arr/cat.quota:0;
      var cls=ratio>=cat.pace?'good':ratio>=cat.pace*0.8?'':'warn';
      return React.createElement('div',{key:cat.id,className:'sa-card'},
        React.createElement('h3',null,cat.lbl),
        React.createElement('div',{className:'g4'},
          React.createElement('div',{className:'met'},React.createElement('div',{className:'lbl'},'ARR'),React.createElement('div',{className:'val'},fmt(arr)),React.createElement('div',{className:'sub'},'Quota: '+fmt(cat.quota))),
          React.createElement('div',{className:'met'},React.createElement('div',{className:'lbl'},'Attainment'),React.createElement('div',{className:'val'},pct(ratio)),React.createElement('div',{className:'sub'},'Pace: '+pct(cat.pace))),
          React.createElement('div',{className:'met'},React.createElement('div',{className:'lbl'},'Deals'),React.createElement('div',{className:'val'},catDeals(cat.id).length),React.createElement('div',{className:'sub'},'avg: '+fmt(catDeals(cat.id).length>0?arr/catDeals(cat.id).length:0))),
          React.createElement('div',{className:'met'},React.createElement('div',{className:'lbl'},'Commission'),React.createElement('div',{className:'val'},fmt(catCom(cat.id))),React.createElement('div',{className:'sub'},cat.id==='PS'?'10% rate':cat.id==='FO'?'7% MRR':'1x MRR'))
        ),
        React.createElement('div',{className:'pb'},React.createElement('div',{className:'pb-f '+cls,style:{width:(Math.min(ratio,1)*100)+'%'}}))
      );
    })
  );
}
function TabARR(){
  var [cat,setCat]=useState('PS');
  var [amt,setAmt]=useState('');
  var [month,setMonth]=useState(String(CM));
  var arr=cat==='PS'?(parseFloat(amt)||0)*12:(parseFloat(amt)||0)*gm(parseInt(month));
  var com=cat==='PS'?(parseFloat(amt)||0)*0.1:cat==='FO'?(parseFloat(amt)||0)*0.07:(parseFloat(amt)||0);
  return React.createElement('div',null,
    React.createElement('div',{className:'sa-card'},
      React.createElement('h3',null,'ARR Calculator'),
      React.createElement('div',{className:'fr3'},
        React.createElement('div',null,React.createElement('label',{className:'lbl'},'Category'),React.createElement('select',{className:'sel',value:cat,onChange:function(e){ setCat(e.target.value); }},
          React.createElement('option',{value:'PS'},'Professional Services'),
          React.createElement('option',{value:'FO'},'FinOps'),
          React.createElement('option',{value:'MS'},'Managed Services')
        )),
        React.createElement('div',null,React.createElement('label',{className:'lbl'},cat==='PS'?'Monthly Amount ($)':'MRR ($)'),React.createElement('input',{className:'inp',type:'number',value:amt,onChange:function(e){ setAmt(e.target.value); },placeholder:'Enter amount'})),
        cat!=='PS'?React.createElement('div',null,React.createElement('label',{className:'lbl'},'Close Month'),React.createElement('select',{className:'sel',value:month,onChange:function(e){ setMonth(e.target.value); }},MN.map(function(m,i){ return React.createElement('option',{key:i,value:String(i+1)},m); }))):React.createElement('div',null)
      ),
      React.createElement('div',{className:'g3'},
        React.createElement('div',{className:'met'},React.createElement('div',{className:'lbl'},'ARR Value'),React.createElement('div',{className:'val'},fmt(arr)),React.createElement('div',{className:'sub'},cat==='PS'?'Monthly x 12':'MRR x '+(13-parseInt(month))+' (multiplier)')),
        React.createElement('div',{className:'met'},React.createElement('div',{className:'lbl'},'Commission'),React.createElement('div',{className:'val'},fmt(com)),React.createElement('div',{className:'sub'},cat==='PS'?'10% of monthly':cat==='FO'?'7% of MRR':'1x MRR')),
        React.createElement('div',{className:'met'},React.createElement('div',{className:'lbl'},cat!=='PS'?'Multiplier':'ARR/MRR Ratio'),React.createElement('div',{className:'val'},cat!=='PS'?('x'+(13-parseInt(month))):'x12'),React.createElement('div',{className:'sub'},cat!=='PS'?MN[(parseInt(month)-1)]+' close':'Full year'))
      ),
      cat!=='PS' && React.createElement('div',{className:'sa-card',style:{marginTop:'16px',background:'#0f172a'}},
        React.createElement('h3',{style:{fontSize:'13px'}},'Multiplier Reference'),
        React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:'8px'}},
          MN.map(function(m,i){ var mul=13-(i+1); return React.createElement('div',{key:i,style:{background:'rgba(99,102,241,.15)',borderRadius:'8px',padding:'8px 12px',textAlign:'center',minWidth:'60px'}},React.createElement('div',{style:{fontSize:'11px',color:'rgba(255,255,255,.5)'}},m),React.createElement('div',{style:{fontWeight:'700',color:'#fff'}},('x'+mul))); })
        )
      )
    )
  );
}

function TabCommissions({reps,deals}){
  var [selRep,setSelRep]=useState('all');
  var filtered=selRep==='all'?deals:deals.filter(function(d){ return d.repId===selRep; });
  var repMap={}; reps.forEach(function(r){ repMap[r.id]=r.name; });
  function repCom(rep){ var s=crs(rep,deals); return s.psc+s.foc+s.msc; }
  var totalCom=reps.reduce(function(s,r){ return s+repCom(r); },0);
  return React.createElement('div',null,
    React.createElement('div',{className:'fb'},
      React.createElement('button',{className:'chip '+(selRep==='all'?'on':''),onClick:function(){ setSelRep('all'); }},'All Reps'),
      reps.map(function(r){ return React.createElement('button',{key:r.id,className:'chip '+(selRep===r.id?'on':''),onClick:function(){ setSelRep(r.id); }},r.name); })
    ),
    selRep==='all'?React.createElement('div',null,
      React.createElement('div',{className:'g3',style:{marginBottom:'16px'}},
        React.createElement('div',{className:'met'},React.createElement('div',{className:'lbl'},'Total Commissions'),React.createElement('div',{className:'val'},fmt(totalCom))),
        React.createElement('div',{className:'met'},React.createElement('div',{className:'lbl'},'Reps Earning'),React.createElement('div',{className:'val'},reps.filter(function(r){ return repCom(r)>0; }).length+' / '+reps.length)),
        React.createElement('div',{className:'met'},React.createElement('div',{className:'lbl'},'Avg Commission'),React.createElement('div',{className:'val'},fmt(reps.length>0?totalCom/reps.length:0)))
      ),
      React.createElement('div',{className:'sa-card'},
        React.createElement('table',{className:'sa-tbl'},
          React.createElement('thead',null,React.createElement('tr',null,
            React.createElement('th',null,'Rep'),React.createElement('th',null,'PS Com'),React.createElement('th',null,'FO Com'),React.createElement('th',null,'MS Com'),React.createElement('th',null,'Total')
          )),
          React.createElement('tbody',null,reps.map(function(r){
            var s=crs(r,deals);
            return React.createElement('tr',{key:r.id},
              React.createElement('td',null,React.createElement('strong',null,r.name)),
              React.createElement('td',null,fmt(s.psc)),
              React.createElement('td',null,fmt(s.foc)),
              React.createElement('td',null,fmt(s.msc)),
              React.createElement('td',null,React.createElement('strong',null,fmt(s.psc+s.foc+s.msc)))
            );
          }))
        )
      )
    ):React.createElement('div',null,
      function(){
        var rep=reps.find(function(r){ return r.id===selRep; });
        if(!rep) return null;
        var s=crs(rep,deals);
        return React.createElement('div',null,
          React.createElement('div',{className:'g3',style:{marginBottom:'16px'}},
            React.createElement('div',{className:'met'},React.createElement('div',{className:'lbl'},'PS Commission'),React.createElement('div',{className:'val'},fmt(s.psc)),React.createElement('div',{className:'sub'},'10% rate')),
            React.createElement('div',{className:'met'},React.createElement('div',{className:'lbl'},'FO Commission'),React.createElement('div',{className:'val'},fmt(s.foc)),React.createElement('div',{className:'sub'},'7% of MRR')),
            React.createElement('div',{className:'met'},React.createElement('div',{className:'lbl'},'MS Commission'),React.createElement('div',{className:'val'},fmt(s.msc)),React.createElement('div',{className:'sub'},'1x MRR'))
          ),
          React.createElement('div',{className:'sa-card'},
            React.createElement('h3',null,rep.name+' - Deal Details'),
            React.createElement('table',{className:'sa-tbl'},
              React.createElement('thead',null,React.createElement('tr',null,
                React.createElement('th',null,'Client'),React.createElement('th',null,'Cat'),React.createElement('th',null,'Month'),React.createElement('th',null,'Amount/MRR'),React.createElement('th',null,'ARR'),React.createElement('th',null,'Commission')
              )),
              React.createElement('tbody',null,s.deals.map(function(d){
                var arr=d.cat==='PS'?d.amount*12:d.mrr*gm(d.month);
                var com=d.cat==='PS'?d.amount*0.1:d.cat==='FO'?d.mrr*0.07:d.mrr;
                return React.createElement('tr',{key:d.id},
                  React.createElement('td',null,d.client),
                  React.createElement('td',null,React.createElement('span',{className:'bdg '+(d.cat==='PS'?'g':d.cat==='FO'?'y':'r')},d.cat)),
                  React.createElement('td',null,MN[d.month-1]),
                  React.createElement('td',null,d.cat==='PS'?fmt(d.amount)+'/mo':fmt(d.mrr)+' MRR'),
                  React.createElement('td',null,fmt(arr)),
                  React.createElement('td',null,React.createElement('strong',null,fmt(com)))
                );
              }))
            )
          )
        );
      }()
    )
  );
}
function TabReports({reps,deals}){
  var [selRep,setSelRep]=useState('all');
  function exportCSV(repId){
    var rep=reps.find(function(r){ return r.id===repId; });
    if(!rep) return;
    var s=crs(rep,deals);
    var rows=['CLOUDELLIGENT','','Department: '+rep.dept,'Period: Full Year 2026','Date Generated: '+new Date().toLocaleDateString(),'','','CATEGORY,DEAL/CLIENT,MONTH,AMOUNT/MRR,ARR VALUE,RATE,COMMISSION'];
    var psDl=s.deals.filter(function(d){ return d.cat==='PS'; });
    if(psDl.length>0){
      rows.push('PROFESSIONAL SERVICES');
      psDl.forEach(function(d){ rows.push(','+d.client+','+MN[d.month-1]+','+d.amount+',$'+(d.amount*12)+',10%,$'+(d.amount*0.1).toFixed(2)); });
      rows.push(',,,,PS Subtotal:,,$'+s.psc.toFixed(2));
    }
    var foDl=s.deals.filter(function(d){ return d.cat==='FO'; });
    if(foDl.length>0){
      rows.push('FINOPS');
      foDl.forEach(function(d){ rows.push(','+d.client+','+MN[d.month-1]+','+d.mrr+' MRR,$'+(d.mrr*gm(d.month))+',7%,$'+(d.mrr*0.07).toFixed(2)); });
      rows.push(',,,,FO Subtotal:,,$'+s.foc.toFixed(2));
    }
    var msDl=s.deals.filter(function(d){ return d.cat==='MS'; });
    if(msDl.length>0){
      rows.push('MANAGED SERVICES');
      msDl.forEach(function(d){ rows.push(','+d.client+','+MN[d.month-1]+','+d.mrr+' MRR,$'+(d.mrr*gm(d.month))+',1x MRR,$'+d.mrr.toFixed(2)); });
      rows.push(',,,,MS Subtotal:,,$'+s.msc.toFixed(2));
    }
    rows.push('');
    rows.push('COMMISSION SUMMARY');
    rows.push('Professional Services (10%),,,,,,$'+s.psc.toFixed(2));
    rows.push('FinOps (7% of MRR),,,,,,$'+s.foc.toFixed(2));
    rows.push('Managed Services (1x MRR),,,,,,$'+s.msc.toFixed(2));
    rows.push('');
    rows.push('TOTAL COMMISSION EARNED,,,,,,$'+(s.psc+s.foc+s.msc).toFixed(2));
    rows.push('');
    rows.push('ACKNOWLEDGMENT');
    rows.push('');
    rows.push('I acknowledge receipt of this commission statement.');
    var csv=rows.join('\n');
    var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url; a.download='Commission_Statement_'+rep.name.replace(/ /g,'_')+'.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }
  return React.createElement('div',null,
    React.createElement('div',{className:'sa-card'},
      React.createElement('h3',null,'Export Commission Statements'),
      React.createElement('p',{style:{color:'rgba(255,255,255,.5)',fontSize:'13px',margin:'0 0 16px'}},'Generate CSV commission statements for each rep.'),
      reps.length===0?React.createElement('div',{className:'empty'},'No reps to export.'):React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:'10px'}},
        reps.map(function(r){
          var s=crs(r,deals);
          return React.createElement('div',{key:r.id,style:{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#0f172a',borderRadius:'10px',padding:'14px 18px'}},
            React.createElement('div',null,
              React.createElement('div',{style:{fontWeight:'700',color:'#fff'}},r.name),
              React.createElement('div',{style:{fontSize:'12px',color:'rgba(255,255,255,.4)',marginTop:'2px'}},r.dept+' | '+s.deals.length+' deals | Total: '+fmt(s.psc+s.foc+s.msc))
            ),
            React.createElement('button',{className:'btn btn-p',onClick:function(){ exportCSV(r.id); }},'Export CSV')
          );
        })
      )
    )
  );
}

function TabSettings({reps,deals,setData}){
  function clearAll(){
    if(!confirm('Delete ALL data? This cannot be undone.')) return;
    var d={reps:[],deals:[]}; sd(d); setData(d);
  }
  var totalARR=deals.reduce(function(s,d){ return s+(d.cat==='PS'?d.amount*12:d.mrr*gm(d.month)); },0);
  var totalCom=reps.reduce(function(s,r){ var x=crs(r,deals); return s+x.psc+x.foc+x.msc; },0);
  return React.createElement('div',null,
    React.createElement('div',{className:'g2'},
      React.createElement('div',{className:'sa-card'},
        React.createElement('h3',null,'Company Quotas'),
        React.createElement('div',{className:'met',style:{marginBottom:'10px'}},React.createElement('div',{className:'lbl'},'Professional Services'),React.createElement('div',{className:'val'},fmt(CQ.PS)),React.createElement('div',{className:'sub'},'Annual Quota')),
        React.createElement('div',{className:'met',style:{marginBottom:'10px'}},React.createElement('div',{className:'lbl'},'FinOps'),React.createElement('div',{className:'val'},fmt(CQ.FO)),React.createElement('div',{className:'sub'},'Annual Quota')),
        React.createElement('div',{className:'met'},React.createElement('div',{className:'lbl'},'Managed Services'),React.createElement('div',{className:'val'},fmt(CQ.MS)),React.createElement('div',{className:'sub'},'Annual Quota'))
      ),
      React.createElement('div',{className:'sa-card'},
        React.createElement('h3',null,'Data Summary'),
        React.createElement('div',{className:'met',style:{marginBottom:'10px'}},React.createElement('div',{className:'lbl'},'Reps'),React.createElement('div',{className:'val'},reps.length)),
        React.createElement('div',{className:'met',style:{marginBottom:'10px'}},React.createElement('div',{className:'lbl'},'Deals'),React.createElement('div',{className:'val'},deals.length),React.createElement('div',{className:'sub'},'Total ARR: '+fmt(totalARR))),
        React.createElement('div',{className:'met'},React.createElement('div',{className:'lbl'},'Total Commissions'),React.createElement('div',{className:'val'},fmt(totalCom)))
      )
    ),
    React.createElement('div',{className:'sa-card'},
      React.createElement('h3',null,'Commission Rates'),
      React.createElement('div',{className:'g3'},
        React.createElement('div',{className:'met'},React.createElement('div',{className:'lbl'},'Professional Services'),React.createElement('div',{className:'val'},'10%'),React.createElement('div',{className:'sub'},'of monthly amount')),
        React.createElement('div',{className:'met'},React.createElement('div',{className:'lbl'},'FinOps'),React.createElement('div',{className:'val'},'7%'),React.createElement('div',{className:'sub'},'of MRR')),
        React.createElement('div',{className:'met'},React.createElement('div',{className:'lbl'},'Managed Services'),React.createElement('div',{className:'val'},'1x MRR'),React.createElement('div',{className:'sub'},'full MRR amount'))
      )
    ),
    React.createElement('div',{className:'sa-card'},
      React.createElement('h3',null,'Danger Zone'),
      React.createElement('p',{style:{color:'rgba(255,255,255,.5)',fontSize:'13px',margin:'0 0 16px'}},'Clear all data. This action cannot be undone.'),
      React.createElement('button',{className:'btn btn-d',onClick:clearAll},'Clear All Data')
    )
  );
}
export default function SalesAnalytics({onClose}){
  var [tab,setTab]=useState('dash');
  var [data,setData]=useState(function(){ return ld(); });
  useEffect(function(){
    function onStorage(e){ if(e.key===SK){ setData(ld()); } }
    window.addEventListener('storage',onStorage);
    return function(){ window.removeEventListener('storage',onStorage); };
  },[]);
  var tabs=[{id:'dash',lbl:'Dashboard'},{id:'reps',lbl:'Reps'},{id:'deals',lbl:'Deals'},{id:'catperf',lbl:'Category Performance'},{id:'arr',lbl:'ARR Calc'},{id:'com',lbl:'Commissions'},{id:'reports',lbl:'Reports'},{id:'settings',lbl:'Settings'}];
  function renderTab(){
    var p={reps:data.reps||[],deals:data.deals||[],setData:setData};
    if(tab==='dash') return React.createElement(TabDash,p);
    if(tab==='reps') return React.createElement(TabReps,p);
    if(tab==='deals') return React.createElement(TabDeals,p);
    if(tab==='catperf') return React.createElement(TabCatPerf,p);
    if(tab==='arr') return React.createElement(TabARR,p);
    if(tab==='com') return React.createElement(TabCommissions,p);
    if(tab==='reports') return React.createElement(TabReports,p);
    if(tab==='settings') return React.createElement(TabSettings,p);
    return null;
  }
  return React.createElement('div',{className:'sa'},
    React.createElement('style',null,ST),
    React.createElement('div',{className:'sa-hd'},
      React.createElement('h1',null,'Sales Analytics'),
      React.createElement('button',{className:'sa-x',onClick:onClose},'Back to Home')
    ),
    React.createElement('div',{className:'sa-tabs'},
      tabs.map(function(t){
        return React.createElement('button',{key:t.id,className:'sa-tab '+(tab===t.id?'on':''),onClick:function(){ setTab(t.id); }},t.lbl);
      })
    ),
    React.createElement('div',{className:'sa-body'},renderTab())
  );
}
