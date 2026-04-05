const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  const auth = event.headers.authorization || '';
  if (!auth.includes('throttle_bdc_secure_2026')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  
  let leads = [];
  try {
    leads = JSON.parse(fs.readFileSync(path.join(__dirname, 'leads.json'), 'utf8'));
  } catch {}
  
  const totalLeads = leads.length;
  const newLeads = leads.filter(l => l.status === 'new').length;
  const appointment = leads.filter(l => l.status === 'appointment').length;
  const showed = leads.filter(l => l.status === 'showed').length;
  const sold = leads.filter(l => l.status === 'sold').length;
  
  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      totalLeads, newLeads, appointment, showed, sold,
      appointmentRate: totalLeads > 0 ? Math.round((appointment / totalLeads) * 100) : 0,
      showRate: appointment > 0 ? Math.round((showed / appointment) * 100) : 0,
      closeRate: showed > 0 ? Math.round((sold / showed) * 100) : 0
    })
  };
};
