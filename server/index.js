import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import cron from 'node-cron'
import { MARCH_PAYROLL } from './payroll-march.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '../.env')
// Load .env if present (local dev), otherwise rely on injected env vars (Render/production)
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8')
  for (const line of envFile.split('\n')) {
    const [key, ...vals] = line.split('=')
    if (key && key.trim() && vals.length) process.env[key.trim()] = vals.join('=').trim()
  }
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

// ─── Hyros API ───────────────────────────────────────────────────────────────
const HYROS_BASE = 'https://api.hyros.com/v1/api/v1.0'

function hyrosHeaders() {
  return { 'API-Key': process.env.HYROS_API_KEY }
}

async function fetchHyrosLeads({ limit = 50, page = 1 } = {}) {
  try {
    const res = await axios.get(`${HYROS_BASE}/leads`, {
      headers: hyrosHeaders(),
      params: { limit, page },
    })
    return res.data?.result || []
  } catch (e) {
    console.error('Hyros leads error:', e.response?.status, e.message)
    return []
  }
}

async function fetchHyrosSales({ limit = 50, page = 1 } = {}) {
  try {
    const res = await axios.get(`${HYROS_BASE}/sales`, {
      headers: hyrosHeaders(),
      params: { limit, page },
    })
    return res.data?.result || []
  } catch (e) {
    console.error('Hyros sales error:', e.response?.status, e.message)
    return []
  }
}

async function fetchHyrosCalls({ limit = 50, page = 1 } = {}) {
  try {
    const res = await axios.get(`${HYROS_BASE}/calls`, {
      headers: hyrosHeaders(),
      params: { limit, page },
    })
    return res.data?.result || []
  } catch (e) {
    console.error('Hyros calls error:', e.response?.status, e.message)
    return []
  }
}

