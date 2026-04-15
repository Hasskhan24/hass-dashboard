import { useState, useEffect } from 'react'

interface FinanceData {
  mrr: { expected: number; collected: number; remaining: number; clients: number }
  upsell: { collected: number; target: number }
  newCash: { collected: number; revenue: number; deals: number; forecastedTotal: number; totalCollected: number }
  sales: {
    callsBooked: number; callsTaken: number; noShows: number; showRate: number
    offersMade: number; dealsClosed: number; closeRate: number
    cashCollected: number; revGenerated: number; dollarPerBookedCall: number
  }
  byCloser: { name: string; deals: number; amount: number }[]
  pl: { projectedRevenue: number; fixedCosts: number; adSpend: number; projectedNet: number }
  lastUpdated: string
}

function MetricCard({ value, label, sub, highlight, warn }: any) {
  return (
    <div style={{
      background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '20px 22px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: warn ? '#ef4444' : highlight ? '#10b981' : '#e8e8e8', marginBottom: 4 }}>{value}</div>
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

export default function Finance() {
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/finance')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const refresh = () => {
    setLoading(true)
    fetch('/api/finance/refresh', { method: 'POST' })
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const fmt = (n: number) => {
    if (!n && n !== 0) return '$0'
    return '$' + n.toLocaleString()
  }

  const pct = (n: number) => `${n.toFixed(1)}%`

  if (loading) return (
    <div style={{ padding: '32px 40px', color: '#444', fontSize: 14 }}>Loading financial data...</div>
  )

  if (!data) return (
    <div style={{ padding: '32px 40px', color: '#444', fontSize: 14 }}>No data. Run a scan first.</div>
  )

  const mrrPct = Math.round((data.mrr.collected / data.mrr.expected) * 100)
  const upsellPct = Math.round((data.upsell.collected / data.upsell.target) * 100)

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e8e8e8', marginBottom: 4 }}>Finance</h1>
          <p style={{ fontSize: 13, color: '#555' }}>
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} · {data.lastUpdated}
          </p>
        </div>
        <button onClick={refresh} disabled={loading} style={{
          padding: '8px 16px', background: '#1a1a1a', border: '1px solid #2a2a2a',
          borderRadius: 8, color: '#888', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          ↻ Refresh
        </button>
      </div>

      {/* MRR */}
      <div style={{ marginBottom: 36 }}>
        <SectionLabel label="Monthly Recurring Revenue" color="#7c3aed" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
          <MetricCard value={fmt(data.mrr.expected)} label="MRR Expected" sub={`${data.mrr.clients} records`} />
          <MetricCard value={fmt(data.mrr.collected)} label="MRR Collected" sub={`${mrrPct}% of expected`} highlight />
          <MetricCard value={fmt(data.mrr.remaining)} label="MRR Remaining" sub={`${100 - mrrPct}% outstanding`} warn={mrrPct < 40} />
          <MetricCard value={fmt(data.upsell.collected)} label="Upsell Cash" sub={`Target: ${fmt(data.upsell.target)}`} warn={upsellPct < 50} />
        </div>
        {/* MRR Progress bar */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#555' }}>MRR Collection Progress</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#e8e8e8' }}>{fmt(data.mrr.collected)} / {fmt(data.mrr.expected)}</span>
          </div>
          <div style={{ background: '#1a1a1a', borderRadius: 4, height: 6 }}>
            <div style={{
              height: 6, width: `${Math.min(mrrPct, 100)}%`,
              background: 'linear-gradient(90deg, #7c3aed, #10b981)',
              borderRadius: 4, transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ fontSize: 11, color: '#444', marginTop: 6 }}>{mrrPct}% collected</div>
        </div>
      </div>

      {/* New Cash */}
      <div style={{ marginBottom: 36 }}>
        <SectionLabel label="New Cash" color="#10b981" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <MetricCard value={fmt(data.newCash.collected)} label="New Cash" sub="MTD collected" highlight />
          <MetricCard value={fmt(data.newCash.forecastedTotal)} label="Forecasted Cash" sub="MRR Expected + New Cash" />
          <MetricCard value={fmt(data.newCash.totalCollected)} label="Total Collected Cash" sub="New Cash + MRR Collected" highlight />
        </div>
      </div>

      {/* Sales Performance */}
      <div style={{ marginBottom: 36 }}>
        <SectionLabel label="Sales Performance" color="#f59e0b" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
          <MetricCard value={data.sales.callsBooked} label="Calls Booked" sub="New calls on calendar" />
          <MetricCard value={data.sales.callsTaken} label="Calls Taken" sub="Total showed" />
          <MetricCard value={data.sales.noShows} label="No Shows" sub="Total no-showed" warn />
          <MetricCard value={pct(data.sales.showRate)} label="Show Rate" sub="Shows / Calls Booked" highlight={data.sales.showRate >= 50} warn={data.sales.showRate < 40} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <MetricCard value={data.sales.offersMade} label="Offers Made" />
          <MetricCard value={data.sales.dealsClosed} label="Deals Closed" highlight />
          <MetricCard value={pct(data.sales.closeRate)} label="Close Rate" sub="Closed / Calls Taken" highlight={data.sales.closeRate >= 30} warn={data.sales.closeRate < 20} />
          <MetricCard value={fmt(data.sales.dollarPerBookedCall)} label="$ Per Booked Call" sub="Rev / Calls Booked" />
        </div>
      </div>

      {/* By Closer */}
      {data.byCloser?.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <SectionLabel label="By Closer" color="#6366f1" />
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
            {data.byCloser.map((c, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 20px',
                borderBottom: i < data.byCloser.length - 1 ? '1px solid #141414' : 'none',
              }}>
                <div style={{ fontSize: 14, color: '#e8e8e8', fontWeight: 500 }}>{c.name}</div>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#555' }}>{c.deals} deal{c.deals !== 1 ? 's' : ''}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#10b981' }}>{fmt(c.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* P&L */}
      <div>
        <SectionLabel label="April Projected P&L" color="#ef4444" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <MetricCard value={fmt(data.pl.projectedRevenue)} label="Projected Revenue" sub="MRR + New Cash" />
          <MetricCard value={fmt(data.pl.fixedCosts)} label="Fixed Costs" sub="Payroll + Ops" />
          <MetricCard value={fmt(data.pl.adSpend)} label="Ad Spend" sub="~$1,800/day" />
          <MetricCard
            value={fmt(data.pl.projectedNet)}
            label="Projected Net"
            sub="Revenue − All Costs"
            highlight={data.pl.projectedNet > 0}
            warn={data.pl.projectedNet < 0}
          />
        </div>
      </div>

    </div>
  )
}
