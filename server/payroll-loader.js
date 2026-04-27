// Payroll auto-loader
// Reads from /server/payroll/YYYY-MM.js — picks the most recent month available
// To add a new month: create /server/payroll/2026-05.js with the same shape as 2026-03.js

import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PAYROLL_DIR = path.join(__dirname, 'payroll')

let cachedPayroll = null
let cachedAt = 0

export async function loadLatestPayroll() {
  // Cache for 1 hour to avoid re-reading directory on every request
  if (cachedPayroll && Date.now() - cachedAt < 3600000) {
    return cachedPayroll
  }

  try {
    console.log('[payroll-loader] reading directory:', PAYROLL_DIR)
    if (!fs.existsSync(PAYROLL_DIR)) {
      console.warn('[payroll-loader] directory does not exist:', PAYROLL_DIR)
      return null
    }
    const allFiles = fs.readdirSync(PAYROLL_DIR)
    console.log('[payroll-loader] files in dir:', allFiles)
    const files = allFiles.filter(f => /^\d{4}-\d{2}\.js$/.test(f)).sort()
    if (!files.length) {
      console.warn('[payroll-loader] no YYYY-MM.js files found')
      return null
    }
    console.log('[payroll-loader] eligible files:', files)

    // Pick the most recent month that's <= current month, fall back to latest
    const todayCT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }))
    const currentYM = `${todayCT.getFullYear()}-${String(todayCT.getMonth() + 1).padStart(2, '0')}`
    const eligible = files.filter(f => f.replace('.js', '') <= currentYM)
    const latestFile = eligible.length ? eligible[eligible.length - 1] : files[files.length - 1]

    const fileUrl = pathToFileURL(path.join(PAYROLL_DIR, latestFile)).href
    const mod = await import(fileUrl)
    const data = mod.default

    cachedPayroll = {
      ...data,
      sourceFile: latestFile,
      lastUpdated: data.monthLabel || latestFile.replace('.js', ''),
    }
    cachedAt = Date.now()
    return cachedPayroll
  } catch (e) {
    console.error('Payroll load error:', e.message)
    return null
  }
}
