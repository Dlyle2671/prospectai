import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/router';

const ADMIN_USER_ID = 'user_3BSgI2SWsJ9xBJeTxxN4mOWqGRM';

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

// Alias for backward compat with JSX that uses "s."
const s = styles;

function UserDrawer({ uid, onClose, onDelete }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setConfirmDelete(false);
    fetch('/api/admin?action=user&uid=' + uid)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [uid]);

  async function handleDelete() {
    setDeleting(true);
    const r = await fetch('/api/admin?action=user&uid=' + uid, { method: 'DELETE' });
    if (r.ok) { onDelete(uid); onClose(); }
    else { alert('Delete failed'); setDeleting(false); }
  }

  return (
    <div style={s.drawer}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>User Detail</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
      </div>
      {loading ? (
        <div style={{ color: '#475569', fontSize: 14 }}>Loading…</div>
      ) : !data ? (
        <div style={{ color: '#ef4444' }}>Failed to load user</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            {data.user.imageUrl ? (
              <img src={data.user.imageUrl} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👤</div>
            )}
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
            {data.senderEmails?.length > 0 && (
              <div style={{ fontSize: 12, color: '#64748b' }}>Sends from: {data.senderEmails.map(e => e.email).join(', ')}</div>
            )}
          </div>
          <div style={{ ...s.card, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>Email Queue ({data.emailQueueTotal} total)</div>
            {data.recentEmails.length === 0 ? (
              <div style={{ fontSize: 12, color: '#334155', fontStyle: 'italic' }}>No emails in queue</div>
            ) : (
              data.recentEmails.slice(0, 8).map((e, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < Math.min(data.recentEmails.length, 8) - 1 ? '1px solid #1e293b' : 'none' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{e.leadName || 'Unknown'}</div>
                    <div style={{ fontSize: 11, color: '#475569' }}>{e.leadCompany || ''}</div>
                  </div>
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
          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 20 }}>
            {!confirmDelete ? (
              <button style={s.btnDanger} onClick={() => setConfirmDelete(true)}>🗑 Delete User</button>
            ) : (
              <div>
                <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>⚠️ This will permanently delete the user from Clerk and wipe all their Redis data. Cannot be undone.</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={{ ...s.btnDanger, background: '#7f1d1d', color: '#fca5a5' }} onClick={handleDelete} disabled={deleting}>
                    {deleting ? 'Deleting…' : 'Confirm Delete'}
                  </button>
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

function InviteModal({ onClose, onInvited }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const r = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || 'Invite failed');
      } else {
        setSuccess('Invitation sent to ' + email + '!');
        setEmail('');
        if (onInvited) onInvited(d);
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: 14, padding: 32, width: 420, boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Invite New User</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
          Enter the email address. Clerk will send an invitation email with a sign-up link automatically.
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); setSuccess(''); }}
              placeholder="user@company.com"
              required
              autoFocus
              style={{ width: '100%', background: '#080c14', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', fontSize: 14, padding: '10px 14px', outline: 'none', boxSizing: 'border-box' }}
            />
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

export default function AdminPortal() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
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

  async function loadUsers() {
    setLoading(true);
    try {
      const [usersRes, invitesRes] = await Promise.all([
        fetch('/api/admin?action=users'),
        fetch('/api/admin/invite'),
      ]);
      const usersData = await usersRes.json();
      const invitesData = await invitesRes.json().catch(() => ({ invites: [] }));
      setUsers(usersData.users || []);
      setInvites(invitesData.invites || []);
    } catch (err) {
      console.error('[loadUsers]', err);
    }
    setLastRefresh(new Date());
    setLoading(false);
  }

  async function revokeInvite(inviteId) {
    await fetch('/api/admin/invite?inviteId=' + inviteId, { method: 'DELETE' });
    setInvites(prev => prev.filter(i => i.id !== inviteId));
  }

  function handleDelete(uid) {
    setUsers(prev => prev.filter(u => u.id !== uid));
  }

  const filtered = users.filter(u =>
    !search ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.firstName + ' ' + u.lastName).toLowerCase().includes(search.toLowerCase())
  );

  const totalEmails = users.reduce((acc, u) => acc + (u.emailQueueCount || 0), 0);
  const totalSent = users.reduce((acc, u) => acc + (u.emailsSent || 0), 0);

  const stats = {
    total: users.length,
    onboarded: users.filter(u => u.onboarded).length,
    activeToday: users.filter(u => u.lastSignInAt && (Date.now() - new Date(u.lastSignInAt)) < 86400000).length,
    totalEmails,
    emailsSent: totalSent,
  };

  if (!isLoaded || !isAdmin) {
    return <div style={{ minHeight: '100vh', background: '#020817', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>Checking access…</div>;
  }

  return (
    <>
      <Head><title>Admin — ProspectAI</title></Head>
      <div style={s.page}>
        <div style={s.nav}>
          <div style={s.logo}>ProspectAI <span style={s.badge}>ADMIN</span></div>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13 }}>← Back to App</button>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#334155', display: 'flex', alignItems: 'center', gap: 8 }}>
            {lastRefresh && 'Refreshed ' + timeAgo(lastRefresh)}
            <button onClick={loadUsers} style={{ background: 'none', border: '1px solid #1e293b', borderRadius: 6, color: '#64748b', cursor: 'pointer', fontSize: 12, padding: '3px 10px' }}>↻ Refresh</button>
            <button onClick={() => setShowInviteModal(true)} style={{ background: '#1d4ed8', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 12, padding: '3px 10px', fontWeight: 600 }}>+ Invite User</button>
          </div>
        </div>

        <div style={s.body}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Admin Portal</h1>
            <div style={{ fontSize: 13, color: '#475569' }}>User management and activity overview</div>
          </div>

          {/* Stats */}
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

          {/* Users table */}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Users ({filtered.length})</div>
              <input
                placeholder="Search by name or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ background: '#080c14', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', fontSize: 13, padding: '7px 12px', width: 260, outline: 'none' }}
              />
            </div>
            {loading ? (
              <div style={{ color: '#475569', padding: '32px 0', textAlign: 'center' }}>Loading users…</div>
            ) : (
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>User</th>
                    <th style={s.th}>Joined</th>
                    <th style={s.th}>Last Active</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Connected</th>
                    <th style={s.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.id} style={{ background: selectedUid === u.id ? '#0f1e3a' : 'transparent', cursor: 'pointer' }} onClick={() => setSelectedUid(u.id === selectedUid ? null : u.id)}>
                      <td style={s.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {u.imageUrl ? (
                            <img src={u.imageUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>👤</div>
                          )}
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
                      <td style={{ ...s.td, color: '#64748b' }}>
                        {u.connectedApps?.length > 0 ? u.connectedApps.join(', ') : <span style={{ color: '#334155' }}>None</span>}
                      </td>
                      <td style={s.td} onClick={e => e.stopPropagation()}>
                        <button style={s.btnPrimary} onClick={() => setSelectedUid(u.id === selectedUid ? null : u.id)}>View →</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pending Invites */}
          {invites.length > 0 && (
            <div style={s.card}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Pending Invites ({invites.length})</div>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Email</th>
                    <th style={s.th}>Invited</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((inv, i) => (
                    <tr key={inv.id || i}>
                      <td style={s.td}>{inv.email}</td>
                      <td style={{ ...s.td, color: '#64748b' }}>{timeAgo(inv.createdAt)}</td>
                      <td style={s.td}><span style={s.pill('#f59e0b')}>{inv.status}</span></td>
                      <td style={s.td}>
                        <button style={s.btnDanger} onClick={() => revokeInvite(inv.id)}>Revoke</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>

      {/* User detail drawer */}
      {selectedUid && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} onClick={() => setSelectedUid(null)} />
          <UserDrawer uid={selectedUid} onClose={() => setSelectedUid(null)} onDelete={handleDelete} />
        </>
      )}

      {/* Invite modal */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onInvited={(d) => {
            setInvites(prev => [{
              id: d.invitationId,
              email: d.email,
              status: 'pending',
              createdAt: new Date().toISOString(),
            }, ...prev]);
          }}
        />
      )}
    </>
  );
}
