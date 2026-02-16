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

// Test MySQL connection
pool.getConnection()
  .then(connection => {
    console.log('✅ MySQL connected successfully!')
    connection.release()
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message)
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

// Serve static files from frontend build
app.use(express.static('Frontend/dist'))

// Catch all handler - return index.html for SPA
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: 'Frontend/dist' })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🗄️  MySQL: ${process.env.DB_HOST || process.env.MYSQL_HOST}`)
  console.log(`🤖 Mistral AI: ${process.env.MISTRAL_MODEL || 'mistral-small'}`)
})
