import smtplib, ssl, email
from email.message import EmailMessage
import os, base64

SMTP_SERVER = 'smtp.portsmaster.co'
SMTP_PORT = 587
USERNAME = 'BDC1@falconsfuryhd.com'
PASSWORD = 'tnfn zlyn qvig hnmu'

def send_mail(subject, to, cc, body, attachments=None):
    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = USERNAME
    msg['To'] = to
    if isinstance(cc, list):
        msg['Cc'] = ', '.join(cc)
    else:
        msg['Cc'] = cc
    msg.set_content(body)
    if attachments:
        for path in attachments:
            with open(path, 'rb') as f:
                data = f.read()
                maintype, subtype = ('application', 'octet-stream')
                filename = os.path.basename(path)
                msg.add_attachment(data, maintype=maintype, subtype=subtype, filename=filename)
    context = ssl.create_default_context()
    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.starttls(context=context)
        server.login(USERNAME, PASSWORD)
        server.send_message(msg)

if __name__ == '__main__':
    # Morning Report
    hot_leads = [
        "Steven Ippoliti jr - (954) 826-9405 - slippijr@yahoo.com - Credit approved",
        "Anetria Jackson - (678) 755-6450 - amjackson2336@yahoo.com - Credit approved"
    ]
    dead_leads = [
        "Ebony Baker - (404) 824-5423 - ebnnbaker1@gmail.com - DO NOT CONTACT"
    ]
    # Placeholder for appointments (no data available)
    appointments = []
    body = "Morning Report\n\nHot Leads:\n" + "\n".join(hot_leads) + "\n\nDead Leads:\n" + "\n".join(dead_leads) + "\n\nAppointments (today):\n" + ("\n".join(appointments) if appointments else "(none recorded)")
    # Assume BDC photo is at /root/.openclaw/workspace/BDC_photo.jpg (not present, skip attachment)
    send_mail(
        subject='Morning Report',
        to='CNGrist1@gmail.com',
        cc=['leonard.baker@falconsfuryhd.com'],
        body=body,
        attachments=[]
    )
    # Video Project Email
    video_body = "Please find attached the video requirements document."
    send_mail(
        subject='Video Project - Throttle Response',
        to='CNGrist1@gmail.com',
        cc=['leonard.baker@falconsfuryhd.com'],
        body=video_body,
        attachments=['/root/.openclaw/workspace/VIDEO_REQUIREMENTS.md']
    )
