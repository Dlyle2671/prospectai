import { useState, useEffect } from 'react';
import { fmtFunding, fmtAmt, fmtGrowth, fmtTimeInRole, fmtRoundDate, fmtRoundAmount, fmtFollowers } from '../lib/utils';

export default function LeadCard({ p, index, onHubspotPush, sequences = [], senderEmailsProp = null }) {
    const [hsSent, setHsSent] = useState(p._hsSent || false);
    const [hsPushing, setHsPushing] = useState(false);
    const [seqSent, setSeqSent] = useState(false);
    const [seqSending, setSeqSending] = useState(false);
    const [seqError, setSeqError] = useState(null);
    const [selectedSeq, setSelectedSeq] = useState('');
    const [seqOpen, setSeqOpen] = useState(false);
    const [descExpanded, setDescExpanded] = useState(false);
    const [fullDesc, setFullDesc] = useState(null);
    const [newsOpen, setNewsOpen] = useState(false);
    const [newsLoading, setNewsLoading] = useState(false);
    const [newsArticles, setNewsArticles] = useState(null);
    const [newsError, setNewsError] = useState(null);

  // Draft email state
  const [emailDrafting, setEmailDrafting] = useState(false);
    const [emailError, setEmailError] = useState(null);
    const [tonePicking, setTonePicking] = useState(false);
    const [toneAction, setToneAction] = useState('draft');
    const [tone, setTone] = useState('conversational');
    const [emailCopied, setEmailCopied] = useState(false);
    const [draftResult, setDraftResult] = useState(null);
    const [subjectCopied, setSubjectCopied] = useState(null);
    const [selectedSender, setSelectedSender] = useState('');
    const [senderPickerOpen, setSenderPickerOpen] = useState(false);

  // Add to Email Queue state
  const [queueing, setQueueing] = useState(false);
    const [queued, setQueued] = useState(false);
    const [queueError, setQueueError] = useState(null);

  const sl = p.score_label || 'cold';
    const score = p.score || 0;
    const loc = [p.city, p.state, p.country].filter(Boolean).join(', ');
    const emailCls = p.email_status === 'verified' ? 'email' : 'email-guessed';
    const emailBadge = p.email_status === 'verified' ? '✅' : '✉️';

  // Load sender emails from localStorage
  const [_senderEmails, setSenderEmails] = useState([]);
    const senderEmails = senderEmailsProp !== null ? senderEmailsProp : _senderEmails;

  useEffect(() => {
        if (senderEmailsProp !== null) return;
        fetch('/api/user-settings?ns=sender_emails')
          .then(r => r.json())
          .then(({ data }) => {
                    if (data) setSenderEmails(typeof data === 'string' ? JSON.parse(data) : data);
          })
          .catch(() => {});
  }, [senderEmailsProp]);

  const defaultSender = senderEmails.find(s => s.isDefault) || senderEmails[0] || null;
    const activeSender = selectedSender
      ? senderEmails.find(s => s.email === selectedSender) || defaultSender
          : defaultSender;

  async function handleHubspot() {
        setHsPushing(true);
        try {
                const resp = await fetch('/api/hubspot', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                                      first_name: p.first_name, last_name: p.last_name, email: p.email,
                                      title: p.title, company_name: p.company_name, company_domain: p.company_domain,
                                      linkedin_url: p.linkedin_url, city: p.city, state: p.state, country: p.country,
                                      company_size: p.company_size, company_industry: p.company_industry,
                                      score_label: p.score_label, score: p.score, twitter_url: p.twitter_url,
                                      personal_phone: p.personal_phone, company_phone: p.company_phone,
                                      company_city: p.company_city, company_state: p.company_state,
                                      company_country: p.company_country, company_street: p.company_street,
                                      company_zip: p.company_zip, company_description: p.company_description,
                          }),
                });
                const data = await resp.json();
                if (data.error) throw new Error(data.error);
                setHsSent(true);
                if (onHubspotPush) onHubspotPush(index);
        } catch (err) {
                alert('HubSpot error: ' + err.message);
        } finally {
                setHsPushing(false);
        }
  }

  async function handleAddToSequence() {
        if (!selectedSeq) return;
        setSeqSending(true);
        setSeqError(null);
        try {
                const resp = await fetch('/api/apollo-sequences', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                                      email: p.email, sequence_id: selectedSeq,
                                      name: p.name || '', title: p.title || '', company_name: p.company_name || ''
                          }),
                });
                const data = await resp.json();
                if (data.error) throw new Error(data.error);
                setSeqSent(true);
                setSeqOpen(false);
        } catch (err) {
                setSeqError(err.message);
        } finally {
                setSeqSending(false);
        }
  }

  async function handleToggleNews() {
        if (newsOpen) { setNewsOpen(false); return; }
        setNewsOpen(true);
        if (newsArticles !== null) return;
        setNewsLoading(true);
        setNewsError(null);
        try {
                const params = new URLSearchParams();
                if (p.name) params.set('name', p.name);
                if (p.company_name) params.set('company', p.company_name);
                const resp = await fetch('/api/news?' + params.toString());
                const data = await resp.json();
                if (data.error) throw new Error(data.error);
                setNewsArticles(data.articles || []);
        } catch (err) {
                setNewsError(err.message);
                setNewsArticles([]);
        } finally {
                setNewsLoading(false);
        }
  }

  function handleDraftEmail() {
        if (!p.email) { setEmailError('No email address for this lead.'); return; }
        setSenderPickerOpen(false);
        setToneAction('draft');
        setTonePicking(true);
  }

  async function handleToneSelected(selectedTone) {
        setTonePicking(false);
        if (toneAction === 'queue') { handleQueueWithTone(selectedTone); return; }
        setTone(selectedTone);
        setEmailDrafting(true);
        setEmailError(null);
        try {
                // Fetch recent news for this lead
                let recentNews = [];
                try {
                  const newsParams = new URLSearchParams();
                  if (p.name) newsParams.set('name', p.name);
                  if (p.company_name) newsParams.set('company', p.company_name);
                  const newsResp = await fetch('/api/news?' + newsParams.toString());
                  const newsData = await newsResp.json();
                  recentNews = (newsData.articles || []).slice(0, 2).map(a => ({ title: a.title, description: a.description, source: a.source, publishedAt: a.publishedAt }));
                } catch (_) {}

                const resp = await fetch('/api/draft-email', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                                      name: p.name, first_name: p.first_name, title: p.title,
                                      company_name: p.company_name,
                                      company_description: p.company_description || p.seo_description || '',
                                      keywords: p.keywords || [], tech_stack: p.tech_stack || [],
                                      aws_services: p.aws_services || [], funding_stage: p.funding_stage || '',
                                      recently_funded: p.recently_funded || false, hiring_surge: p.hiring_surge || false,
                                      location: [p.city, p.state, p.country].filter(Boolean).join(', '),
                                      seniority: p.seniority || '', time_in_role_months: p.time_in_role_months,
                                      prev_jobs: p.prev_jobs || [], headcount_growth: p.headcount_growth,
                                      annual_revenue: p.annual_revenue, funding_round_amount: p.funding_round_amount,
                                      top_investors: p.top_investors || [], intent_signals: p.intent_signals || [],
                                      recent_news: recentNews,
                                      tone: selectedTone,
                          }),
                });
                const data = await resp.json();
                if (data.error) throw new Error(data.error);
                setDraftResult({
                  subjects: data.subjects || [data.subject],
                  body: data.body || '',
                  to: p.email,
                  activeSender,
                });
        } catch (err) {
                setEmailError(err.message);
        } finally {
                setEmailDrafting(false);
        }
  }

