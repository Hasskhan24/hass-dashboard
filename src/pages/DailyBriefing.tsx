import { useState, useEffect } from 'react'

interface BriefingSection {
  title: string
  status: 'clear' | 'attention' | 'action'
  summary: string
  details?: string
  lastScanned?: string
}

interface Briefing {
  date: string
  sections: BriefingSection[]
  alerts: string[]
}

const statusColors: Record<string, string> = {
  clear: '#10b981',
  attention: '#f59e0b',
  action: '#ef4444',
}

const statusLabels: Record<string, string> = {
  clear: 'All Clear',
  attention: 'Needs Attention',
  action: 'Action Required',
}

export default function DailyBriefing() {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  useEffect(() => {
    loadBriefing()
  }, [])

  const loadBriefing = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/briefing')
      const data = await res.json()
      setBriefing(data)
    } catch {
      setBriefing(null)
    } finally {
      setLoading(false)
    }
  }

  const runScan = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/scan/daily', { method: 'POST' })
      const data = await res.json()
      setBriefing(data)
    } catch {
      alert('Scan failed. Check that the server is running.')
    } finally {
      setScanning(false)
    }
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e8e8e8', marginBottom: 4 }}>Daily Briefing</h1>
          <p style={{ fontSize: 13, color: '#555' }}>{today}</p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          style={{
            padding: '9px 18px',
            background: scanning ? '#1a1a1a' : '#7c3aed',
            border: 'none',
            borderRadius: 10,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: scanning ? 'default' : 'pointer',
            fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {scanning ? (
            <><span style={{ animation: 'spin 1s linear infinite' }}>⟳</span> Scanning...</>
          ) : (
            <><span>⚡</span> Run Scan Now</>
          )}
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#444', fontSize: 14 }}>
          Loading briefing...
        </div>
      )}

      {!loading && !briefing && (
        <div style={{
          textAlign: 'center',
          padding: '60px 40px',
          background: '#111',
          borderRadius: 16,
          border: '1px solid #1e1e1e',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e8e8e8', marginBottom: 8 }}>No briefing yet today</h2>
          <p style={{ fontSize: 14, color: '#555', marginBottom: 24 }}>
            Run a scan to pull in your emails, calls, revenue, and alerts.
          </p>
          <button
            onClick={runScan}
            style={{
              padding: '10px 24px',
              background: '#7c3aed',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >Run My First Scan</button>
        </div>
      )}

      {briefing && (
        <>
          {/* Alerts */}
          {briefing.alerts && briefing.alerts.length > 0 && (
            <div style={{
              background: '#1a0f00',
              border: '1px solid #f59e0b33',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 24,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginBottom: 10 }}>
                ⚠️ {briefing.alerts.length} Active Alert{briefing.alerts.length !== 1 ? 's' : ''}
              </div>
              {briefing.alerts.map((alert, i) => (
                <div key={i} style={{
                  fontSize: 13,
                  color: '#d8b04a',
                  padding: '5px 0',
                  borderTop: i > 0 ? '1px solid #2a1f00' : 'none',
                }}>• {alert}</div>
              ))}
            </div>
          )}

          {/* Sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {briefing.sections?.map((section, i) => (
              <div
                key={i}
                style={{
                  background: '#111',
                  border: '1px solid #1e1e1e',
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: statusColors[section.status],
                    }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8e8' }}>{section.title}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: statusColors[section.status],
                      background: `${statusColors[section.status]}22`,
                      padding: '2px 8px',
                      borderRadius: 20,
                    }}>{statusLabels[section.status]}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {section.lastScanned && (
                      <span style={{ fontSize: 12, color: '#444' }}>{section.lastScanned}</span>
                    )}
                    <span style={{ color: '#444', fontSize: 12 }}>{expandedIdx === i ? '▲' : '▼'}</span>
                  </div>
                </div>
                <div style={{ padding: '0 20px 16px', fontSize: 13, color: '#888', lineHeight: 1.6 }}>
                  {section.summary}
                </div>
                {expandedIdx === i && section.details && (
                  <div style={{
                    padding: '12px 20px 16px',
                    borderTop: '1px solid #1a1a1a',
                    fontSize: 13, color: '#666', lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {section.details}
                  </div>
                )}
              </div>
            ))}
          </div>

          {briefing.date && (
            <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: '#333' }}>
              Last scanned: {briefing.date}
            </div>
          )}
        </>
      )}
    </div>
  )
}
