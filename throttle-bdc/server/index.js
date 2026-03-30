require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

const db = { users: [], leads: [], messages: [], appointments: [], templates: [] };

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

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = { id: db.users.length + 1, email, password: hashedPassword, name, role: role || 'agent', createdAt: new Date() };
  db.users.push(user);
  res.json({ message: 'User registered successfully' });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find(u => u.email === email);
  if (!user) return res.status(400).json({ message: 'User not found' });
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return res.status(400).json({ message: 'Invalid password' });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'throttle-secret-key');
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

app.get('/api/leads', authenticateToken, (req, res) => {
  let leads = [...db.leads];
  if (req.query.status) leads = leads.filter(l => l.status === req.query.status);
  if (req.query.source) leads = leads.filter(l => l.source === req.query.source);
  if (req.query.search) leads = leads.filter(l => l.name.toLowerCase().includes(req.query.search.toLowerCase()) || l.email.toLowerCase().includes(req.query.search.toLowerCase()) || l.phone.includes(req.query.search));
  res.json(leads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.get('/api/leads/:id', authenticateToken, (req, res) => {
  const lead = db.leads.find(l => l.id === parseInt(req.params.id));
  if (!lead) return res.status(404).json({ message: 'Lead not found' });
  const leadMessages = db.messages.filter(m => m.leadId === lead.id);
  res.json({ ...lead, messages: leadMessages });
});

app.post('/api/leads', authenticateToken, (req, res) => {
  const { name, email, phone, source, bikeOfInterest, notes } = req.body;
  const lead = { id: db.leads.length + 1, name, email, phone, source: source || 'Website', bikeOfInterest: bikeOfInterest || '', status: 'New', tags: [], assignedTo: null, notes: notes || '', activity: [{ type: 'created', message: 'Lead created', timestamp: new Date() }], createdAt: new Date(), updatedAt: new Date() };
  db.leads.push(lead);
  res.json(lead);
});

app.put('/api/leads/:id', authenticateToken, (req, res) => {
  const leadIndex = db.leads.findIndex(l => l.id === parseInt(req.params.id));
  if (leadIndex === -1) return res.status(404).json({ message: 'Lead not found' });
  db.leads[leadIndex] = { ...db.leads[leadIndex], ...req.body, updatedAt: new Date() };
  res.json(db.leads[leadIndex]);
});

app.delete('/api/leads/:id', authenticateToken, (req, res) => {
  db.leads = db.leads.filter(l => l.id !== parseInt(req.params.id));
  res.json({ message: 'Lead deleted' });
});

app.get('/api/messages/:leadId', authenticateToken, (req, res) => {
  const messages = db.messages.filter(m => m.leadId === parseInt(req.params.leadId));
  res.json(messages);
});

app.post('/api/messages', authenticateToken, (req, res) => {
  const { leadId, type, content, direction } = req.body;
  const message = { id: db.messages.length + 1, leadId: parseInt(leadId), type, content, direction, timestamp: new Date(), userId: req.user.id };
  db.messages.push(message);
  const lead = db.leads.find(l => l.id === parseInt(leadId));
  if (lead) { lead.activity.push({ type: 'message', message: direction === 'inbound' ? 'Received' : 'Sent', timestamp: new Date() }); lead.updatedAt = new Date(); }
  res.json(message);
});

app.get('/api/templates', authenticateToken, (req, res) => res.json(db.templates));

app.post('/api/templates', authenticateToken, (req, res) => {
  const template = { id: db.templates.length + 1, ...req.body, createdBy: req.user.id, createdAt: new Date() };
  db.templates.push(template);
  res.json(template);
});

app.get('/api/appointments', authenticateToken, (req, res) => {
  let appointments = [...db.appointments];
  if (req.query.date) appointments = appointments.filter(a => a.date.startsWith(req.query.date));
  if (req.query.status) appointments = appointments.filter(a => a.status === req.query.status);
  res.json(appointments.sort((a, b) => new Date(a.date) - new Date(b.date)));
});

app.post('/api/appointments', authenticateToken, (req, res) => {
  const { leadId, date, time, salesperson, bikeOfInterest } = req.body;
  const appointment = { id: db.appointments.length + 1, leadId: parseInt(leadId), date, time, salesperson, bikeOfInterest, status: 'Scheduled', createdAt: new Date() };
  db.appointments.push(appointment);
  const lead = db.leads.find(l => l.id === parseInt(leadId));
  if (lead) { lead.status = 'Appointment'; lead.activity.push({ type: 'appointment', message: 'Appointment scheduled', timestamp: new Date() }); }
  res.json(appointment);
});

app.put('/api/appointments/:id', authenticateToken, (req, res) => {
  const index = db.appointments.findIndex(a => a.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ message: 'Appointment not found' });
  db.appointments[index] = { ...db.appointments[index], ...req.body };
  res.json(db.appointments[index]);
});

app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  const totalLeads = db.leads.length;
  const newLeads = db.leads.filter(l => l.status === 'New').length;
  const contacted = db.leads.filter(l => l.status === 'Contacted').length;
  const appointment = db.leads.filter(l => l.status === 'Appointment').length;
  const showed = db.leads.filter(l => l.status === 'Showed').length;
  const sold = db.leads.filter(l => l.status === 'Sold').length;
  res.json({ totalLeads, newLeads, contacted, appointment, showed, sold, appointmentRate: totalLeads ? ((appointment / totalLeads) * 100).toFixed(1) : 0, showRate: appointment ? ((showed / appointment) * 100).toFixed(1) : 0, closeRate: showed ? ((sold / showed) * 100).toFixed(1) : 0 });
});

const seedDatabase = () => {
  db.users.push({ id: 1, email: 'admin@throttlebdc.com', password: '$2a$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', name: 'Chris Medellin', role: 'admin', createdAt: new Date() });
  db.leads = [{ id: 1, name: 'Mark Haggray', email: 'markkeepitmoving@gmail.com', phone: '9123461115', source: 'MotoMate123', bikeOfInterest: 'Street Glide 3 Limited', status: 'New', tags: ['HOT'], assignedTo: 1, notes: '', activity: [{ type: 'created', message: 'Lead created', timestamp: new Date() }], createdAt: new Date(), updatedAt: new Date() }, { id: 2, name: 'Guy Houser', email: 'guyhouser@yahoo.com', phone: '4044577515', source: 'MotoMate123', bikeOfInterest: 'Heritage Softail Classic', status: 'Contacted', tags: ['Trade-In'], assignedTo: 1, notes: '', activity: [{ type: 'created', message: 'Lead created', timestamp: new Date() }], createdAt: new Date(), updatedAt: new Date() }];
  db.templates = [{ id: 1, name: 'Initial Contact', type: 'sms', content: 'Hey {name}, this is Chris with Falcons Fury Harley-Davidson. Let\'s get you riding!' }, { id: 2, name: 'Appointment Reminder', type: 'sms', content: 'Hey {name}, just a reminder about your appointment tomorrow. See you then!' }, { id: 3, name: 'Follow Up', type: 'email', content: 'Hey {name},\n\nHaven\'t heard back from you. What do you need to get this deal done?\n\nChris' }];
  console.log('Database seeded!');
};

seedDatabase();
app.listen(PORT, () => console.log(\`ThrottleBDC Server running on port \${PORT}\`));