async function fetchHyrosMarketingData() {
  // Get current month's date range
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Paginate leads to get all for current month
  const allLeads = []
  for (let page = 1; page <= 25; page++) {
    const leads = await fetchHyrosLeads({ limit: 50, page })
    if (!leads.length) break
    const monthLeads = leads.filter(l => (l.creationDate || '').startsWith(monthPrefix))
    allLeads.push(...monthLeads)
    // If fewer month leads than total, we've gone past the month
    if (monthLeads.length < leads.length && page > 1) break
  }

  // Get sales
  const sales = await fetchHyrosSales({ limit: 50 })
  const monthName = now.toLocaleString('en-US', { month: 'short' })
  const monthSales = sales.filter(s => {
    const date = s.creationDate || ''
    return date.includes('2026') && date.includes(monthName)
  })

  // Aggregate by source
  const bySource = {}
  const byCampaign = {} // { campaign: { leads, sourceName, firstLead } }
  for (const lead of allLeads) {
    const fs = lead.firstSource || {}
    const src = fs.trafficSource?.name || 'unknown'
    const campaign = fs.category?.name || 'uncategorized'
    const sourceLinkName = fs.name || ''
    bySource[src] = (bySource[src] || 0) + 1
    if (!byCampaign[campaign]) {
      byCampaign[campaign] = { leads: 0, sales: 0, revenue: 0, sourceLinks: new Set(), source: src }
    }
    byCampaign[campaign].leads += 1
    if (sourceLinkName) byCampaign[campaign].sourceLinks.add(sourceLinkName)
  }

  // Attribute sales to campaigns via lead's firstSource
  for (const sale of monthSales) {
    const lead = sale.lead
    if (!lead) continue
    // Sales API doesn't have full source info, so look up the lead from leads list
    const fullLead = allLeads.find(l => l.email === lead.email || l.id === lead.id)
    const campaign = fullLead?.firstSource?.category?.name || 'uncategorized'
    if (!byCampaign[campaign]) {
      byCampaign[campaign] = { leads: 0, sales: 0, revenue: 0, sourceLinks: new Set(), source: 'unknown' }
    }
    byCampaign[campaign].sales += 1
    byCampaign[campaign].revenue += sale.usdPrice?.price || 0
  }

  const totalRevenue = monthSales.reduce((sum, s) => sum + (s.usdPrice?.price || 0), 0)
  const totalLeads = allLeads.length
  const facebookLeads = bySource.facebook || 0
  const organicLeads = totalLeads - facebookLeads - (bySource.unknown || 0)

  // Pull calls MTD from Hyros (paginated)
  const allCalls = []
  for (let page = 1; page <= 25; page++) {
    const calls = await fetchHyrosCalls({ limit: 50, page })
    if (!calls.length) break
    const monthCalls = calls.filter(c => {
      const date = c.creationDate || ''
      return date.includes('2026') && date.includes(monthName)
    })
    allCalls.push(...monthCalls)
    if (monthCalls.length < calls.length && page > 1) break
  }
  const qualifiedCalls = allCalls.filter(c => c.state === 'QUALIFIED').length
  const cancelledCalls = allCalls.filter(c => c.state === 'CANCELLED').length
  const callsBooked = allCalls.length

  // Attribute calls to campaigns
  for (const call of allCalls) {
    const campaign = call.firstSource?.category?.name || 'uncategorized'
    if (byCampaign[campaign]) {
      byCampaign[campaign].calls = (byCampaign[campaign].calls || 0) + 1
    }
  }

  // Estimate spend from $1,800/day baseline until Facebook Ads API is wired up
  const daysSoFar = Math.ceil((Date.now() - monthStart.getTime()) / (1000 * 60 * 60 * 24))
  const estimatedSpend = daysSoFar * 1800
  const cpl = facebookLeads > 0 ? estimatedSpend / facebookLeads : 0
  // Cost per call uses qualified calls (excludes cancellations) as the real metric
  const cpc = qualifiedCalls > 0 ? estimatedSpend / qualifiedCalls : 0
  const roas = estimatedSpend > 0 ? totalRevenue / estimatedSpend : 0

  // Build top campaigns with revenue + ROAS
  // Distribute estimated spend proportionally based on lead share
  const topCampaigns = Object.entries(byCampaign)
    .map(([name, d]) => {
      const leadShare = totalLeads > 0 ? d.leads / totalLeads : 0
      const estimatedCampaignSpend = estimatedSpend * leadShare
      const campaignRoas = estimatedCampaignSpend > 0 ? d.revenue / estimatedCampaignSpend : 0
      const campaignCalls = d.calls || 0
      const costPerCampaignCall = campaignCalls > 0 ? estimatedCampaignSpend / campaignCalls : 0
      return {
        name,
        leads: d.leads,
        calls: campaignCalls,
        sales: d.sales,
        revenue: d.revenue,
        estimatedSpend: Math.round(estimatedCampaignSpend),
        costPerCall: parseFloat(costPerCampaignCall.toFixed(0)),
        roas: parseFloat(campaignRoas.toFixed(2)),
        source: d.source,
        topAds: Array.from(d.sourceLinks).slice(0, 3),
      }
    })
    .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads)
    .slice(0, 10)

  return {
    period: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    leads: {
      total: totalLeads,
      facebook: facebookLeads,
      organic: organicLeads,
      unknown: bySource.unknown || 0,
      bySource,
    },
    topCampaigns,
    sales: {
      count: monthSales.length,
      revenue: totalRevenue,
      deals: monthSales.map(s => ({
        name: `${s.lead?.firstName || ''} ${s.lead?.lastName || ''}`.trim() || s.lead?.email || 'Unknown',
        amount: s.usdPrice?.price || 0,
        date: s.creationDate,
      })).sort((a, b) => b.amount - a.amount),
    },
    calls: {
      booked: callsBooked,
      qualified: qualifiedCalls,
      cancelled: cancelledCalls,
      costPerCall: parseFloat(cpc.toFixed(0)),
    },
    spend: {
      estimated: estimatedSpend,
      dailyRate: 1800,
      daysSoFar,
      source: 'baseline estimate (Hyros API does not expose spend)',
    },
    metrics: {
      cpl: parseFloat(cpl.toFixed(0)),
      cpc: parseFloat(cpc.toFixed(0)),
      roas: parseFloat(roas.toFixed(2)),
      conversionRate: totalLeads > 0 ? parseFloat((monthSales.length / totalLeads * 100).toFixed(2)) : 0,
    },
    lastUpdated: new Date().toLocaleTimeString('en-US', { timeZone: 'America/Chicago' }),
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

// ─── QuickBooks OAuth 2.0 ────────────────────────────────────────────────────
const QB_CLIENT_ID = process.env.QB_CLIENT_ID
const QB_CLIENT_SECRET = process.env.QB_CLIENT_SECRET
const QB_REDIRECT_URI = `http://localhost:${PORT}/api/qb/callback`
const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const QB_API_BASE = 'https://quickbooks.api.intuit.com/v3'

// Store tokens in cache
function getQBTokens() {
  const cache = readCache()
  return cache.qbTokens || null
}

function saveQBTokens(tokens) {
  const cache = readCache()
  cache.qbTokens = { ...tokens, savedAt: new Date().toISOString() }
  writeCache(cache)
}

async function refreshQBToken() {
  const tokens = getQBTokens()
  if (!tokens?.refresh_token) return null
  try {
    const res = await axios.post(QB_TOKEN_URL, new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
    }).toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString('base64'),
      },
    })
    const newTokens = { ...res.data, realmId: tokens.realmId }
    saveQBTokens(newTokens)
    return newTokens
  } catch (e) {
    console.error('QB token refresh error:', e.response?.data || e.message)
    return null
  }
}

