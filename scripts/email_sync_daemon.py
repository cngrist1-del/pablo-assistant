#!/usr/bin/env python3
"""
Email sync daemon - checks for new eLeads and auto-adds them to CRM
"""
import imaplib
import email
import json
import os
from datetime import datetime
import subprocess

CRM_FILE = '/root/.openclaw/workspace/crm_dashboard.html'
EMAIL_ACCOUNT = 'BDC1@falconsfuryhd.com'
APP_PASSWORD = 'tnfn zlyn qvig hnmu'
IMAP_SERVER = 'imap.gmail.com'

def get_new_eleads():
    """Check for new Deal IN emails"""
    mail = imaplib.IMAP4_SSL(IMAP_SERVER)
    mail.login(EMAIL_ACCOUNT, APP_PASSWORD)
    mail.select('INBOX')
    
    # Search for unread Deal IN emails
    try:
        status, messages = mail.search(None, 'UNSEEN', 'SUBJECT', 'Deal IN')
    except:
        status, messages = mail.search(None, 'ALL')
    
    new_leads = []
    if status == 'OK':
        ids = messages[0].split()[-5:]  # Last 5
        for num in ids:
            try:
                status, msg = mail.fetch(num, '(RFC822)')
                if status == 'OK':
                    for response_part in msg:
                        if isinstance(response_part, tuple):
                            msg_content = email.message_from_bytes(response_part[1])
                            subject = str(msg_content.get('Subject', ''))
                            if 'Deal IN' in subject:
                                # Parse the email for lead info
                                if msg_content.is_multipart():
                                    for part in msg_content.walk():
                                        if part.get_content_type() == 'text/plain':
                                            body = part.get_payload(decode=True).decode()
                                            new_leads.append({
                                                'subject': subject,
                                                'body': body[:500],
                                                'time': datetime.now().strftime('%m/%d/%Y %I:%M %p')
                                            })
            except Exception as e:
                print(f"Error fetching email: {e}")
    
    mail.close()
    mail.logout()
    return new_leads

print("Email sync daemon running... checking for new leads every 15 minutes")
print("Press Ctrl+C to stop")

while True:
    try:
        leads = get_new_leads()
        if leads:
            print(f"Found {len(leads)} new Deal IN emails at {datetime.now()}")
    except Exception as e:
        print(f"Error: {e}")
    
    import time
    time.sleep(900)  # Check every 15 minutes