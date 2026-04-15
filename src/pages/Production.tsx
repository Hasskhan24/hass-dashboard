import { useState, useEffect } from 'react'

interface Ticket {
  id: string; client: string; type: string; dueDate: string; status: 'overdue' | 'pending' | 'done'; daysOld: number
}

interface ProductionData {
  overdueTickets: number; pendingTickets: number; doneThisWeek: number; tickets: Ticket[]
  lastUpdated: string
}

const statusColors: Record<string, string> = {
  overdue: '#ef4444', pending: '#f59e0b', done: '#10b981',
}

export default function Production() {
  const [data, setData] = useState<ProductionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'overdue' | 'pending'>('all')

  useEffect(() => {
    setLoading(true)
    fetch('/api/production')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const filtered = data?.tickets?.filter(t => filter === 'all' || t.status === filter) || []

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e8e8e8', marginBottom: 4 }}>Production</h1>
        <p style={{ fontSize: 13, color: '#555' }}>Shoots & Upload Tickets</p>
      </div>

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: 60, color: '#444', fontSize: 14 }}>Loading production data...</div>
      )}

      {data && (
        <>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Overdue Tickets', value: data.overdueTickets, color: '#ef4444', bg: '#ef444411' },
              { label: 'Pending Tickets', value: data.pendingTickets, color: '#f59e0b', bg: '#f59e0b11' },
              { label: 'Done This Week', value: data.doneThisWeek, color: '#10b981', bg: '#10b98111' },
            ].map((s, i) => (
              <div key={i} style={{
                background: s.bg, border: `1px solid ${s.color}22`, borderRadius: 12, padding: '20px',
              }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: s.color, opacity: 0.8, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            {(['all', 'overdue', 'pending'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '6px 14px',
                  background: filter === f ? '#7c3aed' : 'transparent',
                  border: `1px solid ${filter === f ? '#7c3aed' : '#2a2a2a'}`,
                  borderRadius: 8, color: filter === f ? '#fff' : '#666',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  textTransform: 'capitalize',
                }}
              >{f}</button>
            ))}
          </div>

          {/* Tickets */}
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#444', fontSize: 13 }}>
                No {filter === 'all' ? '' : filter} tickets found.
              </div>
            ) : (
              filtered.map((ticket, i) => (
                <div key={ticket.id} style={{
                  padding: '14px 20px',
                  borderBottom: i < filtered.length - 1 ? '1px solid #141414' : 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8e8' }}>{ticket.client}</div>
                    <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                      {ticket.type} · Due {ticket.dueDate}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {ticket.status === 'overdue' && (
                      <span style={{ fontSize: 11, color: '#ef4444' }}>{ticket.daysOld}d overdue</span>
                    )}
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                      background: `${statusColors[ticket.status]}22`,
                      color: statusColors[ticket.status],
                      textTransform: 'capitalize',
                    }}>{ticket.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {!loading && !data && (
        <div style={{ textAlign: 'center', padding: 60, color: '#444', fontSize: 14 }}>
          No production data yet. Run a daily scan.
        </div>
      )}
    </div>
  )
}
