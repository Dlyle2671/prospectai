import { useState, useEffect } from 'react';
import LeadCard from './LeadCard';

const STYLES = `
.bi-wrap{padding:0;}
.bi-header{margin-bottom:28px;}
.bi-title{font-size:26px;font-weight:700;color:#f1f5f9;letter-spacing:-0.5px;margin-bottom:6px;display:flex;align-items:center;gap:10px;}
.bi-sub{font-size:13px;color:#64748b;padding-bottom:24px;border-bottom:1px solid rgba(255,255,255,0.06);}
.bi-companies{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:28px;}
.bi-company-chip{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:20px;padding:6px 14px;font-size:12px;font-weight:600;color:#fca5a5;cursor:pointer;transition:all 0.15s ease;display:flex;align-items:center;gap:6px;}
.bi-company-chip:hover,.bi-company-chip.active{background:rgba(239,68,68,0.2);border-color:rgba(239,68,68,0.5);}
.bi-company-chip.active{box-shadow:0 0 0 2px rgba(239,68,68,0.35);}
.bi-company-dot{width:6px;height:6px;border-radius:50%;background:#ef4444;animation:blink 1.4s ease-in-out infinite;}
@keyframes blink{0%,100%{opacity:1;}50%{opacity:0.3;}}
.bi-stats-bar{display:flex;align-items:center;gap:20px;margin-bottom:20px;flex-wrap:wrap;}
.bi-stat{font-size:12px;color:#475569;font-weight:500;}
.bi-stat span{color:#a5b4fc;font-weight:700;}
.bi-refresh{background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s ease;}
.bi-refresh:hover{background:rgba(99,102,241,0.25);}
.bi-refresh:disabled{opacity:0.4;cursor:wait;}
.bi-empty{text-align:center;padding:64px 32px;color:#475569;}
.bi-empty-icon{font-size:48px;margin-bottom:16px;}
.bi-empty-title{font-size:16px;font-weight:600;color:#94a3b8;margin-bottom:8px;}
.bi-empty-desc{font-size:13px;line-height:1.7;max-width:440px;margin:0 auto;}
.bi-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:260px;gap:14px;color:#475569;}
.bi-spinner{width:32px;height:32px;border:3px solid rgba(99,102,241,0.2);border-top-color:#818cf8;border-radius:50%;animation:spin 0.8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.bi-error{background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:16px 20px;color:#fca5a5;font-size:13px;margin-bottom:20px;}
.bi-last-updated{font-size:11px;color:#334155;margin-left:auto;}
.bi-section-label{font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#334155;margin-bottom:12px;}
.bi-company-header{background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
.bi-company-name{font-size:14px;font-weight:600;color:#f1f5f9;}
.bi-company-domain{font-size:11px;color:#64748b;}
.bi-intent-badge{background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:3px 10px;font-size:11px;font-weight:600;color:#fca5a5;display:flex;align-items:center;gap:5px;}
.bi-topic-chip{background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);border-radius:10px;padding:2px 8px;font-size:10px;color:#a5b4fc;}
`;

export default function BuyingIntent() {
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [leads, setLeads]   = useState([]);
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompany] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [sequences, setSequences] = useState([]);
  const [senderEmails, setSenderEmails] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/apollo-sequences').then(r=>r.json()).catch(()=>[]),
      fetch('/api/user-settings?ns=sender_emails').then(r=>r.json()).catch(()=>({})),
    ]).then(([seqs, senderData]) => {
      if (Array.isArray(seqs)) setSequences(seqs);
      if (senderData?.data) setSenderEmails(typeof senderData.data==='string'?JSON.parse(senderData.data):senderData.data);
    });
    loadIntentLeads();
  }, []);

  async function loadIntentLeads() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/intent-leads');
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setLeads(data.leads || []);
      setCompanies(data.companies || []);
      setLastFetch(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const visibleLeads = activeCompany
    ? leads.filter(l => l.company_domain === activeCompany)
    : leads;

  const activeCompanyData = companies.find(c => c.domain === activeCompany);

  return (
    <>
      <style>{STYLES}</style>
      <div className="bi-wrap fade-up">
        <div className="bi-header">
          <div className="bi-title">
            🔥 Buying Intent
            {lastFetch && (
              <span className="bi-last-updated">
                Updated {lastFetch.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
              </span>
            )}
          </div>
          <div className="bi-sub">
            Companies actively researching Cloud, AWS, Managed Services, and IT Outsourcing right now.
            Leads auto-populate from your Apollo intent signals — no search required.
          </div>
        </div>

        {error && <div className="bi-error">⚠️ {error}</div>}

        {loading ? (
          <div className="bi-loading">
            <div className="bi-spinner" />
            <div>Fetching intent companies & leads…</div>
          </div>
        ) : leads.length === 0 ? (
          <div className="bi-empty">
            <div className="bi-empty-icon">📡</div>
            <div className="bi-empty-title">No intent signals yet</div>
            <div className="bi-empty-desc">
              Your Apollo workflow runs daily and posts companies with High Buying Intent here automatically.
              Check back tomorrow or trigger the workflow manually from Apollo → Workflows.
            </div>
          </div>
        ) : (
          <>
            <div className="bi-stats-bar">
              <div className="bi-stat">🏢 <span>{companies.length}</span> companies with active intent</div>
              <div className="bi-stat">👥 <span>{leads.length}</span> leads found</div>
              <div className="bi-stat">🔥 <span>{leads.filter(l=>l.score_label==='hot').length}</span> hot</div>
              <button className="bi-refresh" onClick={loadIntentLeads} disabled={loading}>
                ↻ Refresh
              </button>
            </div>

            {companies.length > 0 && (
              <>
                <div className="bi-section-label">Filter by company</div>
                <div className="bi-companies">
                  <div
                    className={`bi-company-chip ${!activeCompany ? 'active' : ''}`}
                    onClick={() => setActiveCompany(null)}
                  >
                    All companies
                  </div>
                  {companies.map(c => (
                    <div
                      key={c.domain}
                      className={`bi-company-chip ${activeCompany===c.domain ? 'active' : ''}`}
                      onClick={() => setActiveCompany(activeCompany===c.domain ? null : c.domain)}
                    >
                      <div className="bi-company-dot" />
                      {c.org_name || c.domain}
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeCompanyData && (
              <div className="bi-company-header">
                <div>
                  <div className="bi-company-name">{activeCompanyData.org_name || activeCompanyData.domain}</div>
                  <div className="bi-company-domain">{activeCompanyData.domain}</div>
                </div>
                <div className="bi-intent-badge">
                  🔥 {activeCompanyData.intent_strength || 'high'} intent
                </div>
                {(activeCompanyData.intent_signals||[]).map((s,i) => (
                  <div key={i} className="bi-topic-chip">{s.label||s}</div>
                ))}
                {activeCompanyData.updated_at && (
                  <div style={{marginLeft:'auto',fontSize:11,color:'#334155'}}>
                    Flagged {new Date(activeCompanyData.updated_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}

            <div className="bi-section-label">
              {visibleLeads.length} lead{visibleLeads.length!==1?'s':''}{activeCompany?' at this company':''}
            </div>

            {visibleLeads.length > 0
              ? visibleLeads.map((p,i) => (
                  <LeadCard
                    key={p.id||i}
                    p={p}
                    index={i}
                    sequences={sequences}
                    senderEmailsProp={senderEmails}
                  />
                ))
              : <div className="bi-empty" style={{padding:'32px'}}>
                  <div style={{color:'#475569',fontSize:13}}>No leads found for this company yet.</div>
                </div>
            }
          </>
        )}
      </div>
    </>
  );
}
