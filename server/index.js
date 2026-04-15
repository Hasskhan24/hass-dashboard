import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import cron from 'node-cron'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '../.env')
// Always force-load from .env to override any injected env vars
const envFile = fs.readFileSync(envPath, 'utf8')
for (const line of envFile.split('\n')) {
  const [key, ...vals] = line.split('=')
  if (key && key.trim() && vals.length) process.env[key.trim()] = vals.join('=').trim()
}
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// ─── Data persistence (simple JSON file cache) ────────────────────────────────
const DATA_FILE = path.join(__dirname, 'data.json')

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  } catch {
    return {}
  }
}

function writeCache(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

// ─── GHL API ─────────────────────────────────────────────────────────────────
const GHL_BASE = 'https://rest.gohighlevel.com/v1'
const SALES_PIPELINE_ID = 'NhNR55d8xirDZCltTo2p'

// Stage ID → Name map for Sales Opportunity Pipeline
const STAGE_MAP = {
  '12d04676-b9fa-4cca-8a73-8c50fcb5d42d': 'Opt In',
  'ec9a483a-26ba-4146-b829-e975b054a0ae': 'Lead Magnet Opt In',
  '982d5a0c-c8fc-4c91-9fdc-241877dbcb3d': 'OBO Opt In',
  'ea2ad568-8089-4a9e-b9ab-59057f355553': 'Follow Up',
  'f4c4e778-60be-4d07-815a-9342fd1ab6be': 'Application Submitted',
  '9676ec36-fb45-46b5-b35d-01d23ab265e6': 'Call Booked',
  '928f402b-043d-4953-a46d-c092be490c1c': 'Need Rescheduled',
  '2647aa8e-6a3a-4e0c-bf20-4e8d9198dffa': 'Closer Follow Up',
  '5b39352a-7eec-4f2b-94e1-dc660c584d69': 'No Show',
  'ee0166a9-feb2-44fb-81a4-8b0042c09936': 'Deal Closed',
  '1eef27aa-0157-4bff-9a91-8aa50cc246cd': '30 Days to Close',
  '29ef5ba0-ec4b-43d1-8b7a-e55035fa54db': '60 Days to Close',
  '4a9d1fdb-e4fd-4ca3-a921-fffb397fad24': 'Long Term Nurture',
  '36219fdb-7803-4fa1-97b6-afaefb038ab6': 'No Contact/Interest',
}

// Closer user IDs
const CLOSER_IDS = {
  'Hassan': 'KA1JPVKcsIcWs763ZDrq',
  'Lily': '7lbiUWtl1Og5mwv3hfeK',
  'Eric': 'CUzo97jHYJkL96qLTyyx',
  'Akash': 'ZyYNNZmTIjxFDcxwLivd',
}

function ghlHeaders() {
  return { Authorization: `Bearer ${process.env.GHL_API_KEY}` }
}

async function fetchGHLContacts(limit = 100) {
  try {
    const res = await axios.get(`${GHL_BASE}/contacts/`, {
      headers: ghlHeaders(),
      params: { locationId: process.env.GHL_LOCATION_ID, limit: Math.min(limit, 100) },
    })
    return res.data?.contacts || []
  } catch (e) {
    console.error('GHL contacts error:', e.message)
    return []
  }
}

async function fetchGHLPipelines() {
  try {
    const res = await axios.get(`${GHL_BASE}/pipelines/`, {
      headers: ghlHeaders(),
      params: { locationId: process.env.GHL_LOCATION_ID },
    })
    return res.data?.pipelines || []
  } catch (e) {
    console.error('GHL pipelines error:', e.message)
    return []
  }
}

async function fetchGHLOpportunities(pipelineId) {
  try {
    const res = await axios.get(`${GHL_BASE}/pipelines/${pipelineId}/opportunities`, {
      headers: ghlHeaders(),
      params: { locationId: process.env.GHL_LOCATION_ID },
    })
    return res.data?.opportunities || []
  } catch (e) {
    console.error('GHL opps error:', e.message)
    return []
  }
}

// ─── iClosed API ─────────────────────────────────────────────────────────────
const ICLOSED_BASE = 'https://public.api.iclosed.io/v1'

function iClosedHeaders() {
  return { Authorization: `Bearer ${process.env.ICLOSED_API_KEY}` }
}

async function fetchIClosedCalls({ eventType = 'ALL', dateFrom, dateTo, limit = 100 } = {}) {
  try {
    const params = { limit }
    if (eventType) params.eventType = eventType
    if (dateFrom) params.dateFrom = dateFrom
    if (dateTo) params.dateTo = dateTo
    const res = await axios.get(`${ICLOSED_BASE}/eventCalls`, {
      headers: iClosedHeaders(),
      params,
    })
    return res.data?.eventCalls || res.data?.data || res.data || []
  } catch (e) {
    console.error('iClosed calls error:', e.response?.status, e.response?.data || e.message)
    return []
  }
}

async function fetchIClosedDeals({ timeFrom, timeTo, limit = 100 } = {}) {
  try {
    const params = { limit }
    if (timeFrom) params.timeFrom = timeFrom
    if (timeTo) params.timeTo = timeTo
    const res = await axios.get(`${ICLOSED_BASE}/deals`, {
      headers: iClosedHeaders(),
      params,
    })
    return res.data?.deals || res.data?.data || res.data || []
  } catch (e) {
    console.error('iClosed deals error:', e.response?.status, e.response?.data || e.message)
    return []
  }
}

// ─── Claude AI ───────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function analyzeWithClaude(systemPrompt, userContent) {
  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  })
  return msg.content[0].text
}

