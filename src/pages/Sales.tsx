import { useState, useEffect } from 'react'

interface CallEntry {
  name: string
  phone: string
  time: string
  closer: string
  status: string
}

interface FollowUp {
  name: string
  status: 'critical' | 'needs_outreach' | 'confirmed'
  lastContact: string
  notes: string
}

interface SalesData {
  callsToday: number
  noCallsReason: string | null
  calls: CallEntry[]
  followUps: FollowUp[]
  pipeline: { confirmed: number; critical: number; needsOutreach: number }
  lastUpdated: string
}

const statusColors: Record<string, string> = {
  critical: '#ef4444',
  needs_outreach: '#f59e0b',
  confirmed: '#10b981',
}

const statusLabels: Record<string, string> = {
  critical: 'Critical',
  needs_outreach: 'Needs Outreach',
  confirmed: 'Confirmed',
}

export default function Sales() {
  const [data, setData] = useState<SalesData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/sales')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e8e8e8', marginBottom: 4 }}>Sales</h1>
        <p style={{ fontSize: 13, color: '#555' }}>Calls & Pipeline</p>
      </div>

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: 60, color: '#444', fontSize: 14 }}>Loading sales data...</div>
      )}

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Call Board */}
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8e8' }}>Call Board</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>Today's scheduled calls</div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                background: data.callsToday === 0 ? '#ef444422' : '#10b98122',
                color: data.callsToday === 0 ? '#ef4444' : '#10b981',
              }}>
                {data.callsToday === 0 ? 'No Calls' : `${data.callsToday} Calls`}
              </span>
            </div>
            <div style={{ padding: '12px 20px' }}>
              {data.callsToday === 0 ? (
                <div style={{ fontSize: 13, color: '#555', padding: '20px 0', textAlign: 'center' }}>
                  {data.noCallsReason || 'No calls scheduled today.'}
                </div>
              ) : (
                data.calls?.map((call, i) => (
                  <div key={i} style={{
                    padding: '10px 0',
                    borderBottom: i < data.calls.length - 1 ? '1px solid #141414' : 'none',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8' }}>{call.name}</div>
                      <div style={{ fontSize: 12, color: '#555' }}>{call.time}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                      {call.closer} · {call.status}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Follow-Up Audit */}
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8e8' }}>Follow-Up Audit</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>24h compliance check</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {data.pipeline && (
                  <>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: '#10b98122', color: '#10b981' }}>
                      {data.pipeline.confirmed} confirmed
                    </span>
                    {data.pipeline.critical > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: '#ef444422', color: '#ef4444' }}>
                        {data.pipeline.critical} critical
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            <div style={{ padding: '12px 20px', maxHeight: 320, overflowY: 'auto' }}>
              {!data.followUps || data.followUps.length === 0 ? (
                <div style={{ fontSize: 13, color: '#555', padding: '20px 0', textAlign: 'center' }}>
                  No follow-ups needed.
                </div>
              ) : (
                data.followUps.map((fu, i) => (
                  <div key={i} style={{
                    padding: '10px 0',
                    borderBottom: i < data.followUps.length - 1 ? '1px solid #141414' : 'none',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8' }}>{fu.name}</div>
                        <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Last contact: {fu.lastContact}</div>
                        {fu.notes && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{fu.notes}</div>}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, flexShrink: 0,
                        background: `${statusColors[fu.status]}22`,
                        color: statusColors[fu.status],
                      }}>
                        {statusLabels[fu.status]}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && !data && (
        <div style={{ textAlign: 'center', padding: 60, color: '#444', fontSize: 14 }}>
          No sales data yet. Run a daily scan to pull GHL data.
        </div>
      )}
    </div>
  )
}
