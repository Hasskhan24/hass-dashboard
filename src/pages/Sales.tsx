import { useState, useEffect } from 'react'

interface CloserStats {
  name: string
  callsBookedToday: number; callsTakenToday: number; dealsToday: number; cashToday: number
  callsBookedYesterday: number; callsTakenYesterday: number; dealsYesterday: number; cashYesterday: number
  callsBookedMTD: number; callsTakenMTD: number; noShowsMTD: number
  offersMTD: number; dealsMTD: number; cashMTD: number; revMTD: number
  showRate: number; closeRate: number
}

interface Deal {
  name: string; cash: number; revenue: number; closer: string
  date: string; service: string; type: string
}

interface PipelineStage {
  stage: string; count: number
}

interface HotProspect {
  name: string; stage: string; value: number; updatedAt: string
}

interface SalesData {
  today: { booked: number; taken: number; deals: number; cash: number }
  yesterday: { booked: number; taken: number; deals: number; cash: number }
  mtd: {
    booked: number; taken: number; noShows: number; offers: number
    deals: number; cash: number; rev: number
    showRate: number; closeRate: number; dollarPerCall: number
  }
  closerStats: CloserStats[]
  recentDeals: Deal[]
  pipelineStages: PipelineStage[]
  hotProspects: HotProspect[]
  totalOpportunities: number
  lastUpdated: string
}

const CLOSER_COLORS: Record<string, string> = {
  Akash: '#8b5cf6', Lily: '#ec4899', Eric: '#3b82f6', Hass: '#f59e0b',
}

const STAGE_COLORS: Record<string, string> = {
  'Opt In': '#6366f1',
  'Lead Magnet Opt In': '#6366f1',
  'OBO Opt In': '#6366f1',
  'Follow Up': '#f59e0b',
  'Application Submitted': '#8b5cf6',
  'Call Booked': '#10b981',
  'Need Rescheduled': '#ef4444',
  'Closer Follow Up': '#f59e0b',
  'No Show': '#ef4444',
  'Deal Closed': '#10b981',
  '30 Days to Close': '#3b82f6',
  '60 Days to Close': '#3b82f6',
  'Long Term Nurture': '#6b7280',
  'No Contact/Interest': '#6b7280',
}

