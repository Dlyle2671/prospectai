import { useState } from 'react';
import { fmtAmt, fmtGrowth, fmtRoundDate, fmtFollowers, paiSave, paiLoad } from '../lib/utils';

export default function CompanyIntel() {
  const [domain, setDomain] = useState('');
  const [stage, setStage] = useState(0);
  const [profile, setProfile] = useState(() => paiLoad('company'));
  const [lastDomain, setLastDomain] = useState('');

  async function doLookup() {
    const d = domain.trim();
    if (!d) return;
    setLastDomain(d);
    setStage(1);
    try {
      const resp = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: d }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setProfile(data);
      paiSave('company', data);
      setStage(2);
    } catch (err) {
      setStage(0);
      alert('Lookup failed: ' + err.message);
    }
  }

  async function pushContact(i) {
    const c = profile;
    const p = c.contacts[i];
    if (!p) return;
    try {
      await fetch('/api/hubspot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: p.first_name, last_name: p.last_name,
          email: p.email, title: p.title,
          company_name: c.name, company_domain: c.domain,
          linkedin_url: p.linkedin_url, city: p.city, state: p.state, country: p.country,
          personal_phone: p.personal_phone, company_phone: c.phone,
          company_description: c.description, company_industry: c.industry,
          company_size: c.employee_count,
        }),
      });
      setProfile(prev => {
        const contacts = [...prev.contacts];
        contacts[i] = { ...contacts[i], _hsSent: true };
        return { ...prev, contacts };
      });
    } catch (err) {
      alert('HubSpot error: ' + err.message);
    }
  }

  const searchBar = (
    <div className="ci-search-wrap">
      <input
        className="ci-search-input"
        type="text"
        placeholder="Enter company domain (e.g. salesforce.com)"
        value={domain}
        onChange={e => setDomain(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && doLookup()}
      />
      <button className="ci-search-btn" onClick={doLookup}>🔍 Look Up</button>
    </div>
  );

  if (stage === 1) return (
    <div className="fade-up">
      {searchBar}
      <div className="loading-wrap"><span className="spinner" /><p>Researching company…</p></div>
    </div>
  );

  if (stage === 2 && profile) return (
    <div className="fade-up">
      {searchBar}
      <CompanyProfile c={profile} onPushContact={pushContact} />
    </div>
  );

  return (
    <div className="fade-up">
      <div className="section-title">Company Intel</div>
      <div className="section-sub">Enter a company domain to get a full dossier: funding history, tech stack, key contacts, open jobs, and recent news.</div>
      {searchBar}
      {profile && <CompanyProfile c={profile} onPushContact={pushContact} />}
    </div>
  );
}

