import { NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'

const navItems = [
  { path: '/', label: 'Home', icon: '⚡' },
  { path: '/briefing', label: 'Daily Briefing', icon: '📋' },
  { path: '/finance', label: 'Finance', icon: '💰' },
  { path: '/sales', label: 'Sales', icon: '📈' },
  { path: '/marketing', label: 'Marketing', icon: '📣' },
  { path: '/production', label: 'Production', icon: '🎬' },
  { path: '/health', label: 'Client Health', icon: '❤️' },
]

export default function Sidebar() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside style={{
      width: collapsed ? '60px' : '220px',
      background: '#111111',
      borderRight: '1px solid #1e1e1e',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.2s ease',
      flexShrink: 0,
      zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? '20px 0' : '20px 16px',
        borderBottom: '1px solid #1e1e1e',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        justifyContent: collapsed ? 'center' : 'space-between',
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 32, height: 32,
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: '#fff',
            }}>H</div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8e8' }}>Command Center</span>
          </div>
        )}
        {collapsed && (
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: '#fff',
          }}>H</div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: 'none', border: 'none', color: '#555',
            cursor: 'pointer', fontSize: 16, padding: 2,
            display: collapsed ? 'none' : 'block',
          }}
        >‹</button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(item => {
          const isActive = location.pathname === item.path
          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: collapsed ? '8px 0' : '8px 10px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#e8e8e8' : '#666',
                background: isActive ? '#1e1e1e' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{
        padding: collapsed ? '12px 0' : '12px 16px',
        borderTop: '1px solid #1e1e1e',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <div style={{
          width: 28, height: 28,
          background: '#2a2a2a',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: '#888', flexShrink: 0,
        }}>H</div>
        {!collapsed && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e8e8e8' }}>Hass Khan</div>
            <div style={{ fontSize: 11, color: '#555' }}>Content Factory ATX</div>
          </div>
        )}
      </div>
    </aside>
  )
}
