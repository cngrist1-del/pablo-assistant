# ThrottleBDC Production Deployment Guide

## Prerequisites
- GitHub account with repo access
- Railway account (for backend + PostgreSQL)
- Vercel account (for frontend)
- Twilio account (SMS)
- Gmail app password or SMTP server (Email)
- Domain: www.ThrottleBDC.com

---

## Step 1: Deploy Backend to Railway

1. **Create Railway Project**
   - Go to https://railway.app and sign up
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repo (cngrist1-del/pablo-assistant)
   - Choose "Node.js" template

2. **Add PostgreSQL Database**
   - In Railway dashboard, click "New" → "Database" → "PostgreSQL"
   - Copy the DATABASE_URL (format: postgres://user:pass@host:port/db)

3. **Configure Environment Variables**
   - Go to Railway project → "Variables" tab
   - Add these variables:
   ```
   PORT=5000
   NODE_ENV=production
   JWT_SECRET=your-super-secret-key
   DATABASE_URL=postgres://user:password@your-host:5432/throttlebdc
   TWILIO_ACCOUNT_SID=your_twilio_sid
   TWILIO_AUTH_TOKEN=your_twilio_token
   TWILIO_PHONE_NUMBER=+1234567890
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com   EMAIL_PASS=your_gmail_app_password
   ```

4. **Deploy**
   - Click "Deploy" button
   - Wait for deployment to complete
   - Copy your backend URL (e.g., https://throttlebdc.up.railway.app)

---

## Step 2: Deploy Frontend to Vercel

1. **Connect to Vercel**
   - Go to https://vercel.com and sign up
   - Click "Add New..." → "Project"
   - Import your GitHub repo (cngrist1-del/pablo-assistant)

2. **Configure Build**
   - Framework Preset: React
   - Build Command: npm run build
   - Output Directory: client/build

3. **Set Environment Variables**
   - In Vercel project settings, add:
   ```
   API_URL=https://your-railway-backend-url
   ```

4. **Deploy**
   - Click "Deploy"
   - Get your Vercel URL (e.g., throttlebdc.vercel.app)

---

## Step 3: Connect Domain (www.ThrottleBDC.com)

1. **Add Domain in Vercel**
   - Go to Vercel project → "Settings" → "Domains"
   - Add www.ThrottleBDC.com
   - Follow instructions to update DNS

2. **DNS Configuration**
   - In your domain registrar (GoDaddy, etc.):
   - Add CNAME: www → cname.vercel-dns.com
   - Add A record: @ → 76.76.21.21

3. **Enable HTTPS**
   - Vercel automatically provides SSL
   - Force HTTPS in project settings

---

## Step 4: Configure Twilio

1. **Create Twilio Account**
   - Sign up at https://twilio.com
   - Get phone number
   - Copy Account SID, Auth Token, Phone Number

2. **Set Webhook**
   - In Twilio console → Phone Numbers → Your Number
   - Set "A Call Comes In" to:
     `https://your-backend-url/api/webhooks/twilio`

---

## Step 5: Test Everything

### Test Login
- Go to www.ThrottleBDC.com
- Login: admin@throttlebdc.com / admin123

### Test Lead Creation
- Create a new lead manually
- Verify it saves to PostgreSQL

### Test SMS
- Send SMS from CRM
- Confirm receiving reply

### Test Email
- Send email from CRM
- Confirm receiving reply

### Test ADF Lead Ingest
- POST to https://your-backend-url/api/leads/ingest-adf
- With ADF XML body
- Confirm lead auto-created

---

## Quick Deploy Commands (Alternative)

### Railway CLI (if installed)
```bash
npm i -g railway
railway login
railway init
railway up
```

### Vercel CLI
```bash
npm i -g vercel
vercel --prod
```

---

## Troubleshooting

### Bad Gateway
- Ensure backend is running on correct port
- Check that API_URL in frontend matches backend URL

### Twilio Not Working
- Verify webhook URL is publicly accessible
- Check Twilio console for error logs

### Database Errors
- Verify DATABASE_URL is correct
- Check PostgreSQL is running

### CORS Issues
- Ensure CORS is configured in backend
- Use proper origin in production

---

## Default Credentials
- **Email:** admin@throttlebdc.com
- **Password:** admin123
- **CHANGE IMMEDIATELY AFTER FIRST LOGIN**

---

## Support
For issues, check logs in Railway/Vercel dashboards.
