import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

FRONTEND_URL = os.getenv("FRONTEND_URL") or os.getenv("APP_URL") or "http://localhost:5173"

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_PASS")
SMTP_FROM = os.getenv("SMTP_FROM") or SMTP_USER or "Money Manager <noreply@moneymanager.com>"


def get_verification_url(token: str) -> str:
    """Build the frontend email verification URL."""
    base = FRONTEND_URL.rstrip('/')
    return f"{base}/verify-email?token={token}"


def send_verification_email(to_email: str, token: str, full_name: str = "User") -> str:
    """
    Send account verification email via SMTP.
    If SMTP credentials are not configured, prints a mock fallback to console.
    Returns the verification link.
    """
    verification_url = get_verification_url(token)

    # If SMTP is not configured, use local mock fallback
    if not (SMTP_HOST and SMTP_USER and SMTP_PASSWORD):
        print(f"\n==================================================")
        print(f" [Email Service - Mock Fallback] Verification Email")
        print(f" To: {to_email} ({full_name})")
        print(f" Verification Link: {verification_url}")
        print(f"==================================================\n")
        return verification_url

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Verify your Money Manager Account"
        msg["From"] = SMTP_FROM
        msg["To"] = to_email

        plain_text = f"""Hello {full_name},

Thank you for registering for Money Manager AI!
Please verify your email address by opening the following link in your browser:

{verification_url}

If you did not create this account, please ignore this email.

Best regards,
Money Manager Team
"""

        html_text = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }}
    .card {{ max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }}
    .btn {{ display: inline-block; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-weight: 600; margin-top: 20px; }}
    .footer {{ font-size: 12px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 15px; }}
  </style>
</head>
<body>
  <div class="card">
    <h2 style="color: #1e293b; margin-top: 0;">Welcome to Money Manager! 💰</h2>
    <p style="color: #475569; font-size: 15px; line-height: 1.5;">
      Hi <strong>{full_name}</strong>, thanks for creating an account with Money Manager AI. Please click the button below to verify your email and activate your account.
    </p>
    <div style="text-align: center;">
      <a href="{verification_url}" class="btn">Verify Email Address</a>
    </div>
    <p style="color: #64748b; font-size: 13px; margin-top: 25px;">
      Or copy and paste this link into your browser:<br>
      <a href="{verification_url}" style="color: #2563eb; word-break: break-all;">{verification_url}</a>
    </p>
    <div class="footer">
      If you did not request this account, you can safely ignore this email.
    </div>
  </div>
</body>
</html>"""

        msg.attach(MIMEText(plain_text, "plain"))
        msg.attach(MIMEText(html_text, "html"))

        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM, [to_email], msg.as_string())
        server.quit()
        print(f"[Email Service] Verification email successfully sent to {to_email}")
    except Exception as e:
        print(f"[Email Service] Error sending email via SMTP: {e}. Falling back to console log.")
        print(f"Verification link: {verification_url}")

    return verification_url