function handleQueueTrigger() {
        if (!p.email) { setQueueError('No email address for this lead.'); return; }
        setSenderPickerOpen(false);
        setToneAction('queue');
        setTonePicking(true);
  }

  async function handleQueueWithTone(selectedTone) {
        setTonePicking(false);
        setTone(selectedTone);
        setQueueing(true);
        setQueueError(null);
        try {
                // Fetch recent news for this lead
                let recentNews = [];
                try {
                  const newsParams = new URLSearchParams();
                  if (p.name) newsParams.set('name', p.name);
                  if (p.company_name) newsParams.set('company', p.company_name);
                  const newsResp = await fetch('/api/news?' + newsParams.toString());
                  const newsData = await newsResp.json();
                  recentNews = (newsData.articles || []).slice(0, 2).map(a => ({ title: a.title, description: a.description, source: a.source, publishedAt: a.publishedAt }));
                } catch (_) {}
          const draftResp = await fetch('/api/draft-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                                name: p.name, first_name: p.first_name, title: p.title,
                                company_name: p.company_name,
                                company_description: p.company_description || p.seo_description || '',
                                keywords: p.keywords || [], tech_stack: p.tech_stack || [],
                                aws_services: p.aws_services || [], funding_stage: p.funding_stage || '',
                                recently_funded: p.recently_funded || false, hiring_surge: p.hiring_surge || false,
                                location: [p.city, p.state, p.country].filter(Boolean).join(', '),
                                seniority: p.seniority || '', time_in_role_months: p.time_in_role_months,
                                prev_jobs: p.prev_jobs || [], headcount_growth: p.headcount_growth,
                                annual_revenue: p.annual_revenue, funding_round_amount: p.funding_round_amount,
                                top_investors: p.top_investors || [], intent_signals: p.intent_signals || [],
                                recent_news: recentNews,
                                tone: selectedTone,
                    }),
          });
                const draft = await draftResp.json();
                if (draft.error) throw new Error(draft.error);

          // 2. Add draft to email queue
          const queueResp = await fetch('/api/email-queue', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                                items: [{
                                              id: 'eq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                                              leadName: p.name || 'Unknown',
                                              leadEmail: p.email,
                                              leadTitle: p.title || '',
                                              leadCompany: p.company_name || '',
                                              subject: draft.subject,
                                              body: draft.body,
                                              status: 'pending',
                                              createdAt: new Date().toISOString(),
                                }],
                    }),
          });
                const queueData = await queueResp.json();
                if (queueData.error) throw new Error(queueData.error);
                setQueued(true);
        } catch (err) {
                setQueueError(err.message);
        } finally {
                setQueueing(false);
        }
  }

  async function expandDesc() {
        if (fullDesc) return;
        try {
                const resp = await fetch('/api/company', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ domain: p.company_domain }),
                });
                const data = await resp.json();
                const desc = data.seo_description || data.description || p.company_description || '';
                setFullDesc(desc);
                setDescExpanded(true);
        } catch {
                setDescExpanded(true);
        }
  }

  const desc = fullDesc || p.seo_description || p.company_description || '';
    const descTruncated = !fullDesc && desc.length >= 155;

  const dropStyle = {
        background: '#0f172a', border: '1px solid #334155', borderRadius: 6,
        color: '#e2e8f0', fontSize: 12, padding: '6px 10px', cursor: 'pointer',
        width: '100%', appearance: 'none', WebkitAppearance: 'none',
        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2394a3b8\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")',
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', paddingRight: 24,
  };

  function fmtNewsDate(iso) {
        if (!iso) return '';
        try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
        catch { return ''; }
  }

  return (
        <div className={`card ${sl} fade-up`} style={{ animationDelay: `${index * 0.04}s` }}>
      <div className="avatar">
{p.photo_url
          ? <img src={p.photo_url} alt={p.name} onError={e => { e.target.parentNode.innerHTML = '👤'; }} />
          : '👤'}
</div>
      <div className="card-body">
{sl === 'hot' && p.intent_signals && p.intent_signals.length > 0 && (
            <div className="intent-strip">
             <span className="intent-strip-label">🔥 Intent</span>
 {p.intent_signals.map((sig, i) => (<span key={i} className={`intent-chip ${sig.type}`}>{sig.label}</span>))}
  </div>
        )}
        <div className="card-top">
                    <div style={{ minWidth: 0, flex: 1 }}>
            <div className="person-name">{p.name || 'Unknown'}</div>
            <div className="person-title">{p.title || ''}</div>
            <div className="person-company">{p.company_name || ''}{p.company_domain ? ' · ' + p.company_domain : ''}</div>
          </div>
          <div className="score-badge">
                      <div className={`score-num ${sl}`}>{score}</div>
            <div className={`score-lbl ${sl}`}>{sl}</div>
            <div className="score-bar-wrap"><div className={`score-bar ${sl}`} style={{ width: score + '%' }} /></div>
          </div>
          </div>
{(p.recently_funded || p.hiring_surge) && (
            <div className="card-meta">
{p.recently_funded && <span className="badge-funded">💰 Recently Funded</span>}
 {p.hiring_surge && <span className="badge-hiring">📈 Hiring Surge</span>}
   </div>
          )}
         <div className="lc-section">
                     <div className="lc-label">👤 Contact</div>
           <div className="card-meta">
         {p.email && (
                         <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span className={`meta-tag ${emailCls}`}>{emailBadge} {p.email}{p.email_status ? ` (${p.email_status})` : ''}</span>
                <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(p.email).then(() => { setEmailCopied(true); setTimeout(() => setEmailCopied(false), 1500); }); }} title="Copy email"
                  style={{ padding: '2px 7px', fontSize: 12, cursor: 'pointer', border: '1px solid #334155', borderRadius: 4, background: '#1e293b', color: emailCopied ? '#4ade80' : '#94a3b8', lineHeight: 1.4, flexShrink: 0 }}
                >{emailCopied ? '✓' : '📋'}</button>
                  </span>
            )}
{loc && <span className="meta-tag location">📍 {loc}</span>}
 {p.department && <span className="meta-tag dept">🏢 {p.department}</span>}
  {p.seniority && <span className="meta-tag">⭐ {p.seniority}</span>}
   {p.personal_phone && <span className="meta-tag">📞 {p.personal_phone}</span>}
    {p.linkedin_url && <span className="meta-tag social"><a href={p.linkedin_url} target="_blank" rel="noopener noreferrer">in ↗</a></span>}
   {p.twitter_url && <span className="meta-tag social"><a href={p.twitter_url} target="_blank" rel="noopener noreferrer">𝕏 ↗</a></span>}
  {p.github_url && <span className="meta-tag social"><a href={p.github_url} target="_blank" rel="noopener noreferrer">gh ↗</a></span>}
    </div>
    </div>
  {(p.company_size || p.company_founded || p.annual_revenue || p.subindustry || p.headcount_growth || p.time_in_role_months != null) && (
              <div className="lc-section">
                <div className="lc-label">🏢 Company</div>
               <div className="card-meta">
  {p.company_size && <span className="meta-tag">👥 {Number(p.company_size).toLocaleString()} employees</span>}
   {p.company_founded && <span className="meta-tag">📅 Founded {p.company_founded}</span>}
    {p.annual_revenue && <span className="meta-tag revenue">💰 {p.annual_revenue}</span>}
     {p.subindustry && <span className="meta-tag dept">{p.subindustry}</span>}
      {p.headcount_growth && <span className="meta-tag growth">📈 {fmtGrowth(p.headcount_growth)}</span>}
       {p.time_in_role_months != null && <span className="meta-tag">🕐 {fmtTimeInRole(p.time_in_role_months)}</span>}
        {p.company_phone && <span className="meta-tag">📞 {p.company_phone}</span>}
         {p.company_linkedin && <span className="meta-tag social"><a href={p.company_linkedin} target="_blank" rel="noopener noreferrer">Co. in ↗</a></span>}
           </div>
           </div>
                 )}
        {(p.recently_funded || p.funding_stage || p.funding_round_date) && (
                    <div className="card-meta">
        {p.funding_stage && <span className="meta-tag funding">💎 {p.funding_stage}{p.funding_total ? ' · ' + fmtFunding(p.funding_total) : ''}</span>}
         {p.funding_round_date && (<span className="meta-tag round">📌 {fmtRoundDate(p.funding_round_date)}{p.funding_round_type ? ' ' + p.funding_round_type : ''}{p.funding_round_amount ? ' ' + fmtRoundAmount(p.funding_round_amount) : ''}</span>)}
          {p.top_investors && p.top_investors.length > 0 && (<span className="meta-tag investors">👑 {p.top_investors.join(', ')}</span>)}
            </div>
                   )}
          {p.prev_jobs && p.prev_jobs.length > 0 && (
                      <div className="lc-section">
                        <div className="lc-label">↩ Previous Roles</div>
                       <div className="card-meta">
          {p.prev_jobs.map((j, i) => (<span key={i} className="meta-tag prev-job">🔄 {j.title}{j.company ? ' @ ' + j.company : ''}</span>))}
            </div>
            </div>
                   )}
          {p.aws_services && p.aws_services.length > 0 && (
                      <div className="lc-section">
                        <div className="lc-label">☁️ AWS Services</div>
                       <div className="aws-services-row">
                          <span className="aws-services-label">☁ AWS</span>
           {p.aws_services.map((s, i) => <span key={i} className="aws-service-pill">{s}</span>)}
                               </div>
                               </div>
                                       )}
           {p.tech_stack && p.tech_stack.length > 0 && (
                       <div className="lc-section">
                         <div className="lc-label">🛠 Tech Stack</div>
                        <div className="tech-pills">{p.tech_stack.map((t, i) => <span key={i} className="tech-pill">{t}</span>)}</div>
                                                                      </div>
                                                                              )}
           {p.keywords && p.keywords.length > 0 && (
                       <div className="lc-section">
                         <div className="lc-label">🔑 Keywords</div>
                        <div className="card-meta">{p.keywords.map((k, i) => <span key={i} className="meta-tag keyword">{k}</span>)}</div>
                                                                   </div>
                                                                           )}
           {desc && (
                       <div className="lc-section">
                         <div className="lc-label">🏢 About {p.company_name}</div>
                        <div className="company-desc">
           {descExpanded || !descTruncated ? desc : desc.slice(0, 155) + '…'}
           {descTruncated && !descExpanded && (
                             <button onClick={expandDesc} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#4f8ef7', cursor: 'pointer', fontSize: 11 }}>↓ Show full description</button>
                         )}
          </div>
            </div>
                  )}
         {/* Recent News */}
                 <div className="lc-section">
                             <button onClick={handleToggleNews} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                   <span className="lc-label" style={{ margin: 0, cursor: 'pointer' }}>📰 Recent News</span>
                   <span style={{ fontSize: 10, color: '#64748b', marginLeft: 2 }}>{newsOpen ? '▲' : '▼'}</span>
      {newsLoading && <span style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>Loading…</span>}
        </button>
      {newsOpen && (
                    <div style={{ marginTop: 8 }}>
      {newsError && <div style={{ fontSize: 11, color: '#ef4444' }}>⚠️ {newsError}</div>}
      {!newsLoading && newsArticles && newsArticles.length === 0 && (<div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>No recent news found.</div>)}
      {newsArticles && newsArticles.map(function(a, i) {
                        return (
                                            <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: i < newsArticles.length - 1 ? '1px solid #1e293b' : 'none' }}>
                                                            <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 12, lineHeight: 1.4, textDecoration: 'none', display: 'block', marginBottom: 3 }}>{a.title}</a>
     {a.description && (<div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4, marginBottom: 3 }}>{a.description.length > 120 ? a.description.slice(0, 120) + '…' : a.description}</div>)}
                         <div style={{ fontSize: 10, color: '#475569' }}>{a.source && <span style={{ marginRight: 6 }}>{a.source}</span>}{a.publishedAt && <span>{fmtNewsDate(a.publishedAt)}</span>}</div>
     </div>
                   );
  })}
 </div>
           )}
