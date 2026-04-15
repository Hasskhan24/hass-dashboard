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
  pl: {
    projectedRevenue: number; ownersDraw: number; adSpend: number
    fixedOverhead: Record<string, number>
    marchCOGS: number
  }
  lastUpdated: string
}

interface PayrollPerson {
  name: string; amount: number; status: string; location: string; type: string
}

interface PayrollDept {
  total: number; headcount: number; people: PayrollPerson[]
}

interface PayrollData {
  departments: Record<string, PayrollDept>
  totalPayroll: number
  headcount: number
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

const DEPT_ORDER = ['Internal', 'Fulfillment', 'Sales']
const DEPT_COLORS: Record<string, string> = {
  Internal: '#8b5cf6', Fulfillment: '#3b82f6', Sales: '#10b981',
}

export default function Finance() {
  const [data, setData] = useState<FinanceData | null>(null)
  const [payroll, setPayroll] = useState<PayrollData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedDept, setExpandedDept] = useState<string | null>(null)
  const [expandedQB, setExpandedQB] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/finance').then(r => r.json()).catch(() => null),
      fetch('/api/payroll').then(r => r.json()).catch(() => null),
    ]).then(([fin, pay]) => {
      setData(fin)
      setPayroll(pay)
    }).finally(() => setLoading(false))
  }, [])

  const refresh = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/finance/refresh', { method: 'POST' }).then(r => r.json()).catch(() => null),
      fetch('/api/payroll').then(r => r.json()).catch(() => null),
    ]).then(([fin, pay]) => {
      if (fin && !fin.error) setData(fin)
      if (pay) setPayroll(pay)
    }).finally(() => setLoading(false))
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
    <div style={{ padding: '32px 40px' }}>

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

      {/* Live P&L */}
      {(() => {
        const teamPayroll = payroll?.totalPayroll || 105000
        const ownersDraw = data.pl.ownersDraw || 35000
        const adSpend = data.pl.adSpend
        const overhead = data.pl.fixedOverhead || {}
        const totalOverhead = Object.values(overhead).reduce((s: number, v) => s + (v as number), 0)
        // Total costs: team payroll (includes production) + fixed overhead + owner's draw + ad spend
        const totalCosts = teamPayroll + totalOverhead + ownersDraw + adSpend
        const totalRevenue = data.newCash.totalCollected
        const projectedRevenue = data.pl.projectedRevenue
        const netProfit = projectedRevenue - totalCosts
        const collectedNet = totalRevenue - totalCosts
        const margin = projectedRevenue > 0 ? (netProfit / projectedRevenue) * 100 : 0
        const depts = payroll?.departments || {}
        const sortedDepts = DEPT_ORDER.filter(d => depts[d]).concat(
          Object.keys(depts).filter(d => !DEPT_ORDER.includes(d))
        )

        const LineItem = ({ label, value, sub, bold, color, indent }: { label: string; value: string; sub?: string; bold?: boolean; color?: string; indent?: boolean }) => (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', paddingLeft: indent ? 16 : 0 }}>
            <div>
              <span style={{ fontSize: bold ? 14 : 13, color: bold ? '#e8e8e8' : '#999', fontWeight: bold ? 700 : 400 }}>{label}</span>
              {sub && <span style={{ fontSize: 11, color: '#444', marginLeft: 8 }}>{sub}</span>}
            </div>
            <span style={{ fontSize: bold ? 14 : 13, color: color || (bold ? '#e8e8e8' : '#e8e8e8'), fontWeight: bold ? 700 : 600 }}>{value}</span>
          </div>
        )

        return (
          <div>
            <SectionLabel label="Live P&L — April 2026" color="#ef4444" />

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
              <MetricCard value={fmt(projectedRevenue)} label="Projected Revenue" sub="MRR Expected + New Cash" />
              <MetricCard value={fmt(totalCosts)} label="Total All-In Costs" sub="Payroll + Overhead + Draw + Ads" warn />
              <MetricCard value={fmt(netProfit)} label="Projected Net" sub={`${margin.toFixed(1)}% margin`} highlight={netProfit > 0} warn={netProfit < 0} />
              <MetricCard value={fmt(collectedNet)} label="Collected Net" sub="Cash in hand − All costs" highlight={collectedNet > 0} warn={collectedNet < 0} />
            </div>

            {/* Income Statement */}
            <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>

              {/* ── REVENUE ── */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e1e' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Revenue</div>
                <LineItem label="MRR Collected" value={fmt(data.mrr.collected)} />
                <LineItem label="New Cash Collected" value={fmt(data.newCash.collected)} />
                <LineItem label="Upsell Cash" value={fmt(data.upsell.collected)} />
                <div style={{ borderTop: '1px solid #1a1a1a', marginTop: 8 }}>
                  <LineItem label="Total Collected Revenue" value={fmt(totalRevenue)} bold color="#10b981" />
                </div>
                <LineItem label="MRR Remaining (uncollected)" value={`+${fmt(data.mrr.remaining)}`} sub="" />
              </div>

              {/* ── TEAM PAYROLL ── */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e1e' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Team Payroll (Fixed)</div>

                {sortedDepts.map(dept => {
                  const d = depts[dept]
                  const isExpanded = expandedDept === dept
                  const color = DEPT_COLORS[dept] || '#888'
                  const deptAmount = d.total
                  const pctOfTotal = teamPayroll > 0 ? (deptAmount / teamPayroll) * 100 : 0

                  return (
                    <div key={dept}>
                      <div
                        onClick={() => setExpandedDept(isExpanded ? null : dept)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 10, color: '#444' }}>{isExpanded ? '▼' : '▶'}</span>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: '#ccc' }}>{dept}</span>
                          <span style={{ fontSize: 11, color: '#444' }}>{d.headcount} people</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 60, height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: 4, width: `${pctOfTotal}%`, background: color, borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 13, color: '#e8e8e8', fontWeight: 600, minWidth: 70, textAlign: 'right' }}>{fmt(deptAmount)}</span>
                        </div>
                      </div>
                      {isExpanded && (
                        <div style={{ paddingLeft: 36, paddingBottom: 8 }}>
                          {d.people.map((p, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: '#888' }}>{p.name}</span>
                                {p.location === 'Non US' && <span style={{ fontSize: 9, color: '#555', background: '#1a1a1a', padding: '1px 5px', borderRadius: 3 }}>Intl</span>}
                                {p.type === 'External' && <span style={{ fontSize: 9, color: '#555', background: '#1a1a1a', padding: '1px 5px', borderRadius: 3 }}>Contractor</span>}
                              </div>
                              <span style={{ fontSize: 12, color: p.amount > 0 ? '#ccc' : '#333', fontWeight: 500 }}>{p.amount > 0 ? fmt(p.amount) : '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                <div style={{ borderTop: '1px solid #1a1a1a', marginTop: 8 }}>
                  <LineItem label={`Total Team Payroll (${payroll?.headcount || '—'} people)`} value={fmt(teamPayroll)} bold color="#ef4444" />
                </div>
              </div>

              {/* ── FIXED OVERHEAD (from QuickBooks March P&L) ── */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e1e' }}>
                <div
                  onClick={() => setExpandedQB(!expandedQB)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10, color: '#444' }}>{expandedQB ? '▼' : '▶'}</span>
                    <span style={{ fontSize: 13, color: '#ccc', fontWeight: 600 }}>Fixed Overhead</span>
                    <span style={{ fontSize: 11, color: '#444' }}>from QuickBooks March P&L</span>
                  </div>
                  <span style={{ fontSize: 13, color: '#e8e8e8', fontWeight: 600 }}>{fmt(totalOverhead)}</span>
                </div>
                {expandedQB && (
                  <div style={{ paddingLeft: 26, paddingTop: 8 }}>
                    {[
                      { label: 'Software & Apps', key: 'softwareApps' },
                      { label: 'Rent & Building', key: 'rentBuilding' },
                      { label: 'Office Utilities', key: 'officeUtilities' },
                      { label: 'Legal & Accounting', key: 'legalAccounting' },
                      { label: 'Bank & Merchant Fees', key: 'bankMerchantFees' },
                      { label: 'Memberships & Subscriptions', key: 'memberships' },
                      { label: 'Interest', key: 'interest' },
                      { label: 'Admin Labor', key: 'adminLabor' },
                      { label: 'Insurance', key: 'insurance' },
                      { label: 'Travel', key: 'travel' },
                      { label: 'Office Expenses', key: 'officeExpenses' },
                      { label: 'Meals', key: 'meals' },
                      { label: 'Vehicle', key: 'vehicle' },
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                        <span style={{ fontSize: 12, color: '#888' }}>{item.label}</span>
                        <span style={{ fontSize: 12, color: '#ccc' }}>{fmt(overhead[item.key] || 0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── OWNER'S DRAW ── */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e1e' }}>
                <LineItem label="Owner's Draw" value={fmt(ownersDraw)} sub="Monthly" />
              </div>

              {/* ── AD SPEND ── */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e1e' }}>
                <LineItem label="Advertising & Marketing" value={fmt(adSpend)} sub="~$1,800/day" />
              </div>

              {/* ── TOTALS ── */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e1e', background: '#0d0d0d' }}>
                <LineItem label="Team Payroll" value={fmt(teamPayroll)} indent sub="Fulfillment + Sales + Internal" />
                <LineItem label="Fixed Overhead" value={fmt(totalOverhead)} indent />
                <LineItem label="Owner's Draw" value={fmt(ownersDraw)} indent />
                <LineItem label="Advertising" value={fmt(adSpend)} indent />
                <div style={{ borderTop: '1px solid #1a1a1a', marginTop: 8 }}>
                  <LineItem label="Total All-In Costs" value={`(${fmt(totalCosts)})`} bold color="#ef4444" />
                </div>
              </div>

              {/* ── BOTTOM LINE ── */}
              <div style={{ padding: '20px', background: netProfit > 0 ? '#10b98108' : '#ef444408' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1e1e1e' }}>
                  <span style={{ fontSize: 18, color: '#e8e8e8', fontWeight: 700 }}>Projected Net Profit</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: netProfit > 0 ? '#10b981' : '#ef4444' }}>{fmt(netProfit)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ fontSize: 13, color: '#999' }}>Net Margin</span>
                  <span style={{ fontSize: 13, color: margin > 20 ? '#10b981' : margin > 0 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>{margin.toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ fontSize: 13, color: '#999' }}>Collected Net (cash in hand)</span>
                  <span style={{ fontSize: 13, color: collectedNet > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>{fmt(collectedNet)}</span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: '#333', marginTop: 8, textAlign: 'right' }}>
              Payroll: Airtable{payroll ? ` · ${payroll.lastUpdated}` : ''} | Production: cfinternaltools | Overhead: QuickBooks March P&L
            </div>
          </div>
        )
      })()}

    </div>
  )
}
