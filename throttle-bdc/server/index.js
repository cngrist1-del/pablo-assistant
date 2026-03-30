require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const twilio = require('twilio');
const nodemailer = require('nodemailer');
const { parseString } = require('xml2js');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

// Database initialization (SQLite)
const dbPath = path.join(__dirname, 'throttle.db');
const db = new Database(dbPath);

// Create tables if they don't exist
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

// Initialize default admin user if not exists
const adminExists = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@throttlebdc.com');
if (!adminExists) {
  const hashed = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)').run('admin@throttlebdc.com', hashed, 'Chris Medellin', 'admin');
}

// Environment variables for Twilio & Email
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = process.env.EMAIL_PORT || 587;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// Twilio client
let twilioClient;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

// Email transporter
const emailTransporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: false,
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
});

// Helper: authenticate token
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

// ============ AUTH ROUTES ============

app.post('/api/auth/register', (req, res) => {
  const { email, password, name, role } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  try {
    db.prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)').run(email, hashedPassword, name, role || 'agent');
    res.json({ message: 'User registered successfully' });
  } catch (e) {
    res.status(400).json({ message: 'User already exists' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(400).json({ message: 'User not found' });
  const validPassword = bcrypt.compareSync(password, user.password);
  if (!validPassword) return res.status(400).json({ message: 'Invalid password' });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'throttle-secret-key');
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

// ============ LEAD ROUTES ============

app.get('/api/leads', authenticateToken, (req, res) => {
  let leads = db.prepare('SELECT * FROM leads ORDER BY createdAt DESC').all();
  if (req.query.status) leads = leads.filter(l => l.status === req.query.status);
  if (req.query.source) leads = leads.filter(l => l.source === req.query.source);
  if (req.query.search) leads = leads.filter(l => l.name.toLowerCase().includes(req.query.search.toLowerCase()) || l.email.toLowerCase().includes(req.query.search.toLowerCase()) || l.phone.includes(req.query.search));
  res.json(leads);
});

app.get('/api/leads/:id', authenticateToken, (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found' });
  const messages = db.prepare('SELECT * FROM messages WHERE leadId = ? ORDER BY timestamp ASC').all(lead.id);
  res.json({ ...lead, messages });
});

app.post('/api/leads', authenticateToken, (req, res) => {
  const { name, email, phone, source, bikeOfInterest, notes } = req.body;
  const now = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO leads (name, email, phone, source, bikeOfInterest, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const result = stmt.run(name, email, phone, source || 'Website', bikeOfInterest || '', notes || '', now, now);
  const newLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);
  // Auto-create activity
  db.prepare('INSERT INTO messages (leadId, type, content, direction, timestamp) VALUES (?, ?, ?, ?, ?)').run(newLead.id, 'note', 'Lead created', 'system', now);
  res.json(newLead);
});

app.put('/api/leads/:id', authenticateToken, (req, res) => {
  const now = new Date().toISOString();
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found' });
  const fields = Object.keys(req.body).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
  const values = Object.keys(req.body).filter(k => k !== 'id').map(k => req.body[k]);
  db.prepare(`UPDATE leads SET ${fields}, updatedAt = ? WHERE id = ?`).run(...values, now, req.params.id);
  res.json(db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id));
});

app.delete('/api/leads/:id', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ message: 'Lead deleted' });
});

// ============ MESSAGE ROUTES (SMS/Email) ============

