#!/usr/bin/env python3
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

smtp_server = 'smtp.gmail.com'
smtp_port = 587
sender_email = 'BDC1@falconsfuryhd.com'
app_password = 'tnfn zlyn qvig hnmu'

to_email = 'ebnbaker1@gmail.com'

msg = MIMEMultipart()
msg['From'] = sender_email
msg['To'] = to_email
msg['Subject'] = 'Ebony — ready when you are'

body = """This is Pablo — reaching out on behalf of Chris.

Checking in — haven't heard back. That approval is still waiting on you.

Beautiful day to ride. Let me know what works.

Text or call: 770-230-6879

Pablo from Falcons Fury Harley-Davidson"""

msg.attach(MIMEText(body, 'plain'))

server = smtplib.SMTP(smtp_server, smtp_port)
server.starttls()
server.login(sender_email, app_password)
server.sendmail(sender_email, to_email, msg.as_string())
server.quit()

print('Ebony follow-up sent')