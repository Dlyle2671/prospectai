import { useState, useEffect } from 'react';

export default function AwsSnapshots() {
          const [total, setTotal] = useState(null);
          const [loading, setLoading] = useState(true);
          const [clearing, setClearing] = useState(false);
          const [message, setMessage] = useState(null);

  const fetchTotal = async () => {
              setLoading(true);
              try {
                            const res = await fetch('/api/kv?action=getall');
                            const data = await res.json();
                            setTotal(data.total ?? 0);
              } catch {
                            setMessage({ type: 'error', text: 'Failed to load total.' });
              } finally {
                            setLoading(false);
              }
  };

  useEffect(() => { fetchTotal(); }, []);

  const handleClear = async () => {
              if (!confirm('Clear all opportunities from the running total? This cannot be undone.')) return;
              setClearing(true);
              try {
                            const res = await fetch('/api/kv?action=clear');
                            const data = await res.json();
                            if (data.success) {
                                            setTotal(0);
                                            setMessage({ type: 'success', text: 'Running total cleared.' });
                                            setTimeout(() => setMessage(null), 3000);
                            }
              } catch {
                            setMessage({ type: 'error', text: 'Failed to clear.' });
              } finally {
                            setClearing(false);
              }
  };

  return (
              <div style={{ padding: '32px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Running Total</h2>
        <button
          onClick={fetchTotal}
          style={{ background: 'transparent', border: '1px solid #444', color: '#ccc', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px' }}
        >
          Refresh
                  </button>
                  </div>

{message && (
                <div style={{
                  padding: '10px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '14px',
                  background: message.type === 'success' ? '#1a3a2a' : '#3a1a1a',
                  color: message.type === 'success' ? '#4ade80' : '#f87171',
                  border: '1px solid ' + (message.type === 'success' ? '#166534' : '#7f1d1d')
}}>
{message.text}
</div>
      )}

      <div style={{
                      background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: '16px',
                      padding: '40px', textAlign: 'center', marginBottom: '24px'
      }}>
{loading ? (
                  <div style={{ color: '#888', fontSize: '16px' }}>Loading...</div>
                ) : (
                  <div>
                    <div style={{ fontSize: '72px', fontWeight: 800, color: '#e2e8f0', lineHeight: 1, marginBottom: '12px' }}>
{total !== null ? total.toLocaleString() : 0}
</div>
            <div style={{ fontSize: '16px', color: '#888', letterSpacing: '.04em' }}>
              total opportunities uploaded
                      </div>
                      </div>
        )}
</div>

      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', padding: '20px' }}>
        <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px', lineHeight: 1.6 }}>
          Upload opportunities in AWS Opportunities, then click + Add to Running Total to merge them here. New uploads are deduplicated by Opportunity ID.
                  </div>
        <button
          onClick={handleClear}
          disabled={clearing || loading || total === 0}
          style={{
                              background: 'transparent', color: '#f87171', border: '1px solid #7f1d1d',
                              borderRadius: '8px', padding: '8px 16px',
                              cursor: (clearing || loading || total === 0) ? 'not-allowed' : 'pointer',
                              fontSize: '13px', opacity: (clearing || loading || total === 0) ? 0.4 : 1
          }}
        >
{clearing ? 'Clearing...' : 'Clear All'}
</button>
        </div>
        </div>
  );
}
