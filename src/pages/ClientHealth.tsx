import { useState, useEffect } from 'react'

interface Client {
  name: string; status: 'healthy' | 'at_risk' | 'critical'; mrr: number
  lastContact: string; notes: string; plan: string
}

interface HealthData {
  total: number; healthy: number; atRisk: number; critical: number; clients: Client[]
  lastUpdated: string
}

const statusColors: Record<string, string> = {
  healthy: '#10b981', at_risk: '#f59e0b', critical: '#ef4444',
}

const statusLabels: Record<string, string> = {
  healthy: 'Healthy', at_risk: 'At Risk', critical: 'Critical',
}

export default function ClientHealth() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'healthy' | 'at_risk' | 'critical'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch('/api/health')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const filtered = data?.clients?.filter(c => {
    const matchFilter = filter === 'all' || c.status === filter
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  }) || []

  const fmt = (n: number) => `$${n?.toLocaleString() || 0}`

  return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e8e8e8', marginBottom: 4 }}>Client Health</h1>
        <p style={{ fontSize: 13, color: '#555' }}>Retention & At-Risk Tracker</p>
      </div>

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: 60, color: '#444', fontSize: 14 }}>Loading client data...</div>
      )}

      {data && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total Clients', value: data.total, color: '#e8e8e8' },
              { label: 'Healthy', value: data.healthy, color: '#10b981' },
              { label: 'At Risk', value: data.atRisk, color: '#f59e0b' },
              { label: 'Critical', value: data.critical, color: '#ef4444' },
            ].map((s, i) => (
              <div key={i} style={{
                background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '18px',
              }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filters + Search */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', 'critical', 'at_risk', 'healthy'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '6px 12px',
                    background: filter === f ? (f === 'all' ? '#7c3aed' : `${statusColors[f]}33`) : 'transparent',
                    border: `1px solid ${filter === f ? (f === 'all' ? '#7c3aed' : statusColors[f]) : '#2a2a2a'}`,
                    borderRadius: 8,
                    color: filter === f ? (f === 'all' ? '#fff' : statusColors[f]) : '#666',
                    fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    textTransform: 'capitalize',
                  }}
                >{f === 'at_risk' ? 'At Risk' : f.charAt(0).toUpperCase() + f.slice(1)}</button>
              ))}
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clients..."
              style={{
                marginLeft: 'auto', background: '#111', border: '1px solid #2a2a2a',
                borderRadius: 8, padding: '6px 12px', color: '#e8e8e8', fontSize: 12,
                outline: 'none', fontFamily: 'inherit', width: 200,
              }}
            />
          </div>

          {/* Client List */}
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#444', fontSize: 13 }}>
                No clients match your filter.
              </div>
            ) : (
              filtered.map((client, i) => (
                <div key={i} style={{
                  padding: '14px 20px',
                  borderBottom: i < filtered.length - 1 ? '1px solid #141414' : 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8e8' }}>{client.name}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                        background: `${statusColors[client.status]}22`,
                        color: statusColors[client.status],
                      }}>{statusLabels[client.status]}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#555' }}>
                      {client.plan} · Last contact: {client.lastContact}
                    </div>
                    {client.notes && (
                      <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>{client.notes}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', flexShrink: 0, marginLeft: 20 }}>
                    {fmt(client.mrr)}/mo
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {!loading && !data && (
        <div style={{ textAlign: 'center', padding: 60, color: '#444', fontSize: 14 }}>
          No client health data yet. Run a daily scan.
        </div>
      )}
    </div>
  )
}
