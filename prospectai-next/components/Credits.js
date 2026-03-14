import { useState } from 'react';
import { paiSave, paiLoad } from '../lib/utils';

const PLANS = [
  { id: 'free', label: 'Free', limit: 50 },
  { id: 'basic', label: 'Basic', limit: 1000 },
  { id: 'pro', label: 'Pro', limit: 2000 },
  { id: 'unlimited', label: 'Unlimited', limit: 10000 },
  { id: 'custom', label: 'Custom', limit: null },
];

const DATA_SOURCES = [
  { id: 'apollo', name: 'Apollo.io', icon: '🚀', status: 'connected', desc: 'Contact & company enrichment' },
  { id: 'hunter', name: 'Hunter.io', icon: '🔍', status: 'disconnected', desc: 'Email finding' },
  { id: 'clearbit', name: 'Clearbit', icon: '🔷', status: 'disconnected', desc: 'Person & company data' },
  { id: 'linkedin', name: 'LinkedIn Sales Nav', icon: '💼', status: 'disconnected', desc: 'Premium contact data' },
];

function getMonth() { return new Date().toISOString().slice(0,7); }

export default function Credits() {
  const [store, setStore] = useState(() => paiLoad('creditStore') || { months: {}, planLimit: 1000, plan: 'basic' });
  const [plan, setPlan] = useState(store.plan || 'basic');
  const [customLimit, setCustomLimit] = useState(store.planLimit || 1000);

  const month = getMonth();
  const monthData = store.months[month] || { searches: 0, bulk: 0, company: 0, jobchange: 0, total: 0, activity: [] };
  const planObj = PLANS.find(p => p.id === plan) || PLANS[1];
  const planLimit = plan === 'custom' ? customLimit : (planObj.limit || 1000);
  const used = monthData.total || 0;
  const remaining = Math.max(0, planLimit - used);
  const pct = Math.min(100, Math.round((used / planLimit) * 100));
  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e';

  function resetMonth() {
    setStore(prev => {
      const next = { ...prev, months: { ...prev.months, [month]: { searches: 0, bulk: 0, company: 0, jobchange: 0, total: 0, activity: [] } } };
      paiSave('creditStore', next);
      return next;
    });
  }

  function savePlan() {
    const limit = plan === 'custom' ? customLimit : (planObj.limit || 1000);
    setStore(prev => {
      const next = { ...prev, plan, planLimit: limit };
      paiSave('creditStore', next);
      return next;
    });
  }

  const TYPE_ICONS = { search: '🔍', bulk: '⚡', company: '🏢', jobchange: '🔄' };

  return (
    <div className="fade-up">
      <div className="section-title">📊 Credits & Usage</div>
      <div className="section-sub">Track your API usage across all connected data sources.</div>

      {/* Data Sources */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 12 }}>Connected Data Sources</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {DATA_SOURCES.map(src => (
            <div key={src.id} style={{ background: '#0d1424', border: '1px solid #1a2540', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>{src.icon} {src.name}</div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, ...(src.status === 'connected' ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' } : { background: 'rgba(100,116,139,0.1)', color: '#64748b', border: '1px solid rgba(100,116,139,0.3)' }) }}>
                  {src.status === 'connected' ? '● Connected' : '○ Not Connected'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{src.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Credits Used', value: used, color: '#f1f5f9' },
          { label: 'Remaining', value: remaining, color: '#22c55e' },
          { label: 'Searches', value: monthData.searches || 0, color: '#60a5fa' },
          { label: 'Bulk Runs', value: monthData.bulk || 0, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{ background: '#0d1424', border: '1px solid #1a2540', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Usage Bar */}
      <div style={{ background: '#0d1424', border: '1px solid #1a2540', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Monthly Usage — {new Date().toLocaleString('default',{month:'long',year:'numeric'})}</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>{used.toLocaleString()} / {planLimit.toLocaleString()}</div>
        </div>
        <div style={{ background: '#1a2540', borderRadius: 6, height: 10, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: barColor, width: pct + '%', transition: 'width .4s', borderRadius: 6 }} />
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>{pct}% of monthly limit used</div>
      </div>

      {/* Plan Selector */}
      <div style={{ background: '#0d1424', border: '1px solid #1a2540', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 14 }}>Apollo Plan</div>
        <div className="pill-row" style={{ marginBottom: 12 }}>
          {PLANS.map(p => (
            <button key={p.id} className={`pill ${plan === p.id ? 'active' : ''}`} onClick={() => setPlan(p.id)}>
              {p.label}{p.limit ? ` (${p.limit.toLocaleString()})` : ''}
            </button>
          ))}
        </div>
        {plan === 'custom' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#6b7a99' }}>Custom limit:</label>
            <input type="number" value={customLimit} onChange={e => setCustomLimit(parseInt(e.target.value) || 1000)} style={{ width: 100, padding: '6px 10px', background: '#080c14', border: '1px solid #1a2540', borderRadius: 6, color: '#c8d4e8', fontSize: 13 }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ padding: '8px 20px', borderRadius: 8, background: '#1d4ed8', color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer' }} onClick={savePlan}>Save Plan</button>
          <button style={{ padding: '8px 20px', borderRadius: 8, background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', fontSize: 13, cursor: 'pointer' }} onClick={resetMonth}>↺ Reset Month</button>
        </div>
      </div>

      {/* Activity Log */}
      {monthData.activity?.length > 0 && (
        <div style={{ background: '#0d1424', border: '1px solid #1a2540', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 14 }}>Recent Activity</div>
          {monthData.activity.slice(-10).reverse().map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #111827' }}>
              <span style={{ fontSize: 16 }}>{TYPE_ICONS[a.type] || '📋'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#c8d4e8' }}>{a.label}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{a.date}</div>
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>-{a.count}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