function MetricCard({ value, label, sub, highlight, warn, accent }: any) {
  return (
    <div style={{
      background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '20px 22px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: warn ? '#ef4444' : highlight ? '#10b981' : accent || '#e8e8e8', marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function SectionLabel({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>
      {label}
    </div>
  )
}

export default function Sales() {
  const [data, setData] = useState<SalesData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/sales')
      .then(r => r.json())
      .then(d => {
        if (!d.error) setData(d)
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const refresh = () => {
    setLoading(true)
    fetch('/api/sales')
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const fmt = (n: number) => {
    if (!n && n !== 0) return '$0'
    return '$' + n.toLocaleString()
  }
  const fmtNum = (n: number) => (n || 0).toLocaleString()
  const pct = (n: number) => `${n.toFixed(1)}%`

  if (loading && !data) return (
    <div style={{ padding: '32px 40px', color: '#444', fontSize: 14 }}>Loading sales data...</div>
  )

  if (!data) return (
    <div style={{ padding: '32px 40px', color: '#444', fontSize: 14 }}>No sales data. Run a scan first.</div>
  )

  return (
    <div style={{ padding: '32px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e8e8e8', marginBottom: 4 }}>Sales</h1>
          <p style={{ fontSize: 13, color: '#555' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {data.lastUpdated}
          </p>
        </div>
        <button onClick={refresh} disabled={loading} style={{
          padding: '8px 16px', background: '#1a1a1a', border: '1px solid #2a2a2a',
          borderRadius: 8, color: '#888', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          {loading ? '...' : '↻ Refresh'}
        </button>
      </div>

      {/* TODAY + YESTERDAY */}
      <div style={{ marginBottom: 36 }}>
        <SectionLabel label="Today & Yesterday" color="#10b981" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
          <MetricCard value={fmtNum(data.today.booked)} label="Calls Booked Today" sub={`${data.today.taken} taken`} accent="#10b981" />
          <MetricCard value={fmtNum(data.yesterday.booked)} label="Booked Yesterday" sub={`${data.yesterday.taken} taken · ${data.yesterday.deals} closed`} />
          <MetricCard value={fmtNum(data.today.deals)} label="Deals Closed Today" sub={fmt(data.today.cash) + ' collected'} highlight={data.today.deals > 0} />
          <MetricCard value={fmt(data.yesterday.cash)} label="Cash Yesterday" sub={`${data.yesterday.deals} deals`} />
        </div>
      </div>

      {/* MTD PERFORMANCE */}
      <div style={{ marginBottom: 36 }}>
        <SectionLabel label="Month to Date" color="#f59e0b" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
          <MetricCard value={fmtNum(data.mtd.booked)} label="Calls Booked" sub={`${data.mtd.taken} taken · ${data.mtd.noShows} no-shows`} />
          <MetricCard value={pct(data.mtd.showRate)} label="Show Rate" sub="Taken / Booked" highlight={data.mtd.showRate >= 50} warn={data.mtd.showRate < 40} />
          <MetricCard value={fmtNum(data.mtd.deals)} label="Deals Closed" sub={`${data.mtd.offers} offers made`} highlight />
          <MetricCard value={pct(data.mtd.closeRate)} label="Close Rate" sub="Closed / Taken" highlight={data.mtd.closeRate >= 30} warn={data.mtd.closeRate < 20} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <MetricCard value={fmt(data.mtd.cash)} label="Cash Collected MTD" highlight />
          <MetricCard value={fmt(data.mtd.rev)} label="Revenue Generated MTD" />
          <MetricCard value={fmt(data.mtd.dollarPerCall)} label="$ Per Booked Call" sub="Cash / Calls Booked" />
        </div>
      </div>

      {/* CLOSER LEADERBOARD */}
      <div style={{ marginBottom: 36 }}>
        <SectionLabel label="Closer Leaderboard (MTD)" color="#6366f1" />
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr',
            gap: 12, padding: '12px 20px', borderBottom: '1px solid #1a1a1a',
            fontSize: 10, fontWeight: 700, color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            <div>Closer</div>
            <div style={{ textAlign: 'right' }}>Booked</div>
            <div style={{ textAlign: 'right' }}>Taken</div>
            <div style={{ textAlign: 'right' }}>Show %</div>
            <div style={{ textAlign: 'right' }}>Deals</div>
            <div style={{ textAlign: 'right' }}>Close %</div>
            <div style={{ textAlign: 'right' }}>Yesterday</div>
            <div style={{ textAlign: 'right' }}>Cash</div>
          </div>
          {data.closerStats.map((c, i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr',
              gap: 12, padding: '14px 20px', alignItems: 'center',
              borderBottom: i < data.closerStats.length - 1 ? '1px solid #141414' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: CLOSER_COLORS[c.name] || '#888' }} />
                <span style={{ fontSize: 14, color: '#e8e8e8', fontWeight: 500 }}>{c.name}</span>
              </div>
              <div style={{ fontSize: 13, color: '#ccc', textAlign: 'right' }}>{c.callsBookedMTD}</div>
              <div style={{ fontSize: 13, color: '#ccc', textAlign: 'right' }}>{c.callsTakenMTD}</div>
              <div style={{ fontSize: 13, color: c.showRate >= 50 ? '#10b981' : c.showRate < 40 ? '#ef4444' : '#ccc', textAlign: 'right' }}>
                {c.showRate > 0 ? pct(c.showRate) : '—'}
              </div>
              <div style={{ fontSize: 13, color: c.dealsMTD > 0 ? '#10b981' : '#555', textAlign: 'right', fontWeight: 600 }}>{c.dealsMTD}</div>
              <div style={{ fontSize: 13, color: c.closeRate >= 30 ? '#10b981' : c.closeRate < 20 ? '#ef4444' : '#ccc', textAlign: 'right' }}>
                {c.closeRate > 0 ? pct(c.closeRate) : '—'}
              </div>
              <div style={{ fontSize: 13, color: '#888', textAlign: 'right' }}>
                {c.callsBookedYesterday > 0 ? `${c.callsBookedYesterday} calls` : '—'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.cashMTD > 0 ? '#10b981' : '#555', textAlign: 'right' }}>
                {fmt(c.cashMTD)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RECENT DEALS */}
      {data.recentDeals.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <SectionLabel label="Recent Deals (from NEW Cash)" color="#10b981" />
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
            {data.recentDeals.map((deal, i) => (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                gap: 12, padding: '12px 20px', alignItems: 'center',
                borderBottom: i < data.recentDeals.length - 1 ? '1px solid #141414' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: 13, color: '#e8e8e8', fontWeight: 500 }}>{deal.name}</div>
                  {deal.service && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{deal.service}{deal.type ? ` · ${deal.type}` : ''}</div>}
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>{deal.date}</div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {deal.closer ? <span style={{ color: CLOSER_COLORS[deal.closer] || '#888' }}>{deal.closer}</span> : '—'}
                </div>
                <div style={{ fontSize: 13, color: '#ccc', textAlign: 'right' }}>{fmt(deal.revenue)} rev</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', textAlign: 'right' }}>{fmt(deal.cash)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PIPELINE + HOT PROSPECTS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20, marginBottom: 36 }}>
        {/* Pipeline stages */}
        <div>
          <SectionLabel label={`GHL Pipeline (${data.totalOpportunities} opps)`} color="#8b5cf6" />
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
            {data.pipelineStages.map((s, i) => {
              const maxCount = Math.max(...data.pipelineStages.map(x => x.count))
              const pct = (s.count / maxCount) * 100
              const color = STAGE_COLORS[s.stage] || '#888'
              return (
                <div key={i} style={{
                  padding: '12px 20px',
                  borderBottom: i < data.pipelineStages.length - 1 ? '1px solid #141414' : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 2, background: color }} />
                      <span style={{ fontSize: 13, color: '#ccc' }}>{s.stage}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8' }}>{s.count}</span>
                  </div>
                  <div style={{ height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: 3, width: `${pct}%`, background: color, borderRadius: 2 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Hot Prospects */}
        <div>
          <SectionLabel label={`Hot Prospects (Need Action)`} color="#ef4444" />
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden', maxHeight: 500, overflowY: 'auto' }}>
            {data.hotProspects.length === 0 ? (
              <div style={{ padding: '30px 20px', textAlign: 'center', color: '#555', fontSize: 13 }}>
                No hot prospects needing action.
              </div>
            ) : (
              data.hotProspects.map((p, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 20px',
                  borderBottom: i < data.hotProspects.length - 1 ? '1px solid #141414' : 'none',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#e8e8e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>
                      {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : ''}
                    </div>
                  </div>
                  {p.value > 0 && (
                    <span style={{ fontSize: 12, color: '#888', marginRight: 12 }}>{fmt(p.value)}</span>
                  )}
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20, flexShrink: 0,
                    background: `${STAGE_COLORS[p.stage] || '#888'}22`,
                    color: STAGE_COLORS[p.stage] || '#888',
                  }}>
                    {p.stage}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
