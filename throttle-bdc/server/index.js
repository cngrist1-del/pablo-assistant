require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('fs');

// Database - PostgreSQL if URL provided, else SQLite
let db;
const DATABASE_URL = process.env.DATABASE_URL;

if (DATABASE_URL) {
  // PostgreSQL setup
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: DATABASE_URL });
  db = {
    query: (text, params) => pool.query(text, params),
    get: (sql, params) => pool.query(sql, params).then(r => r.rows[0]),
    all: (sql, params) => pool.query(sql, params).then(r => r.rows),
    run: (sql, params) => pool.query(sql, params).then(r => ({ lastInsertRowid: r.rows[0]?.id }))
  };
  // Initialize tables
  pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      name TEXT,
      role TEXT DEFAULT 'agent',
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      source TEXT,
      "bikeOfInterest" TEXT,
      status TEXT DEFAULT 'New',
      tags TEXT,
      "assignedTo" INTEGER,
      notes TEXT,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      "leadId" INTEGER,
      type TEXT,
      content TEXT,
      direction TEXT,
      timestamp TIMESTAMP DEFAULT NOW(),
      "userId" INTEGER
    );
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      "leadId" INTEGER,
      date TEXT,
      time TEXT,
      salesperson TEXT,
      "bikeOfInterest" TEXT,
      status TEXT DEFAULT 'Scheduled',
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS templates (
      id SERIAL PRIMARY KEY,
      name TEXT,
      type TEXT,
      content TEXT,
      "createdBy" INTEGER,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
  `).catch(console.error);
} else {
  // SQLite fallback
  const Database = require('better-sqlite3');
  const path = require('path');
  const dbPath = path.join(__dirname, 'throttle.db');
  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      name TEXT,
      role TEXT DEFAULT 'agent',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      phone TEXT,
      source TEXT,
      bikeOfInterest TEXT,
      status TEXT DEFAULT 'New',
      tags TEXT,
      assignedTo INTEGER,
      notes TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leadId INTEGER,
      type TEXT,
      content TEXT,
      direction TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      userId INTEGER
    );
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leadId INTEGER,
      date TEXT,
      time TEXT,
      salesperson TEXT,
      bikeOfInterest TEXT,
      status TEXT DEFAULT 'Scheduled',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      type TEXT,
      content TEXT,
      createdBy INTEGER,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // Default admin
  const adminExists = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@throttlebdc.com');
  if (!adminExists) {
    const hashed = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)').run('admin@throttlebdc.com', hashed, 'Chris Medellin', 'admin');
  }
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

// Twilio & Email
const twilio = require('twilio');
const nodemailer = require('nodemailer');
const { parseString } = require('xml2js');

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = process.env.EMAIL_PORT || 587;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

let twilioClient;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

const emailTransporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: false,
  auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.JWT_SECRET || 'throttle-secret-key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ============ AUTH ============
app.post('/api/auth/register', (req, res) => {
  const { email, password, name, role } = req.body;
  const hashed = bcrypt.hashSync(password, 10);
  try {
    if (DATABASE_URL) {
      db.query('INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4)', [email, hashed, name, role || 'agent']);
    } else {
      db.prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)').run(email, hashed, name, role || 'agent');
    }
    res.json({ message: 'User registered' });
  } catch { res.status(400).json({ message: 'User exists' }); }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const getUser = DATABASE_URL 
    ? () => db.query('SELECT * FROM users WHERE email = $1', [email]).then(r => r.rows[0])
    : () => Promise.resolve(db.prepare('SELECT * FROM users WHERE email = ?').get(email));
  
  getUser().then(user => {
    if (!user) return res.status(400).json({ message: 'User not found' });
    if (!bcrypt.compareSync(password, user.password)) return res.status(400).json({ message: 'Invalid password' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'throttle-secret-key');
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });
});

// ============ LEADS ============
const getLeads = (sql, params = []) => DATABASE_URL ? db.query(sql, params).then(r => r.rows) : db.prepare(sql).all(...params);

app.get('/api/leads', authenticateToken, async (req, res) => {
  let leads = await getLeads(DATABASE_URL ? 'SELECT * FROM leads ORDER BY "createdAt" DESC' : 'SELECT * FROM leads ORDER BY createdAt DESC');
  if (req.query.status) leads = leads.filter(l => l.status === req.query.status);
  if (req.query.source) leads = leads.filter(l => l.source === req.query.source);
  if (req.query.search) leads = leads.filter(l => l.name?.toLowerCase().includes(req.query.search.toLowerCase()) || l.email?.toLowerCase().includes(req.query.search.toLowerCase()) || l.phone?.includes(req.query.search));
  res.json(leads);
});

app.get('/api/leads/:id', authenticateToken, async (req, res) => {
  const lead = await getLeads(DATABASE_URL ? 'SELECT * FROM leads WHERE id = $1' : 'SELECT * FROM leads WHERE id = ?', [req.params.id]);
  const leadData = Array.isArray(lead) ? lead[0] : lead;
  if (!leadData) return res.status(404).json({ message: 'Lead not found' });
  const messages = await getLeads(DATABASE_URL ? 'SELECT * FROM messages WHERE "leadId" = $1 ORDER BY timestamp ASC' : 'SELECT * FROM messages WHERE leadId = ? ORDER BY timestamp ASC', [leadData.id]);
  res.json({ ...leadData, messages });
});

app.post('/api/leads', authenticateToken, async (req, res) => {
  const { name, email, phone, source, bikeOfInterest, notes } = req.body;
  const now = new Date().toISOString();
  if (DATABASE_URL) {
    const r = await db.query('INSERT INTO leads (name, email, phone, source, "bikeOfInterest", notes, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id', [name, email, phone, source || 'Website', bikeOfInterest || '', notes || '', now, now]);
    db.query('INSERT INTO messages ("leadId", type, content, direction, timestamp) VALUES ($1, $2, $3, $4, $5)', [r.rows[0].id, 'note', 'Lead created', 'system', now]);
    res.json({ id: r.rows[0].id, name, email, phone, source, bikeOfInterest, notes, status: 'New', createdAt: now, updatedAt: now });
  } else {
    const stmt = db.prepare('INSERT INTO leads (name, email, phone, source, bikeOfInterest, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const result = stmt.run(name, email, phone, source || 'Website', bikeOfInterest || '', notes || '', now, now);
    db.prepare('INSERT INTO messages (leadId, type, content, direction, timestamp) VALUES (?, ?, ?, ?, ?)').run(result.lastInsertRowid, 'note', 'Lead created', 'system', now);
    res.json({ id: result.lastInsertRowid, name, email, phone, source, bikeOfInterest, notes, status: 'New', createdAt: now, updatedAt: now });
  }
});

app.put('/api/leads/:id', authenticateToken, async (req, res) => {
  const now = new Date().toISOString();
  const fields = Object.keys(req.body).filter(k => k !== 'id').map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = Object.keys(req.body).filter(k => k !== 'id').map(k => req.body[k]);
  if (DATABASE_URL) {
    await db.query(`UPDATE leads SET ${fields}, "updatedAt" = $${values.length + 1} WHERE id = $${values.length}`, [...values, now, req.params.id]);
  } else {
    db.prepare(`UPDATE leads SET ${fields}, updatedAt = ? WHERE id = ?`).run(...values, now, req.params.id);
  }
  res.json({ success: true });
});

app.delete('/api/leads/:id', authenticateToken, async (req, res) => {
  if (DATABASE_URL) await db.query('DELETE FROM leads WHERE id = $1', [req.params.id]);
  else db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ message: 'Lead deleted' });
});

// ============ MESSAGES ============
app.post('/api/messages/send-sms', authenticateToken, async (req, res) => {
  const { leadId, content } = req.body;
  const lead = await getLeads(DATABASE_URL ? 'SELECT * FROM leads WHERE id = $1' : 'SELECT * FROM leads WHERE id = ?', [leadId]);
  const leadData = Array.isArray(lead) ? lead[0] : lead;
  if (!leadData) return res.status(404).json({ message: 'Lead not found' });
  if (!twilioClient) return res.status(500).json({ message: 'Twilio not configured' });
  try {
    const msg = await twilioClient.messages.create({ body: content, from: TWILIO_PHONE_NUMBER, to: leadData.phone });
    const now = new Date().toISOString();
    if (DATABASE_URL) {
      await db.query('INSERT INTO messages ("leadId", type, content, direction, timestamp) VALUES ($1, $2, $3, $4, $5)', [leadId, 'sms', content, 'outbound', now]);
    } else {
      db.prepare('INSERT INTO messages (leadId, type, content, direction, timestamp) VALUES (?, ?, ?, ?, ?)').run(leadId, 'sms', content, 'outbound', now);
    }
    res.json({ success: true, sid: msg.sid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/messages/send-email', authenticateToken, async (req, res) => {
  const { leadId, subject, content } = req.body;
  const lead = await getLeads(DATABASE_URL ? 'SELECT * FROM leads WHERE id = $1' : 'SELECT * FROM leads WHERE id = ?', [leadId]);
  const leadData = Array.isArray(lead) ? lead[0] : lead;
  if (!leadData) return res.status(404).json({ message: 'Lead not found' });
  if (!emailTransporter) return res.status(500).json({ message: 'Email not configured' });
  try {
    await emailTransporter.sendMail({ from: EMAIL_USER, to: leadData.email, subject, text: content });
    const now = new Date().toISOString();
    if (DATABASE_URL) {
      await db.query('INSERT INTO messages ("leadId", type, content, direction, timestamp) VALUES ($1, $2, $3, $4, $5)', [leadId, 'email', content, 'outbound', now]);
    } else {
      db.prepare('INSERT INTO messages (leadId, type, content, direction, timestamp) VALUES (?, ?, ?, ?, ?)').run(leadId, 'email', content, 'outbound', now);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/webhooks/twilio', (req, res) => {
  const { From, Body } = req.body;
  getLeads(DATABASE_URL ? 'SELECT * FROM leads WHERE phone = $1' : 'SELECT * FROM leads WHERE phone = ?', [From]).then(lead => {
    const leadData = Array.isArray(lead) ? lead[0] : lead;
    if (leadData) {
      const now = new Date().toISOString();
      if (DATABASE_URL) {
        db.query('INSERT INTO messages ("leadId", type, content, direction, timestamp) VALUES ($1, $2, $3, $4, $5)', [leadData.id, 'sms', Body, 'inbound', now]);
        db.query('UPDATE leads SET status = $1, "updatedAt" = $2 WHERE id = $3', ['Contacted', now, leadData.id]);
      } else {
        db.prepare('INSERT INTO messages (leadId, type, content, direction, timestamp) VALUES (?, ?, ?, ?, ?)').run(leadData.id, 'sms', Body, 'inbound', now);
        db.prepare('UPDATE leads SET status = ?, updatedAt = ? WHERE id = ?').run('Contacted', now, leadData.id);
      }
    }
    res.send('<Response></Response>');
  });
});

app.get('/api/messages/:leadId', authenticateToken, async (req, res) => {
  const messages = await getLeads(DATABASE_URL ? 'SELECT * FROM messages WHERE "leadId" = $1 ORDER BY timestamp ASC' : 'SELECT * FROM messages WHERE leadId = ? ORDER BY timestamp ASC', [req.params.leadId]);
  res.json(messages);
});

// ============ TEMPLATES ============
app.get('/api/templates', authenticateToken, async (req, res) => res.json(await getLeads(DATABASE_URL ? 'SELECT * FROM templates' : 'SELECT * FROM templates')));
app.post('/api/templates', authenticateToken, async (req, res) => {
  const { name, type, content } = req.body;
  const now = new Date().toISOString();
  if (DATABASE_URL) await db.query('INSERT INTO templates (name, type, content, "createdBy", "createdAt") VALUES ($1, $2, $3, $4, $5)', [name, type, content, req.user.id, now]);
  else db.prepare('INSERT INTO templates (name, type, content, createdBy, createdAt) VALUES (?, ?, ?, ?, ?)').run(name, type, content, req.user.id, now);
  res.json({ success: true });
});

// ============ APPOINTMENTS ============
app.get('/api/appointments', authenticateToken, async (req, res) => {
  let appts = await getLeads(DATABASE_URL ? 'SELECT * FROM appointments ORDER BY date ASC' : 'SELECT * FROM appointments ORDER BY date ASC');
  if (req.query.date) appts = appts.filter(a => a.date.startsWith(req.query.date));
  res.json(appts);
});

app.post('/api/appointments', authenticateToken, async (req, res) => {
  const { leadId, date, time, salesperson, bikeOfInterest } = req.body;
  const now = new Date().toISOString();
  if (DATABASE_URL) {
    await db.query('INSERT INTO appointments ("leadId", date, time, salesperson, "bikeOfInterest", status) VALUES ($1, $2, $3, $4, $5, $6)', [leadId, date, time, salesperson, bikeOfInterest, 'Scheduled']);
    await db.query('UPDATE leads SET status = $1, "updatedAt" = $2 WHERE id = $3', ['Appointment', now, leadId]);
  } else {
    db.prepare('INSERT INTO appointments (leadId, date, time, salesperson, bikeOfInterest, status) VALUES (?, ?, ?, ?, ?, ?)').run(leadId, date, time, salesperson, bikeOfInterest, 'Scheduled');
    db.prepare('UPDATE leads SET status = ?, updatedAt = ? WHERE id = ?').run('Appointment', now, leadId);
  }
  res.json({ success: true });
});

app.put('/api/appointments/:id', authenticateToken, async (req, res) => {
  const fields = Object.keys(req.body).map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = Object.values(req.body);
  if (DATABASE_URL) await db.query(`UPDATE appointments SET ${fields} WHERE id = $${values.length}`, [...values, req.params.id]);
  else db.prepare(`UPDATE appointments SET ${fields} WHERE id = ?`).run(...values, req.params.id);
  res.json({ success: true });
});

// ============ DASHBOARD ============
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  const stats = {};
  if (DATABASE_URL) {
    stats.totalLeads = (await db.query('SELECT COUNT(*) FROM leads')).rows[0].count;
    stats.newLeads = (await db.query('SELECT COUNT(*) FROM leads WHERE status = $1', ['New'])).rows[0].count;
    stats.contacted = (await db.query('SELECT COUNT(*) FROM leads WHERE status = $1', ['Contacted'])).rows[0].count;
    stats.appointment = (await db.query('SELECT COUNT(*) FROM leads WHERE status = $1', ['Appointment'])).rows[0].count;
    stats.showed = (await db.query('SELECT COUNT(*) FROM leads WHERE status = $1', ['Showed'])).rows[0].count;
    stats.sold = (await db.query('SELECT COUNT(*) FROM leads WHERE status = $1', ['Sold'])).rows[0].count;
  } else {
    stats.totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
    stats.newLeads = db.prepare('SELECT COUNT(*) as count FROM leads WHERE status = ?').get('New').count;
    stats.contacted = db.prepare('SELECT COUNT(*) as count FROM leads WHERE status = ?').get('Contacted').count;
    stats.appointment = db.prepare('SELECT COUNT(*) as count FROM leads WHERE status = ?').get('Appointment').count;
    stats.showed = db.prepare('SELECT COUNT(*) as count FROM leads WHERE status = ?').get('Showed').count;
    stats.sold = db.prepare('SELECT COUNT(*) as count FROM leads WHERE status = ?').get('Sold').count;
  }
  stats.appointmentRate = stats.totalLeads ? ((stats.appointment / stats.totalLeads) * 100).toFixed(1) : 0;
  stats.showRate = stats.appointment ? ((stats.showed / stats.appointment) * 100).toFixed(1) : 0;
  stats.closeRate = stats.showed ? ((stats.sold / stats.showed) * 100).toFixed(1) : 0;
  res.json(stats);
});

// ============ ADF INGEST ============
app.post('/api/leads/ingest-adf', express.text(), async (req, res) => {
  const xml = req.body;
  parseString(xml, (err, result) => {
    if (err || !result) return res.status(400).json({ error: 'Invalid ADF' });
    try {
      const p = result.adf.prospect[0].customer[0].contact[0];
      const name = `${p.name[0].$.first} ${p.name[0].$.last}`;
      const email = p.email[0];
      const phone = p.phone[0]._;
      const v = result.adf.prospect[0]['vehiclewantedinformation'][0];
      const bike = `${v.year} ${v.make} ${v.model}`;
      const now = new Date().toISOString();
      if (DATABASE_URL) {
        const r = await db.query('INSERT INTO leads (name, email, phone, source, "bikeOfInterest", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id', [name, email, phone, 'ADF Import', bike, now, now]);
        res.json({ success: true, leadId: r.rows[0].id });
      } else {
        const resultLead = db.prepare('INSERT INTO leads (name, email, phone, source, bikeOfInterest, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)').run(name, email, phone, 'ADF Import', bike, now, now);
        res.json({ success: true, leadId: resultLead.lastInsertRowid });
      }
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
});

// Twilio Webhook (no auth required)
app.post('/webhook', (req, res) => {
  const incoming = req.body.Body || req.body || 'No message';
  console.log('Incoming message:', incoming);
  
  res.set('Content-Type', 'text/xml');
  res.send(`
<Response>
  <Message>Hey this is Chris with Throttle Response BDC — what bike are you looking at?</Message>
</Response>
  `);
});

// Serve static files
app.use(express.static(path.join(__dirname, '../client/build')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/build', 'index.html')));

app.listen(PORT, () => console.log(`ThrottleBDC running on port ${PORT}`));
