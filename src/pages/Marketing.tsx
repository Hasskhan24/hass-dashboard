import { useState, useEffect } from 'react'

interface MarketingData {
  period: string
  leads: {
    total: number
    facebook: number
    organic: number
    unknown: number
    bySource: Record<string, number>
  }
  topCampaigns: { name: string; leads: number }[]
  sales: {
    count: number
    revenue: number
    deals: { name: string; amount: number; date: string }[]
  }
  spend: {
    estimated: number
    dailyRate: number
    daysSoFar: number
    source?: string
  }
  metrics: {
    cpl: number
    roas: number
    conversionRate: number
  }
  lastUpdated: string
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

const SOURCE_COLORS: Record<string, string> = {
  facebook: '#1877f2',
  google: '#ea4335',
  instagram: '#e1306c',
  organic: '#10b981',
  automatic: '#8b5cf6',
  unknown: '#555',
  email: '#f59e0b',
}

export default function Marketing() {
  const [data, setData] = useState<MarketingData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/marketing')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const refresh = () => {
    setLoading(true)
    fetch('/api/marketing?refresh=true')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const fmt = (n: number) => {
    if (!n && n !== 0) return '$0'
    return '$' + n.toLocaleString()
  }

  const fmtNum = (n: number) => (n || 0).toLocaleString()

  if (loading && !data) return (
    <div style={{ padding: '32px 40px', color: '#444', fontSize: 14 }}>Loading marketing data from Hyros...</div>
  )

  if (!data) return (
    <div style={{ padding: '32px 40px', color: '#444', fontSize: 14 }}>No marketing data.</div>
  )

  const totalLeads = data.leads.total
  const fbPct = totalLeads > 0 ? ((data.leads.facebook / totalLeads) * 100).toFixed(0) : '0'

  return (
    <div style={{ padding: '32px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e8e8e8', marginBottom: 4 }}>Marketing</h1>
          <p style={{ fontSize: 13, color: '#555' }}>
            {data.period} · Live from Hyros · {data.lastUpdated}
          </p>
        </div>
        <button onClick={refresh} disabled={loading} style={{
          padding: '8px 16px', background: '#1a1a1a', border: '1px solid #2a2a2a',
          borderRadius: 8, color: '#888', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          ↻ Refresh
        </button>
      </div>

      {/* Top KPIs */}
      <div style={{ marginBottom: 36 }}>
        <SectionLabel label="Performance Overview" color="#7c3aed" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <MetricCard
            value={fmt(data.spend.estimated)}
            label="Ad Spend (MTD)"
            sub={`~$${fmtNum(data.spend.dailyRate)}/day · ${data.spend.daysSoFar} days`}
          />
          <MetricCard
            value={fmtNum(totalLeads)}
            label="Total Leads"
            sub={`${data.leads.facebook} FB · ${data.leads.organic} organic`}
            accent="#3b82f6"
          />
          <MetricCard
            value={fmt(data.metrics.cpl)}
            label="Cost Per Lead"
            sub={`Spend / FB Leads`}
            warn={data.metrics.cpl > 100}
            highlight={data.metrics.cpl > 0 && data.metrics.cpl < 50}
          />
          <MetricCard
            value={`${data.metrics.roas.toFixed(2)}x`}
            label="ROAS"
            sub="Revenue / Spend"
            highlight={data.metrics.roas >= 2}
            warn={data.metrics.roas < 1}
          />
        </div>
      </div>

      {/* Sales from Ads */}
      <div style={{ marginBottom: 36 }}>
        <SectionLabel label="Sales from Ads (Hyros Attribution)" color="#10b981" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          <MetricCard
            value={fmtNum(data.sales.count)}
            label="Tracked Sales"
            sub="Deals tied to Hyros attribution"
          />
          <MetricCard
            value={fmt(data.sales.revenue)}
            label="Attributed Revenue"
            sub="From tracked sales"
            highlight
          />
          <MetricCard
            value={`${data.metrics.conversionRate}%`}
            label="Lead → Sale Rate"
            sub="Sales / Total Leads"
          />
        </div>

        {data.sales.deals.length > 0 && (
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #1a1a1a', fontSize: 11, fontWeight: 700, color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Recent Tracked Deals
            </div>
            {data.sales.deals.map((d, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 20px',
                borderBottom: i < data.sales.deals.length - 1 ? '1px solid #141414' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: 13, color: '#e8e8e8' }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{d.date?.substring(0, 16)}</div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#10b981' }}>{fmt(d.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lead Sources */}
      <div style={{ marginBottom: 36 }}>
        <SectionLabel label="Lead Sources" color="#3b82f6" />
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: '#999' }}>Source Distribution</span>
            <span style={{ fontSize: 13, color: '#e8e8e8', fontWeight: 600 }}>{fmtNum(totalLeads)} total</span>
          </div>

          {/* Stacked bar */}
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#1a1a1a', marginBottom: 16 }}>
            {Object.entries(data.leads.bySource)
              .sort((a, b) => b[1] - a[1])
              .map(([src, count]) => (
                <div
                  key={src}
                  style={{
                    width: `${(count / totalLeads) * 100}%`,
                    background: SOURCE_COLORS[src] || '#666',
                  }}
                  title={`${src}: ${count}`}
                />
              ))}
          </div>

          {/* Source breakdown */}
          {Object.entries(data.leads.bySource)
            .sort((a, b) => b[1] - a[1])
            .map(([src, count]) => {
              const pct = ((count / totalLeads) * 100).toFixed(1)
              const color = SOURCE_COLORS[src] || '#666'
              return (
                <div key={src} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid #1a1a1a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                    <span style={{ fontSize: 13, color: '#ccc', textTransform: 'capitalize' }}>{src}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: 12, color: '#555', minWidth: 50, textAlign: 'right' }}>{pct}%</span>
                    <span style={{ fontSize: 13, color: '#e8e8e8', fontWeight: 600, minWidth: 50, textAlign: 'right' }}>{fmtNum(count)}</span>
                  </div>
                </div>
              )
            })}

          <div style={{ fontSize: 11, color: '#444', marginTop: 12, paddingTop: 12, borderTop: '1px solid #1a1a1a' }}>
            Facebook: {fbPct}% of total leads
          </div>
        </div>
      </div>

      {/* Top Campaigns */}
      {data.topCampaigns.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <SectionLabel label="Top Ad Campaigns" color="#f59e0b" />
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
            {data.topCampaigns.map((c, i) => {
              const pct = totalLeads > 0 ? (c.leads / totalLeads) * 100 : 0
              return (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 20px',
                  borderBottom: i < data.topCampaigns.length - 1 ? '1px solid #141414' : 'none',
                }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: 16 }}>
                    <div style={{ fontSize: 13, color: '#e8e8e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ width: '100%', height: 3, background: '#1a1a1a', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                      <div style={{ height: 3, width: `${pct}%`, background: '#f59e0b', borderRadius: 2 }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', flexShrink: 0 }}>{c.leads}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Data source note */}
      <div style={{ fontSize: 11, color: '#333', textAlign: 'right', paddingTop: 8 }}>
        Leads & attribution: Hyros API · Spend: {data.spend.source || 'estimated from $1,800/day baseline'}
      </div>
    </div>
  )
}
