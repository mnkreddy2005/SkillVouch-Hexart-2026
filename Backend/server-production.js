import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import mysql from "mysql2/promise"
import axios from "axios"

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${req.method} ${req.url} - ${req.ip}`)
  next()
})

// MySQL Connection
const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQL_HOST,
  user: process.env.DB_USER || process.env.MYSQL_USER,
  password: process.env.DB_PASS || process.env.MYSQL_PASSWORD,
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

// Helper function for database queries
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params)
  return rows
}

// Helper mappers
function mapUserRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    avatar: row.avatar,
    skillsKnown: row.skills_known ? JSON.parse(row.skills_known) : [],
    skillsToLearn: row.skills_to_learn ? JSON.parse(row.skills_to_learn) : [],
    bio: row.bio || '',
    discordLink: row.discord_link || undefined,
    rating: row.rating,
  }
}

// Database connection status
let dbConnected = false
let dbConnectionAttempts = 0
const maxDbRetries = 5

async function checkDatabaseConnection() {
  dbConnectionAttempts++
  console.log(`🔍 Checking database connection (attempt ${dbConnectionAttempts}/${maxDbRetries})...`)
  
  try {
    const connection = await pool.getConnection()
    await connection.ping()
    await connection.execute('SELECT 1')
    connection.release()
    
    if (!dbConnected) {
      dbConnected = true
      console.log('✅ MySQL connected successfully!')
      console.log(`📊 Database: ${process.env.DB_NAME || process.env.MYSQL_DATABASE}`)
      console.log(`🌐 Host: ${process.env.DB_HOST || process.env.MYSQL_HOST}`)
      console.log(`👤 User: ${process.env.DB_USER || process.env.MYSQL_USER}`)
    }
    return true
  } catch (err) {
    dbConnected = false
    console.error(`❌ MySQL connection failed (attempt ${dbConnectionAttempts}):`, err.message)
    
    if (dbConnectionAttempts < maxDbRetries) {
      console.log(`🔄 Retrying database connection in 5 seconds...`)
      setTimeout(checkDatabaseConnection, 5000)
    } else {
      console.error('🚨 Maximum database connection attempts reached. Server will continue running but database features will be limited.')
    }
    return false
  }
}

// Initial database connection check
checkDatabaseConnection()

// Periodic database health check
setInterval(async () => {
  const wasConnected = dbConnected
  await checkDatabaseConnection()
  
  if (wasConnected && !dbConnected) {
    console.log('⚠️  Database connection lost!')
  } else if (!wasConnected && dbConnected) {
    console.log('🎉 Database connection restored!')
  }
}, 30000) // Check every 30 seconds

// Mistral AI connection test
let mistralConnected = false

async function testMistralConnection() {
  try {
    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: process.env.MISTRAL_MODEL || "mistral-small",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 1
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 5000
      }
    )
    
    if (!mistralConnected) {
      mistralConnected = true
      console.log('✅ Mistral AI connected successfully!')
      console.log(`🤖 Model: ${process.env.MISTRAL_MODEL || 'mistral-small'}`)
    }
    return true
  } catch (err) {
    mistralConnected = false
    console.error('❌ Mistral AI connection failed:', err.response?.data?.error?.message || err.message)
    return false
  }
}

// Test Mistral connection on startup
setTimeout(testMistralConnection, 2000)

// Periodic Mistral health check
setInterval(testMistralConnection, 60000) // Check every minute

// Enhanced status endpoint
app.get("/api/status", (req, res) => {
  const uptime = process.uptime()
  const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
  
  const status = {
    status: "running",
    timestamp: new Date().toISOString(),
    uptime: uptimeFormatted,
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5000,
    services: {
      database: {
        connected: dbConnected,
        host: process.env.DB_HOST || process.env.MYSQL_HOST,
        database: process.env.DB_NAME || process.env.MYSQL_DATABASE,
        connectionAttempts: dbConnectionAttempts
      },
      mistral: {
        connected: mistralConnected,
        model: process.env.MISTRAL_MODEL || 'mistral-small',
        apiKey: process.env.MISTRAL_API_KEY ? 'configured' : 'missing'
      }
    },
    endpoints: {
      users: 'available',
      login: 'available', 
      ai: mistralConnected ? 'available' : 'unavailable',
      health: 'available'
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100
    }
  }
  
  console.log(`📊 Status check requested from ${req.ip} - Database: ${dbConnected ? '✅' : '❌'}, Mistral: ${mistralConnected ? '✅' : '❌'}`)
  res.json(status)
})

// Detailed health check for frontend monitoring
app.get("/api/health", (req, res) => {
  const health = {
    healthy: dbConnected,
    timestamp: new Date().toISOString(),
    checks: {
      database: dbConnected ? 'pass' : 'fail',
      api: 'pass',
      memory: process.memoryUsage().heapUsed < 500 * 1024 * 1024 ? 'pass' : 'warn' // Warn if > 500MB
    }
  }
  
  res.status(health.healthy ? 200 : 503).json(health)
})

// User endpoints
app.post('/api/users', async (req, res) => {
  try {
    const { id, name, email, password, bio, skillsKnown, skillsToLearn, discordLink } = req.body
    
    await query(
      `INSERT INTO users (id, name, email, password, bio, skills_known, skills_to_learn, discord_link, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, email, password || '', bio || '', JSON.stringify(skillsKnown || []), JSON.stringify(skillsToLearn || []), discordLink || '', 5.0]
    )
    
    const newUsers = await query('SELECT * FROM users WHERE id = ?', [id])
    res.status(201).json(mapUserRow(newUsers[0]))
  } catch (err) {
    console.error('POST /api/users error', err)
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'User already exists' })
    } else {
      res.status(500).json({ error: 'Failed to create user' })
    }
  }
})

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }
    
    const users = await query('SELECT * FROM users WHERE email = ?', [email])
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    
    const user = users[0]
    
    // For now, accept any password if user exists
    // In production, you'd hash and verify passwords properly
    if (!user.password && password) {
      // Update user with password if they don't have one
      await query('UPDATE users SET password = ? WHERE id = ?', [password, user.id])
      user.password = password
    }
    
    res.json({
      user: mapUserRow(user),
      token: 'simple-token-' + user.id // Simple token for now
    })
  } catch (err) {
    console.error('POST /api/login error', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

app.get('/api/users', async (req, res) => {
  try {
    const users = await query('SELECT * FROM users')
    res.json(users.map(mapUserRow))
  } catch (err) {
    console.error('GET /api/users error', err)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params
    const users = await query('SELECT * FROM users WHERE id = ?', [id])
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json(mapUserRow(users[0]))
  } catch (err) {
    console.error('GET /api/users/:id error', err)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, bio, skillsKnown, skillsToLearn, discordLink, password } = req.body
    
    // Check if user exists first
    const existingUsers = await query('SELECT * FROM users WHERE id = ?', [id])
    if (existingUsers.length === 0) {
      // If user doesn't exist, create them (for signup flow)
      await query(
        `INSERT INTO users (id, name, email, password, bio, skills_known, skills_to_learn, discord_link, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, req.body.email || '', password || '', bio || '', JSON.stringify(skillsKnown || []), JSON.stringify(skillsToLearn || []), discordLink || '', 5.0]
      )
    } else {
      // Update existing user
      const updateFields = ['name = ?', 'bio = ?', 'skills_known = ?', 'skills_to_learn = ?', 'discord_link = ?']
      const updateValues = [name, bio, JSON.stringify(skillsKnown || []), JSON.stringify(skillsToLearn || []), discordLink]
      
      if (password) {
        updateFields.push('password = ?')
        updateValues.push(password)
      }
      
      updateFields.push('WHERE id = ?')
      updateValues.push(id)
      
      await query(`UPDATE users SET ${updateFields.join(' ')}`, updateValues)
    }
    
    const updatedUsers = await query('SELECT * FROM users WHERE id = ?', [id])
    res.json(mapUserRow(updatedUsers[0]))
  } catch (err) {
    console.error('PUT /api/users/:id error', err)
    res.status(500).json({ error: 'Failed to update/create user' })
  }
})

// Mistral AI Route
app.post("/ai", async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: process.env.MISTRAL_MODEL || "mistral-small",
        messages: [{ role: "user", content: req.body.prompt }]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    )
    res.json(response.data)
  } catch (err) {
    console.error('Mistral AI Error:', err.response?.data || err.message)
    res.status(500).json({ error: err.message })
  }
})

// Health check route
app.get("/", (req, res) => {
  res.send("Backend running successfully 🚀")
})

// API status route
app.get("/api/status", (req, res) => {
  res.json({
    status: "running",
    timestamp: new Date().toISOString(),
    database: "connected",
    mistral: "configured"
  })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log('\n🚀 ===============================================')
  console.log('🚀 SkillVouch AI Backend Server Started')
  console.log('🚀 ===============================================')
  console.log(`📡 Server running on port: ${PORT}`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`⏰ Start time: ${new Date().toISOString()}`)
  console.log('')
  console.log('� Services Status:')
  console.log(`   Database: ${dbConnected ? '✅ Connected' : '🔄 Connecting...'} (${process.env.DB_HOST || process.env.MYSQL_HOST})`)
  console.log(`   Mistral AI: ${mistralConnected ? '✅ Connected' : '🔄 Testing...'}`)
  console.log('')
  console.log('🔗 Available Endpoints:')
  console.log('   GET  /           - Health check')
  console.log('   GET  /api/status - Detailed status')
  console.log('   GET  /api/health - Health monitoring')
  console.log('   POST /api/login  - User authentication')
  console.log('   POST /api/users  - User creation')
  console.log('   GET  /api/users  - List users')
  console.log('   PUT  /api/users/:id - Update user')
  console.log('   POST /ai         - Mistral AI chat')
  console.log('')
  console.log('📝 Console Logs:')
  console.log('   • All requests will be logged with timestamps')
  console.log('   • Database connection status monitored every 30s')
  console.log('   • Mistral AI connection tested every 60s')
  console.log('   • Status checks logged when requested')
  console.log('===============================================\n')
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Server shutting down gracefully...')
  console.log('📊 Final Status:')
  console.log(`   Database: ${dbConnected ? '✅ Was connected' : '❌ Was disconnected'}`)
  console.log(`   Mistral AI: ${mistralConnected ? '✅ Was connected' : '❌ Was disconnected'}`)
  console.log('👋 Goodbye!')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Server received SIGTERM, shutting down...')
  process.exit(0)
})
