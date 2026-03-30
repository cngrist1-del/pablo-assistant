#!/usr/bin/env python3
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

smtp_server = 'smtp.gmail.com'
smtp_port = 587
sender_email = 'BDC1@falconsfuryhd.com'
app_password = 'tnfn zlyn qvig hnmu'

to_email = 'leviwood1164@gmail.com'

msg = MIMEMultipart()
msg['From'] = sender_email
msg['To'] = to_email
msg['Subject'] = 'Levi — last chance'

body = """Levi, this is Pablo w/ Falcons Fury Harley-Davidson.

One more check-in. That 2025 Street Glide is ready, and your approval is waiting.

Let's get you on that bike. When can you come in?

Text or call: 770-230-6879

Let's go.

Pablo from Falcons Fury Harley-Davidson"""

msg.attach(MIMEText(body, 'plain'))

server = smtplib.SMTP(smtp_server, smtp_port)
server.starttls()
server.login(sender_email, app_password)
server.sendmail(sender_email, to_email, msg.as_string())
server.quit()

print('Levi Wood follow-up 2 sent')