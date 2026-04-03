// v3
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/router';
const ADMIN_USER_ID = 'user_3BSgI2SWsJ9xBJeTxxN4mOWqGRM';
const _buildVer = 3;
function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function timeAgo(ts) {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  return d + 'd ago';
}
function fmtTTL(secs) {
  if (!secs || secs <= 0) return 'expired';
  const h = Math.floor(secs / 3600);
  const d = Math.floor(h / 24);
  if (d > 0) return d + 'd ' + (h % 24) + 'h';
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}
const styles = {
  page: { minHeight: '100vh', background: '#020817', color: '#e2e8f0', fontFamily: 'DM Sans, sans-serif' },
  nav: { background: '#0a0f1e', borderBottom: '1px solid #1e293b', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', gap: 24 },
  logo: { fontSize: 18, fontWeight: 800, color: '#e2e8f0' },
  badge: { fontSize: 10, background: '#7c3aed', color: '#fff', borderRadius: 4, padding: '2px 7px', fontWeight: 700, letterSpacing: '.04em', marginLeft: 8 },
  body: { maxWidth: 1100, margin: '0 auto', padding: '32px 24px' },
  card: { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '20px 24px', marginBottom: 20 },
  stat: { background: '#080c14', border: '1px solid #1e293b', borderRadius: 10, padding: '16px 20px', textAlign: 'center' },
  statNum: { fontSize: 32, fontWeight: 800, color: '#3b82f6' },
  statLabel: { fontSize: 12, color: '#475569', marginTop: 4 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #1e293b' },
  td: { padding: '12px', borderBottom: '1px solid #0f172a', fontSize: 13 },
  btnDanger: { padding: '5px 12px', borderRadius: 6, border: '1px solid #7f1d1d', background: 'transparent', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  btnPrimary: { padding: '5px 12px', borderRadius: 6, border: 'none', background: '#1d4ed8', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  pill: (color) => ({ fontSize: 11, padding: '2px 8px', borderRadius: 20, border: '1px solid', borderColor: color + '44', background: color + '18', color }),
  drawer: { position: 'fixed', top: 0, right: 0, width: 460, height: '100vh', background: '#0a0f1e', borderLeft: '1px solid #1e293b', overflowY: 'auto', zIndex: 100, padding: 28, boxSizing: 'border-box' },
};
const s = styles;
function UserDrawer({ uid, onClose, onDelete }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [flags, setFlags] = useState(null);
  const [savingFlags, setSavingFlags] = useState(false);
  const [flagsSaved, setFlagsSaved] = useState(false);
  useEffect(() => {
    setLoading(true);
    setConfirmDelete(false);
    fetch('/api/admin?action=user&uid=' + uid)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); setFlags(d.featureFlags || {}); })
      .catch(() => setLoading(false));
  }, [uid]);
  async function saveFlags() {
    setSavingFlags(true);
    await fetch('/api/admin?action=flags&uid=' + uid, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flags }) });
    setSavingFlags(false); setFlagsSaved(true); setTimeout(() => setFlagsSaved(false), 2000);
  }
  async function handleDelete() {
    setDeleting(true);
    const r = await fetch('/api/admin?action=user&uid=' + uid, { method: 'DELETE' });
    if (r.ok) { onDelete(uid); onClose(); } else { alert('Delete failed'); setDeleting(false); }
  }
  return (
    <div style={s.drawer}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>User Detail</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
      </div>
      {loading ? <div style={{ color: '#475569', fontSize: 14 }}>Loading…</div> : !data ? <div style={{ color: '#ef4444' }}>Failed to load user</div> : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            {data.user.imageUrl ? <img src={data.user.imageUrl} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👤</div>}
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{data.user.firstName} {data.user.lastName}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>{data.user.email}</div>
            </div>
          </div>
          <div style={{ ...s.card, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><div style={{ fontSize: 11, color: '#475569' }}>Joined</div><div style={{ fontSize: 13, marginTop: 3 }}>{fmtDate(data.user.createdAt)}</div></div>
              <div><div style={{ fontSize: 11, color: '#475569' }}>Last sign in</div><div style={{ fontSize: 13, marginTop: 3 }}>{timeAgo(data.user.lastSignInAt)}</div></div>
            </div>
          </div>
          <div style={{ ...s.card, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>Settings</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <span style={s.pill(data.senderEmails?.length > 0 ? '#22c55e' : '#475569')}>{data.senderEmails?.length > 0 ? '✓ Sender email set' : '✗ No sender email'}</span>
              <span style={s.pill(data.icpWeights ? '#22c55e' : '#475569')}>{data.icpWeights ? '✓ ICP configured' : '✗ Default ICP'}</span>
              <span style={s.pill(data.integrations?.hubspot_token ? '#22c55e' : '#475569')}>{data.integrations?.hubspot_token ? '✓ HubSpot' : '✗ No HubSpot'}</span>
              <span style={s.pill(data.integrations?.apollo_key ? '#22c55e' : '#475569')}>{data.integrations?.apollo_key ? '✓ Apollo' : '✗ No Apollo'}</span>
            </div>
            {data.senderEmails?.length > 0 && <div style={{ fontSize: 12, color: '#64748b' }}>Sends from: {data.senderEmails.map(e => e.email).join(', ')}</div>}
          </div>
          <div style={{ ...s.card, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>Email Queue ({data.emailQueueTotal} total)</div>
            {data.recentEmails.length === 0 ? <div style={{ fontSize: 12, color: '#334155', fontStyle: 'italic' }}>No emails in queue</div> : (
              data.recentEmails.slice(0, 8).map((e, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < Math.min(data.recentEmails.length, 8) - 1 ? '1px solid #1e293b' : 'none' }}>
                  <div><div style={{ fontSize: 12, fontWeight: 600 }}>{e.leadName || 'Unknown'}</div><div style={{ fontSize: 11, color: '#475569' }}>{e.leadCompany || ''}</div></div>
                  <span style={s.pill(e.status === 'sent' ? '#22c55e' : e.status === 'pending' ? '#f59e0b' : '#64748b')}>{e.status}</span>
                </div>
              ))
            )}
          </div>
          {data.icpWeights && (
            <div style={{ ...s.card, padding: '14px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>ICP Weights</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['companySizeWeight','industryWeight','fundingWeight','hiringSurgeBonus','awsBonus'].map(k => (
                  <span key={k} style={{ fontSize: 11, background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: '2px 10px', color: '#94a3b8' }}>
                    {k.replace('Weight','').replace('Bonus','')}: <strong style={{ color: '#e2e8f0' }}>{data.icpWeights[k]}pts</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
          {flags !== null && (
            <div style={{ borderTop: '1px solid #1e293b', paddingTop: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 14 }}>Tool Access</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                {[{id:'leads',label:'Find Leads'},{id:'company',label:'Company Intel'},{id:'bulk',label:'Bulk Prospector'},{id:'jobchanges',label:'Job Changes'},{id:'peoplelookup',label:'People Lookup'},{id:'lookalike',label:'Lookalike'},{id:'awsopps',label:'Lead Scoring'},{id:'emailqueue',label:'Email Queue'},{id:'credits',label:'Credits'},{id:'salesanalytics',label:'Sales Analytics'}].map(tool => {
                  const enabled = flags[tool.id] !== false;
                  return (
                    <label key={tool.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: enabled ? '#f1f5f9' : '#475569' }}>
                      <div onClick={() => setFlags(prev => ({ ...prev, [tool.id]: !enabled }))} style={{ width: 36, height: 20, borderRadius: 10, flexShrink: 0, background: enabled ? '#6366f1' : '#1e293b', border: '1px solid ' + (enabled ? '#818cf8' : '#334155'), position: 'relative', cursor: 'pointer', transition: 'background .2s' }}>
                        <div style={{ position: 'absolute', top: 2, left: enabled ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: enabled ? '#fff' : '#475569', transition: 'left .2s' }} />
                      </div>
                      {tool.label}
                    </label>
                  );
                })}
              </div>
              <button onClick={saveFlags} disabled={savingFlags} style={{ marginTop: 14, padding: '7px 18px', background: flagsSaved ? 'rgba(34,197,94,.15)' : 'rgba(99,102,241,.2)', border: '1px solid ' + (flagsSaved ? '#22c55e' : 'rgba(99,102,241,.4)'), color: flagsSaved ? '#22c55e' : '#a5b4fc', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {flagsSaved ? '✓ Saved' : savingFlags ? 'Saving…' : 'Save Permissions'}
              </button>
            </div>
          )}
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 20 }}>
            {!confirmDelete ? <button style={s.btnDanger} onClick={() => setConfirmDelete(true)}>🗑 Delete User</button> : (
              <div>
                <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>⚠️ This will permanently delete the user from Clerk and wipe all their Redis data. Cannot be undone.</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={{ ...s.btnDanger, background: '#7f1d1d', color: '#fca5a5' }} onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Confirm Delete'}</button>
                  <button style={{ ...s.btnPrimary, background: 'transparent', border: '1px solid #334155', color: '#94a3b8' }} onClick={() => setConfirmDelete(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
const TOOLS = [
  { id: 'leads', label: 'Find Leads' }, { id: 'company', label: 'Company Intel' },
  { id: 'bulk', label: 'Bulk Prospector' }, { id: 'jobchanges', label: 'Job Changes' },
  { id: 'peoplelookup', label: 'People Lookup' }, { id: 'lookalike', label: 'Lookalike' },
  { id: 'awsopps', label: 'Lead Scoring' }, { id: 'emailqueue', label: 'Email Queue' },
  { id: 'credits', label: 'Credits' }, { id: 'salesanalytics', label: 'Sales Analytics' },
];
function ToolToggle({ toolId, label, enabled, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: enabled ? '#f1f5f9' : '#475569' }}>
      <div onClick={() => onChange(!enabled)} style={{ width: 34, height: 18, borderRadius: 9, flexShrink: 0, background: enabled ? '#6366f1' : '#1e293b', border: '1px solid ' + (enabled ? '#818cf8' : '#334155'), position: 'relative', cursor: 'pointer', transition: 'background .2s' }}>
        <div style={{ position: 'absolute', top: 2, left: enabled ? 16 : 2, width: 12, height: 12, borderRadius: '50%', background: enabled ? '#fff' : '#475569', transition: 'left .2s' }} />
      </div>
      {label}
    </label>
  );
}
function InviteModal({ onClose, onInvited }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const defaultFlags = Object.fromEntries(TOOLS.map(t => [t.id, true]));
  const [flags, setFlags] = useState(defaultFlags);
  function toggleAll(val) { setFlags(Object.fromEntries(TOOLS.map(t => [t.id, val]))); }
  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      const r = await fetch('/api/admin/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), flags }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Invite failed'); } else { setSuccess('Invitation sent to ' + email + '!'); setEmail(''); setFlags(defaultFlags); if (onInvited) onInvited(d); }
    } catch (err) { setError('Network error: ' + err.message); } finally { setLoading(false); }
  }
  const allOn = TOOLS.every(t => flags[t.id] !== false);
  const allOff = TOOLS.every(t => flags[t.id] === false);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 14, padding: 28, width: 480, maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Invite New User</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Email Address</label>
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); setSuccess(''); }} placeholder="user@company.com" required autoFocus style={{ width: '100%', background: '#080c14', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', fontSize: 14, padding: '10px 14px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.8px' }}>Tool Access</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => toggleAll(true)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '1px solid #1e293b', background: allOn ? '#1e3a5f' : 'transparent', color: allOn ? '#60a5fa' : '#475569', cursor: 'pointer' }}>All On</button>
                <button type="button" onClick={() => toggleAll(false)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '1px solid #1e293b', background: allOff ? '#2d1b1b' : 'transparent', color: allOff ? '#f87171' : '#475569', cursor: 'pointer' }}>All Off</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
              {TOOLS.map(tool => <ToolToggle key={tool.id} toolId={tool.id} label={tool.label} enabled={flags[tool.id] !== false} onChange={val => setFlags(prev => ({ ...prev, [tool.id]: val }))} />)}
            </div>
          </div>
          {error && <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 14, padding: '8px 12px', background: 'rgba(127,29,29,0.13)', border: '1px solid rgba(127,29,29,0.33)', borderRadius: 6 }}>{error}</div>}
          {success && <div style={{ fontSize: 13, color: '#22c55e', marginBottom: 14, padding: '8px 12px', background: 'rgba(20,83,45,0.13)', border: '1px solid rgba(20,83,45,0.33)', borderRadius: 6 }}>{success}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #1e293b', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
            <button type="submit" disabled={loading || !email.trim()} style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: loading || !email.trim() ? '#1e3a5f' : '#1d4ed8', color: '#fff', fontSize: 13, cursor: loading || !email.trim() ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
              {loading ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
function IntentDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [deletingDomain, setDeletingDomain] = useState(null);
  const [seedDomain, setSeedDomain] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/intent');
      const d = await r.json();
      setData(d);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  async function deleteDomain(domain) {
    setDeletingDomain(domain);
    await fetch('/api/admin/intent?domain=' + encodeURIComponent(domain), { method: 'DELETE' });
    setData(prev => ({ ...prev, domains: prev.domains.filter(d => d.domain !== domain), today: { ...prev.today, count: Math.max(0, (prev.daily?.count || 1) - 1) } }));
    setDeletingDomain(null);
  }
  async function clearAll() {
    setClearing(true);
    if (data?.entries) {
      await Promise.all(data.entries.map(d => fetch('/api/admin/intent?domain=' + encodeURIComponent(d.domain), { method: 'DELETE' })));
    }
    setConfirmClear(false); setClearing(false);
    load();
  }
  async function seedDomainFn() {
    if (!seedDomain.trim()) return;
    setSeeding(true); setSeedMsg('');
    try {
      const r = await fetch('/api/intent-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': 'apollo-intent-2026' },
        body: JSON.stringify([{ organization: { name: seedDomain.trim(), primary_domain: seedDomain.trim() }, intent_strength: 'HIGH', signals: ['Manual seed'], source: 'manual' }]),
      });
      const d = await r.json();
      setSeedMsg(d.error ? '❌ ' + d.error : '✓ Seeded ' + seedDomain.trim());
      if (!d.error) { setSeedDomain(''); load(); }
    } catch (e) { setSeedMsg('❌ ' + e.message); }
    setSeeding(false);
  }
  const limit = data?.daily?.limit || 25;
  const todayCount = data?.daily?.count || 0;
  const pct = Math.min(100, Math.round((todayCount / limit) * 100));
  const history = data?.history || [];
  const maxHistCount = Math.max(1, ...history.map(h => h.count || 0));
  const strengthColor = { HIGH: '#22c55e', MEDIUM: '#f59e0b', LOW: '#64748b' };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>🔥 Intent Dashboard</div>
          <div style={{ fontSize: 13, color: '#475569' }}>Apollo buying intent signals — Redis state</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={load} style={{ background: 'none', border: '1px solid #1e293b', borderRadius: 6, color: '#64748b', cursor: 'pointer', fontSize: 12, padding: '5px 12px' }}>↻ Refresh</button>
          {!confirmClear ? (
            <button onClick={() => setConfirmClear(true)} style={{ ...s.btnDanger, padding: '5px 14px' }}>Clear All</button>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#ef4444' }}>Delete all {data?.entries?.length || 0} domains?</span>
              <button onClick={clearAll} disabled={clearing} style={{ ...s.btnDanger, background: '#7f1d1d', color: '#fca5a5' }}>{clearing ? 'Clearing…' : 'Yes, clear all'}</button>
              <button onClick={() => setConfirmClear(false)} style={{ ...s.btnPrimary, background: 'transparent', border: '1px solid #334155', color: '#94a3b8' }}>Cancel</button>
            </div>
          )}
        </div>
      </div>
      {loading ? <div style={{ color: '#475569', padding: '40px 0', textAlign: 'center' }}>Loading intent data…</div> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={s.card}>
              <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Today’s Usage</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e' }}>{todayCount}</span>
                <span style={{ fontSize: 16, color: '#475569' }}>/ {limit}</span>
                <span style={{ fontSize: 12, color: '#64748b', marginLeft: 4 }}>domains today</span>
              </div>
              <div style={{ background: '#1e293b', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                <div style={{ width: pct + '%', height: '100%', background: pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e', transition: 'width .4s', borderRadius: 6 }} />
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>{pct}% of daily limit — resets midnight UTC</div>
            </div>
            <div style={s.card}>
              <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>7-Day History</div>
              {history.length === 0 ? <div style={{ fontSize: 12, color: '#334155', fontStyle: 'italic' }}>No history yet</div> : (
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 60 }}>
                  {history.slice(-7).map((h, i) => {
                    const barH = Math.max(4, Math.round((h.count / maxHistCount) * 52));
                    const isToday = h.date === new Date().toISOString().slice(0,10);
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <div style={{ fontSize: 9, color: '#475569' }}>{h.count}</div>
                        <div style={{ width: '100%', height: barH, background: isToday ? '#3b82f6' : '#1e3a5f', borderRadius: 3, border: isToday ? '1px solid #60a5fa' : 'none' }} />
                        <div style={{ fontSize: 8, color: '#334155' }}>{h.date?.slice(5)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div style={s.card}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Manual Domain Seed</div>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>Inject a test domain into the intent pipeline (bypasses Apollo)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={seedDomain} onChange={e => setSeedDomain(e.target.value)} placeholder="example.com" onKeyDown={e => e.key === 'Enter' && seedDomainFn()} style={{ flex: 1, background: '#080c14', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', fontSize: 13, padding: '7px 12px', outline: 'none' }} />
              <button onClick={seedDomainFn} disabled={seeding || !seedDomain.trim()} style={{ ...s.btnPrimary, padding: '7px 16px', opacity: seeding || !seedDomain.trim() ? .5 : 1 }}>{seeding ? 'Seeding…' : 'Seed'}</button>
            </div>
            {seedMsg && <div style={{ fontSize: 12, marginTop: 8, color: seedMsg.startsWith('✓') ? '#22c55e' : '#ef4444' }}>{seedMsg}</div>}
          </div>
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Active Intent Domains ({data?.entries?.length || 0})</div>
            </div>
            {!data?.entries?.length ? <div style={{ color: '#334155', fontStyle: 'italic', fontSize: 13 }}>No intent domains in Redis yet. Waiting for Apollo signals.</div> : (
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Domain / Org</th>
                    <th style={s.th}>Strength</th>
                    <th style={s.th}>Signals</th>
                    <th style={s.th}>Source</th>
                    <th style={s.th}>Updated</th>
                    <th style={s.th}>TTL</th>
                    <th style={s.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((d, i) => (
                    <tr key={d.domain} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.01)' }}>
                      <td style={s.td}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{d.org_name || d.domain}</div>
                        <div style={{ fontSize: 11, color: '#475569' }}>{d.domain}</div>
                      </td>
                      <td style={s.td}><span style={s.pill(strengthColor[(d.intent_strength || '').toUpperCase()] || '#64748b')}>{(d.intent_strength || '').toUpperCase() || '?'}</span></td>
                      <td style={{ ...s.td, color: '#94a3b8' }}>{Array.isArray(d.intent_signals) ? d.intent_signals.join(', ') : (d.intent_signals || '—')}</td>
                      <td style={{ ...s.td, color: '#64748b', fontSize: 11 }}>{d.source || 'apollo'}</td>
                      <td style={{ ...s.td, color: '#64748b', fontSize: 11 }}>{timeAgo(d.updatedAt)}</td>
                      <td style={{ ...s.td, fontSize: 11, color: d.ttl_seconds < 86400 ? '#f59e0b' : '#64748b' }}>{fmtTTL(d.ttl_seconds)}</td>
                      <td style={s.td}>
                        <button style={s.btnDanger} onClick={() => deleteDomain(d.domain)} disabled={deletingDomain === d.domain}>{deletingDomain === d.domain ? '…' : 'Del'}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
export default function AdminPortal() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUid, setSelectedUid] = useState(null);
  const [search, setSearch] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invites, setInvites] = useState([]);
  const isAdmin = isLoaded && user?.id === ADMIN_USER_ID;
  useEffect(() => {
    if (!isLoaded) return;
    if (!isAdmin) { router.replace('/'); return; }
    loadUsers();
  }, [isLoaded, isAdmin]);
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, invitesRes] = await Promise.all([fetch('/api/admin?action=users'), fetch('/api/admin/invite')]);
      const usersData = await usersRes.json().catch(() => ({ users: [] }));
      const invitesData = await invitesRes.json().catch(() => ({ invites: [] }));
      setUsers(usersData.users || []);
      setInvites(invitesData.invites || []);
    } catch (err) { console.error('[loadUsers]', err); }
    setLastRefresh(new Date());
    setLoading(false);
  }, []);
  async function revokeInvite(inviteId) {
    await fetch('/api/admin/invite?inviteId=' + inviteId, { method: 'DELETE' });
    setInvites(prev => prev.filter(i => i.id !== inviteId));
  }
  function handleDelete(uid) { setUsers(prev => prev.filter(u => u.id !== uid)); }
  const filtered = users.filter(u => !search || u.email.toLowerCase().includes(search.toLowerCase()) || (u.firstName + ' ' + u.lastName).toLowerCase().includes(search.toLowerCase()));
  const totalEmails = users.reduce((acc, u) => acc + (u.emailQueueCount || 0), 0);
  const totalSent = users.reduce((acc, u) => acc + (u.emailsSent || 0), 0);
  const stats = { total: users.length, onboarded: users.filter(u => u.onboarded).length, activeToday: users.filter(u => u.lastSignInAt && (Date.now() - new Date(u.lastSignInAt)) < 86400000).length, totalEmails, emailsSent: totalSent };
  if (!isLoaded || !isAdmin) return <div style={{ minHeight: '100vh', background: '#020817', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>Checking access…</div>;
  const tabBtnStyle = (active) => ({
    padding: '6px 16px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    background: active ? '#1e3a5f' : 'transparent', color: active ? '#60a5fa' : '#475569',
    borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
  });
  return (
    <>
      <Head><title>Admin Portal — ProspectAI</title></Head>
      <div style={s.page} data-version={_buildVer}>
        <div style={s.nav}>
          <div style={s.logo}>ProspectAI <span style={s.badge}>ADMIN</span></div>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13 }}>← Back to App</button>
          <div style={{ display: 'flex', gap: 4, marginLeft: 16 }}>
            <button style={tabBtnStyle(activeTab === 'users')} onClick={() => setActiveTab('users')}>👥 Users</button>
            <button style={tabBtnStyle(activeTab === 'intent')} onClick={() => setActiveTab('intent')}>🔥 Intent</button>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#334155', display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeTab === 'users' && lastRefresh && 'Refreshed ' + timeAgo(lastRefresh)}
            {activeTab === 'users' && <button onClick={loadUsers} style={{ background: 'none', border: '1px solid #1e293b', borderRadius: 6, color: '#64748b', cursor: 'pointer', fontSize: 12, padding: '3px 10px' }}>↻ Refresh</button>}
            {activeTab === 'users' && <button onClick={() => setShowInviteModal(true)} style={{ background: '#1d4ed8', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 12, padding: '3px 10px', fontWeight: 600 }}>+ Invite User</button>}
          </div>
        </div>
        <div style={s.body}>
          {activeTab === 'intent' ? <IntentDashboard /> : (
            <>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Admin Portal</h1>
                <div style={{ fontSize: 13, color: '#475569' }}>User management and activity overview</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 28 }}>
                {[
                  { label: 'Total Users', value: stats.total, color: '#3b82f6' },
                  { label: 'Onboarded', value: stats.onboarded, color: '#22c55e' },
                  { label: 'Active Today', value: stats.activeToday, color: '#f59e0b' },
                  { label: 'Apollo Connected', value: users.filter(u => u.connectedApps?.includes('apollo_key')).length, color: '#8b5cf6' },
                  { label: 'Email Configured', value: users.filter(u => u.hasSenders).length, color: '#0ea5e9' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={s.stat}>
                    <div style={{ ...s.statNum, color }}>{loading ? '—' : value}</div>
                    <div style={s.statLabel}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Users ({filtered.length})</div>
                  <input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} style={{ background: '#080c14', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', fontSize: 13, padding: '7px 12px', width: 260, outline: 'none' }} />
                </div>
                {loading ? <div style={{ color: '#475569', padding: '32px 0', textAlign: 'center' }}>Loading users…</div> : (
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>User</th><th style={s.th}>Joined</th><th style={s.th}>Last Active</th>
                        <th style={s.th}>Status</th><th style={s.th}>Connected</th><th style={s.th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(u => (
                        <tr key={u.id} style={{ background: selectedUid === u.id ? '#0f1e3a' : 'transparent', cursor: 'pointer' }} onClick={() => setSelectedUid(u.id === selectedUid ? null : u.id)}>
                          <td style={s.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {u.imageUrl ? <img src={u.imageUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>👤</div>}
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{u.firstName} {u.lastName}{u.id === ADMIN_USER_ID ? ' 👑' : ''}</div>
                                <div style={{ fontSize: 11, color: '#475569' }}>{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ ...s.td, color: '#64748b' }}>{fmtDate(u.createdAt)}</td>
                          <td style={{ ...s.td, color: '#64748b' }}>{timeAgo(u.lastSignInAt)}</td>
                          <td style={s.td}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <span style={s.pill(u.onboarded ? '#22c55e' : '#f59e0b')}>{u.onboarded ? '✓ Onboarded' : '⏳ Pending'}</span>
                              {u.hasSenders && <span style={s.pill('#0ea5e9')}>✉️ Email</span>}
                              {u.hasIcp && <span style={s.pill('#8b5cf6')}>🎯 ICP</span>}
                            </div>
                          </td>
                          <td style={{ ...s.td, color: '#64748b' }}>{u.connectedApps?.length > 0 ? u.connectedApps.join(', ') : <span style={{ color: '#334155' }}>None</span>}</td>
                          <td style={s.td} onClick={e => e.stopPropagation()}><button style={s.btnPrimary} onClick={() => setSelectedUid(u.id === selectedUid ? null : u.id)}>View →</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {invites.length > 0 && (
                <div style={s.card}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Pending Invites ({invites.length})</div>
                  <table style={s.table}>
                    <thead><tr><th style={s.th}>Email</th><th style={s.th}>Invited</th><th style={s.th}>Status</th><th style={s.th}></th></tr></thead>
                    <tbody>
                      {invites.map((inv, i) => (
                        <tr key={inv.id || i}>
                          <td style={s.td}>{inv.email}</td>
                          <td style={{ ...s.td, color: '#64748b' }}>{timeAgo(inv.createdAt)}</td>
                          <td style={s.td}><span style={s.pill('#f59e0b')}>{inv.status}</span></td>
                          <td style={s.td}><button style={s.btnDanger} onClick={() => revokeInvite(inv.id)}>Revoke</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {selectedUid && activeTab === 'users' && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} onClick={() => setSelectedUid(null)} />
          <UserDrawer uid={selectedUid} onClose={() => setSelectedUid(null)} onDelete={handleDelete} />
        </>
      )}
      {showInviteModal && (
        <InviteModal onClose={() => setShowInviteModal(false)} onInvited={(d) => { setInvites(prev => [{ id: d.invitationId, email: d.email, status: 'pending', createdAt: new Date().toISOString() }, ...prev]); }} />
      )}
    </>
  );
}
// v3 Stop Claude
