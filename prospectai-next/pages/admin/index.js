import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Head from 'next/head';
import Link from 'next/link';

const TAB_IDS = ['leads','company','bulk','jobchanges','people','lookalike','awsopps','emailqueue','credits','salesanalytics'];
const TAB_LABELS = { leads:'Find Leads', company:'Company Intel', bulk:'Bulk Prospector', jobchanges:'Job Changes', people:'People Lookup', lookalike:'Lookalike', awsopps:'Lead Scoring', emailqueue:'Email Queue', credits:'Credits', salesanalytics:'Sales Analytics' };

function timeAgo(ts) {
  if (!ts) return 'Never';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  return days + 'd ago';
}

export default function AdminPortal() {
  const { user, isLoaded } = useUser();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expandedUser, setExpandedUser] = useState(null);
  const [pendingFlags, setPendingFlags] = useState({});
  const [savingFlags, setSavingFlags] = useState(null);

  useEffect(() => {
    if (!isLoaded) return;
    fetchUsers();
  }, [isLoaded]);

  async function fetchUsers() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users');
      if (res.status === 403) { setError('Access denied. You are not an admin.'); setLoading(false); return; }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function deleteUser(userId, email) {
    if (confirmDelete !== userId) {
      setConfirmDelete(userId);
      return;
    }
    setDeleting(userId);
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/admin/users?userId=${userId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      setUsers(prev => prev.filter(u => u.id !== userId));
      setTotal(prev => prev - 1);
    } catch (err) {
      setError('Delete failed: ' + err.message);
    }
    setDeleting(null);
  }

  function toggleFlag(userId, featureId, currentFlags) {
    const base = pendingFlags[userId] || currentFlags || {};
    const current = base[featureId] !== false;
    setPendingFlags(p => ({ ...p, [userId]: { ...base, [featureId]: !current } }));
  }

  async function saveFlags(userId) {
    const flags = pendingFlags[userId];
    if (!flags) return;
    setSavingFlags(userId);
    try {
      const res = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetId: userId, featureFlags: flags }) });
      if (!res.ok) throw new Error(await res.text());
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, featureFlags: flags } : u));
      setPendingFlags(p => { const n={...p}; delete n[userId]; return n; });
      setExpandedUser(null);
    } catch (err) { setError('Save failed: ' + err.message); }
    setSavingFlags(null);
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.firstName + ' ' + u.lastName).toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total,
    onboarded: users.filter(u => u.onboarded).length,
    withApollo: users.filter(u => u.connectedApps?.includes('apollo')).length,
    withHubspot: users.filter(u => u.connectedApps?.includes('hubspot')).length,
    withEmail: users.filter(u => u.connectedApps?.includes('email_pass')).length,
  };

  return (
    <>
      <Head><title>Admin Portal -- ProspectAI</title></Head>
      <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', fontFamily: 'Inter, sans-serif', padding: '32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#6366f1', textDecoration: 'none', fontSize: 14, fontWeight: 500, padding: '7px 14px', background: '#1e1b4b', borderRadius: 8, border: '1px solid #3730a3' }}>
                &larr; Back to App
              </Link>
              <div>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#fff' }}>ProspectAI Admin</h1>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Logged in as {user?.primaryEmailAddress?.emailAddress}</p>
              </div>
            </div>
            <button onClick={fetchUsers} style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
              Refresh
            </button>
          </div>

          {error && (
            <div style={{ background: '#2d1b1b', border: '1px solid #dc2626', borderRadius: 8, padding: '12px 16px', marginBottom: 24, color: '#fca5a5' }}>
              {error}
            </div>
          )}

          {/* Stats */}
          {!loading && !error && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 32 }}>
              {[
                { label: 'Total Users', value: stats.total, color: '#6366f1' },
                { label: 'Onboarded', value: stats.onboarded, color: '#10b981' },
                { label: 'Apollo Connected', value: stats.withApollo, color: '#f59e0b' },
                { label: 'HubSpot Connected', value: stats.withHubspot, color: '#f97316' },
                { label: 'Email Configured', value: stats.withEmail, color: '#06b6d4' },
              ].map(s => (
                <div key={s.label} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: '20px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Search */}
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', background: '#111827', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: 'center', color: '#64748b', padding: 64 }}>Loading users...</div>
          ) : (
            <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e293b' }}>
                    {['User', 'Email', 'Signed Up', 'Last Sign In', 'Onboarded', 'Connected', 'Features', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>No users found</td></tr>
                  )}
                  {filtered.map((u, i) => (<>
                    <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #1e293b' : 'none', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#1a2332'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {u.imageUrl
                            ? <img src={u.imageUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                            : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#64748b' }}>{(u.firstName || u.email || '?')[0].toUpperCase()}</div>
                          }
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>
                            {u.firstName || u.lastName ? (u.firstName + ' ' + u.lastName).trim() : 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }}>{u.email}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{timeAgo(u.createdAt)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{timeAgo(u.lastSignInAt)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: u.onboarded ? '#064e3b' : '#1e293b', color: u.onboarded ? '#34d399' : '#64748b' }}>
                          {u.onboarded ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(u.connectedApps || []).map(app => (
                            <span key={app} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: '#1e3a5f', color: '#60a5fa', textTransform: 'uppercase' }}>{app}</span>
                          ))}
                          {(!u.connectedApps || u.connectedApps.length === 0) && <span style={{ fontSize: 12, color: '#475569' }}>None</span>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={() => { setExpandedUser(expandedUser === u.id ? null : u.id); setPendingFlags(p => ({...p})); }}
                          style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: expandedUser === u.id ? 'rgba(99,102,241,0.2)' : '#1e293b', border: '1px solid ' + (expandedUser === u.id ? '#6366f1' : '#334155'), color: expandedUser === u.id ? '#818cf8' : '#94a3b8' }}>
                          {expandedUser === u.id ? '▲ Hide' : '▼ Features'}
                        </button>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={() => deleteUser(u.id, u.email)}
                          disabled={deleting === u.id}
                          style={{
                            background: confirmDelete === u.id ? '#7f1d1d' : '#1e293b',
                            border: '1px solid ' + (confirmDelete === u.id ? '#dc2626' : '#334155'),
                            color: confirmDelete === u.id ? '#fca5a5' : '#94a3b8',
                            padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500,
                            opacity: deleting === u.id ? 0.5 : 1,
                          }}
                        >
                          {deleting === u.id ? 'Deleting...' : confirmDelete === u.id ? 'Confirm?' : 'Delete'}
                        </button>
                        {confirmDelete === u.id && (
                          <button onClick={() => setConfirmDelete(null)} style={{ marginLeft: 4, background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                        )}
                      </td>
                    </tr>
                    {expandedUser === u.id && (
                      <tr>
                        <td colSpan={7} style={{ background: '#0f172a', padding: '0 16px 16px' }}>
                          <div style={{ borderTop: '1px solid #1e293b', paddingTop: 14 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Feature Access</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {TAB_IDS.map(fid => {
                                const flags = pendingFlags[u.id] || u.featureFlags || {};
                                const enabled = flags[fid] !== false;
                                return (
                                  <button key={fid} onClick={() => toggleFlag(u.id, fid, u.featureFlags)}
                                    style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid', borderColor: enabled ? '#22c55e' : '#475569', background: enabled ? 'rgba(34,197,94,0.12)' : 'rgba(71,85,105,0.12)', color: enabled ? '#86efac' : '#94a3b8' }}>
                                    {TAB_LABELS[fid]}
                                  </button>
                                );
                              })}
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                              <button onClick={() => saveFlags(u.id)} disabled={savingFlags === u.id}
                                style={{ padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#6366f1', border: 'none', color: '#fff', opacity: savingFlags === u.id ? 0.6 : 1 }}>
                                {savingFlags === u.id ? 'Saving...' : 'Save Changes'}
                              </button>
                              <button onClick={() => { setPendingFlags(p => { const n={...p}; delete n[u.id]; return n; }); setExpandedUser(null); }}
                                style={{ padding: '6px 16px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: 'transparent', border: '1px solid #334155', color: '#94a3b8' }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                                    </>))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: 12, color: '#475569', textAlign: 'center' }}>
            {filtered.length} of {total} users shown
          </div>
        </div>
      </div>
    </>
  );
}
