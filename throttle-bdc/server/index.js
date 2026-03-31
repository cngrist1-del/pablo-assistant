require('dotenv').config();
const express = require('express');
const app = express();

// REQUIRED middleware
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Twilio webhook
app.post('/webhook', (req, res) => {
  try {
    const incoming = req.body.Body || 'No message';
    console.log('Incoming:', incoming);

    res.set('Content-Type', 'text/xml');
    res.status(200).send(`
<Response>
  <Message>Hey this is Chris with Throttle Response BDC — what bike are you looking at?</Message>
</Response>
    `);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(500);
  }
});

// Serve static files for React app
const path = require('path');
app.use(express.static(path.join(__dirname, '../client/build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

// PORT
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
