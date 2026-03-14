import { useState } from 'react';
import { fmtFunding, fmtAmt, fmtGrowth, fmtTimeInRole, fmtRoundDate, fmtRoundAmount, fmtFollowers } from '../lib/utils';

export default function LeadCard({ p, index, onHubspotPush }) {
  const [hsSent, setHsSent] = useState(p._hsSent || false);
  const [hsPushing, setHsPushing] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [fullDesc, setFullDesc] = useState(null);

  const sl = p.score_label || 'cold';
  const score = p.score || 0;
  const loc = [p.city, p.state, p.country].filter(Boolean).join(', ');
  const emailCls = p.email_status === 'verified' ? 'email' : 'email-guessed';
  const emailBadge = p.email_status === 'verified' ? '✅' : '✉️';

  async function handleHubspot() {
    setHsPushing(true);
    try {
      const resp = await fetch('/api/hubspot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: p.first_name, last_name: p.last_name,
          email: p.email, title: p.title,
          company_name: p.company_name, company_domain: p.company_domain,
          linkedin_url: p.linkedin_url, city: p.city, state: p.state, country: p.country,
          company_size: p.company_size, company_industry: p.company_industry,
          score_label: p.score_label, twitter_url: p.twitter_url,
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

  return (
    <div className={`card ${sl} fade-up`} style={{ animationDelay: `${index * 0.04}s` }}>
      {/* Avatar */}
      <div className="avatar">
        {p.photo_url
          ? <img src={p.photo_url} alt={p.name} onError={e => { e.target.parentNode.innerHTML = '👤'; }} />
          : '👤'}
      </div>

      <div className="card-body">
        {/* Intent strip for hot leads */}
        {sl === 'hot' && p.intent_signals && p.intent_signals.length > 0 && (
          <div className="intent-strip">
            <span className="intent-strip-label">🔥 Intent</span>
            {p.intent_signals.map((sig, i) => (
              <span key={i} className={`intent-chip ${sig.type}`}>{sig.label}</span>
            ))}
          </div>
        )}

        {/* Header row */}
        <div className="card-top">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="person-name">{p.name || 'Unknown'}</div>
            <div className="person-title">{p.title || ''}</div>
            <div className="person-company">
              {p.company_name || ''}{p.company_domain ? ' · ' + p.company_domain : ''}
            </div>
          </div>
          <div className="score-badge">
            <div className={`score-num ${sl}`}>{score}</div>
            <div className={`score-lbl ${sl}`}>{sl}</div>
            <div className="score-bar-wrap">
              <div className={`score-bar ${sl}`} style={{ width: score + '%' }} />
            </div>
          </div>
        </div>

        {/* Badges */}
        {(p.recently_funded || p.hiring_surge) && (
          <div className="card-meta">
            {p.recently_funded && <span className="badge-funded">💰 Recently Funded</span>}
            {p.hiring_surge && <span className="badge-hiring">📈 Hiring Surge</span>}
          </div>
        )}

        {/* 👤 Contact section */}
        <div className="lc-section">
          <div className="lc-label">👤 Contact</div>
          <div className="card-meta">
            {p.email && <span className={`meta-tag ${emailCls}`}>{emailBadge} {p.email}{p.email_status ? ` (${p.email_status})` : ''}</span>}
            {loc && <span className="meta-tag location">📍 {loc}</span>}
            {p.department && <span className="meta-tag dept">🏢 {p.department}</span>}
            {p.seniority && <span className="meta-tag">⭐ {p.seniority}</span>}
            {p.personal_phone && <span className="meta-tag">📞 {p.personal_phone}</span>}
            {p.linkedin_url && <span className="meta-tag social"><a href={p.linkedin_url} target="_blank" rel="noopener noreferrer">in ↗</a></span>}
            {p.twitter_url && <span className="meta-tag social"><a href={p.twitter_url} target="_blank" rel="noopener noreferrer">𝕏 ↗</a></span>}
            {p.github_url && <span className="meta-tag social"><a href={p.github_url} target="_blank" rel="noopener noreferrer">gh ↗</a></span>}
          </div>
        </div>

        {/* 🏢 Company section */}
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

        {/* Funding */}
        {(p.recently_funded || p.funding_stage || p.funding_round_date) && (
          <div className="card-meta">
            {p.funding_stage && <span className="meta-tag funding">💎 {p.funding_stage}{p.funding_total ? ' · ' + fmtFunding(p.funding_total) : ''}</span>}
            {p.funding_round_date && (
              <span className="meta-tag round">
                📌 {fmtRoundDate(p.funding_round_date)}{p.funding_round_type ? ' ' + p.funding_round_type : ''}{p.funding_round_amount ? ' ' + fmtRoundAmount(p.funding_round_amount) : ''}
              </span>
            )}
            {p.top_investors && p.top_investors.length > 0 && (
              <span className="meta-tag investors">👑 {p.top_investors.join(', ')}</span>
            )}
          </div>
        )}

        {/* ↩ Previous Roles */}
        {p.prev_jobs && p.prev_jobs.length > 0 && (
          <div className="lc-section">
            <div className="lc-label">↩ Previous Roles</div>
            <div className="card-meta">
              {p.prev_jobs.map((j, i) => (
                <span key={i} className="meta-tag prev-job">
                  🔄 {j.title}{j.company ? ' @ ' + j.company : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ☁️ AWS Services */}
        {p.aws_services && p.aws_services.length > 0 && (
          <div className="lc-section">
            <div className="lc-label">☁️ AWS Services</div>
            <div className="aws-services-row">
              <span className="aws-services-label">☁ AWS</span>
              {p.aws_services.map((s, i) => <span key={i} className="aws-service-pill">{s}</span>)}
            </div>
          </div>
        )}

        {/* 🛠 Tech Stack */}
        {p.tech_stack && p.tech_stack.length > 0 && (
          <div className="lc-section">
            <div className="lc-label">🛠 Tech Stack</div>
            <div className="tech-pills">
              {p.tech_stack.map((t, i) => <span key={i} className="tech-pill">{t}</span>)}
            </div>
          </div>
        )}

        {/* 🔑 Keywords */}
        {p.keywords && p.keywords.length > 0 && (
          <div className="lc-section">
            <div className="lc-label">🔑 Keywords</div>
            <div className="card-meta">
              {p.keywords.map((k, i) => <span key={i} className="meta-tag keyword">{k}</span>)}
            </div>
          </div>
        )}

        {/* 🏢 About */}
        {desc && (
          <div className="lc-section">
            <div className="lc-label">🏢 About {p.company_name}</div>
            <div className="company-desc">
              {descExpanded || !descTruncated ? desc : desc.slice(0, 155) + '…'}
              {descTruncated && !descExpanded && (
                <button onClick={expandDesc} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#4f8ef7', cursor: 'pointer', fontSize: 11 }}>
                  ↓ Show full description
                </button>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="card-actions">
          <button
            className={`btn-sm btn-hs${hsSent ? ' sent' : ''}`}
            onClick={handleHubspot}
            disabled={hsPushing || hsSent}
          >
            {hsSent ? '✓ In HubSpot' : hsPushing ? 'Pushing…' : '⬆ Push to HubSpot'}
          </button>
        </div>
      </div>
    </div>
  );
}
