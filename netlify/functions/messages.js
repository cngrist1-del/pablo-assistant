const fs = require('fs');
const path = require('path');
const DATA_DIR = __dirname;

const getEmails = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'emails.json'), 'utf8'));
  } catch { return []; }
};

const saveEmails = (emails) => {
  fs.writeFileSync(path.join(DATA_DIR, 'emails.json'), JSON.stringify(emails));
};

exports.handler = async (event, context) => {
  const auth = event.headers.authorization || '';
  if (!auth.includes('throttle_bdc_secure_2026')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  
  const leadId = event.path.split('/').pop();
  
  if (event.httpMethod === 'GET') {
    const emails = getEmails().filter(e => e.leadId === leadId);
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ messages: emails }) };
  }
  
  if (event.httpMethod === 'POST') {
    const emails = getEmails();
    const data = JSON.parse(event.body);
    const email = { id: Date.now().toString(), leadId, direction: 'outbound', ...data, date: new Date().toISOString() };
    emails.push(email);
    saveEmails(emails);
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(email) };
  }
  
  return { statusCode: 405, body: 'Method not allowed' };
};