async function qbApiCall(endpoint) {
  let tokens = getQBTokens()
  if (!tokens?.access_token) return null

  const url = `${QB_API_BASE}/company/${tokens.realmId}${endpoint}`
  try {
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: 'application/json',
      },
    })
    return res.data
  } catch (e) {
    if (e.response?.status === 401) {
      // Token expired, try refresh
      tokens = await refreshQBToken()
      if (!tokens) return null
      const retry = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: 'application/json',
        },
      })
      return retry.data
    }
    console.error('QB API error:', e.response?.status, e.response?.data || e.message)
    return null
  }
}

async function fetchQBProfitAndLoss(startDate, endDate) {
  const data = await qbApiCall(`/reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}&minorversion=65`)
  if (!data?.QueryResponse && !data?.Rows && !data?.Header) {
    // Try alternate response structure
    return data
  }
  return data
}

async function fetchQBExpenses(startDate, endDate) {
  const plData = await fetchQBProfitAndLoss(startDate, endDate)
  if (!plData) return null

  // Parse the QB P&L report into expense categories
  const expenses = { categories: [], totalExpenses: 0 }

  function parseRows(rows, depth = 0) {
    if (!rows?.Row) return
    for (const row of rows.Row) {
      if (row.type === 'Section' && row.Header) {
        const sectionName = row.Header.ColData?.[0]?.value || ''
        if (row.Summary) {
          const total = parseFloat(row.Summary.ColData?.[1]?.value || '0')
          if (sectionName && total && !sectionName.includes('Income') && !sectionName.includes('Revenue')) {
            expenses.categories.push({ name: sectionName, amount: Math.abs(total), items: [] })
          }
        }
        // Parse sub-items
        if (row.Rows?.Row) {
          const cat = expenses.categories[expenses.categories.length - 1]
          for (const subRow of row.Rows.Row) {
            if (subRow.type === 'Data' && subRow.ColData) {
              const itemName = subRow.ColData[0]?.value || ''
              const itemAmount = parseFloat(subRow.ColData[1]?.value || '0')
              if (itemName && itemAmount && cat) {
                cat.items.push({ name: itemName, amount: Math.abs(itemAmount) })
              }
            }
          }
        }
      }
    }
  }

  try {
    parseRows(plData.Rows || plData)
    expenses.totalExpenses = expenses.categories.reduce((sum, c) => sum + c.amount, 0)
  } catch (e) {
    console.error('QB parse error:', e.message)
  }

  return expenses
}

// ─── CF Internal Tools (Production Costs) ───────────────────────────────────
const CF_TOOLS_API = 'https://script.google.com/macros/s/AKfycby2DsJbHWtk_GFioBcZZmMSO2npyjPpiq5RD8RIbdVSbeIuT0CBChDi_7-7vXSZuecx/exec'

// Per-task rates by content type (matches cfinternaltools rates panel)
const TASK_RATES = {
  Video: 20, Ad: 15, Thumbnail: 5, Carousel: 10, Static: 5,
}

