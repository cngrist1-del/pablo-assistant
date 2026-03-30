#!/usr/bin/env python3
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import os

smtp_server = 'smtp.gmail.com'
smtp_port = 587
sender_email = 'BDC1@falconsfuryhd.com'
app_password = 'tnfn zlyn qvig hnmu'

to_email = 'CNGrist1@gmail.com'
cc_email = 'leonard.baker@falconsfuryhd.com'

msg = MIMEMultipart()
msg['From'] = sender_email
msg['To'] = to_email
msg['CC'] = cc_email
msg['Subject'] = 'Video Project - Throttle Response'

body = """<html><body>
<p><b>VIDEO PROJECT - THROTTLE RESPONSE</b></p>
<p>Please find attached the video requirements document.</p>
<p>Let me know if you need anything else.</p>
</body></html>"""

msg.attach(MIMEText(body, 'html'))

attach_path = '/root/.openclaw/workspace/VIDEO_REQUIREMENTS.md'
if os.path.exists(attach_path):
    with open(attach_path, 'rb') as f:
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', 'attachment', filename='VIDEO_REQUIREMENTS.md')
        msg.attach(part)

server = smtplib.SMTP(smtp_server, smtp_port)
server.starttls()
server.login(sender_email, app_password)
server.sendmail(sender_email, [to_email, cc_email], msg.as_string())
server.quit()

print('Video Project Email sent')