</div>
{/* Actions */}
        <div className="card-actions">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', overflow: 'visible' }}>
{/* HubSpot */}
            <button className={`btn-sm btn-hs${hsSent ? ' sent' : ''}`} onClick={handleHubspot} disabled={hsPushing || hsSent}>
            {hsSent ? '✓ In HubSpot' : hsPushing ? 'Pushing…' : '⬆ Push to HubSpot'}
</button>

{/* Apollo Sequence */}
{seqSent ? (
                <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>✓ Added to sequence</span>
              ) : (
                <button onClick={() => setSeqOpen(o => !o)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, background: seqOpen ? '#6d28d9' : '#7c3aed', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                🚀 Add to Apollo Sequence {seqOpen ? '▲' : '▼'}
</button>
            )}
{/* Draft Email button */}
            <div style={{ position: 'relative', overflow: 'visible' }}>
              {/* Tone picker popover */}
              {tonePicking && (
                <div style={{ position: 'absolute', bottom: '110%', left: 0, zIndex: 200, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', minWidth: 200 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select tone</div>
                  {[
                    { key: 'formal', label: 'Formal', desc: 'Professional, no contractions' },
                    { key: 'conversational', label: 'Conversational', desc: 'Human, approachable' },
                    { key: 'direct', label: 'Direct', desc: 'Blunt, value-first' },
                  ].map(opt => (
                    <button key={opt.key} onClick={() => handleToneSelected(opt.key)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', marginBottom: 4, borderRadius: 7, border: '1px solid #334155', background: 'transparent', color: '#f1f5f9', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background='#0e7490'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{opt.label}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{opt.desc}</div>
                    </button>
                  ))}
                  <button onClick={() => setTonePicking(false)} style={{ marginTop: 4, fontSize: 10, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}>Cancel</button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid #0e7490' }}>
                <button onClick={handleDraftEmail} disabled={emailDrafting || !p.email}
                  title={!p.email ? 'No email address for this lead' : 'Draft a personalized email with AI and open in Outlook'}
                  style={{ padding: '7px 12px', border: 'none', fontSize: 12, fontWeight: 600, background: emailDrafting ? '#164e63' : '#0e7490', color: emailDrafting ? '#94a3b8' : '#fff', cursor: !p.email ? 'not-allowed' : emailDrafting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
{emailDrafting ? '✍️ Drafting…' : '✉️ Draft Email'}
</button>
{senderEmails.length > 1 && (
                    <button onClick={() => setSenderPickerOpen(o => !o)} style={{ padding: '7px 8px', border: 'none', borderLeft: '1px solid #0891b2', fontSize: 10, background: senderPickerOpen ? '#164e63' : '#0e7490', color: '#fff', cursor: 'pointer' }} title="Choose sender email">
{senderPickerOpen ? '▲' : '▼'}
</button>
                )}
</div>
{/* Sender picker dropdown */}
{senderPickerOpen && senderEmails.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '6px 0', minWidth: 220, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', marginTop: 4 }}>
                  <div style={{ fontSize: 10, color: '#475569', padding: '4px 12px 8px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Send from</div>
{senderEmails.map(s => (
                      <button key={s.email} onClick={() => { setSelectedSender(s.email); setSenderPickerOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: activeSender && activeSender.email === s.email ? 'rgba(14,116,144,0.2)' : 'transparent', border: 'none', cursor: 'pointer', color: '#e2e8f0' }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{s.email}</div>
{s.name && <div style={{ fontSize: 11, color: '#64748b' }}>{s.name}</div>}
{s.isDefault && !selectedSender && <div style={{ fontSize: 10, color: '#0e7490' }}>Default</div>}
  </button>
                  ))}
                    </div>
              )}</div>

{/* Add to Email Queue button */}
            <button
              onClick={handleQueueTrigger}
              disabled={queueing || queued || !p.email}
              title={!p.email ? 'No email address for this lead' : queued ? 'Already added to queue' : 'Draft email with AI and add to Email Queue for review'}
              style={{
                                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                border: queued ? '1px solid #16a34a' : '1px solid #1e4d2b',
                                background: queued ? '#052e16' : queueing ? '#0d2518' : '#0d2518',
                                color: queued ? '#4ade80' : queueing ? '#64748b' : '#4ade80',
                                cursor: !p.email || queued ? 'not-allowed' : queueing ? 'wait' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
{queued ? '✓ In Queue' : queueing ? '⏳ Adding…' : '📥 Add to Email Queue'}
</button>
  </div>

{/* Sequence picker */}
{seqOpen && !seqSent && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
{sequences.length === 0 ? (
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>No sequences found in Apollo. Create one first.</span>
               ) : (
                                 <>
                                   <select style={dropStyle} value={selectedSeq} onChange={e => { setSelectedSeq(e.target.value); setSeqError(null); }} disabled={seqSending}>
                      <option value="">Select a sequence…</option>
{sequences.map(s => (<option key={s.id} value={s.id}>{s.name}{s.num_steps ? ` (${s.num_steps} steps)` : ''}</option>))}
  </select>
                  <button onClick={handleAddToSequence} disabled={!selectedSeq || seqSending}
                    style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, background: !selectedSeq || seqSending ? '#1e293b' : '#7c3aed', color: !selectedSeq || seqSending ? '#475569' : '#fff', cursor: !selectedSeq || seqSending ? 'not-allowed' : 'pointer' }}>
{seqSending ? 'Adding…' : '▶ Enroll'}
</button>
  </>
              )}
</div>
          )}
{seqError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>⚠️ {seqError}</div>}
{emailError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>⚠️ {emailError}</div>}
{queueError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>⚠️ Queue error: {queueError}</div>}
{draftResult && (
  <div style={{ marginTop: 12, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '12px 14px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>✉️ Draft Ready — Pick a Subject Line</div>
      <button onClick={() => setDraftResult(null)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14 }}>✕</button>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
      {(draftResult.subjects || []).map((subj, i) => {
        const label = i === 0 ? '🎯' : i === 1 ? '💰' : '👤';
        const clean = subj.replace(/^\[(CURIOSITY|VALUE|PERSONAL)\]\s*/, '');
        return (
          <button key={i} onClick={() => {
            navigator.clipboard.writeText(clean).catch(() => {});
            setSubjectCopied(i);
            setTimeout(() => setSubjectCopied(null), 2000);
          }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: '1px solid #334155', background: subjectCopied === i ? '#0e7490' : '#1e293b', color: subjectCopied === i ? '#fff' : '#e2e8f0', cursor: 'pointer', textAlign: 'left', fontSize: 12, transition: 'background 0.15s' }}>
            <span>{label}</span>
            <span style={{ flex: 1 }}>{clean}</span>
            <span style={{ fontSize: 10, color: subjectCopied === i ? '#bae6fd' : '#64748b', flexShrink: 0 }}>{subjectCopied === i ? '✓ Copied' : 'Copy'}</span>
          </button>
        );
      })}
    </div>
    <textarea readOnly value={(() => { let b = draftResult.body || ''; if (draftResult.activeSender) { b = b + (draftResult.activeSender.name ? '\n\nBest,\n' + draftResult.activeSender.name : '\n\nBest,'); } return b; })()} style={{ width: '100%', minHeight: 140, background: '#020617', border: '1px solid #1e293b', borderRadius: 7, padding: '8px 10px', fontSize: 11, color: '#cbd5e1', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5 }} onClick={e => e.target.select()} />
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <button onClick={() => {
        const b = (() => { let b = draftResult.body || ''; if (draftResult.activeSender) { b = b + (draftResult.activeSender.name ? '\n\nBest,\n' + draftResult.activeSender.name : '\n\nBest,'); } return b; })();
        navigator.clipboard.writeText(b).catch(() => {});
        setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000);
      }} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #334155', background: emailCopied ? '#0e7490' : '#1e293b', color: emailCopied ? '#fff' : '#94a3b8', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
        {emailCopied ? '✓ Copied' : '📋 Copy Email'}
      </button>
      <button onClick={() => {
        const subj = (draftResult.subjects && draftResult.subjects[0] || '').replace(/^[(CURIOSITY|VALUE|PERSONAL)]s*/, '');
        const b = (() => { let b = draftResult.body || ''; if (draftResult.activeSender) { b = b + (draftResult.activeSender.name ? '\n\nBest,\n' + draftResult.activeSender.name : '\n\nBest,'); } return b; })();
        const a = document.createElement('a');
        a.href = 'mailto:' + draftResult.to + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(b);
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#0e7490', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
        📨 Open in Email Client
      </button>
    </div>
  </div>
)}
  </div>
  </div>
  </div>
  );
}