async function fetchProductionCosts() {
  try {
    const res = await axios.get(CF_TOOLS_API, { maxRedirects: 5, timeout: 15000 })
    const tasks = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.tasks || [])

    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    // Group by month and calculate costs
    const byEditor = {}
    let totalCost = 0
    let taskCount = 0

    for (const task of tasks) {
      // Determine task type and calculate cost
      const name = (task['Task Name'] || task.name || task.task || '').toString()
      const editor = task['Assigned'] || task.assigned || task.editor || 'Unassigned'
      const status = (task['Status'] || task.status || '').toString().toLowerCase()

      // Determine content type from task name patterns
      let type = 'Video'
      if (/^T-/i.test(name) || /thumbnail/i.test(name)) type = 'Thumbnail'
      else if (/^Ad-/i.test(name) || /\bad\b/i.test(name)) type = 'Ad'
      else if (/carousel/i.test(name)) type = 'Carousel'
      else if (/static/i.test(name)) type = 'Static'

      const cost = TASK_RATES[type] || 15

      if (!byEditor[editor]) byEditor[editor] = { tasks: 0, cost: 0 }
      byEditor[editor].tasks += 1
      byEditor[editor].cost += cost
      totalCost += cost
      taskCount += 1
    }

    return {
      totalCost,
      taskCount,
      byEditor: Object.entries(byEditor)
        .map(([name, d]) => ({ name, tasks: d.tasks, cost: d.cost }))
        .sort((a, b) => b.cost - a.cost),
      month: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    }
  } catch (e) {
    console.error('CF Tools error:', e.message)
    return null
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
  // Tries April columns first, falls back to most recent actual (March/Feb)
  const recurring = recurringCash || []
  let mrrExpected = 0, mrrCollected = 0
  for (const r of recurring) {
    const f = r.fields || r.cellValuesByFieldId || {}
    // April columns first, then fall back to March projected, then Feb actual
    const expected = Number(f['April 26'] || f['March 26'] || f['Feb 26 Act'] || 0)
    const collected = Number(f['April Act 26'] || 0)
    mrrExpected += expected
    mrrCollected += collected
  }

  // Fall back to live Airtable pull if EODs not fetched
  if (!eods.length) {
    // Keep totalCash/totalRev as 0 — will show blank rather than wrong hardcoded data
  }
  if (!recurring.length) {
    // No recurring data — use last known baseline from March
    mrrExpected = 129225; mrrCollected = 0
  }

  const mrrRemaining = mrrExpected - mrrCollected
  const showRate = totalCallSlots > 0 ? (totalCallsTaken / totalCallSlots) * 100 : 0
  const closeRate = totalCallsTaken > 0 ? (totalDeals / totalCallsTaken) * 100 : 0
  const dollarPerBookedCall = totalCallSlots > 0 ? totalCash / totalCallSlots : 0

  // Forecasted = MRR (full month) + new cash projected at current daily pace
  const today = new Date()
  const dayOfMonth = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const dailyNewCashPace = dayOfMonth > 0 ? totalCash / dayOfMonth : 0
  const projectedNewCash = Math.round(dailyNewCashPace * daysInMonth)
  const forecastedTotal = mrrExpected + projectedNewCash
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
    pl: {
      projectedRevenue: forecastedTotal,
      ownersDraw: 35000,
      adSpend: 54000,
      // Fixed monthly overhead from QuickBooks March P&L (stays ~same each month)
      fixedOverhead: {
        softwareApps: 12863,
        rentBuilding: 12000,
        officeUtilities: 1695,
        legalAccounting: 2119,
        bankMerchantFees: 7469,
        insurance: 750,
        memberships: 1500,
        officeExpenses: 655,
        adminLabor: 859,
        travel: 1632,
        meals: 320,
        interest: 998,
        vehicle: 28,
      },
      marchCOGS: 81454,
    },
    lastUpdated: eods.length ? `Live from Airtable · ${new Date().toLocaleTimeString('en-US', { timeZone: 'America/Chicago' })}` : 'CF Reporting (MTD Apr)',
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

// ─── QuickBooks OAuth Routes ────────────────────────────────────────────────
// Step 1: Start OAuth flow — user visits this URL
app.get('/api/qb/connect', (req, res) => {
  const authUrl = `${QB_AUTH_URL}?client_id=${QB_CLIENT_ID}&redirect_uri=${encodeURIComponent(QB_REDIRECT_URI)}&response_type=code&scope=com.intuit.quickbooks.accounting&state=dashboard`
  res.redirect(authUrl)
})

// Step 2: OAuth callback — Intuit redirects here with auth code
app.get('/api/qb/callback', async (req, res) => {
  const { code, realmId } = req.query
  if (!code) return res.status(400).send('No authorization code received')

  try {
    const tokenRes = await axios.post(QB_TOKEN_URL, new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: QB_REDIRECT_URI,
    }).toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString('base64'),
      },
    })

    saveQBTokens({ ...tokenRes.data, realmId })
    console.log('QuickBooks connected! RealmId:', realmId)
    res.redirect('/finance?qb=connected')
  } catch (e) {
    console.error('QB OAuth error:', e.response?.data || e.message)
    res.status(500).send('QuickBooks connection failed: ' + (e.response?.data?.error || e.message))
  }
})

// Step 3: Check connection status
app.get('/api/qb/status', (req, res) => {
  const tokens = getQBTokens()
  res.json({
    connected: !!tokens?.access_token,
    realmId: tokens?.realmId || null,
    connectedAt: tokens?.savedAt || null,
  })
})

