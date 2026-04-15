import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const QUICK_PROMPTS = [
  { label: "Today's Summary", prompt: "Give me a full summary of today — revenue, calls, emails, and any alerts I need to know about." },
  { label: "MRR Status", prompt: "What's my current MRR? How much have I collected vs projected this month?" },
  { label: "Follow-Up Audit", prompt: "Who are the hot prospects that need follow-up right now? List them with their status." },
  { label: "Ad Spend", prompt: "What's my ad spend today and this month? What's the ROI looking like?" },
  { label: "Client Health", prompt: "Are any clients at risk? Give me a summary of client health right now." },
  { label: "Call Board", prompt: "What calls are scheduled today and what's the status of each closer?" },
]

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanStatus, setScanStatus] = useState<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    // Load today's scan status
    fetch('/api/scan/status')
      .then(r => r.json())
      .then(setScanStatus)
      .catch(() => setScanStatus(null))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "I couldn't connect to the server. Make sure the backend is running." }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const showChat = messages.length > 0

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#0a0a0a',
    }}>
      {!showChat ? (
        // Home state — Claude-style centered
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          maxWidth: 720,
          margin: '0 auto',
          width: '100%',
        }}>
          {/* Greeting */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              width: 56, height: 56,
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              borderRadius: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, margin: '0 auto 16px',
            }}>⚡</div>
            <h1 style={{
              fontSize: 28,
              fontWeight: 600,
              color: '#e8e8e8',
              marginBottom: 4,
            }}>
              {getGreeting()}, Hass
            </h1>
            <p style={{ fontSize: 14, color: '#555' }}>{formatDate()}</p>
          </div>

          {/* Scan Status Bar */}
          {scanStatus && (
            <div style={{
              display: 'flex',
              gap: 8,
              marginBottom: 28,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}>
              {[
                { label: `${scanStatus.emailsScanned || 0} emails scanned`, color: '#3b82f6' },
                { label: `$${scanStatus.mrrCollected || 0} MRR collected`, color: '#10b981' },
                { label: `${scanStatus.callsToday || 0} calls today`, color: '#8b5cf6' },
                { label: `${scanStatus.alerts || 0} alerts`, color: scanStatus.alerts > 0 ? '#f59e0b' : '#555' },
              ].map((pill, i) => (
                <div key={i} style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  border: `1px solid ${pill.color}33`,
                  background: `${pill.color}11`,
                  fontSize: 12,
                  color: pill.color,
                  fontWeight: 500,
                }}>{pill.label}</div>
              ))}
            </div>
          )}

          {/* Chat Input */}
          <div style={{
            width: '100%',
            background: '#161616',
            border: '1px solid #2a2a2a',
            borderRadius: 16,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
            marginBottom: 20,
            transition: 'border-color 0.15s',
          }}
            onFocus={() => {}}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about your business..."
              rows={2}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#e8e8e8',
                fontSize: 15,
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.5,
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              style={{
                width: 36, height: 36,
                background: input.trim() ? '#7c3aed' : '#1e1e1e',
                border: 'none',
                borderRadius: 10,
                cursor: input.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >↑</button>
          </div>

          {/* Quick Prompts */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            width: '100%',
          }}>
            {QUICK_PROMPTS.map((p, i) => (
              <button
                key={i}
                onClick={() => sendMessage(p.prompt)}
                style={{
                  background: '#111',
                  border: '1px solid #1e1e1e',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: '#888',
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#1a1a1a'
                  e.currentTarget.style.color = '#e8e8e8'
                  e.currentTarget.style.borderColor = '#333'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#111'
                  e.currentTarget.style.color = '#888'
                  e.currentTarget.style.borderColor = '#1e1e1e'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Dashboard Shortcuts */}
          <div style={{
            display: 'flex', gap: 8, marginTop: 24, flexWrap: 'wrap', justifyContent: 'center',
          }}>
            {[
              { label: 'Briefing', path: '/briefing' },
              { label: 'Finance', path: '/finance' },
              { label: 'Sales', path: '/sales' },
              { label: 'Marketing', path: '/marketing' },
              { label: 'Production', path: '/production' },
              { label: 'Client Health', path: '/health' },
            ].map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  padding: '6px 14px',
                  background: 'none',
                  border: '1px solid #222',
                  borderRadius: 20,
                  color: '#555',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#444'
                  e.currentTarget.style.color = '#888'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#222'
                  e.currentTarget.style.color = '#555'
                }}
              >{item.label}</button>
            ))}
          </div>
        </div>
      ) : (
        // Chat state
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{
                  display: 'flex',
                  gap: 12,
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: msg.role === 'user' ? '#2a2a2a' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 600, color: '#fff',
                  }}>
                    {msg.role === 'user' ? 'H' : '⚡'}
                  </div>
                  <div style={{
                    maxWidth: '80%',
                    background: msg.role === 'user' ? '#1a1a1a' : 'transparent',
                    border: msg.role === 'user' ? '1px solid #2a2a2a' : 'none',
                    borderRadius: 12,
                    padding: msg.role === 'user' ? '10px 14px' : '4px 0',
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: '#d8d8d8',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, color: '#fff',
                  }}>⚡</div>
                  <div style={{ padding: '10px 0', color: '#555', fontSize: 14 }}>
                    Scanning your data...
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #1a1a1a',
            background: '#0a0a0a',
          }}>
            <div style={{
              maxWidth: 720,
              margin: '0 auto',
              background: '#161616',
              border: '1px solid #2a2a2a',
              borderRadius: 14,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: 10,
            }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a follow-up..."
                rows={1}
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: '#e8e8e8',
                  fontSize: 14,
                  resize: 'none',
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                style={{
                  width: 32, height: 32,
                  background: input.trim() ? '#7c3aed' : '#1e1e1e',
                  border: 'none', borderRadius: 8,
                  cursor: input.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: '#fff', flexShrink: 0,
                  transition: 'background 0.15s',
                }}
              >↑</button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button
                onClick={() => setMessages([])}
                style={{
                  background: 'none', border: 'none', color: '#444',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >New conversation</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