function CompanyProfile({ c, onPushContact }) {
  const [pushingAll, setPushingAll] = useState(false);
  const [allSent, setAllSent] = useState(false);

  async function pushAll() {
    setPushingAll(true);
    for (let i = 0; i < (c.contacts || []).length; i++) {
      if (!c.contacts[i]._hsSent) await onPushContact(i);
      await new Promise(r => setTimeout(r, 300));
    }
    setAllSent(true);
    setPushingAll(false);
  }

  const logo = c.logo_url
    ? <div className="ci-logo"><img src={c.logo_url} alt={c.name} onError={e => { e.target.parentNode.innerHTML = '🏢'; }} /></div>
    : <div className="ci-logo">🏢</div>;

  return (
    <div className="ci-profile fade-up">
      {/* Header */}
      <div className="ci-header">
        {logo}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ci-company-name">{c.name || c.domain}</div>
          <div className="ci-company-meta">{c.industry}{c.headquarters ? ' · ' + c.headquarters : ''}{c.founded_year ? ' · Founded ' + c.founded_year : ''}</div>
          <div className="ci-company-links">
            {c.website && <a className="ci-link" href={c.website} target="_blank" rel="noopener noreferrer">🌐 Website</a>}
            {c.linkedin_url && <a className="ci-link" href={c.linkedin_url} target="_blank" rel="noopener noreferrer">in LinkedIn</a>}
            {c.twitter_url && <a className="ci-link" href={c.twitter_url} target="_blank" rel="noopener noreferrer">𝕏 Twitter</a>}
          </div>
        </div>
      </div>

      {/* Overview + Description */}
      <div className="ci-grid">
        <div className="ci-section">
          <div className="ci-section-title">📊 Overview</div>
          <div className="ci-stat-row">
            {c.employee_count && <div className="ci-stat"><span className="ci-stat-label">Employees</span><span className="ci-stat-value">{Number(c.employee_count).toLocaleString()}</span></div>}
            {c.founded_year && <div className="ci-stat"><span className="ci-stat-label">Founded</span><span className="ci-stat-value">{c.founded_year}</span></div>}
            {c.annual_revenue && <div className="ci-stat"><span className="ci-stat-label">Annual Revenue</span><span className="ci-stat-value">{c.annual_revenue}</span></div>}
            {c.latest_funding_stage && <div className="ci-stat"><span className="ci-stat-label">Funding Stage</span><span className="ci-stat-value">{c.latest_funding_stage}</span></div>}
            {c.total_funding && <div className="ci-stat"><span className="ci-stat-label">Total Raised</span><span className="ci-stat-value">{fmtAmt(c.total_funding)}</span></div>}
            {c.job_postings_count && <div className="ci-stat"><span className="ci-stat-label">Open Roles</span><span className="ci-stat-value">{c.job_postings_count}</span></div>}
            {c.linkedin_follower_count && <div className="ci-stat"><span className="ci-stat-label">LinkedIn Followers</span><span className="ci-stat-value">{fmtFollowers(c.linkedin_follower_count)}</span></div>}
            {c.phone && <div className="ci-stat"><span className="ci-stat-label">Phone</span><span className="ci-stat-value">{c.phone}</span></div>}
          </div>
        </div>
        {(c.seo_description || c.description) && (
          <div className="ci-section">
            <div className="ci-section-title">📝 About</div>
            <div className="ci-desc">{c.seo_description || c.description}</div>
          </div>
        )}
      </div>

      {/* Funding + Tech */}
      {(c.funding_events?.length > 0 || c.tech_stack?.length > 0 || c.aws_services?.length > 0) && (
        <div className="ci-grid">
          {c.funding_events?.length > 0 && (
            <div className="ci-section">
              <div className="ci-section-title">💰 Funding History</div>
              {c.funding_events.map((ev, i) => (
                <div key={i} className="ci-funding-event">
                  <div>
                    <div className="ci-funding-date">{fmtRoundDate(ev.date)}</div>
                    <div className="ci-funding-type">{ev.type || 'Round'}</div>
                    {ev.investors?.length > 0 && <div className="ci-funding-investors">{ev.investors.join(', ')}</div>}
                  </div>
                  <div className="ci-funding-amount">{ev.amount ? fmtAmt(ev.amount) : ''}</div>
                </div>
              ))}
            </div>
          )}
          {(c.tech_stack?.length > 0 || c.aws_services?.length > 0) && (
            <div className="ci-section">
              <div className="ci-section-title">⚙️ Tech Stack</div>
              {c.aws_services?.length > 0 && (
                <div className="aws-services-row" style={{ marginBottom: 10 }}>
                  <span className="aws-services-label">☁ AWS</span>
                  {c.aws_services.map((s, i) => <span key={i} className="aws-service-pill">{s}</span>)}
                </div>
              )}
              {c.tech_stack?.length > 0 && (
                <div className="tech-pills">
                  {c.tech_stack.map((t, i) => <span key={i} className="tech-pill">{t}</span>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Job Postings */}
      {(c.job_postings?.length > 0 || c.job_board_links?.length > 0) && (
        <div className="ci-section" style={{ marginBottom: 16 }}>
          <div className="ci-section-title">💼 Technical Job Openings {c.job_postings?.length > 0 && `(${c.job_postings.length})`}</div>
          {c.job_postings?.map((j, i) => (
            <div key={i} className="ci-job-item">
              <div>
                <div className="ci-job-title">{j.title}</div>
                {j.location && <div className="ci-job-location">📍 {j.location}</div>}
              </div>
              {j.url && <a className="ci-job-link" href={j.url} target="_blank" rel="noopener noreferrer">Apply ↗</a>}
            </div>
          ))}
          {c.job_board_links?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <span style={{ fontSize: 11, color: '#4a5568' }}>Search on: </span>
              {c.job_board_links.map((b, i) => <a key={i} className="ci-job-link" href={b.url} target="_blank" rel="noopener noreferrer" style={{ margin: '2px 4px 2px 0', display: 'inline-block' }}>{b.label} ↗</a>)}
            </div>
          )}
        </div>
      )}

      {/* News */}
      {c.news?.length > 0 && (
        <div className="ci-section" style={{ marginBottom: 16 }}>
          <div className="ci-section-title">📰 Recent News</div>
          {c.news.map((n, i) => (
            <div key={i} className="ci-news-item">
              <div className="ci-news-title">
                {n.url ? <a href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a> : n.title}
              </div>
              <div className="ci-news-meta">
                {n.source && <span className="ci-news-source">{n.source}</span>}
                {n.date && <span>{n.date}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contacts */}
      {c.contacts?.length > 0 && (
        <div className="ci-section">
          <div className="ci-section-title">👥 Key Contacts ({c.contacts.length})</div>
          {c.contacts.map((p, i) => (
            <div key={i} className="ci-contact-card">
              <div className="ci-contact-avatar">
                {p.photo_url ? <img src={p.photo_url} alt={p.name} onError={e => { e.target.parentNode.innerHTML = '👤'; }} /> : '👤'}
              </div>
              <div className="ci-contact-info">
                <div className="ci-contact-name">{p.name}</div>
                <div className="ci-contact-title">{p.title}</div>
                <div className="ci-contact-email" style={{ color: p.email_status === 'verified' ? '#22c55e' : '#f59e0b' }}>{p.email}</div>
                {p.personal_phone && <div className="ci-contact-phone">📞 {p.personal_phone}</div>}
              </div>
              <div className="ci-contact-actions">
                {p.linkedin_url && <a className="ci-link" href={p.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ padding: '2px 8px', fontSize: 11 }}>in</a>}
                <button
                  className={`btn-sm btn-hs${p._hsSent ? ' sent' : ''}`}
                  style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={() => !p._hsSent && onPushContact(i)}
                  disabled={p._hsSent}
                >
                  {p._hsSent ? '✓' : '⬆ Push'}
                </button>
              </div>
            </div>
          ))}
          <button className={`ci-push-all${allSent ? ' sent' : ''}`} onClick={pushAll} disabled={pushingAll || allSent}>
            {allSent ? '✓ All Contacts in HubSpot' : pushingAll ? 'Pushing…' : '⬆ Push All Contacts + Company to HubSpot'}
          </button>
        </div>
      )}
    </div>
  );
}
