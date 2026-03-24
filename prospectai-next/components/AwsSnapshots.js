import { useState, useEffect } from 'react';

export default function AwsSnapshots({ onLoadSnapshot }) {
      const [snapshots, setSnapshots] = useState([]);
      const [loading, setLoading] = useState(true);
      const [deleting, setDeleting] = useState(null);
      const [message, setMessage] = useState(null);

    const fetchSnapshots = async () => {
              setLoading(true);
              try {
                            const res = await fetch('/api/kv?action=list');
                            const data = await res.json();
                            setSnapshots(data.snapshots || []);
              } catch (err) {
                            setMessage({ type: 'error', text: 'Failed to load snapshots.' });
              } finally {
                            setLoading(false);
              }
    };

    useEffect(() => { fetchSnapshots(); }, []);

    const handleDelete = async (key, name) => {
              if (!confirm(`Delete snapshot "${name}"?`)) return;
              setDeleting(key);
              try {
                            const res = await fetch(`/api/kv?action=delete&key=${encodeURIComponent(key)}`);
                            const data = await res.json();
                            if (data.success) {
                                              setMessage({ type: 'success', text: `Deleted "${name}"` });
                                              setSnapshots(prev => prev.filter(s => s.key !== key));
                            } else {
                                              setMessage({ type: 'error', text: 'Delete failed.' });
                            }
              } catch {
                            setMessage({ type: 'error', text: 'Delete failed.' });
              } finally {
                            setDeleting(null);
                            setTimeout(() => setMessage(null), 3000);
              }
    };

    const handleLoad = async (key, name) => {
              try {
                            const res = await fetch(`/api/kv?action=load&key=${encodeURIComponent(key)}`);
                            const data = await res.json();
                            if (data.opps && onLoadSnapshot) {
                                              onLoadSnapshot(data);
                                              setMessage({ type: 'success', text: `Loaded "${name}"` });
                                              setTimeout(() => setMessage(null), 3000);
                            }
              } catch {
                            setMessage({ type: 'error', text: 'Failed to load snapshot.' });
              }
    };

    const formatDate = (iso) => {
              const d = new Date(iso);
              return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
              <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>💾 Saved Snapshots</h2>
                <button
                    onClick={fetchSnapshots}
                    style={{ background: 'transparent', border: '1px solid #444', color: '#ccc', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px' }}
                >
                    ↻ Refresh
                      </button>
                      </div>

{message && (
                  <div style={{
                                  padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px',
                      background: message.type === 'success' ? '#1a3a2a' : '#3a1a1a',
                      color: message.type === 'success' ? '#4ade80' : '#f87171',
                      border: `1px solid ${message.type === 'success' ? '#166534' : '#7f1d1d'}`
}}>
{message.text}
</div>
            )}

{loading ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>Loading snapshots...</div>
              ) : snapshots.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: '#666', border: '1px dashed #333', borderRadius: '12px' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                      <div style={{ fontSize: '16px' }}>No snapshots saved yet.</div>
                      <div style={{ fontSize: '13px', marginTop: '6px', color: '#555' }}>Go to AWS Opportunities and click "Save Snapshot".</div>
  </div>
             ) : (
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               {snapshots.map((snap) => (
                                       <div key={snap.key} style={{
                                           background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: '12px',
                                           padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px'
             }}>
                                                          <div style={{ flex: 1, minWidth: 0 }}>
                                                                                                      <div style={{ fontWeight: 600, fontSize: '15px', color: '#e2e8f0', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
{snap.name || 'Untitled Snapshot'}
</div>
                                <div style={{ fontSize: '12px', color: '#888' }}>
{formatDate(snap.savedAt)} &nbsp;·&nbsp; {snap.count} {snap.count === 1 ? 'opportunity' : 'opportunities'}
</div>
  </div>
                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                <button
                                    onClick={() => handleLoad(snap.key, snap.name)}
                                    style={{ background: '#1e40af', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                                >
                                    Load
                                      </button>
                                <button
                                    onClick={() => handleDelete(snap.key, snap.name)}
                                    disabled={deleting === snap.key}
                                                                          style={{ background: 'transparent', color: '#f87171', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', fontSize: '13px', opacity: deleting === snap.key ? 0.5 : 1 }}
                                >
{deleting === snap.key ? '...' : 'Delete'}
</button>
  </div>
  </div>
                    ))}
                      </div>
            )}
</div>
    );
}
