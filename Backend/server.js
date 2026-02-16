import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ========================================
// DATABASE CONNECTION HARDENING
// ========================================

// MySQL Connection Pool Configuration
const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQL_HOST || 'mysql-meruva.alwaysdata.net',
  port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
  user: process.env.DB_USER || process.env.MYSQL_USER || 'meruva',
  password: process.env.DB_PASS || process.env.MYSQL_PASSWORD || 'meruva_12345',
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'meruva_skillvouch',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Database connection status
let dbConnected = false;
let dbConnectionAttempts = 0;
const maxDbRetries = 5;

// Query function with strict validation
async function query(sql, params = []) {
  if (!dbConnected) {
    throw new Error('Database connection unavailable');
  }

  // Strict query validation - ensure parameterized queries
  const paramCount = (sql.match(/\?/g) || []).length;
  if (paramCount !== params.length) {
    throw new Error(`Parameter count mismatch: expected ${paramCount}, got ${params.length}`);
  }

  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(sql, params);
      return rows;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Database query failed:', err.message);
    throw err;
  }
}

// Transaction support
async function transaction(callback) {
  if (!dbConnected) {
    throw new Error('Database connection unavailable');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    try {
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (err) {
      await connection.rollback();
      throw err;
    }
  } finally {
    connection.release();
  }
}

// ========================================
// DATABASE CONNECTION VALIDATION
// ========================================

async function checkDatabaseConnection() {
  dbConnectionAttempts++;
  console.log(`🔍 Checking database connection (attempt ${dbConnectionAttempts}/${maxDbRetries})...`);

  try {
    const connection = await pool.getConnection();
    await connection.ping();
    await connection.execute('SELECT 1');

    if (!dbConnected) {
      dbConnected = true;
      console.log('✅ MySQL connected successfully!');
      console.log(`📊 Database: ${process.env.DB_NAME || process.env.MYSQL_DATABASE}`);
      console.log(`🌐 Host: ${process.env.DB_HOST || process.env.MYSQL_HOST}`);
    }

    connection.release();
    return true;
  } catch (err) {
    dbConnected = false;
    console.error(`❌ MySQL connection failed (attempt ${dbConnectionAttempts}):`, err.message);

    if (dbConnectionAttempts < maxDbRetries) {
      console.log(`🔄 Retrying database connection in 5 seconds...`);
      setTimeout(checkDatabaseConnection, 5000);
    } else {
      console.error('🚨 Maximum database connection attempts reached. Server will continue running but database features will be limited.');
    }
    return false;
  }
}

// ========================================
// TABLE CREATION AND VALIDATION
// ========================================

const requiredTables = [
  'users',
  'exchange_requests',
  'exchange_feedback',
  'messages',
  'quizzes',
  'quiz_attempts'
];

async function createTablesIfNotExist() {
  console.log('📋 Checking database tables...');

  for (const tableName of requiredTables) {
    try {
      await query('SELECT 1 FROM ?? LIMIT 1', [tableName]);
      console.log(`✅ Table '${tableName}' exists`);
    } catch (err) {
      console.log(`⚠️  Table '${tableName}' missing, creating...`);
      await createTable(tableName);
    }
  }
}

async function createTable(tableName) {
  let createQuery = '';

  switch (tableName) {
    case 'users':
      createQuery = `
        CREATE TABLE users (
          id VARCHAR(36) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255),
          avatar TEXT,
          bio TEXT,
          skills_known JSON DEFAULT ('[]'),
          skills_to_learn JSON DEFAULT ('[]'),
          discord_link VARCHAR(255),
          rating DECIMAL(3,2) DEFAULT 5.00,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;
      break;

    case 'exchange_requests':
      createQuery = `
        CREATE TABLE exchange_requests (
          id VARCHAR(36) PRIMARY KEY,
          requester_id VARCHAR(36) NOT NULL,
          target_id VARCHAR(36) NOT NULL,
          skill_to_teach VARCHAR(255) NOT NULL,
          skill_to_learn VARCHAR(255) NOT NULL,
          message TEXT,
          status ENUM('pending', 'accepted', 'declined', 'completed') DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (target_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_requester (requester_id),
          INDEX idx_target (target_id),
          INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;
      break;

    case 'exchange_feedback':
      createQuery = `
        CREATE TABLE exchange_feedback (
          id VARCHAR(36) PRIMARY KEY,
          exchange_request_id VARCHAR(36) NOT NULL,
          from_user_id VARCHAR(36) NOT NULL,
          to_user_id VARCHAR(36) NOT NULL,
          rating DECIMAL(3,2) NOT NULL,
          comment TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (exchange_request_id) REFERENCES exchange_requests(id) ON DELETE CASCADE,
          FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_exchange (exchange_request_id),
          INDEX idx_from_user (from_user_id),
          INDEX idx_to_user (to_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;
      break;

    case 'messages':
      createQuery = `
        CREATE TABLE messages (
          id VARCHAR(36) PRIMARY KEY,
          sender_id VARCHAR(36) NOT NULL,
          receiver_id VARCHAR(36) NOT NULL,
          content TEXT NOT NULL,
          timestamp BIGINT NOT NULL,
          read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_sender (sender_id),
          INDEX idx_receiver (receiver_id),
          INDEX idx_timestamp (timestamp)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;
      break;

    case 'quizzes':
      createQuery = `
        CREATE TABLE quizzes (
          id VARCHAR(36) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          skill VARCHAR(255) NOT NULL,
          difficulty ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'intermediate',
          questions JSON NOT NULL,
          created_by VARCHAR(36),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_skill (skill),
          INDEX idx_difficulty (difficulty)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;
      break;

    case 'quiz_attempts':
      createQuery = `
        CREATE TABLE quiz_attempts (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          quiz_id VARCHAR(36) NOT NULL,
          answers JSON NOT NULL,
          score DECIMAL(5,2),
          completed BOOLEAN DEFAULT FALSE,
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
          INDEX idx_user (user_id),
          INDEX idx_quiz (quiz_id),
          INDEX idx_completed (completed)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;
      break;

    default:
      throw new Error(`Unknown table: ${tableName}`);
  }

  await query(createQuery);
  console.log(`✅ Table '${tableName}' created successfully`);
}

// ========================================
// JSON SAFETY HELPERS
// ========================================

function safeParseJSON(value, defaultValue = null) {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  try {
    return JSON.parse(value);
  } catch (err) {
    console.error('JSON parsing error:', err.message, 'Value:', value);
    return defaultValue;
  }
}

function safeStringifyJSON(value) {
  try {
    return JSON.stringify(value);
  } catch (err) {
    console.error('JSON stringify error:', err.message, 'Value:', value);
    return '[]'; // Default empty array
  }
}

// ========================================
// EXPRESS APP SETUP
// ========================================

const app = express();

// Security and CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || "https://svai-hexart27.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ========================================
// HELPER MAPPERS
// ========================================

function mapUserRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    avatar: row.avatar,
    skillsKnown: safeParseJSON(row.skills_known, []),
    skillsToLearn: safeParseJSON(row.skills_to_learn, []),
    bio: row.bio || '',
    discordLink: row.discord_link || undefined,
    rating: row.rating,
  };
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

function mapExchangeRequestRow(row) {
  return {
    id: row.id,
    requesterId: row.requester_id,
    targetId: row.target_id,
    skillToTeach: row.skill_to_teach,
    skillToLearn: row.skill_to_learn,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ========================================
// DATABASE HEALTH ROUTE
// ========================================

app.get('/api/db-status', async (req, res) => {
  const tablesStatus = {};

  for (const tableName of requiredTables) {
    try {
      await query('SELECT 1 FROM ?? LIMIT 1', [tableName]);
      tablesStatus[tableName] = true;
    } catch (err) {
      tablesStatus[tableName] = false;
    }
  }

  res.json({
    connected: dbConnected,
    uptime: process.uptime(),
    tables: tablesStatus
  });
});

// ========================================
// USER ENDPOINTS
// ========================================

app.post('/api/users', async (req, res) => {
  try {
    const { id, name, email, password, bio, skillsKnown, skillsToLearn, discordLink } = req.body;

    if (!id || !name || !email) {
      return res.status(400).json({ error: 'ID, name, and email are required' });
    }

    const skillsKnownJson = safeStringifyJSON(skillsKnown || []);
    const skillsToLearnJson = safeStringifyJSON(skillsToLearn || []);

    await query(
      'INSERT INTO users (id, name, email, password, bio, skills_known, skills_to_learn, discord_link, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, email, password || '', bio || '', skillsKnownJson, skillsToLearnJson, discordLink || '', 5.0]
    );

    // Verify the insert
    const insertedUsers = await query('SELECT * FROM users WHERE id = ?', [id]);
    if (insertedUsers.length === 0) {
      throw new Error('User insertion failed - record not found after insert');
    }

    res.status(201).json(mapUserRow(insertedUsers[0]));
  } catch (err) {
    console.error('POST /api/users error:', err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await query('SELECT * FROM users');
    res.json(users.map(mapUserRow));
  } catch (err) {
    console.error('GET /api/users error:', err.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const users = await query('SELECT * FROM users WHERE id = ?', [id]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(mapUserRow(users[0]));
  } catch (err) {
    console.error('GET /api/users/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, bio, skillsKnown, skillsToLearn, discordLink, password } = req.body;

    // Check if user exists
    const existingUsers = await query('SELECT * FROM users WHERE id = ?', [id]);
    if (existingUsers.length === 0) {
      // Create user if not exists
      const userData = {
        id,
        name: name || '',
        email: req.body.email || '',
        password: password || '',
        bio: bio || '',
        skillsKnown: skillsKnown || [],
        skillsToLearn: skillsToLearn || [],
        discordLink: discordLink || ''
      };
      return app._router.handle({ method: 'POST', url: '/api/users', body: userData }, {
        status: (code) => ({ json: (data) => res.status(code).json(data) })
      }, () => {});
    }

    // Preserve existing skills if not provided
    const existingUser = existingUsers[0];
    const finalSkillsKnown = skillsKnown !== undefined ? skillsKnown : safeParseJSON(existingUser.skills_known, []);
    const finalSkillsToLearn = skillsToLearn !== undefined ? skillsToLearn : safeParseJSON(existingUser.skills_to_learn, []);

    const skillsKnownJson = safeStringifyJSON(finalSkillsKnown);
    const skillsToLearnJson = safeStringifyJSON(finalSkillsToLearn);

    const updateFields = ['name = ?', 'bio = ?', 'skills_known = ?', 'skills_to_learn = ?', 'discord_link = ?'];
    const updateValues = [name || existingUser.name, bio || existingUser.bio, skillsKnownJson, skillsToLearnJson, discordLink || existingUser.discord_link];

    if (password !== undefined) {
      updateFields.push('password = ?');
      updateValues.push(password);
    }

    updateFields.push('WHERE id = ?');
    updateValues.push(id);

    await query(`UPDATE users SET ${updateFields.join(', ')}`, updateValues);

    // Verify the update
    const updatedUsers = await query('SELECT * FROM users WHERE id = ?', [id]);
    if (updatedUsers.length === 0) {
      throw new Error('User update failed - record not found after update');
    }

    res.json(mapUserRow(updatedUsers[0]));
  } catch (err) {
    console.error('PUT /api/users/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const users = await query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // Simple password check (in production, use hashing)
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({
      user: mapUserRow(user),
      token: 'token-' + user.id
    });
  } catch (err) {
    console.error('POST /api/login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ========================================
// MESSAGE ENDPOINTS
// ========================================

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

// ========================================
// CONVERSATIONS ENDPOINT
// ========================================

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

// ========================================
// EXCHANGE REQUEST ENDPOINTS
// ========================================

app.post('/api/exchange-requests', async (req, res) => {
  try {
    const { requesterId, targetId, skillToTeach, skillToLearn, message } = req.body;

    if (!requesterId || !targetId || !skillToTeach || !skillToLearn) {
      return res.status(400).json({ error: 'Requester ID, target ID, skill to teach, and skill to learn are required' });
    }

    const id = crypto.randomUUID();

    await transaction(async (connection) => {
      // Insert exchange request
      await connection.execute(
        'INSERT INTO exchange_requests (id, requester_id, target_id, skill_to_teach, skill_to_learn, message) VALUES (?, ?, ?, ?, ?, ?)',
        [id, requesterId, targetId, skillToTeach, skillToLearn, message || '']
      );

      // Verify the insert
      const [insertedRequests] = await connection.execute('SELECT * FROM exchange_requests WHERE id = ?', [id]);
      if (insertedRequests.length === 0) {
        throw new Error('Exchange request insertion failed');
      }

      return insertedRequests[0];
    });

    const insertedRequests = await query('SELECT * FROM exchange_requests WHERE id = ?', [id]);
    res.status(201).json(mapExchangeRequestRow(insertedRequests[0]));
  } catch (err) {
    console.error('POST /api/exchange-requests error:', err.message);
    if (err.message.includes('insertion failed')) {
      res.status(500).json({ error: 'Failed to create exchange request' });
    } else {
      res.status(500).json({ error: 'Failed to create exchange request' });
    }
  }
});

app.get('/api/exchange-requests/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const requests = await query(
      'SELECT * FROM exchange_requests WHERE requester_id = ? OR target_id = ? ORDER BY created_at DESC',
      [userId, userId]
    );
    res.json(requests.map(mapExchangeRequestRow));
  } catch (err) {
    console.error('GET /api/exchange-requests error:', err.message);
    res.status(500).json({ error: 'Failed to fetch exchange requests' });
  }
});

app.put('/api/exchange-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'accepted', 'declined', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await query('UPDATE exchange_requests SET status = ? WHERE id = ?', [status, id]);

    // Verify the update
    const updatedRequests = await query('SELECT * FROM exchange_requests WHERE id = ?', [id]);
    if (updatedRequests.length === 0) {
      throw new Error('Exchange request update failed');
    }

    res.json(mapExchangeRequestRow(updatedRequests[0]));
  } catch (err) {
    console.error('PUT /api/exchange-requests error:', err.message);
    res.status(500).json({ error: 'Failed to update exchange request' });
  }
});

// ========================================
// QUIZ ENDPOINTS
// ========================================

app.get('/api/quizzes', async (req, res) => {
  try {
    const quizzes = await query('SELECT * FROM quizzes ORDER BY created_at DESC');
    res.json(quizzes.map(quiz => ({
      ...quiz,
      questions: safeParseJSON(quiz.questions, [])
    })));
  } catch (err) {
    console.error('GET /api/quizzes error:', err.message);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

app.post('/api/quiz-attempts', async (req, res) => {
  try {
    const { userId, quizId, answers } = req.body;

    if (!userId || !quizId || !answers) {
      return res.status(400).json({ error: 'User ID, quiz ID, and answers are required' });
    }

    const id = crypto.randomUUID();
    const answersJson = safeStringifyJSON(answers);

    await transaction(async (connection) => {
      // Insert quiz attempt
      await connection.execute(
        'INSERT INTO quiz_attempts (id, user_id, quiz_id, answers, completed) VALUES (?, ?, ?, ?, ?)',
        [id, userId, quizId, answersJson, true]
      );

      // Calculate score (simple implementation)
      const [quizResult] = await connection.execute('SELECT questions FROM quizzes WHERE id = ?', [quizId]);
      if (quizResult.length === 0) {
        throw new Error('Quiz not found');
      }

      const questions = safeParseJSON(quizResult[0].questions, []);
      let correct = 0;
      let total = questions.length;

      for (let i = 0; i < questions.length; i++) {
        if (answers[i] === questions[i].correctAnswer) {
          correct++;
        }
      }

      const score = total > 0 ? (correct / total) * 100 : 0;

      // Update score
      await connection.execute(
        'UPDATE quiz_attempts SET score = ?, completed_at = NOW() WHERE id = ?',
        [score, id]
      );

      // Verify the insert
      const [insertedAttempts] = await connection.execute('SELECT * FROM quiz_attempts WHERE id = ?', [id]);
      if (insertedAttempts.length === 0) {
        throw new Error('Quiz attempt insertion failed');
      }

      return insertedAttempts[0];
    });

    const insertedAttempts = await query('SELECT * FROM quiz_attempts WHERE id = ?', [id]);
    const attempt = insertedAttempts[0];

    res.status(201).json({
      ...attempt,
      answers: safeParseJSON(attempt.answers, [])
    });
  } catch (err) {
    console.error('POST /api/quiz-attempts error:', err.message);
    res.status(500).json({ error: 'Failed to submit quiz attempt' });
  }
});

// ========================================
// AI ENDPOINT
// ========================================

app.post('/ai', async (req, res) => {
  try {
    // Import dynamically to avoid issues if not available
    const { generateQuiz } = await import('./ai/mistralQuiz.js');
    const result = await generateQuiz(req.body);
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

// ========================================
// HEALTH CHECKS
// ========================================

app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'SkillVouch API Server Running' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', uptime: process.uptime() });
});

// ========================================
// STARTUP SEQUENCE
// ========================================

async function initializeServer() {
  console.log('\n🚀 Starting SkillVouch Backend Server...');

  // 1. Check database connection
  await checkDatabaseConnection();

  // 2. Create tables if they don't exist
  if (dbConnected) {
    await createTablesIfNotExist();
  }

  // 3. Start the server
  const PORT = process.env.PORT || 5000;
  const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

  app.listen(PORT, HOST, () => {
    console.log('\n✅ Server started successfully!');
    console.log(`📡 Listening on ${HOST}:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  Database: ${dbConnected ? 'Connected' : 'Disconnected'}`);
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'Not configured'}`);
    console.log('\n📋 Available endpoints:');
    console.log('   GET  /              - Basic health check');
    console.log('   GET  /health         - Health check');
    console.log('   GET  /api/db-status  - Database status');
    console.log('   POST /api/users      - Create user');
    console.log('   GET  /api/users      - List users');
    console.log('   POST /api/login      - User login');
    console.log('   POST /api/messages   - Send message');
    console.log('   POST /ai             - AI chat');
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  process.exit(0);
});

// Start the server
initializeServer().catch(err => {
  console.error('❌ Failed to initialize server:', err.message);
  process.exit(1);
});
