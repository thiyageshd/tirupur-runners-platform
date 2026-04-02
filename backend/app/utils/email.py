import logging
import resend

# import smtplib  # Gmail SMTP — reserved for future use
# from email.mime.text import MIMEText
# from email.mime.multipart import MIMEMultipart

from app.core.config import settings

logger = logging.getLogger(__name__)


def _send(to_email: str, subject: str, html: str):
    """Send via Resend API (HTTPS — works on all cloud hosts).
    Falls back to console log when API key not set.
    """
    if not settings.RESEND_API_KEY:
        logger.info(f"[DEV] Email to {to_email} | {subject}")
        return
    resend.api_key = settings.RESEND_API_KEY
    try:
        resend.Emails.send({
            "from": f"Tirupur Runners Club <{settings.FROM_EMAIL}>",
            "to": [to_email],
            "subject": subject,
            "html": html,
        })
        logger.info(f"Email sent to {to_email} | {subject}")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")

    # ── Gmail SMTP (future use) ────────────────────────────────────────────
    # msg = MIMEMultipart("alternative")
    # msg["Subject"] = subject
    # msg["From"] = f"Tirupur Runners Club <{settings.FROM_EMAIL}>"
    # msg["To"] = to_email
    # with smtplib.SMTP("smtp.gmail.com", 587, timeout=10) as server:
    #     server.ehlo(); server.starttls(); server.ehlo()
    #     server.login(settings.GMAIL_USER, settings.GMAIL_APP_PASSWORD)
    #     server.sendmail(settings.GMAIL_USER, to_email, msg.as_string())
    # ──────────────────────────────────────────────────────────────────────


async def send_otp_email(to_email: str, otp: str):
    subject = "Your Tirupur Runners Club OTP"
    html = f"""
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#16a34a">Tirupur Runners Club</h2>
          <p>Your one-time password is:</p>
          <h1 style="letter-spacing:8px;color:#111">{otp}</h1>
          <p style="color:#666;font-size:13px">Valid for 5 minutes. Do not share this OTP.</p>
        </div>
        """
    _send(to_email, subject, html)


async def send_membership_confirmation(to_email: str, name: str, end_date: str):
    subject = "Membership Confirmed — Tirupur Runners Club"
    html = f"""
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#16a34a">Welcome, {name}!</h2>
          <p>Your Tirupur Runners Club membership is now <strong>active</strong>.</p>
          <p><strong>Valid until:</strong> {end_date}</p>
          <p>See you at the next run!</p>
          <hr style="border:none;border-top:1px solid #eee">
          <p style="color:#999;font-size:12px">tirupurrunners.com</p>
        </div>
        """
    _send(to_email, subject, html)


async def send_approval_email(to_email: str, name: str, login_url: str):
    subject = "Your Registration is Approved — Tirupur Runners Club"
    html = f"""
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#16a34a">Congratulations, {name}!</h2>
          <p>Your registration with <strong>Tirupur Runners Club</strong> has been <strong>approved</strong>.</p>
          <p>You can now log in and complete your annual membership payment of <strong>&#8377;2,000</strong>.</p>
          <p style="margin:24px 0">
            <a href="{login_url}" style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
              Login &amp; Pay Now
            </a>
          </p>
          <p style="color:#666">Join us every <strong>Sunday at 5:30 AM</strong> at Tirupur Collectorate for the weekly run!</p>
          <hr style="border:none;border-top:1px solid #eee">
          <p style="color:#999;font-size:12px">Questions? Email tirupurrunners@gmail.com or call +91 94882 52599</p>
        </div>
        """
    _send(to_email, subject, html)


async def send_rejection_email(to_email: str, name: str):
    subject = "Regarding Your Registration — Tirupur Runners Club"
    html = f"""
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#374151">Hi {name},</h2>
          <p>Thank you for your interest in joining <strong>Tirupur Runners Club</strong>.</p>
          <p>After review, we are unable to approve your registration at this time.</p>
          <p>If you believe this is a mistake or have questions, please reach out to us directly:</p>
          <ul style="color:#666">
            <li>Email: tirupurrunners@gmail.com</li>
            <li>Phone: +91 94882 52599</li>
          </ul>
          <hr style="border:none;border-top:1px solid #eee">
          <p style="color:#999;font-size:12px">Tirupur Runners Club</p>
        </div>
        """
    _send(to_email, subject, html)
