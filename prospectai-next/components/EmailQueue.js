import { useState, useEffect, useCallback } from 'react';
import { paiLoad } from '../lib/utils';

const STATUS_COLORS = {
    pending:  { bg: '#1e293b', border: '#334155', badge: '#475569', label: 'Pending' },
    approved: { bg: '#052e16', border: '#166534', badge: '#16a34a', label: 'Approved' },
    sent:     { bg: '#0c1a2e', border: '#1e40af', badge: '#3b82f6', label: 'Sent' },
    discarded:{ bg: '#1c0a0a', border: '#7f1d1d', badge: '#ef4444', label: 'Discarded' },
};

function Badge({ status }) {
    const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
    return (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: c.badge + '22', color: c.badge, border: '1px solid ' + c.badge, textTransform: 'uppercase', letterSpacing: '.06em' }}>
{c.label}
</span>
  );
}

function EmailCard({ item, onUpdate, onDiscard, onApprove, onSend, sending }) {
    const [editing, setEditing] = useState(false);
    const [subject, setSubject] = useState(item.subject);
    const [body, setBody] = useState(item.body);
    const [saving, setSaving] = useState(false);
    const isDone = item.status === 'sent' || item.status === 'discarded';

  async function saveEdits() {
        setSaving(true);
        await onUpdate(item.id, { subject, body });
        setSaving(false);
        setEditing(false);
  }
    function cancelEdits() { setSubject(item.subject); setBody(item.body); setEditing(false); }

  const c = STATUS_COLORS[item.status] || STATUS_COLORS.pending;
    return (
          <div style={{ background: c.bg, border: '1px solid ' + c.border, borderRadius: 12, padding: '18px 20px', marginBottom: 16, transition: 'border-color .2s' }}>
{/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9' }}>{item.leadName}</span>
            <Badge status={item.status} />
{item.hsSynced && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#f97316' + '22', color: '#f97316', border: '1px solid #f97316', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                ⬆ HubSpot
                  </span>
            )}
</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{item.leadTitle} · {item.leadCompany}</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>→ {item.leadEmail}</div>
              </div>
        <div style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap', flexShrink: 0 }}>
{new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
</div>
  </div>
{/* Email content */}
{editing ? (
          <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#f1f5f9', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }} />
          <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>Body</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={12} style={{ width: '100%', padding: '8px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#f1f5f9', fontSize: 12, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={saveEdits} disabled={saving} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#0e7490', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
{saving ? 'Saving…' : '💾 Save'}
</button>
            <button onClick={cancelEdits} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
  </div>
  </div>
      ) : (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
            <span style={{ fontWeight: 600, color: '#cbd5e1' }}>Subject: </span>{item.subject}
        </div>
          <div style={{ background: '#0f172a', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>
{item.body}
</div>
  </div>
      )}
{/* Action buttons */}
{!isDone && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
{!editing && (
              <button onClick={() => setEditing(true)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
              ✏️ Edit
                </button>
          )}
{item.status === 'pending' && (
              <button onClick={() => onApprove(item.id)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#14532d', color: '#4ade80', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ✓ Approve
                </button>
          )}
{item.status === 'approved' && (
              <button onClick={() => onSend(item)} disabled={sending === item.id} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: sending === item.id ? '#164e63' : '#0e7490', color: sending === item.id ? '#94a3b8' : '#fff', fontSize: 12, fontWeight: 600, cursor: sending === item.id ? 'wait' : 'pointer' }}>
{sending === item.id ? '📤 Sending…' : '📤 Send Now'}
</button>
          )}
{item.status === 'pending' && (
              <button onClick={() => onApprove(item.id, true)} disabled={sending === item.id} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: sending === item.id ? '#164e63' : '#0e7490', color: sending === item.id ? '#94a3b8' : '#fff', fontSize: 12, fontWeight: 600, cursor: sending === item.id ? 'wait' : 'pointer' }}>
{sending === item.id ? '📤 Sending…' : '📤 Approve & Send'}
</button>
          )}
          <button onClick={() => onDiscard(item.id)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #7f1d1d', background: 'transparent', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>
            🗑 Discard
              </button>
              </div>
      )}
{item.status === 'sent' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: '#3b82f6' }}>✓ Sent {item.sentAt ? new Date(item.sentAt).toLocaleString() : ''}</div>
{item.hsSynced && <div style={{ fontSize: 12, color: '#f97316' }}>⬆ Logged to HubSpot</div>}
{item.hsSyncError && <div style={{ fontSize: 12, color: '#94a3b8' }}>⚠️ HubSpot: {item.hsSyncError}</div>}
  </div>
      )}
{item.status === 'discarded' && (
          <div style={{ fontSize: 12, color: '#ef4444' }}>Discarded</div>
      )}
</div>
  );
}