app.post('/api/messages/send-sms', authenticateToken, async (req, res) => {
  const { leadId, content } = req.body;
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
  if (!lead) return res.status(404).json({ message: 'Lead not found' });
  if (!twilioClient) return res.status(500).json({ message: 'Twilio not configured' });
  try {
    const msg = await twilioClient.messages.create({
      body: content,
      from: TWILIO_PHONE_NUMBER,
      to: lead.phone
    });
    const now = new Date().toISOString();
    db.prepare('INSERT INTO messages (leadId, type, content, direction, timestamp) VALUES (?, ?, ?, ?, ?)').run(leadId, 'sms', content, 'outbound', now);
    res.json({ success: true, sid: msg.sid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/messages/send-email', authenticateToken, async (req, res) => {
  const { leadId, subject, content } = req.body;
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
  if (!lead) return res.status(404).json({ message: 'Lead not found' });
  if (!emailTransporter) return res.status(500).json({ message: 'Email not configured' });
  try {
    await emailTransporter.sendMail({
      from: EMAIL_USER,
      to: lead.email,
      subject,
      text: content
    });
    const now = new Date().toISOString();
    db.prepare('INSERT INTO messages (leadId, type, content, direction, timestamp) VALUES (?, ?, ?, ?, ?)').run(leadId, 'email', content, 'outbound', now);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Twilio webhook for incoming SMS
app.post('/api/webhooks/twilio', (req, res) => {
  const { From, Body } = req.body;
  // Find lead by phone
  const lead = db.prepare('SELECT * FROM leads WHERE phone = ?').get(From);
  if (lead) {
    const now = new Date().toISOString();
    db.prepare('INSERT INTO messages (leadId, type, content, direction, timestamp) VALUES (?, ?, ?, ?, ?)').run(lead.id, 'sms', Body, 'inbound', now);
    // Update lead status to 'Contacted'
    db.prepare('UPDATE leads SET status = ?, updatedAt = ? WHERE id = ?').run('Contacted', now, lead.id);
  }
  res.send('<Response></Response>');
});

// ============ EMAIL ROUTES ============

app.get('/api/messages/:leadId', authenticateToken, (req, res) => {
  const messages = db.prepare('SELECT * FROM messages WHERE leadId = ? ORDER BY timestamp ASC').all(req.params.leadId);
  res.json(messages);
});

app.post('/api/messages', authenticateToken, (req, res) => {
  const { leadId, type, content, direction } = req.body;
  const now = new Date().toISOString();
  db.prepare('INSERT INTO messages (leadId, type, content, direction, timestamp, userId) VALUES (?, ?, ?, ?, ?, ?)').run(leadId, type, content, direction, now, req.user.id);
  res.json({ success: true });
});

// ============ TEMPLATE ROUTES ============

app.get('/api/templates', authenticateToken, (req, res) => {
  res.json(db.prepare('SELECT * FROM templates').all());
});

app.post('/api/templates', authenticateToken, (req, res) => {
  const { name, type, content } = req.body;
  const now = new Date().toISOString();
  db.prepare('INSERT INTO templates (name, type, content, createdBy, createdAt) VALUES (?, ?, ?, ?, ?)').run(name, type, content, req.user.id, now);
  res.json({ success: true });
});

// ============ APPOINTMENT ROUTES ============

app.get('/api/appointments', authenticateToken, (req, res) => {
  let appts = db.prepare('SELECT * FROM appointments ORDER BY date ASC').all();
  if (req.query.date) appts = appts.filter(a => a.date.startsWith(req.query.date));
  if (req.query.status) appts = appts.filter(a => a.status === req.query.status);
  res.json(appts);
});

app.post('/api/appointments', authenticateToken, (req, res) => {
  const { leadId, date, time, salesperson, bikeOfInterest } = req.body;
  const now = new Date().toISOString();
  db.prepare('INSERT INTO appointments (leadId, date, time, salesperson, bikeOfInterest, status) VALUES (?, ?, ?, ?, ?, ?)').run(leadId, date, time, salesperson, bikeOfInterest, 'Scheduled');
  db.prepare('UPDATE leads SET status = ?, updatedAt = ? WHERE id = ?').run('Appointment', now, leadId);
  res.json({ success: true });
});

app.put('/api/appointments/:id', authenticateToken, (req, res) => {
  const fields = Object.keys(req.body).map(k => `${k} = ?`).join(', ');
  const values = Object.values(req.body);
  db.prepare(`UPDATE appointments SET ${fields} WHERE id = ?`).run(...values, req.params.id);
  res.json({ success: true });
});

// ============ DASHBOARD STATS ============

app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
  const newLeads = db.prepare('SELECT COUNT(*) as count FROM leads WHERE status = ?').get('New').count;
  const contacted = db.prepare('SELECT COUNT(*) as count FROM leads WHERE status = ?').get('Contacted').count;
  const appointment = db.prepare('SELECT COUNT(*) as count FROM leads WHERE status = ?').get('Appointment').count;
  const showed = db.prepare('SELECT COUNT(*) as count FROM leads WHERE status = ?').get('Showed').count;
  const sold = db.prepare('SELECT COUNT(*) as count FROM leads WHERE status = ?').get('Sold').count;
  const appointmentRate = totalLeads ? ((appointment / totalLeads) * 100).toFixed(1) : 0;
  const showRate = appointment ? ((showed / appointment) * 100).toFixed(1) : 0;
  const closeRate = showed ? ((sold / showed) * 100).toFixed(1) : 0;
  res.json({ totalLeads, newLeads, contacted, appointment, showed, sold, appointmentRate, showRate, closeRate });
});

// ============ ADF/XML LEAD INGESTION ============

app.post('/api/leads/ingest-adf', (req, res) => {
  const adfXml = req.body.xml || '';
  parseString(adfXml, (err, result) => {
    if (err || !result) return res.status(400).json({ error: 'Invalid ADF' });
    try {
      const p = result.adf.prospect[0].customer[0].contact[0];
      const name = `${p['name'][0].$.first} ${p['name'][0].$.last}`;
      const email = p['email'][0];
      const phone = p['phone'][0]._;
      const vehicle = result.adf.prospect[0]['vehiclewantedinformation'][0];
      const bike = `${vehicle['year']} ${vehicle['make']} ${vehicle['model']}`;
      const now = new Date().toISOString();
      const stmt = db.prepare('INSERT INTO leads (name, email, phone, source, bikeOfInterest, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const resultLead = stmt.run(name, email, phone, 'ADF Import', bike, now, now);
      // Auto-response could be triggered here
      res.json({ success: true, leadId: resultLead.lastInsertRowid });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// ============ SERVE STATIC FILES (Production) ============

app.use(express.static(path.join(__dirname, '../client/build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

// Start server
app.listen(PORT, () => console.log(`ThrottleBDC Server running on port ${PORT}`));
