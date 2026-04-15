import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import DailyBriefing from './pages/DailyBriefing'
import Finance from './pages/Finance'
import Sales from './pages/Sales'
import Marketing from './pages/Marketing'
import Production from './pages/Production'
import ClientHealth from './pages/ClientHealth'

function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', height: '100vh', background: '#0a0a0a' }}>
        <Sidebar />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/briefing" element={<DailyBriefing />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/marketing" element={<Marketing />} />
            <Route path="/production" element={<Production />} />
            <Route path="/health" element={<ClientHealth />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
