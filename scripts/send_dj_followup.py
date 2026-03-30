#!/usr/bin/env python3
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

smtp_server = 'smtp.gmail.com'
smtp_port = 587
sender_email = 'BDC1@falconsfuryhd.com'
app_password = 'tnfn zlyn qvig hnmu'

to_email = 'deejeandames@aol.com'

msg = MIMEMultipart()
msg['From'] = sender_email
msg['To'] = to_email
msg['Subject'] = 'DJ — ready when you are'

body = """DJ, this is Pablo w/ Falcons Fury Harley-Davidson.

Checking in — still interested in the 2024 Ultra Limited? What's your timeline?

Let me know where you are with this, and I'll help structure the deal.

Text or call: 770-230-6879

Let's go.

Pablo from Falcons Fury Harley-Davidson"""

msg.attach(MIMEText(body, 'plain'))

server = smtplib.SMTP(smtp_server, smtp_port)
server.starttls()
server.login(sender_email, app_password)
server.sendmail(sender_email, to_email, msg.as_string())
server.quit()

print('DJ follow-up sent')