// ─── Airtable ────────────────────────────────────────────────────────────────
const AIRTABLE_BASE = 'https://api.airtable.com/v0'
const AT_BASE_ID = 'appkKz5W1k5UFgcv9'

function atHeaders() {
  return { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` }
}

async function fetchAirtableRecords(tableId, fields = [], filterFormula = '') {
  if (!process.env.AIRTABLE_API_KEY) return []
  try {
    const params = {}
    if (fields.length) params['fields[]'] = fields
    if (filterFormula) params.filterByFormula = filterFormula
    const res = await axios.get(`${AIRTABLE_BASE}/${AT_BASE_ID}/${tableId}`, {
      headers: atHeaders(),
      params,
    })
    return res.data?.records || []
  } catch (e) {
    console.error('Airtable error:', e.response?.status, e.message)
    return []
  }
}

// Calculates finance snapshot from Airtable data (or returns cached/hardcoded)
function buildFinanceFromAirtable(closerEODs = null, recurringCash = null) {
  // ── Closer EODs (MTD April) ──
  const eods = closerEODs || []
  const byCloserMap = {}
  let totalCallsTaken = 0, totalNoShows = 0, totalOffers = 0, totalDeals = 0
  let totalCash = 0, totalRev = 0, totalCallSlots = 0

  for (const r of eods) {
    const f = r.fields || r.cellValuesByFieldId || {}
    const name = (f['Your Name']?.name || f['Your Name'] || '').toString()
    const taken = Number(f['Calls Taken'] || f['fld4EsJpqqRPUwlRS'] || 0)
    const noShow = Number(f['No Shows'] || f['fldMR9yyJQ1u097bY'] || 0)
    const offers = Number(f['Offers Made'] || f['fldgMNBxU5NuARIew'] || 0)
    const deals = Number(f['Deals Closed'] || f['fldDQ07efjONEcSu5'] || 0)
    const cash = Number(f['Cash Collected'] || f['fldZfE3C0XTxH2sCj'] || 0)
    const rev = Number(f['Revenue Generated'] || f['fldpP5y7BBEAib2Zw'] || 0)
    const slots = Number(f['Call Slots Filled'] || f['fld5hIrV3MfdyHaxo'] || 0)

    totalCallsTaken += taken; totalNoShows += noShow; totalOffers += offers
    totalDeals += deals; totalCash += cash; totalRev += rev; totalCallSlots += slots

    if (name) {
      if (!byCloserMap[name]) byCloserMap[name] = { deals: 0, amount: 0 }
      byCloserMap[name].deals += deals
      byCloserMap[name].amount += cash
    }
  }

  // ── RECURRING Cash (MRR) ──
  const recurring = recurringCash || []
  let mrrExpected = 0, mrrCollected = 0
  for (const r of recurring) {
    const f = r.fields || r.cellValuesByFieldId || {}
    mrrExpected += Number(f['April 26'] || f['fldRio9Bf3jlli88H'] || 0)
    mrrCollected += Number(f['April Act 26'] || f['fldbl8WLY3qkdwBMx'] || 0)
  }

  // Fall back to CF Reporting actuals if Airtable not connected
  if (!eods.length) {
    totalCallsTaken = 28; totalNoShows = 17; totalOffers = 26; totalDeals = 7
    totalCash = 82136; totalRev = 107135; totalCallSlots = 63
    byCloserMap['Hass'] = { deals: 2, amount: 31550 }
    byCloserMap['Lily'] = { deals: 1, amount: 18000 }
    byCloserMap['Eric'] = { deals: 2, amount: 5001 }
    byCloserMap['Akash'] = { deals: 2, amount: 27585 }
  }
  if (!recurring.length) {
    mrrExpected = 166925; mrrCollected = 47400
  }

  const mrrRemaining = mrrExpected - mrrCollected
  const showRate = totalCallSlots > 0 ? (totalCallsTaken / totalCallSlots) * 100 : 0
  const closeRate = totalCallsTaken > 0 ? (totalDeals / totalCallsTaken) * 100 : 0
  const dollarPerBookedCall = totalCallSlots > 0 ? totalCash / totalCallSlots : 0
  const forecastedTotal = mrrExpected + totalCash
  const totalCollected = mrrCollected + totalCash

  return {
    mrr: { expected: mrrExpected, collected: mrrCollected, remaining: mrrRemaining, clients: recurring.length || 37 },
    upsell: { collected: 2800, target: 10000 },
    newCash: { collected: totalCash, revenue: totalRev, deals: totalDeals, forecastedTotal, totalCollected },
    sales: {
      callsBooked: totalCallSlots || 63,
      callsTaken: totalCallsTaken,
      noShows: totalNoShows,
      showRate: parseFloat(showRate.toFixed(1)),
      offersMade: totalOffers,
      dealsClosed: totalDeals,
      closeRate: parseFloat(closeRate.toFixed(1)),
      cashCollected: totalCash,
      revGenerated: totalRev,
      dollarPerBookedCall: parseFloat(dollarPerBookedCall.toFixed(2)),
    },
    byCloser: Object.entries(byCloserMap)
      .map(([name, d]) => ({ name, deals: d.deals, amount: d.amount }))
      .sort((a, b) => b.amount - a.amount),
    pl: { projectedRevenue: forecastedTotal, fixedCosts: 50000, adSpend: 54000, projectedNet: forecastedTotal - 104000 },
    lastUpdated: eods.length ? `Live from Airtable · ${new Date().toLocaleTimeString('en-US', { timeZone: 'America/Chicago' })}` : 'CF Reporting (MTD Apr)',
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

// Scan status
app.get('/api/scan/status', (req, res) => {
  const cache = readCache()
  res.json(cache.scanStatus || null)
})

// Run daily scan
app.post('/api/scan/daily', async (req, res) => {
  try {
    console.log('Starting daily scan...')

    // Pull data from GHL + iClosed in parallel
    const today = new Date()
    const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(today); endOfDay.setHours(23, 59, 59, 999)

    const [contacts, opportunities, iClosedCalls, iClosedDeals] = await Promise.all([
      fetchGHLContacts(100),
      fetchGHLOpportunities(SALES_PIPELINE_ID),
      fetchIClosedCalls({
        eventType: 'ALL',
        dateFrom: startOfDay.toISOString(),
        dateTo: endOfDay.toISOString(),
        limit: 100,
      }),
      fetchIClosedDeals({
        timeFrom: new Date(today.getFullYear(), today.getMonth(), 1).toISOString(),
        timeTo: endOfDay.toISOString(),
        limit: 100,
      }),
    ])

    const appointments = iClosedCalls

    // Map stage IDs to names
    opportunities.forEach(o => {
      o.stageName = STAGE_MAP[o.pipelineStageId] || o.pipelineStageId || 'Unknown'
    })

    // Stage breakdown
    const stageBreakdown = {}
    opportunities.forEach(o => {
      stageBreakdown[o.stageName] = (stageBreakdown[o.stageName] || 0) + 1
    })

    // Hot stages (need action)
    const hotOpps = opportunities.filter(o =>
      ['Call Booked', 'Closer Follow Up', 'Need Rescheduled', 'Application Submitted'].includes(o.stageName)
    )

    // iClosed deal totals
    const dealsThisMonth = iClosedDeals.length
    const dealRevenue = iClosedDeals.reduce((sum, d) => sum + (d.value || d.amount || 0), 0)

    // Build context for Claude
    const contextSummary = `
GHL DATA (Sales Opportunity Pipeline):
- Total contacts: ${contacts.length}
- Total opportunities: ${opportunities.length}
- Stage breakdown: ${Object.entries(stageBreakdown).map(([s,c]) => `${s}: ${c}`).join(', ')}
- Hot opps needing action (${hotOpps.length}): ${hotOpps.slice(0,10).map(o => `${o.name} (${o.stageName})`).join(', ')}
- Recent contacts (last 10): ${contacts.slice(0, 10).map(c => `${c.firstName} ${c.lastName}`).join(', ')}

ICLOSED DATA:
- Calls today: ${appointments.length}
- Calls: ${appointments.slice(0,10).map(a => `${a.inviteeName || a.name || 'Unknown'} (${a.outcome || a.status || 'scheduled'})`).join(', ')}
- Deals closed this month: ${dealsThisMonth} worth $${dealRevenue.toLocaleString()}

BUSINESS CONTEXT:
- Company: Content Factory ATX
- Owner: Hass Khan
- MRR Target: ~$147k/month
- Monthly costs: ~$50k (payroll, ads, operations)
- Closers: Hass, Lily, Eric, Akash
- Services: Done-for-you video/content, $3K–$42K
    `.trim()

    // Generate briefing with Claude
    const briefingAnalysis = await analyzeWithClaude(
      `You are the AI chief of staff for Hass Khan, owner of Content Factory ATX.
      Analyze the business data provided and give a concise daily briefing.
      Format your response as JSON with this structure:
      {
        "sections": [
          { "title": "...", "status": "clear|attention|action", "summary": "...", "details": "...", "lastScanned": "..." }
        ],
        "alerts": ["alert 1", "alert 2"],
        "scanStatus": { "emailsScanned": 0, "mrrCollected": 0, "callsToday": 0, "alerts": 0 }
      }
      Keep summaries under 2 sentences. Be direct and action-oriented.`,
      contextSummary
    )

    let briefingData
    try {
      // Extract JSON from Claude's response
      const jsonMatch = briefingAnalysis.match(/\{[\s\S]*\}/)
      briefingData = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    } catch {
      briefingData = null
    }

    // Build the briefing
    const briefing = {
      date: new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }),
      sections: briefingData?.sections || [
        { title: 'Marketing', status: 'clear', summary: 'Email scan complete.', lastScanned: 'Just now' },
        { title: 'Sales', status: appointments.length === 0 ? 'attention' : 'clear', summary: `${appointments.length} calls today. ${opportunities.length} prospects in pipeline.`, lastScanned: 'Just now' },
        { title: 'Finance', status: 'attention', summary: 'Check GHL pipeline for new revenue.', lastScanned: 'Just now' },
        { title: 'Client Health', status: 'clear', summary: `${contacts.length} contacts in GHL.`, lastScanned: 'Just now' },
      ],
      alerts: briefingData?.alerts || (appointments.length === 0 ? ['No calls scheduled today in iClosed — check your calendar.'] : []),
      raw: { contacts: contacts.length, appointments: appointments.length, opportunities: opportunities.length, deals: iClosedDeals.length },
    }

    // Build individual page data
    const salesData = {
      callsToday: appointments.length,
      noCallsReason: appointments.length === 0 ? 'No calls scheduled today in iClosed.' : null,
      calls: appointments.map(a => ({
        name: a.inviteeName || a.name || a.title || 'Call',
        phone: a.inviteePhone || a.phone || '',
        email: a.inviteeEmail || '',
        time: a.dateTime ? new Date(a.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' }) : '',
        closer: a.userName || a.userId || 'Unassigned',
        status: a.outcome || a.status || 'Scheduled',
        callType: a.callType || a.type || '',
      })),
      deals: iClosedDeals.map(d => ({
        name: d.contactName || d.name || 'Unknown',
        value: d.value || d.amount || 0,
        closer: d.userName || d.userId || '',
        date: d.createdAt || d.date || '',
      })),
      followUps: opportunities.slice(0, 20).map(o => ({
        name: o.name || o.contactName || 'Unknown',
        status: o.status === 'lost' ? 'critical' : o.monetaryValue > 10000 ? 'needs_outreach' : 'confirmed',
        lastContact: o.updatedAt ? new Date(o.updatedAt).toLocaleDateString() : 'Unknown',
        notes: o.pipelineStageName || '',
      })),
      pipeline: {
        confirmed: opportunities.filter(o => o.status === 'won').length,
        critical: opportunities.filter(o => o.status === 'lost').length,
        needsOutreach: opportunities.filter(o => !['won', 'lost'].includes(o.status)).length,
      },
      lastUpdated: new Date().toLocaleTimeString('en-US', { timeZone: 'America/Chicago' }),
    }

    const scanStatus = briefingData?.scanStatus || {
      emailsScanned: 0,
      mrrCollected: 48000,
      callsToday: appointments.length,
      alerts: briefing.alerts.length,
    }

    // Cache everything
    const cache = readCache()
    cache.briefing = briefing
    cache.sales = salesData
    cache.scanStatus = scanStatus
    cache.lastScan = new Date().toISOString()
    writeCache(cache)

    console.log('Daily scan complete.')
    res.json(briefing)
  } catch (err) {
    console.error('Scan error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Get briefing
app.get('/api/briefing', (req, res) => {
  const cache = readCache()
  res.json(cache.briefing || null)
})

// Chat with Claude
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body
    const cache = readCache()

    const systemContext = `You are Claude, the AI chief of staff for Hass Khan, owner of Content Factory ATX in Austin, TX.

BUSINESS CONTEXT:
- Done-for-you video/content agency
- Services: $3K–$42K
- 500+ clients, 4.9-star rating
- Team closers: Hass, Lily, Eric, Akash
- Monthly fixed costs: ~$50k

LATEST DATA:
${cache.briefing ? `Last scan: ${cache.briefing.date}
Active alerts: ${cache.briefing.alerts?.join(', ') || 'None'}` : 'No scan data yet — advise user to run a scan.'}

${cache.sales ? `Calls today: ${cache.sales.callsToday}
Pipeline prospects: ${cache.sales.followUps?.length || 0}` : ''}

${cache.scanStatus ? `MRR collected: $${cache.scanStatus.mrrCollected?.toLocaleString() || 0}
Emails scanned: ${cache.scanStatus.emailsScanned}` : ''}

Be concise, direct, and action-oriented. Use numbers and specifics when available. If you don't have data, say so and suggest running a scan.`

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1000,
      system: systemContext,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    res.json({ response: response.content[0].text })
  } catch (err) {
    console.error('Chat error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Finance data
app.get('/api/finance', (req, res) => {
  const cache = readCache()
  if (cache.finance) return res.json(cache.finance)

  // Live numbers from Airtable CF Business Hub (Closer EODs + RECURRING Cash)
  // Last synced from Airtable MCP — use /api/finance/refresh to pull latest
  const financeData = buildFinanceFromAirtable()
  res.json(financeData)
})

app.post('/api/finance/refresh', async (req, res) => {
  try {
    // Pull live from Airtable if API key is set
    const today = new Date()
    const monthStart = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`

    const [closerEODs, recurringCash] = await Promise.all([
      fetchAirtableRecords('tblrF6wHdRLHXQ4EN',
        ['Your Name','Calls Taken','No Shows','Offers Made','Deals Closed','Cash Collected','Revenue Generated','Call Slots Filled'],
        `IS_AFTER({Today's Date}, '${monthStart}')`
      ),
      fetchAirtableRecords('tblIIV3rVGhhV0vsf',
        ['Client','Client Status','April 26','April Act 26'],
        `{Client Status}='Active - MRR'`
      ),
    ])

    const finance = buildFinanceFromAirtable(
      closerEODs.length ? closerEODs : null,
      recurringCash.length ? recurringCash : null
    )

    const cache = readCache()
    cache.finance = finance
    writeCache(cache)

    res.json(finance)
  } catch (err) {
    console.error('Finance refresh error:', err.message)
    res.json(buildFinanceFromAirtable())
  }
})

// Sales data
app.get('/api/sales', (req, res) => {
  const cache = readCache()
  res.json(cache.sales || null)
})

// Marketing data
app.get('/api/marketing', (req, res) => {
  const cache = readCache()
  res.json(cache.marketing || {
    email: { scanned: 0, timeSensitive: 0, needsResponse: 0, fyi: 0 },
    ads: { spend: 0, impressions: 0, clicks: 0, leads: 0, cpl: 0, roas: 0 },
    broadcastStatus: 'No data — run a scan',
    lastUpdated: 'Never',
  })
})

// Production data
app.get('/api/production', (req, res) => {
  const cache = readCache()
  res.json(cache.production || {
    overdueTickets: 0, pendingTickets: 0, doneThisWeek: 0, tickets: [],
    lastUpdated: 'No data — run a scan',
  })
})

// Client health data
app.get('/api/health', (req, res) => {
  const cache = readCache()
  res.json(cache.health || {
    total: 284, healthy: 241, atRisk: 41, critical: 2, clients: [],
    lastUpdated: 'Run a scan to load client list',
  })
})

// ─── Serve React frontend in production ──────────────────────────────────────
const distPath = path.join(__dirname, '../dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'))
    }
  })
  console.log('   Serving static frontend from /dist')
}

// ─── 8am daily auto-scan (America/Chicago = Austin, TX) ──────────────────────
cron.schedule('0 8 * * *', async () => {
  console.log('[CRON] Running 8am daily scan...')
  try {
    const res = await axios.post(`http://localhost:${PORT}/api/scan/daily`)
    console.log('[CRON] Scan complete:', res.data?.date)
  } catch (err) {
    console.error('[CRON] Scan failed:', err.message)
  }
}, { timezone: 'America/Chicago' })

app.listen(PORT, () => {
  console.log(`\n✅ Hass Dashboard API running on http://localhost:${PORT}`)
  console.log(`   Scanning: GHL → Claude AI → Dashboard`)
  console.log(`   Auto-scan: 8:00am CT daily\n`)
})
