import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import mysql from "mysql2/promise"
import axios from "axios"
import helmet from "helmet"

dotenv.config()

const app = express()

// Security headers
app.use(helmet())

// Security and CORS
// IMPORTANT: Frontend must use backend URL from environment variable VITE_API_URL
// Do NOT call Vercel domain directly - use Render backend URL instead
app.use(cors({
  origin: process.env.FRONTEND_URL || "https://svai-hexart27.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}))

// JSON parsing with size limit
app.use(express.json({ limit: "10kb" }))

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

function mapMessageRow(row) {
  return {
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    content: row.content,
    timestamp: Number(row.timestamp),
    read: !!row.read,
  };
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

// Messages endpoints
app.get('/api/messages/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await query(
      'SELECT * FROM messages WHERE sender_id = ? OR receiver_id = ? ORDER BY timestamp DESC',
      [userId, userId]
    );
    res.json(messages.map(mapMessageRow));
  } catch (err) {
    console.error('GET /api/messages error:', err.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.get('/api/messages/unread-count', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await query(
      'SELECT COUNT(*) as unreadCount FROM messages WHERE receiver_id = ? AND read = FALSE',
      [userId]
    );

    res.json({ unreadCount: result[0].unreadCount || 0 });
  } catch (err) {
    console.error('GET /api/messages/unread-count error:', err.message);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const { senderId, receiverId, content } = req.body;

    if (!senderId || !receiverId || !content) {
      return res.status(400).json({ error: 'Sender ID, receiver ID, and content are required' });
    }

    const timestamp = Date.now();
    const id = crypto.randomUUID();

    await query(
      'INSERT INTO messages (id, sender_id, receiver_id, content, timestamp) VALUES (?, ?, ?, ?, ?)',
      [id, senderId, receiverId, content, timestamp]
    );

    // Verify the insert
    const insertedMessages = await query('SELECT * FROM messages WHERE id = ?', [id]);
    if (insertedMessages.length === 0) {
      throw new Error('Message insertion failed');
    }

    res.status(201).json(mapMessageRow(insertedMessages[0]));
  } catch (err) {
    console.error('POST /api/messages error:', err.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Conversations endpoint
app.get('/api/conversations', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get all unique conversation partners for this user
    const conversations = await query(`
      SELECT DISTINCT
        CASE
          WHEN sender_id = ? THEN receiver_id
          ELSE sender_id
        END as partnerId,
        u.name as partnerName,
        u.avatar as partnerAvatar,
        MAX(m.timestamp) as lastMessageTime,
        COUNT(CASE WHEN m.read = FALSE AND m.receiver_id = ? THEN 1 END) as unreadCount
      FROM messages m
      JOIN users u ON (CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END) = u.id
      WHERE m.sender_id = ? OR m.receiver_id = ?
      GROUP BY partnerId, u.name, u.avatar
      ORDER BY lastMessageTime DESC
    `, [userId, userId, userId, userId, userId]);

    // Get the last message for each conversation
    const conversationsWithLastMessage = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await query(`
          SELECT content, timestamp, sender_id
          FROM messages
          WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
          ORDER BY timestamp DESC
          LIMIT 1
        `, [userId, conv.partnerId, conv.partnerId, userId]);

        return {
          partnerId: conv.partnerId,
          partnerName: conv.partnerName,
          partnerAvatar: conv.partnerAvatar,
          lastMessage: lastMessage.length > 0 ? {
            content: lastMessage[0].content,
            timestamp: lastMessage[0].timestamp,
            isFromUser: lastMessage[0].sender_id === userId
          } : null,
          unreadCount: conv.unreadCount,
          lastMessageTime: conv.lastMessageTime
        };
      })
    );

    res.json(conversationsWithLastMessage);
  } catch (err) {
    console.error('GET /api/conversations error:', err.message);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Roadmap generation endpoint
app.post('/api/roadmap/generate', async (req, res) => {
  try {
    // Import the generateRoadmap function from the skills service
    const { generateRoadmap } = await import('./ai/mistralSkills.js');

    if (!generateRoadmap) {
      throw new Error('generateRoadmap function not found in mistralSkills.js');
    }

    const result = await generateRoadmap(req.body);
    res.json(result);
  } catch (err) {
    console.error('POST /api/roadmap/generate error:', err.message);
    res.status(500).json({
      success: false,
      message: "AI service unavailable",
      error: err.message
    });
  }
});

// Skills suggestion endpoint
app.post('/api/skills/suggest', async (req, res) => {
  try {
    // Import the suggestSkills function from the skills service
    const { suggestSkills } = await import('./ai/mistralSkills.js');

    if (!suggestSkills) {
      throw new Error('suggestSkills function not found in mistralSkills.js');
    }

    const result = await suggestSkills(req.body);
    res.json(result);
  } catch (err) {
    console.error('POST /api/skills/suggest error:', err.message);
    res.status(500).json({
      success: false,
      message: "AI service unavailable",
      error: err.message
    });
  }
});

// Quiz generation endpoint
app.post('/api/quiz/generate', async (req, res) => {
  try {
    // Import the generateQuiz function from the quiz service
    const { generateQuiz } = await import('./ai/mistralQuiz.js');

    if (!generateQuiz) {
      throw new Error('generateQuiz function not found in mistralQuiz.js');
    }

    const result = await generateQuiz(req.body);
    res.json(result);
  } catch (err) {
    console.error('POST /api/quiz/generate error:', err.message);
    res.status(500).json({
      success: false,
      message: "AI service unavailable",
      error: err.message
    });
  }
});

// ========================================
// SKILLS VALIDATION HELPERS
// ========================================

function validateSkill(skill) {
  if (!skill || typeof skill !== 'object') {
    throw new Error('Skill must be an object');
  }
  if (!skill.name || typeof skill.name !== 'string') {
    throw new Error('Skill must have a valid name');
  }
  return {
    name: skill.name.trim(),
    verified: skill.verified === true, // Default to false if not true
    level: skill.level || 'beginner',
    experienceYears: skill.experienceYears || 0,
    availability: Array.isArray(skill.availability) ? skill.availability : []
  };
}

function validateSkillsArray(skills) {
  if (!Array.isArray(skills)) {
    throw new Error('Skills must be an array');
  }
  return skills.map(validateSkill);
}

// ========================================
// EXCHANGE REQUESTS ENDPOINT
// ========================================

app.get('/api/requests', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get exchange requests where user is requester OR target
    const requests = await query(
      'SELECT * FROM exchange_requests WHERE requester_id = ? OR target_id = ? ORDER BY created_at DESC',
      [userId, userId]
    );

    res.json(requests.map(mapExchangeRequestRow));
  } catch (err) {
    console.error('GET /api/requests error:', err.message);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// User endpoints
app.post('/api/users', async (req, res) => {
  try {
    const { id, name, email, password, bio, skillsKnown, skillsToLearn, discordLink } = req.body

    // Validate required fields
    if (!id || !name || !email) {
      return res.status(400).json({ error: 'ID, name, and email are required' });
    }

    // Validate and normalize skills
    let validatedSkillsKnown = [];
    let validatedSkillsToLearn = [];

    if (skillsKnown) {
      validatedSkillsKnown = validateSkillsArray(skillsKnown);
    }
    if (skillsToLearn) {
      validatedSkillsToLearn = validateSkillsArray(skillsToLearn);
    }

    // Always JSON.stringify before storing
    const skillsKnownJson = JSON.stringify(validatedSkillsKnown);
    const skillsToLearnJson = JSON.stringify(validatedSkillsToLearn);

    await query(
      `INSERT INTO users (id, name, email, password, bio, skills_known, skills_to_learn, discord_link, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, email, password || '', bio || '', skillsKnownJson, skillsToLearnJson, discordLink || '', 5.0]
    )

    const newUsers = await query('SELECT * FROM users WHERE id = ?', [id])
    res.status(201).json(mapUserRow(newUsers[0]))
  } catch (err) {
    if (err.message.includes('Skill') || err.message.includes('skills')) {
      res.status(400).json({ error: 'Invalid skills format: ' + err.message });
    } else if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'User already exists' });
    } else {
      console.error('POST /api/users DB write failed:', err.message);
      res.status(500).json({ error: 'Failed to create user' });
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
    const { name, bio, skillsKnown, skillsToLearn, discordLink, password, email } = req.body

    // Check if user exists first
    const existingUsers = await query('SELECT * FROM users WHERE id = ?', [id])
    if (existingUsers.length === 0) {
      // If user doesn't exist, create them (for signup flow)
      const validatedSkillsKnown = skillsKnown ? validateSkillsArray(skillsKnown) : [];
      const validatedSkillsToLearn = skillsToLearn ? validateSkillsArray(skillsToLearn) : [];

      await query(
        `INSERT INTO users (id, name, email, password, bio, skills_known, skills_to_learn, discord_link, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name || '', email || '', password || '', bio || '', JSON.stringify(validatedSkillsKnown), JSON.stringify(validatedSkillsToLearn), discordLink || '', 5.0]
      )
    } else {
      // Update existing user - preserve existing skills if not provided
      const existingUser = existingUsers[0];

      // Preserve existing skills if not provided in request
      let finalSkillsKnown = safeParseJSON(existingUser.skills_known, []);
      let finalSkillsToLearn = safeParseJSON(existingUser.skills_to_learn, []);

      // Only update skills if they are provided in the request
      if (skillsKnown !== undefined) {
        finalSkillsKnown = validateSkillsArray(skillsKnown);
      }
      if (skillsToLearn !== undefined) {
        finalSkillsToLearn = validateSkillsArray(skillsToLearn);
      }

      // Always JSON.stringify before storing
      const skillsKnownJson = JSON.stringify(finalSkillsKnown);
      const skillsToLearnJson = JSON.stringify(finalSkillsToLearn);

      const updateFields = ['name = ?', 'bio = ?', 'skills_known = ?', 'skills_to_learn = ?', 'discord_link = ?']
      const updateValues = [
        name !== undefined ? name : existingUser.name,
        bio !== undefined ? bio : existingUser.bio,
        skillsKnownJson,
        skillsToLearnJson,
        discordLink !== undefined ? discordLink : existingUser.discord_link
      ]

      if (password !== undefined) {
        updateFields.push('password = ?')
        updateValues.push(password)
      }

      updateFields.push('WHERE id = ?')
      updateValues.push(id)

      await query(`UPDATE users SET ${updateFields.join(', ')}`, updateValues)
    }

    // Immediately SELECT and return updated user from DB
    const updatedUsers = await query('SELECT * FROM users WHERE id = ?', [id])
    if (updatedUsers.length === 0) {
      console.error('PUT /api/users/:id DB write failed: User not found after update');
      return res.status(500).json({ error: 'User update failed - user not found after update' });
    }

    res.json(mapUserRow(updatedUsers[0]))
  } catch (err) {
    if (err.message.includes('Skill') || err.message.includes('skills')) {
      res.status(400).json({ error: 'Invalid skills format: ' + err.message });
    } else {
      console.error('PUT /api/users/:id DB write failed:', err.message);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
})

// AI endpoint - Quiz Generation
app.post('/ai', async (req, res) => {
  try {
    // Import the generateQuiz function from the mistralQuiz.js file
    const { generateQuiz } = await import('./ai/mistralQuiz.js');

    if (!generateQuiz) {
      throw new Error('generateQuiz function not found in mistralQuiz.js');
    }

    // Call the generateQuiz function with the request body
    const result = await generateQuiz(req.body);

    // Return the result
    res.json(result);
  } catch (err) {
    console.error('AI endpoint error:', err.message);
    res.status(500).json({
      success: false,
      message: "AI service unavailable",
      error: err.message
    });
  }
});

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", uptime: process.uptime() })
})

// API test endpoint
app.get("/api/test", (req, res) => {
  res.json({ message: "API is working", timestamp: new Date().toISOString() })
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

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack)
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})
