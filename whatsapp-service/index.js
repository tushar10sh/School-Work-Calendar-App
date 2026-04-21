const express = require('express')
const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode')
const fs = require('fs')

const app = express()
app.use(express.json())

// Connection state
let client = null
let status = 'DISCONNECTED' // DISCONNECTED | QR_PENDING | LOADING | CONNECTED
let qrDataURL = null
let connectedPhone = null
const MESSAGE_FILTER = process.env.MESSAGE_FILTER || 'planner'

function clearChromiumLocks() {
  const lockFiles = [
    '/app/sessions/session/SingletonLock',
    '/app/sessions/session/SingletonCookie',
    '/app/sessions/session/SingletonSocket',
  ]
  lockFiles.forEach((f) => { try { fs.unlinkSync(f) } catch (_) {} })
}

function createClient() {
  clearChromiumLocks()
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: '/app/sessions' }),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
      ],
    },
  })

  client.on('qr', async (qr) => {
    console.log('[WA] QR code received')
    status = 'QR_PENDING'
    qrDataURL = await qrcode.toDataURL(qr)
  })

  client.on('loading_screen', (percent) => {
    console.log(`[WA] Loading ${percent}%`)
    status = 'LOADING'
  })

  client.on('authenticated', () => {
    console.log('[WA] Authenticated')
    status = 'LOADING'
    qrDataURL = null
  })

  client.on('ready', () => {
    console.log('[WA] Ready — phone:', client.info?.wid?.user)
    status = 'CONNECTED'
    connectedPhone = client.info?.wid?.user || null
    qrDataURL = null
  })

  client.on('disconnected', (reason) => {
    console.log('[WA] Disconnected:', reason)
    status = 'DISCONNECTED'
    connectedPhone = null
    qrDataURL = null
  })

  client.on('auth_failure', (msg) => {
    console.error('[WA] Auth failure:', msg)
    status = 'DISCONNECTED'
    qrDataURL = null
  })

  client.initialize().catch((err) => {
    console.error('[WA] Initialize error:', err.message)
    status = 'DISCONNECTED'
  })
}

// Auto-start
createClient()

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/status', (req, res) => {
  res.json({ status, phone: connectedPhone })
})

app.get('/qr', (req, res) => {
  if (!qrDataURL) {
    return res.status(404).json({ error: 'No QR code available. Status: ' + status })
  }
  res.json({ qr: qrDataURL, status })
})

app.get('/groups', async (req, res) => {
  if (status !== 'CONNECTED') {
    return res.status(503).json({ error: 'Not connected. Status: ' + status })
  }
  try {
    const chats = await client.getChats()
    const groups = chats
      .filter((c) => c.isGroup)
      .map((c) => ({
        id: c.id._serialized,
        name: c.name,
        participantCount: c.participants?.length || 0,
      }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    res.json(groups)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/groups/:groupId/messages', async (req, res) => {
  if (status !== 'CONNECTED') {
    return res.status(503).json({ error: 'Not connected. Status: ' + status })
  }
  const { groupId } = req.params
  const limit = Math.min(parseInt(req.query.limit) || 50, 200)
  const since = req.query.since ? parseInt(req.query.since) : null

  try {
    const chats = await client.getChats()
    const chat = chats.find((c) => c.id._serialized === groupId)
    if (!chat) return res.status(404).json({ error: 'Group not found' })
    const messages = await chat.fetchMessages({ limit })

    const filtered = messages
      .filter((m) => {
        if (since && m.timestamp <= since) return false
        const body = (m.body || '').toLowerCase()
        return body.includes(MESSAGE_FILTER.toLowerCase())
      })
      .map((m) => ({
        id: m.id._serialized,
        body: m.body,
        timestamp: m.timestamp,
        from: m.from,
        author: m.author || m.from,
      }))

    res.json(filtered)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/reconnect', async (req, res) => {
  console.log('[WA] Reconnect requested')
  if (client) {
    try { await client.destroy() } catch (_) {}
  }
  status = 'DISCONNECTED'
  qrDataURL = null
  connectedPhone = null
  createClient()
  res.json({ ok: true })
})

app.post('/disconnect', async (req, res) => {
  console.log('[WA] Disconnect requested')
  if (client) {
    try { await client.logout() } catch (_) {}
    try { await client.destroy() } catch (_) {}
    client = null
  }
  status = 'DISCONNECTED'
  qrDataURL = null
  connectedPhone = null
  res.json({ ok: true })
})

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[WA] WhatsApp service listening on port ${PORT}`)
})
