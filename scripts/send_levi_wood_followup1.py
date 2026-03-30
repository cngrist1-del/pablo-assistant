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
msg['Subject'] = 'Levi — your bike is waiting'

body = """Levi, this is Pablo w/ Falcons Fury Harley-Davidson.

You were approved, we had you on the 2025 Street Glide, and the appointment was set. Something came up?

That approval doesn't last forever, and your bike is ready. When can you come in?

Text or call: 770-230-6879

Let's go.

Pablo from Falcons Fury Harley-Davidson"""

msg.attach(MIMEText(body, 'plain'))

server = smtplib.SMTP(smtp_server, smtp_port)
server.starttls()
server.login(sender_email, app_password)
server.sendmail(sender_email, to_email, msg.as_string())
server.quit()

print('Levi Wood follow-up 1 sent')