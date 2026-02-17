import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { ChatMistralAI } from '@langchain/mistralai';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQL_HOST,
  port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
  user: process.env.DB_USER || process.env.MYSQL_USER,
  password: process.env.DB_PASS || process.env.MYSQL_PASSWORD,
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

let dbConnected = false;
let dbConnectionAttempts = 0;
const maxDbRetries = 5;

async function query(sql, params = []) {
  if (!dbConnected) {
    throw new Error('Database connection unavailable');
  }
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

async function checkDatabaseConnection() {
  dbConnectionAttempts++;
  console.log(`🔍 Checking database connection (attempt ${dbConnectionAttempts}/${maxDbRetries})...`);

  try {
    const connection = await pool.getConnection();
    await connection.ping();
    await connection.execute('SELECT 1');
    connection.release();

    if (!dbConnected) {
      dbConnected = true;
      console.log('✅ MySQL connected successfully!');
      console.log(`📊 Database: ${process.env.DB_NAME || process.env.MYSQL_DATABASE}`);
      console.log(`🌐 Host: ${process.env.DB_HOST || process.env.MYSQL_HOST}`);
    }
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
        CREATE TABLE IF NOT EXISTS users (
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
        CREATE TABLE IF NOT EXISTS exchange_requests (
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
        CREATE TABLE IF NOT EXISTS exchange_feedback (
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
        CREATE TABLE IF NOT EXISTS messages (
          id VARCHAR(36) PRIMARY KEY,
          sender_id VARCHAR(36) NOT NULL,
          receiver_id VARCHAR(36) NOT NULL,
          content TEXT NOT NULL,
          timestamp BIGINT NOT NULL,
          \`read\` BOOLEAN DEFAULT FALSE,
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
        CREATE TABLE IF NOT EXISTS quizzes (
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
        CREATE TABLE IF NOT EXISTS quiz_attempts (
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

function validateSkill(skill) {
  if (!skill || typeof skill !== 'object') {
    throw new Error('Skill must be an object');
  }
  if (!skill.name || typeof skill.name !== 'string') {
    throw new Error('Skill must have a valid name');
  }
  return {
    name: skill.name.trim(),
    verified: skill.verified === true,
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

const app = express();

app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://skill-vouch-hexart-2026.vercel.app',
      'https://*.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002'
    ];

    if (!origin || allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const pattern = allowed.replace('*', '.*');
        return new RegExp(`^${pattern}$`).test(origin);
      }
      return allowed === origin;
    })) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
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
    const { name, bio, skillsKnown, skillsToLearn, discordLink, password, email } = req.body;

    const existingUsers = await query('SELECT * FROM users WHERE id = ?', [id]);
    if (existingUsers.length === 0) {
      const validatedSkillsKnown = skillsKnown ? validateSkillsArray(skillsKnown) : [];
      const validatedSkillsToLearn = skillsToLearn ? validateSkillsArray(skillsToLearn) : [];

      await query(
        `INSERT INTO users (id, name, email, password, bio, skills_known, skills_to_learn, discord_link, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name || '', email || '', password || '', bio || '', JSON.stringify(validatedSkillsKnown), JSON.stringify(validatedSkillsToLearn), discordLink || '', 5.0]
      );
    } else {
      const existingUser = existingUsers[0];

      let finalSkillsKnown = safeParseJSON(existingUser.skills_known, []);
      let finalSkillsToLearn = safeParseJSON(existingUser.skills_to_learn, []);

      if (skillsKnown !== undefined) {
        finalSkillsKnown = validateSkillsArray(skillsKnown);
      }
      if (skillsToLearn !== undefined) {
        finalSkillsToLearn = validateSkillsArray(skillsToLearn);
      }

      const skillsKnownJson = JSON.stringify(finalSkillsKnown);
      const skillsToLearnJson = JSON.stringify(finalSkillsToLearn);

      const updateFields = ['name = ?', 'bio = ?', 'skills_known = ?', 'skills_to_learn = ?', 'discord_link = ?'];
      const updateValues = [
        name !== undefined ? name : existingUser.name,
        bio !== undefined ? bio : existingUser.bio,
        skillsKnownJson,
        skillsToLearnJson,
        discordLink !== undefined ? discordLink : existingUser.discord_link
      ];

      if (password !== undefined) {
        updateFields.push('password = ?');
        updateValues.push(password);
      }

      updateFields.push('WHERE id = ?');
      updateValues.push(id);

      await query(`UPDATE users SET ${updateFields.join(', ')}`, updateValues);
    }

    const updatedUsers = await query('SELECT * FROM users WHERE id = ?', [id]);
    if (updatedUsers.length === 0) {
      console.error('PUT /api/users/:id DB write failed: User not found after update');
      return res.status(500).json({ error: 'User update failed - user not found after update' });
    }

    res.json(mapUserRow(updatedUsers[0]));
  } catch (err) {
    if (err.message.includes('Skill') || err.message.includes('skills')) {
      res.status(400).json({ error: 'Invalid skills format: ' + err.message });
    } else {
      console.error('PUT /api/users/:id DB write failed:', err.message);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { id, name, email, password, bio, skillsKnown, skillsToLearn, discordLink } = req.body;

    if (!id || !name || !email) {
      return res.status(400).json({ error: 'ID, name, and email are required' });
    }

    let validatedSkillsKnown = [];
    let validatedSkillsToLearn = [];

    if (skillsKnown) {
      validatedSkillsKnown = validateSkillsArray(skillsKnown);
    }
    if (skillsToLearn) {
      validatedSkillsToLearn = validateSkillsArray(skillsToLearn);
    }

    const skillsKnownJson = JSON.stringify(validatedSkillsKnown);
    const skillsToLearnJson = JSON.stringify(validatedSkillsToLearn);

    await query(
      `INSERT INTO users (id, name, email, password, bio, skills_known, skills_to_learn, discord_link, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, email, password || '', bio || '', skillsKnownJson, skillsToLearnJson, discordLink || '', 5.0]
    );

    const newUsers = await query('SELECT * FROM users WHERE id = ?', [id]);
    res.status(201).json(mapUserRow(newUsers[0]));
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

app.get('/api/requests', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

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

app.post('/api/requests', async (req, res) => {
  try {
    const { requesterId, targetId, skillToTeach, skillToLearn, message } = req.body;

    if (!requesterId || !targetId || !skillToTeach || !skillToLearn) {
      return res.status(400).json({ error: 'Requester ID, target ID, skill to teach, and skill to learn are required' });
    }

    const id = crypto.randomUUID();

    await query(
      'INSERT INTO exchange_requests (id, requester_id, target_id, skill_to_teach, skill_to_learn, message) VALUES (?, ?, ?, ?, ?, ?)',
      [id, requesterId, targetId, skillToTeach, skillToLearn, message || '']
    );

    const insertedRequests = await query('SELECT * FROM exchange_requests WHERE id = ?', [id]);
    res.status(201).json(mapExchangeRequestRow(insertedRequests[0]));
  } catch (err) {
    console.error('POST /api/requests error:', err.message);
    res.status(500).json({ error: 'Failed to create exchange request' });
  }
});

app.put('/api/requests/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'accepted', 'declined', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await query('UPDATE exchange_requests SET status = ? WHERE id = ?', [status, id]);

    const updatedRequests = await query('SELECT * FROM exchange_requests WHERE id = ?', [id]);
    if (updatedRequests.length === 0) {
      throw new Error('Exchange request update failed');
    }

    res.json(mapExchangeRequestRow(updatedRequests[0]));
  } catch (err) {
    console.error('PUT /api/requests/:id/status error:', err.message);
    res.status(500).json({ error: 'Failed to update exchange request' });
  }
});

app.post('/api/feedback', async (req, res) => {
  try {
    const { exchangeRequestId, fromUserId, toUserId, rating, comment } = req.body;

    if (!exchangeRequestId || !fromUserId || !toUserId || rating === undefined) {
      return res.status(400).json({ error: 'Exchange request ID, from user ID, to user ID, and rating are required' });
    }

    const id = crypto.randomUUID();

    await query(
      'INSERT INTO exchange_feedback (id, exchange_request_id, from_user_id, to_user_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)',
      [id, exchangeRequestId, fromUserId, toUserId, rating, comment || '']
    );

    const insertedFeedback = await query('SELECT * FROM exchange_feedback WHERE id = ?', [id]);
    res.status(201).json(insertedFeedback[0]);
  } catch (err) {
    console.error('POST /api/feedback error:', err.message);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

app.get('/api/feedback/received', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const feedback = await query(
      'SELECT * FROM exchange_feedback WHERE to_user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    res.json(feedback);
  } catch (err) {
    console.error('GET /api/feedback/received error:', err.message);
    res.status(500).json({ error: 'Failed to fetch received feedback' });
  }
});

app.get('/api/feedback/stats', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await query(
      'SELECT COUNT(*) as count, AVG(rating) as avgRating FROM exchange_feedback WHERE to_user_id = ?',
      [userId]
    );

    res.json({
      avgStars: parseFloat(result[0].avgRating || 0),
      count: result[0].count || 0
    });
  } catch (err) {
    console.error('GET /api/feedback/stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch feedback stats' });
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

app.get('/api/messages/conversation', async (req, res) => {
  try {
    const { user1Id, user2Id } = req.query;
    if (!user1Id || !user2Id) {
      return res.status(400).json({ error: 'Both user IDs are required' });
    }

    const messages = await query(
      'SELECT * FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY timestamp ASC',
      [user1Id, user2Id, user2Id, user1Id]
    );

    res.json(messages.map(mapMessageRow));
  } catch (err) {
    console.error('GET /api/messages/conversation error:', err.message);
    res.status(500).json({ error: 'Failed to fetch conversation' });
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

app.post('/api/messages/mark-as-read', async (req, res) => {
  try {
    const { userId, senderId } = req.body;
    if (!userId || !senderId) {
      return res.status(400).json({ error: 'User ID and sender ID are required' });
    }

    await query(
      'UPDATE messages SET read = TRUE WHERE receiver_id = ? AND sender_id = ? AND read = FALSE',
      [userId, senderId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/messages/mark-as-read error:', err.message);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

app.get('/api/conversations', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

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

const mistral = new ChatMistralAI({
  model: process.env.MISTRAL_MODEL || 'mistral-large-latest',
  temperature: 0.3,
  apiKey: process.env.MISTRAL_API_KEY,
});

app.post('/api/quizzes/generate', async (req, res) => {
  try {
    const { skill, difficulty } = req.body;

    if (!skill || typeof skill !== 'string') {
      return res.status(400).json({ error: 'Skill parameter must be a non-empty string' });
    }
    if (!difficulty || typeof difficulty !== 'string') {
      return res.status(400).json({ error: 'Difficulty parameter must be a non-empty string' });
    }

    const trimmedSkill = skill.trim();
    if (!trimmedSkill) {
      return res.status(400).json({ error: 'Skill parameter cannot be empty after trimming' });
    }

    const prompt = `Generate a quiz about ${trimmedSkill} at ${difficulty} level. Create 5 multiple choice questions with 4 options each. Return the response as JSON with this exact format:
{
  "title": "Quiz Title",
  "description": "Brief description",
  "questions": [
    {
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 0
    }
  ]
}`;

    const response = await mistral.invoke(prompt);
    const content = response.content;

    try {
      const quizData = JSON.parse(content);
      res.json(quizData);
    } catch (parseError) {
      console.error('Failed to parse Mistral response as JSON:', content);
      res.status(500).json({
        success: false,
        message: "AI service returned invalid format",
        error: parseError.message
      });
    }
  } catch (err) {
    console.error('POST /api/quizzes/generate error:', err.message);
    res.status(500).json({
      success: false,
      message: "AI service unavailable",
      error: err.message
    });
  }
});

app.post('/api/quizzes/submit', async (req, res) => {
  try {
    const { userId, quizId, answers } = req.body;

    if (!userId || !quizId || !answers) {
      return res.status(400).json({ error: 'User ID, quiz ID, and answers are required' });
    }

    const id = crypto.randomUUID();
    const answersJson = JSON.stringify(answers);

    await query(
      'INSERT INTO quiz_attempts (id, user_id, quiz_id, answers, completed) VALUES (?, ?, ?, ?, ?)',
      [id, userId, quizId, answersJson, true]
    );

    const quizResult = await query('SELECT questions FROM quizzes WHERE id = ?', [quizId]);
    if (quizResult.length === 0) {
      throw new Error('Quiz not found');
    }

    const questions = safeParseJSON(quizResult[0].questions, []);
    let correct = 0;
    let total = questions.length;

    for (let i = 0; i < questions.length; i++) {
      if (answers[i] === questions[i].correctAnswerIndex) {
        correct++;
      }
    }

    const score = total > 0 ? (correct / total) * 100 : 0;

    await query(
      'UPDATE quiz_attempts SET score = ?, completed_at = NOW() WHERE id = ?',
      [score, id]
    );

    const insertedAttempts = await query('SELECT * FROM quiz_attempts WHERE id = ?', [id]);
    const attempt = insertedAttempts[0];

    res.status(201).json({
      ...attempt,
      answers: safeParseJSON(attempt.answers, [])
    });
  } catch (err) {
    console.error('POST /api/quizzes/submit error:', err.message);
    res.status(500).json({ error: 'Failed to submit quiz attempt' });
  }
});

app.post('/api/skills/suggest', async (req, res) => {
  try {
    const { currentSkills, currentGoals } = req.body;

    const prompt = `Based on current skills: ${JSON.stringify(currentSkills || [])}
And learning goals: ${JSON.stringify(currentGoals || [])}

Suggest 5 new skills that would complement these. Return as JSON:
{
  "skills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5"]
}`;

    const response = await mistral.invoke(prompt);
    const content = response.content;

    try {
      const suggestions = JSON.parse(content);
      res.json(suggestions);
    } catch (parseError) {
      console.error('Failed to parse Mistral response as JSON:', content);
      res.status(500).json({
        success: false,
        message: "AI service returned invalid format",
        error: parseError.message
      });
    }
  } catch (err) {
    console.error('POST /api/skills/suggest error:', err.message);
    res.status(500).json({
      success: false,
      message: "AI service unavailable",
      error: err.message
    });
  }
});

app.post('/api/roadmap/generate', async (req, res) => {
  try {
    const { skill } = req.body;

    if (!skill || typeof skill !== 'string') {
      return res.status(400).json({ error: 'Skill parameter must be a non-empty string' });
    }

    const prompt = `Create a detailed learning roadmap for ${skill.trim()}. Return as JSON with this format:
{
  "title": "Skill Learning Roadmap",
  "description": "Overview of the learning journey",
  "milestones": [
    {
      "title": "Milestone Title",
      "description": "What to learn in this milestone",
      "duration": "X weeks",
      "resources": ["Resource 1", "Resource 2"],
      "projects": ["Project idea 1", "Project idea 2"]
    }
  ],
  "estimatedTime": "Total time to complete"
}`;

    const response = await mistral.invoke(prompt);
    const content = response.content;

    try {
      const roadmap = JSON.parse(content);
      res.json(roadmap);
    } catch (parseError) {
      console.error('Failed to parse Mistral response as JSON:', content);
      res.status(500).json({
        success: false,
        message: "AI service returned invalid format",
        error: parseError.message
      });
    }
  } catch (err) {
    console.error('POST /api/roadmap/generate error:', err.message);
    res.status(500).json({
      success: false,
      message: "AI service unavailable",
      error: err.message
    });
  }
});

app.post('/api/ai', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt must be a non-empty string' });
    }

    const response = await mistral.invoke(prompt);
    res.json({
      response: response.content,
      success: true
    });
  } catch (err) {
    console.error('AI endpoint error:', err.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: "AI service unavailable",
      error: err.message
    });
  }
});

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

app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'SkillVouch API Server Running' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', uptime: process.uptime() });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

async function initializeServer() {
  console.log('\n🚀 Starting SkillVouch Backend Server...');

  await checkDatabaseConnection();

  if (dbConnected) {
    await createTablesIfNotExist();
  }

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
    console.log('   POST /api/ai         - AI chat');
  });
}

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  process.exit(0);
});

initializeServer().catch(err => {
  console.error('❌ Failed to initialize server:', err.message);
  process.exit(1);
});
