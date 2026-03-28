import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_otp_email(to_email: str, otp: str):
    """Send OTP via SendGrid. Falls back to console log in dev mode."""
    if not settings.SENDGRID_API_KEY:
        logger.info(f"[DEV] OTP for {to_email}: {otp}")
        return

    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail

        sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        message = Mail(
            from_email=settings.FROM_EMAIL,
            to_emails=to_email,
            subject="Your Tirupur Runners Club OTP",
            html_content=f"""
            <div style="font-family:sans-serif;max-width:480px;margin:auto">
              <h2 style="color:#16a34a">Tirupur Runners Club</h2>
              <p>Your one-time password is:</p>
              <h1 style="letter-spacing:8px;color:#111">{otp}</h1>
              <p style="color:#666;font-size:13px">Valid for 5 minutes. Do not share this OTP.</p>
            </div>
            """,
        )
        sg.send(message)
    except Exception as e:
        logger.error(f"Failed to send OTP email to {to_email}: {e}")


async def send_membership_confirmation(to_email: str, name: str, end_date: str):
    if not settings.SENDGRID_API_KEY:
        logger.info(f"[DEV] Membership confirmed for {to_email} until {end_date}")
        return

    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail

        sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        message = Mail(
            from_email=settings.FROM_EMAIL,
            to_emails=to_email,
            subject="Membership Confirmed — Tirupur Runners Club",
            html_content=f"""
            <div style="font-family:sans-serif;max-width:480px;margin:auto">
              <h2 style="color:#16a34a">Welcome, {name}!</h2>
              <p>Your Tirupur Runners Club membership is now <strong>active</strong>.</p>
              <p><strong>Valid until:</strong> {end_date}</p>
              <p>See you at the next run! 🏃</p>
              <hr style="border:none;border-top:1px solid #eee">
              <p style="color:#999;font-size:12px">tirupurrunners.com</p>
            </div>
            """,
        )
        sg.send(message)
    except Exception as e:
        logger.error(f"Failed to send confirmation email to {to_email}: {e}")
