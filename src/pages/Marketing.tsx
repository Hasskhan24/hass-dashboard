import { useState, useEffect } from 'react'

interface EmailData {
  scanned: number; timeSensitive: number; needsResponse: number; fyi: number
  topEmails?: { subject: string; from: string; priority: string }[]
}

interface AdData {
  spend: number; impressions: number; clicks: number; leads: number; cpl: number; roas: number
}

interface MarketingData {
  email: EmailData
  ads: AdData
  broadcastStatus: string
  lastUpdated: string
}

export default function Marketing() {
  const [data, setData] = useState<MarketingData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/marketing')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n?.toFixed(0) || 0}`

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e8e8e8', marginBottom: 4 }}>Marketing</h1>
        <p style={{ fontSize: 13, color: '#555' }}>Ads & Email</p>
      </div>

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: 60, color: '#444', fontSize: 14 }}>Loading marketing data...</div>
      )}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Email Briefing */}
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8e8' }}>✉️ Inbox Briefing</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{data.email.scanned} emails scanned in last 24h</div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                background: data.email.needsResponse > 0 ? '#ef444422' : '#10b98122',
                color: data.email.needsResponse > 0 ? '#ef4444' : '#10b981',
              }}>
                {data.email.needsResponse > 0 ? 'Action Required' : 'All Clear'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: '#141414' }}>
              {[
                { label: 'Emails Scanned', value: data.email.scanned, color: '#e8e8e8' },
                { label: 'Time-Sensitive', value: data.email.timeSensitive, color: data.email.timeSensitive > 0 ? '#ef4444' : '#555' },
                { label: 'Need Response', value: data.email.needsResponse, color: data.email.needsResponse > 0 ? '#f59e0b' : '#555' },
                { label: 'FYI', value: data.email.fyi, color: '#3b82f6' },
              ].map((m, i) => (
                <div key={i} style={{ background: '#111', padding: '16px 20px' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{m.label}</div>
                </div>
              ))}
            </div>
            {data.email.topEmails && data.email.topEmails.length > 0 && (
              <div style={{ padding: '12px 20px' }}>
                <div style={{ fontSize: 11, color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Top Priority Emails</div>
                {data.email.topEmails.map((e, i) => (
                  <div key={i} style={{
                    padding: '8px 0',
                    borderTop: i > 0 ? '1px solid #141414' : 'none',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, color: '#e8e8e8' }}>{e.subject}</div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{e.from}</div>
                    </div>
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 20, flexShrink: 0,
                      background: e.priority === 'high' ? '#ef444422' : '#f59e0b22',
                      color: e.priority === 'high' ? '#ef4444' : '#f59e0b',
                      fontWeight: 600,
                    }}>{e.priority}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ad Performance */}
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8e8' }}>📣 Ad Performance</div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>Facebook + Hyros · Today</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: '#141414' }}>
              {[
                { label: 'Ad Spend', value: fmt(data.ads.spend) },
                { label: 'Impressions', value: data.ads.impressions?.toLocaleString() || '—' },
                { label: 'Clicks', value: data.ads.clicks?.toLocaleString() || '—' },
                { label: 'Leads Generated', value: data.ads.leads || '—' },
                { label: 'Cost Per Lead', value: fmt(data.ads.cpl) },
                { label: 'ROAS', value: data.ads.roas ? `${data.ads.roas.toFixed(1)}x` : '—' },
              ].map((m, i) => (
                <div key={i} style={{ background: '#111', padding: '16px 20px' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#e8e8e8' }}>{m.value}</div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && !data && (
        <div style={{ textAlign: 'center', padding: 60, color: '#444', fontSize: 14 }}>
          No marketing data yet. Run a daily scan.
        </div>
      )}
    </div>
  )
}
