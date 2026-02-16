import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import mysql from "mysql2/promise"
import axios from "axios"

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

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

// Test MySQL connection
pool.getConnection()
  .then(connection => {
    console.log('✅ MySQL connected successfully!')
    connection.release()
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message)
  })

// User endpoints
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
    const { name, bio, skillsKnown, skillsToLearn, discordLink } = req.body
    
    await query(
      `UPDATE users SET name = ?, bio = ?, skills_known = ?, skills_to_learn = ?, discord_link = ? WHERE id = ?`,
      [name, bio, JSON.stringify(skillsKnown || []), JSON.stringify(skillsToLearn || []), discordLink, id]
    )
    
    const updatedUsers = await query('SELECT * FROM users WHERE id = ?', [id])
    res.json(mapUserRow(updatedUsers[0]))
  } catch (err) {
    console.error('PUT /api/users/:id error', err)
    res.status(500).json({ error: 'Failed to update user' })
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
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🗄️  MySQL: ${process.env.DB_HOST || process.env.MYSQL_HOST}`)
  console.log(`🤖 Mistral AI: ${process.env.MISTRAL_MODEL || 'mistral-small'}`)
})
