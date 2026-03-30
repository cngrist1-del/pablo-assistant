const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Email configuration - UPDATE THESE WITH YOUR SMTP SETTINGS
const emailConfig = {
    host: 'smtp.mail.portsmaster.co', // or your SMTP host
    port: 587,
    secure: false,
    auth: {
        user: 'BDC1@falconsfuryhd.com',
        pass: 'tnfn zlyn qvig hnmu' // app password
    }
};

// In-memory storage (for demo - use database in production)
let leads = [];
let contacts = [];
let appointments = [];

// Load data if exists
try {
    if (fs.existsSync('leads.json')) leads = JSON.parse(fs.readFileSync('leads.json'));
    if (fs.existsSync('contacts.json')) contacts = JSON.parse(fs.readFileSync('contacts.json'));
    if (fs.existsSync('appointments.json')) appointments = JSON.parse(fs.readFileSync('appointments.json'));
} catch (e) {}

// Save helpers
const saveData = () => {
    fs.writeFileSync('leads.json', JSON.stringify(leads));
    fs.writeFileSync('contacts.json', JSON.stringify(contacts));
    fs.writeFileSync('appointments.json', JSON.stringify(appointments));
};

// Transporter
const transporter = nodemailer.createTransport(emailConfig);

// API Routes

// Get all leads
app.get('/api/leads', (req, res) => {
    res.json(leads);
});

// Add/Update lead
app.post('/api/leads', (req, res) => {
    const { id, name, phone, email, source, model, status, notes } = req.body;
    const idx = leads.findIndex(l => l.id === id);
    const lead = { id: id || Date.now().toString(), name, phone, email, source, model, status, notes, updatedAt: new Date().toISOString() };
    if (idx >= 0) leads[idx] = lead;
    else leads.push(lead);
    saveData();
    res.json(lead);
});

// Delete lead
app.delete('/api/leads/:id', (req, res) => {
    leads = leads.filter(l => l.id !== req.params.id);
    saveData();
    res.json({ success: true });
});

// Get contacts for lead
app.get('/api/contacts/:leadId', (req, res) => {
    const filtered = contacts.filter(c => c.leadId === req.params.leadId);
    res.json(filtered);
});

// Add contact
app.post('/api/contacts', (req, res) => {
    const { leadId, type, notes } = req.body;
    const contact = { id: Date.now().toString(), leadId, type, notes, date: new Date().toISOString() };
    contacts.push(contact);
    saveData();
    res.json(contact);
});

// Get appointments
app.get('/api/appointments', (req, res) => {
    res.json(appointments);
});

// Add appointment
app.post('/api/appointments', (req, res) => {
    const { leadId, date, time, notes } = req.body;
    const apt = { id: Date.now().toString(), leadId, date, time, notes };
    appointments.push(apt);
    
    // Update lead status
    const lead = leads.find(l => l.id === leadId);
    if (lead) { lead.status = 'appointment'; saveData(); }
    
    saveData();
    res.json(apt);
});

// Send email
app.post('/api/send-email', async (req, res) => {
    const { to, subject, body, fromName } = req.body;
    
    try {
        await transporter.sendMail({
            from: `${fromName || 'Throttle Response BDC'} <${emailConfig.auth.user}>`,
            to,
            subject,
            text: body
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Throttle Response API running on port ${PORT}`));