#!/usr/bin/env python3
"""
Email daemon - runs in background and sends scheduled emails
No external dependencies needed
"""
import time
import subprocess
from datetime import datetime

def send_morning_report():
    try:
        subprocess.run(['/usr/bin/python3', '/root/.openclaw/workspace/scripts/send_morning_report.py'], check=True)
        print(f"Morning report sent at {datetime.now()}")
    except Exception as e:
        print(f"Error sending morning report: {e}")

def send_video_email():
    try:
        subprocess.run(['/usr/bin/python3', '/root/.openclaw/workspace/scripts/send_video_email.py'], check=True)
        print(f"Video email sent at {datetime.now()}")
    except Exception as e:
        print(f"Error sending video email: {e}")

def send_ebony_followup():
    try:
        subprocess.run(['/usr/bin/python3', '/root/.openclaw/workspace/scripts/send_ebony_followup.py'], check=True)
        print(f"Ebony follow-up sent at {datetime.now()}")
    except Exception as e:
        print(f"Error sending Ebony follow-up: {e}")

def send_dj_followup():
    try:
        subprocess.run(['/usr/bin/python3', '/root/.openclaw/workspace/scripts/send_dj_followup.py'], check=True)
        print(f"DJ follow-up sent at {datetime.now()}")
    except Exception as e:
        print(f"Error sending DJ follow-up: {e}")

def send_levi_wood_followup1():
    try:
        subprocess.run(['/usr/bin/python3', '/root/.openclaw/workspace/scripts/send_levi_wood_followup1.py'], check=True)
        print(f"Levi Wood follow-up 1 sent at {datetime.now()}")
    except Exception as e:
        print(f"Error sending Levi Wood follow-up 1: {e}")

def send_levi_wood_followup2():
    try:
        subprocess.run(['/usr/bin/python3', '/root/.openclaw/workspace/scripts/send_levi_wood_followup2.py'], check=True)
        print(f"Levi Wood follow-up 2 sent at {datetime.now()}")
    except Exception as e:
        print(f"Error sending Levi Wood follow-up 2: {e}")

# Track sent emails today
sent_morning = False
sent_video = False

print("Email daemon started - sending at 11:00 and 12:00 daily")
print("Press Ctrl+C to stop")

while True:
    now = datetime.now()
    current_hour = now.hour
    current_minute = now.minute
    
    # Reset sent flags at midnight
    if current_hour == 0 and current_minute == 0:
        sent_morning = False
        sent_video = False
    
    # Send morning report at 11:00
    if current_hour == 11 and current_minute == 0 and not sent_morning:
        send_morning_report()
        sent_morning = True
    
    # Send video email at 12:00
    if current_hour == 12 and current_minute == 0 and not sent_video:
        send_video_email()
        sent_video = True
    
    # Ebony follow-up DISABLED - now working with LoKey - no contact unless Chris directs

# DJ Barker follow-up at 4:00 PM (16:00) if no reply
    if current_hour == 16 and current_minute == 0:
        send_dj_followup()
    
    # Levi Wood follow-up at 4:03 PM (16:03)
    if current_hour == 16 and current_minute == 3:
        send_levi_wood_followup1()
    
    # Levi Wood follow-up at 6:22 PM (18:22)
    if current_hour == 18 and current_minute == 22:
        send_levi_wood_followup2()
    
    time.sleep(30)  # Check every 30 seconds