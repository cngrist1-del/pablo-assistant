#!/usr/bin/env python3
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
import csv
import os

# Email config
smtp_server = 'smtp.gmail.com'
smtp_port = 587
sender_email = 'BDC1@falconsfuryhd.com'
app_password = 'tnfn zlyn qvig hnmu'

to_email = 'CNGrist1@gmail.com'
cc_email = 'leonard.baker@falconsfuryhd.com'

# Read hot leads
hot_leads = []
if os.path.exists('/root/.openclaw/workspace/HOT_LEADS.csv'):
    with open('/root/.openclaw/workspace/HOT_LEADS.csv', 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            hot_leads.append(row)

# Read dead leads
dead_leads = []
if os.path.exists('/root/.openclaw/workspace/DEAD_LEADS.csv'):
    with open('/root/.openclaw/workspace/DEAD_LEADS.csv', 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            dead_leads.append(row)

import datetime

# Rotating mob boss quotes - one per day
quotes = [
    "They plot while we grind.",
    "They quit at quitting time. We clock in.",
    "A quiet mouth and a loud wallet.",
    "Speak softly and carry a closed deal.",
    "They wonder how we do it. We don't tell.",
    "Your approval expires. Our dominance doesn't.",
    "Death before debt. Payment before peace.",
    "The strong eat. The weak starve.",
    "Respect is earned. Deals are closed.",
    "Make it happen. Or get ran over.",
    "They pay us to solve problems. Not to have feelings.",
    "Nobody ever got rich being nice.",
    "Ambition beats talent when talent doesn't work.",
    "We don't ask for permission. We ask for results.",
    "Sleep is for those who already won."
]

# Get today's quote based on day of week
day_of_week = datetime.datetime.now().weekday()
todays_quote = quotes[day_of_week % len(quotes)]

# Build email body
body = f"""<html><body>
<p><b>{todays_quote}</b></p>
<p><b>MORNING REPORT</b></p>
<p><b>Hot Leads:</b><br>"""

for lead in hot_leads:
    body += f"- {lead['Lead Name']} — {lead['Status']} — {lead.get('Interest', '')} — {lead.get('Response', '')}<br>"
    body += f"  Phone: {lead['Phone']} | Email: {lead['Email']}<br><br>"

body += """</p>
<p><b>Today's Appointments:</b><br>
- None scheduled yet</p>
<p><b>Dead Leads:</b><br>"""

for lead in dead_leads:
    body += f"- {lead['Lead Name']} — {lead['Reason']}<br>"

body += """</p>
<p><b>BDC Cartel Best in the World</b></p>
<p>Pablo from Falcons Fury Harley-Davidson</p>
</body></html>"""

# Build message
msg = MIMEMultipart()
msg['From'] = sender_email
msg['To'] = to_email
msg['CC'] = cc_email
msg['Subject'] = 'Morning Report - Hot Leads & Appointments'
msg.attach(MIMEText(body, 'html'))

# Send
server = smtplib.SMTP(smtp_server, smtp_port)
server.starttls()
server.login(sender_email, app_password)
server.sendmail(sender_email, [to_email, cc_email], msg.as_string())
server.quit()

print('Morning Report sent')