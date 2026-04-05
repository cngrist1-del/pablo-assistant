const fs = require('fs');
const path = require('path');
const DATA_DIR = __dirname;

const getLeads = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'leads.json'), 'utf8'));
  } catch { return []; }
};

const saveLeads = (leads) => {
  fs.writeFileSync(path.join(DATA_DIR, 'leads.json'), JSON.stringify(leads));
};

exports.handler = async (event, context) => {
  // Simple auth check via header
  const auth = event.headers.authorization || '';
  if (!auth.includes('throttle_bdc_secure_2026')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  
  if (event.httpMethod === 'GET') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(getLeads()) };
  }
  
  if (event.httpMethod === 'POST') {
    const leads = getLeads();
    const data = JSON.parse(event.body);
    const id = data.id || Date.now().toString();
    const idx = leads.findIndex(l => l.id === id);
    const lead = { ...data, id, updatedAt: new Date().toISOString() };
    
    if (idx >= 0) leads[idx] = lead;
    else leads.push(lead);
    
    saveLeads(leads);
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(lead) };
  }
  
  return { statusCode: 405, body: 'Method not allowed' };
};
