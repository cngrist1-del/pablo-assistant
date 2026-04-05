const ADMIN = { email: 'admin@throttlebdc.com', password: 'admin123', name: 'Chris' };
const TOKEN = 'throttle_bdc_secure_2026';

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  
  try {
    const { email, password } = JSON.parse(event.body);
    
    if (email === ADMIN.email && password === ADMIN.password) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, user: { email: ADMIN.email, name: ADMIN.name } })
      };
    }
    return {
      statusCode: 401,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid credentials' })
    };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