export default function EmailQueue() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [sending, setSending] = useState(null);
    const [bulkSending, setBulkSending] = useState(false);
    const [toast, setToast] = useState(null);

  const senderEmails = paiLoad('sender_emails') || [];
    const defaultSender = senderEmails.find(s => s.isDefault) || senderEmails[0] || null;

  function showToast(msg, type = 'success') {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
  }

  const loadQueue = useCallback(async () => {
        setLoading(true);
        try {
                const r = await fetch('/api/email-queue');
                const data = await r.json();
                setItems(data.items || []);
        } catch (e) {
                showToast('Failed to load queue', 'error');
        } finally {
                setLoading(false);
        }
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  async function handleUpdate(id, changes) {
        await fetch('/api/email-queue', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...changes }),
        });
        setItems(prev => prev.map(i => i.id === id ? { ...i, ...changes, updatedAt: new Date().toISOString() } : i));
  }

  async function handleApprove(id, andSend = false) {
        await handleUpdate(id, { status: 'approved' });
        if (andSend) {
                const item = items.find(i => i.id === id);
                if (item) await handleSend({ ...item, status: 'approved' });
        }
  }

  async function handleDiscard(id) {
        await fetch('/api/email-queue', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
        });
        setItems(prev => prev.filter(i => i.id !== id));
        showToast('Email discarded');
  }

  async function logToHubspot(item, fromEmail, fromName) {
        try {
                const r = await fetch('/api/hubspot-log-email', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                                      leadEmail: item.leadEmail,
                                      leadName: item.leadName,
                                      leadTitle: item.leadTitle,
                                      leadCompany: item.leadCompany,
                                      subject: item.subject,
                                      body: item.body,
                                      fromEmail: fromEmail || '',
                                      fromName: fromName || '',
                          }),
                });
                const data = await r.json();
                return data;
        } catch (e) {
                return { ok: false, reason: e.message };
        }
  }

  async function handleSend(item) {
        if (!defaultSender) { showToast('Add a sender email in Settings first', 'error'); return; }
        setSending(item.id);
        try {
                const r = await fetch('/api/send-email', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                                      leads: [{ email: item.leadEmail, name: item.leadName, title: item.leadTitle, company_name: item.leadCompany }],
                                      template: { subject: item.subject, body: item.body },
                                      fromEmail: defaultSender.email,
                                      fromName: defaultSender.name || defaultSender.email,
                          }),
                });
                const data = await r.json();
                if (data.results?.[0]?.status === 'sent') {
                          // Mark as sent in queue
                  await handleUpdate(item.id, { status: 'sent', sentAt: new Date().toISOString() });

                  // Push to HubSpot
                  const hsResult = await logToHubspot(item, defaultSender.email, defaultSender.name || defaultSender.email);
                          if (hsResult.ok) {
                                      await handleUpdate(item.id, { hsSynced: true, hsSyncError: null });
                                      showToast('✓ Sent to ' + item.leadName + ' · logged to HubSpot');
                          } else {
                                      await handleUpdate(item.id, { hsSynced: false, hsSyncError: hsResult.reason || 'Sync failed' });
                                      showToast('Sent to ' + item.leadName + ' (HubSpot: ' + (hsResult.reason || 'skipped') + ')', 'error');
                          }
                } else {
                          showToast(data.results?.[0]?.reason || 'Send failed', 'error');
                }
        } catch (e) {
                showToast('Send failed: ' + e.message, 'error');
        } finally {
                setSending(null);
        }
  }

  async function handleSendAllApproved() {
        if (!defaultSender) { showToast('Add a sender email in Settings first', 'error'); return; }
        const approved = items.filter(i => i.status === 'approved');
        if (!approved.length) { showToast('No approved emails to send', 'error'); return; }
        setBulkSending(true);
        let sentCount = 0;
        let hsSyncCount = 0;
        for (const item of approved) {
                setSending(item.id);
                try {
                          const r = await fetch('/api/send-email', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                                    leads: [{ email: item.leadEmail, name: item.leadName, title: item.leadTitle, company_name: item.leadCompany }],
                                                    template: { subject: item.subject, body: item.body },
                                      }),
                          });
                          const data = await r.json();
                          if (data.results?.[0]?.status === 'sent') {
                                      await handleUpdate(item.id, { status: 'sent', sentAt: new Date().toISOString() });
                                      sentCount++;
                                      // Log to HubSpot
                            const hsResult = await logToHubspot(item, defaultSender.email, defaultSender.name || defaultSender.email);
                                      if (hsResult.ok) {
                                                    await handleUpdate(item.id, { hsSynced: true, hsSyncError: null });
                                                    hsSyncCount++;
                                      } else {
                                                    await handleUpdate(item.id, { hsSynced: false, hsSyncError: hsResult.reason || 'Sync failed' });
                                      }
                          }
                } catch (e) { /* continue */ }
        }
        setSending(null);
        setBulkSending(false);
        showToast('Sent ' + sentCount + ' of ' + approved.length + ' emails · ' + hsSyncCount + ' logged to HubSpot');
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);
    const counts = {
          all: items.length,
          pending: items.filter(i => i.status === 'pending').length,
          approved: items.filter(i => i.status === 'approved').length,
          sent: items.filter(i => i.status === 'sent').length,
          discarded: items.filter(i => i.status === 'discarded').length,
    };
    const filterTabs = [
      { key: 'all', label: 'All' },
      { key: 'pending', label: '⏳ Pending' },
      { key: 'approved', label: '✓ Approved' },
      { key: 'sent', label: '📤 Sent' },
      { key: 'discarded', label: '🗑 Discarded' },
        ];

  return (
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px' }}>
{/* Toast */}
{toast && (
          <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', borderRadius: 10, background: toast.type === 'error' ? '#7f1d1d' : '#052e16', border: '1px solid ' + (toast.type === 'error' ? '#ef4444' : '#16a34a'), color: toast.type === 'error' ? '#fca5a5' : '#4ade80', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,.5)' }}>
{toast.msg}
</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>✉️ Email Queue</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Review and approve AI-drafted emails · sent emails are logged to HubSpot automatically</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
{counts.approved > 0 && (
              <button onClick={handleSendAllApproved} disabled={bulkSending} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: bulkSending ? '#164e63' : '#0e7490', color: '#fff', fontSize: 13, fontWeight: 600, cursor: bulkSending ? 'wait' : 'pointer' }}>
{bulkSending ? 'Sending…' : '📤 Send All Approved (' + counts.approved + ')'}
</button>
          )}
          <button onClick={loadQueue} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>
            ↻ Refresh
              </button>
              </div>
              </div>
{/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
{filterTabs.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
            style={{ padding: '5px 12px', borderRadius: 99, border: '1px solid ' + (filter === t.key ? '#0e7490' : '#334155'), background: filter === t.key ? '#0e749022' : 'transparent', color: filter === t.key ? '#38bdf8' : '#64748b', fontSize: 12, fontWeight: filter === t.key ? 700 : 400, cursor: 'pointer' }}>
{t.label} {counts[t.key] > 0 ? <span style={{ fontSize: 11, opacity: .7 }}>({counts[t.key]})</span> : ''}
  </button>
        ))}
          </div>
{loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569', fontSize: 14 }}>Loading queue…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✉️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
{filter === 'all' ? 'Queue is empty' : 'No ' + filter + ' emails'}
  </div>
            <div style={{ fontSize: 13, color: '#475569' }}>
{filter === 'all' ? 'Use "Add to Email Queue" on any lead card to populate this queue.' : 'Switch filters to see other emails.'}
  </div>
  </div>
        ) : (
          filtered.map(item => (
                      <EmailCard key={item.id} item={item} onUpdate={handleUpdate} onDiscard={handleDiscard} onApprove={handleApprove} onSend={handleSend} sending={sending} />
          ))
        )}
  </div>
  );
}