// Step 4: Pull expenses from QuickBooks
app.get('/api/qb/expenses', async (req, res) => {
  const tokens = getQBTokens()
  if (!tokens?.access_token) {
    return res.json({ connected: false, error: 'Not connected. Visit /api/qb/connect to authorize.' })
  }

  const now = new Date()
  const startDate = req.query.start || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const endDate = req.query.end || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const cache = readCache()
  // Return cached if less than 1 hour old and same date range
  if (cache.qbExpenses?.startDate === startDate && cache.qbExpenses?.endDate === endDate &&
      cache.qbExpensesUpdated && (Date.now() - new Date(cache.qbExpensesUpdated).getTime()) < 3600000) {
    return res.json(cache.qbExpenses)
  }

  const expenses = await fetchQBExpenses(startDate, endDate)
  if (expenses) {
    const result = { ...expenses, startDate, endDate, connected: true, lastUpdated: new Date().toLocaleTimeString('en-US', { timeZone: 'America/Chicago' }) }
    const c = readCache()
    c.qbExpenses = result
    c.qbExpensesUpdated = new Date().toISOString()
    writeCache(c)
    return res.json(result)
  }

  res.json(cache.qbExpenses || { connected: true, categories: [], totalExpenses: 0, error: 'Failed to fetch' })
})

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

    const [contacts, opportunities, iClosedCallsRaw, iClosedDealsRaw, productionCosts] = await Promise.all([
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
      fetchProductionCosts(),
    ])

    // Normalize iClosed responses — API may return object or array
    const iClosedCalls = Array.isArray(iClosedCallsRaw) ? iClosedCallsRaw : (iClosedCallsRaw?.data || iClosedCallsRaw?.calls || iClosedCallsRaw?.results || [])
    const iClosedDeals = Array.isArray(iClosedDealsRaw) ? iClosedDealsRaw : (iClosedDealsRaw?.data || iClosedDealsRaw?.deals || iClosedDealsRaw?.results || [])

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
    if (productionCosts) cache.productionCosts = productionCosts
    cache.lastScan = new Date().toISOString()
    writeCache(cache)

    console.log('Daily scan complete.')
    res.json(briefing)
  } catch (err) {
    console.error('Scan error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Production costs from CF Internal Tools
app.get('/api/production-costs', async (req, res) => {
  const cache = readCache()
  // Return cached if less than 1 hour old
  if (cache.productionCosts && cache.productionCostsUpdated && (Date.now() - new Date(cache.productionCostsUpdated).getTime()) < 3600000) {
    return res.json(cache.productionCosts)
  }
  const costs = await fetchProductionCosts()
  if (costs) {
    const c = readCache()
    c.productionCosts = costs
    c.productionCostsUpdated = new Date().toISOString()
    writeCache(c)
  }
  res.json(costs || cache.productionCosts || { totalCost: 0, taskCount: 0, byEditor: [] })
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

// Payroll data — from March 2026 payroll PDF (source of truth)
app.get('/api/payroll', (req, res) => {
  res.json(MARCH_PAYROLL)
})

// Finance data — always redirects to refresh for live data
app.get('/api/finance', async (req, res) => {
  try {
    // Always pull live from Airtable so numbers are never stale
    const today = new Date()
    const dayBeforeMonthStart = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`
    const prevDay = new Date(dayBeforeMonthStart)
    prevDay.setDate(prevDay.getDate() - 1)
    const filterDate = `${prevDay.getFullYear()}-${String(prevDay.getMonth()+1).padStart(2,'0')}-${String(prevDay.getDate()).padStart(2,'0')}`

    const [closerEODs, recurringCash, newCashRecords] = await Promise.all([
      fetchAirtableRecords('tblrF6wHdRLHXQ4EN',
        ['Your Name','Calls Taken','No Shows','Offers Made','Deals Closed','Cash Collected','Revenue Generated','Call Slots Filled'],
        `IS_AFTER({Today's Date}, '${filterDate}')`
      ),
      fetchAirtableRecords('tblIIV3rVGhhV0vsf',
        ['Client','Client Status','April 26','April Act 26','March 26','Feb 26 Act'],
        `{Client Status}='Active - MRR'`
      ),
      fetchAirtableRecords('tblQDgLyWasv8T7Qz',
        ['Client / Deal Name','Cash Collected','Rev Generated','Closer Name','Date Closed','Service','Sale Type'],
        `IS_AFTER({Date Closed}, '${filterDate}')`
      ),
    ])

    const finance = buildFinanceFromAirtable(
      closerEODs.length ? closerEODs : null,
      recurringCash.length ? recurringCash : null
    )

    if (newCashRecords.length) {
      let cashCollected = 0, revGenerated = 0
      for (const r of newCashRecords) {
        const f = r.fields || {}
        cashCollected += Number(f['Cash Collected'] || 0)
        revGenerated += Number(f['Rev Generated'] || f['Revenue Generated'] || 0)
      }
      const today2 = new Date()
      const dom = today2.getDate()
      const dim = new Date(today2.getFullYear(), today2.getMonth() + 1, 0).getDate()
      const projNew = Math.round((cashCollected / dom) * dim)
      finance.newCash.collected = cashCollected
      finance.newCash.revenue = revGenerated
      finance.newCash.forecastedTotal = finance.mrr.expected + projNew
      finance.pl.projectedRevenue = finance.newCash.forecastedTotal
    }

    // Cache for 30 min to avoid hammering Airtable
    const cache = readCache()
    cache.finance = finance
    cache.financeCachedAt = Date.now()
    writeCache(cache)

    res.json(finance)
  } catch (e) {
    console.error('Finance live fetch failed:', e.message)
    const cache = readCache()
    res.json(cache.finance || buildFinanceFromAirtable())
  }
})

app.post('/api/finance/refresh', async (req, res) => {
  try {
    // Pull live from Airtable if API key is set
    const today = new Date()
    // Use day BEFORE month start so IS_AFTER includes the 1st of the month
    const dayBeforeMonthStart = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`
    const prevDay = new Date(dayBeforeMonthStart)
    prevDay.setDate(prevDay.getDate() - 1)
    const filterDate = `${prevDay.getFullYear()}-${String(prevDay.getMonth()+1).padStart(2,'0')}-${String(prevDay.getDate()).padStart(2,'0')}`

    const [closerEODs, recurringCash, newCashRecords] = await Promise.all([
      fetchAirtableRecords('tblrF6wHdRLHXQ4EN',
        ['Your Name','Calls Taken','No Shows','Offers Made','Deals Closed','Cash Collected','Revenue Generated','Call Slots Filled'],
        `IS_AFTER({Today's Date}, '${filterDate}')`
      ),
      fetchAirtableRecords('tblIIV3rVGhhV0vsf',
        ['Client','Client Status','April 26','April Act 26'],
        `{Client Status}='Active - MRR'`
      ),
      fetchAirtableRecords('tblQDgLyWasv8T7Qz',
        ['Client / Deal Name','Cash Collected','Rev Generated','Closer Name','Date Closed','Service','Sale Type'],
        `IS_AFTER({Date Closed}, '${filterDate}')`
      ),
    ])

    const finance = buildFinanceFromAirtable(
      closerEODs.length ? closerEODs : null,
      recurringCash.length ? recurringCash : null
    )

    // Override new cash with data from NEW Cash table (source of truth)
    if (newCashRecords.length) {
      let cashCollected = 0, revGenerated = 0
      const byCloserMap = {}
      for (const r of newCashRecords) {
        const f = r.fields || r.cellValuesByFieldId || {}
        const cash = Number(f['Cash Collected'] || f['fldwBOUnG9olgOJe2'] || 0)
        const rev = Number(f['Rev Generated'] || f['fld1KJdXQYr2Bm0pp'] || 0)
        const closerRaw = f['Closer Name'] || f['fldiXMFl9agUUDFtc']
        const closer = Array.isArray(closerRaw) ? (closerRaw[0]?.name || closerRaw[0] || '').toString() : (closerRaw?.name || closerRaw || '').toString()
        cashCollected += cash
        revGenerated += rev
        if (closer) {
          if (!byCloserMap[closer]) byCloserMap[closer] = { deals: 0, amount: 0 }
          byCloserMap[closer].deals += 1
          byCloserMap[closer].amount += cash
        }
      }
      const today3 = new Date()
      const dom3 = today3.getDate()
      const dim3 = new Date(today3.getFullYear(), today3.getMonth() + 1, 0).getDate()
      const projNew3 = Math.round((cashCollected / dom3) * dim3)
      finance.newCash.collected = cashCollected
      finance.newCash.revenue = revGenerated
      finance.newCash.deals = newCashRecords.length
      finance.newCash.totalCollected = finance.mrr.collected + cashCollected
      finance.newCash.forecastedTotal = finance.mrr.expected + projNew3
      finance.pl.projectedRevenue = finance.newCash.forecastedTotal
      finance.byCloser = Object.entries(byCloserMap)
        .map(([name, d]) => ({ name, deals: d.deals, amount: d.amount }))
        .sort((a, b) => b.amount - a.amount)
      finance.lastUpdated = `Live from Airtable NEW Cash · ${new Date().toLocaleTimeString('en-US', { timeZone: 'America/Chicago' })}`
    }

    const cache = readCache()
    cache.finance = finance
    writeCache(cache)

    res.json(finance)
  } catch (err) {
    console.error('Finance refresh error:', err.message)
    res.json(buildFinanceFromAirtable())
  }
})

// Sales data - comprehensive dashboard
app.get('/api/sales', async (req, res) => {
  const cache = readCache()
  // Return cached if < 5 min old (shorter so updates flow through)
  if (cache.salesDashboard && cache.salesDashboardUpdated &&
      (Date.now() - new Date(cache.salesDashboardUpdated).getTime()) < 300000) {
    return res.json(cache.salesDashboard)
  }

  try {
    // Use America/Chicago timezone so "today/yesterday" matches the business day
    const ctNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }))
    const ctYesterday = new Date(ctNow)
    ctYesterday.setDate(ctYesterday.getDate() - 1)
    const todayStr = `${ctNow.getFullYear()}-${String(ctNow.getMonth() + 1).padStart(2, '0')}-${String(ctNow.getDate()).padStart(2, '0')}`
    const yesterdayStr = `${ctYesterday.getFullYear()}-${String(ctYesterday.getMonth() + 1).padStart(2, '0')}-${String(ctYesterday.getDate()).padStart(2, '0')}`
    const monthStart = `${ctNow.getFullYear()}-${String(ctNow.getMonth() + 1).padStart(2, '0')}-01`
    const prevDay = new Date(monthStart + 'T12:00:00')
    prevDay.setDate(prevDay.getDate() - 1)
    const filterDate = `${prevDay.getFullYear()}-${String(prevDay.getMonth() + 1).padStart(2, '0')}-${String(prevDay.getDate()).padStart(2, '0')}`

    // Pull everything in parallel
    const [closerEODs, newCashRecords, ghlOpps] = await Promise.all([
      fetchAirtableRecords('tblrF6wHdRLHXQ4EN',
        ['Your Name', "Today's Date", 'Call Slots Filled', 'Calls Taken', 'No Shows', 'Offers Made', 'Deals Closed', 'Cash Collected', 'Revenue Generated'],
        `IS_AFTER({Today's Date}, '${filterDate}')`
      ),
      fetchAirtableRecords('tblQDgLyWasv8T7Qz',
        ['Client / Deal Name', 'Cash Collected', 'Rev Generated', 'Closer Name', 'Date Closed', 'Service', 'Sale Type'],
        `IS_AFTER({Date Closed}, '${filterDate}')`
      ),
      fetchGHLOpportunities(SALES_PIPELINE_ID),
    ])

    // ── Calls: today, yesterday, MTD by closer ──
    const byCloser = {}
    const closerNames = ['Akash', 'Lily', 'Eric', 'Hass']
    for (const name of closerNames) {
      byCloser[name] = {
        callsBookedToday: 0, callsTakenToday: 0, dealsToday: 0, cashToday: 0,
        callsBookedYesterday: 0, callsTakenYesterday: 0, dealsYesterday: 0, cashYesterday: 0,
        callsBookedMTD: 0, callsTakenMTD: 0, noShowsMTD: 0, offersMTD: 0, dealsMTD: 0, cashMTD: 0, revMTD: 0,
      }
    }

    let todayTotals = { booked: 0, taken: 0, deals: 0, cash: 0 }
    let yesterdayTotals = { booked: 0, taken: 0, deals: 0, cash: 0 }
    let mtdTotals = { booked: 0, taken: 0, noShows: 0, offers: 0, deals: 0, cash: 0, rev: 0 }

    for (const r of closerEODs) {
      const f = r.fields || r.cellValuesByFieldId || {}
      const name = (f['Your Name']?.name || f['Your Name'] || '').toString()
      const date = f["Today's Date"] || f['fldvnmr6n167ZxjEL'] || ''
      const booked = Number(f['Call Slots Filled'] || f['fld5hIrV3MfdyHaxo'] || 0)
      const taken = Number(f['Calls Taken'] || f['fld4EsJpqqRPUwlRS'] || 0)
      const noShows = Number(f['No Shows'] || f['fldMR9yyJQ1u097bY'] || 0)
      const offers = Number(f['Offers Made'] || f['fldgMNBxU5NuARIew'] || 0)
      const deals = Number(f['Deals Closed'] || f['fldDQ07efjONEcSu5'] || 0)
      const cash = Number(f['Cash Collected'] || f['fldZfE3C0XTxH2sCj'] || 0)
      const rev = Number(f['Revenue Generated'] || f['fldpP5y7BBEAib2Zw'] || 0)

      mtdTotals.booked += booked; mtdTotals.taken += taken; mtdTotals.noShows += noShows
      mtdTotals.offers += offers; mtdTotals.deals += deals; mtdTotals.cash += cash; mtdTotals.rev += rev

      const isToday = date === todayStr
      const isYesterday = date === yesterdayStr

      if (isToday) {
        todayTotals.booked += booked; todayTotals.taken += taken
        todayTotals.deals += deals; todayTotals.cash += cash
      }
      if (isYesterday) {
        yesterdayTotals.booked += booked; yesterdayTotals.taken += taken
        yesterdayTotals.deals += deals; yesterdayTotals.cash += cash
      }

      if (name && byCloser[name]) {
        byCloser[name].callsBookedMTD += booked
        byCloser[name].callsTakenMTD += taken
        byCloser[name].noShowsMTD += noShows
        byCloser[name].offersMTD += offers
        byCloser[name].dealsMTD += deals
        byCloser[name].cashMTD += cash
        byCloser[name].revMTD += rev
        if (isToday) {
          byCloser[name].callsBookedToday += booked
          byCloser[name].callsTakenToday += taken
          byCloser[name].dealsToday += deals
          byCloser[name].cashToday += cash
        }
        if (isYesterday) {
          byCloser[name].callsBookedYesterday += booked
          byCloser[name].callsTakenYesterday += taken
          byCloser[name].dealsYesterday += deals
          byCloser[name].cashYesterday += cash
        }
      }
    }

    // Compute rates per closer
    const closerStats = Object.entries(byCloser).map(([name, d]) => ({
      name,
      ...d,
      showRate: d.callsBookedMTD > 0 ? parseFloat((d.callsTakenMTD / d.callsBookedMTD * 100).toFixed(1)) : 0,
      closeRate: d.callsTakenMTD > 0 ? parseFloat((d.dealsMTD / d.callsTakenMTD * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.cashMTD - a.cashMTD)

    // ── Recent deals from NEW Cash ──
    const recentDeals = newCashRecords.map(r => {
      const f = r.fields || r.cellValuesByFieldId || {}
      const closerRaw = f['Closer Name'] || f['fldiXMFl9agUUDFtc']
      const closer = Array.isArray(closerRaw) ? (closerRaw[0]?.name || closerRaw[0] || '').toString() : (closerRaw?.name || closerRaw || '').toString()
      return {
        name: f['Client / Deal Name'] || f['fldJm0LHMAzFNq08H'] || 'Unknown',
        cash: Number(f['Cash Collected'] || f['fldwBOUnG9olgOJe2'] || 0),
        revenue: Number(f['Rev Generated'] || f['fld1KJdXQYr2Bm0pp'] || 0),
        closer,
        date: f['Date Closed'] || f['fldJYhT8NaF8Zu9Wc'] || '',
        service: (f['Service']?.name || f['Service'] || '').toString(),
        type: (f['Sale Type']?.name || f['Sale Type'] || '').toString(),
      }
    }).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 15)

    // ── GHL Pipeline Breakdown ──
    const stageBreakdown = {}
    for (const opp of ghlOpps) {
      const stage = STAGE_MAP[opp.pipelineStageId] || 'Unknown'
      stageBreakdown[stage] = (stageBreakdown[stage] || 0) + 1
    }
    const pipelineStages = Object.entries(stageBreakdown)
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => b.count - a.count)

    // ── Hot prospects (need action) ──
    const HOT_STAGES = ['Call Booked', 'Closer Follow Up', 'Need Rescheduled', 'Application Submitted']
    const hotProspects = ghlOpps
      .filter(o => HOT_STAGES.includes(STAGE_MAP[o.pipelineStageId]))
      .map(o => ({
        name: o.name || o.contactName || 'Unknown',
        stage: STAGE_MAP[o.pipelineStageId] || 'Unknown',
        value: o.monetaryValue || 0,
        updatedAt: o.updatedAt || '',
      }))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .slice(0, 20)

    const dashboard = {
      today: todayTotals,
      yesterday: yesterdayTotals,
      mtd: {
        ...mtdTotals,
        showRate: mtdTotals.booked > 0 ? parseFloat((mtdTotals.taken / mtdTotals.booked * 100).toFixed(1)) : 0,
        closeRate: mtdTotals.taken > 0 ? parseFloat((mtdTotals.deals / mtdTotals.taken * 100).toFixed(1)) : 0,
        dollarPerCall: mtdTotals.booked > 0 ? parseFloat((mtdTotals.cash / mtdTotals.booked).toFixed(2)) : 0,
      },
      closerStats,
      recentDeals,
      pipelineStages,
      hotProspects,
      totalOpportunities: ghlOpps.length,
      lastUpdated: new Date().toLocaleTimeString('en-US', { timeZone: 'America/Chicago' }),
    }

    const c = readCache()
    c.salesDashboard = dashboard
    c.salesDashboardUpdated = new Date().toISOString()
    writeCache(c)

    res.json(dashboard)
  } catch (err) {
    console.error('Sales error:', err.message)
    res.json(cache.salesDashboard || { error: err.message })
  }
})

// Marketing data — live from Hyros
app.get('/api/marketing', async (req, res) => {
  const cache = readCache()
  // Return cached if less than 1 hour old
  if (cache.marketing && cache.marketingUpdated && (Date.now() - new Date(cache.marketingUpdated).getTime()) < 3600000) {
    return res.json(cache.marketing)
  }

  try {
    const marketing = await fetchHyrosMarketingData()
    const c = readCache()
    c.marketing = marketing
    c.marketingUpdated = new Date().toISOString()
    writeCache(c)
    res.json(marketing)
  } catch (err) {
    console.error('Marketing error:', err.message)
    res.json(cache.marketing || {
      period: 'No data',
      leads: { total: 0, facebook: 0, organic: 0, bySource: {} },
      topCampaigns: [],
      sales: { count: 0, revenue: 0, deals: [] },
      spend: { estimated: 0, dailyRate: 1800, daysSoFar: 0 },
      metrics: { cpl: 0, roas: 0, conversionRate: 0 },
      lastUpdated: 'Error loading',
    })
  }
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
  app.get('/{*path}', (req, res) => {
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
