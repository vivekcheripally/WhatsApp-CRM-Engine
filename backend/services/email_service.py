import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, Tuple
import aiosmtplib

from core.config import settings

logger = logging.getLogger("fastsales")


class EmailService:
    @staticmethod
    async def send_organization_credentials_email(
        contact_name: str,
        org_name: str,
        login_email: str,
        temp_password: str,
        recipient_email: str,
    ) -> Tuple[bool, Optional[str]]:
        """
        Sends temporary credentials to the organization admin's email using SMTP.
        Returns a tuple of (success: bool, error_message: Optional[str]).
        Does NOT raise an exception on delivery failure so approval remains unaffected.
        """
        if not settings.SMTP_HOST:
            logger.warning("SMTP_HOST is not configured. Skipping credential email delivery.")
            return False, "SMTP configuration missing (SMTP_HOST is not set)"

        frontend_base = getattr(settings, "FRONTEND_URL", None) or "http://localhost:3000"
        login_url = f"{frontend_base}/login"
        sender = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME or "noreply@nexora.com"
        from_header = f"{settings.SMTP_FROM_NAME} <{sender}>"

        subject = "Your organization account is ready"

        text_content = f"""Hello {contact_name or 'Admin'},

Your organization {org_name} has been approved.

Your login credentials are:
Email: {login_email}
Temporary Password: {temp_password}
Login URL: {login_url}

Important:
This is a temporary password. You must change your password after your first login.

Regards,
{settings.SMTP_FROM_NAME} Team
"""

        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1a1040; background-color: #f7f3ff; margin: 0; padding: 20px; }}
        .card {{ max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e5d8ff; padding: 32px; box-shadow: 0 4px 20px rgba(124,58,237,0.08); }}
        .header {{ font-size: 22px; font-weight: 800; color: #7c3aed; margin-bottom: 16px; }}
        .credentials {{ background: #faf9ff; border: 1px solid #7c3aed33; border-radius: 12px; padding: 16px; margin: 20px 0; }}
        .field {{ margin-bottom: 8px; font-size: 14px; }}
        .label {{ font-weight: 600; color: #6b6899; }}
        .value {{ font-weight: 700; color: #1a1040; word-break: break-all; }}
        .temp-pw {{ font-family: monospace; font-size: 16px; color: #7c3aed; letter-spacing: 0.5px; }}
        .warning {{ font-size: 13px; color: #d97706; background: #fffbe8; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px; margin-top: 16px; }}
        .btn {{ display: inline-block; background: #7c3aed; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; font-size: 14px; margin-top: 20px; }}
        .footer {{ margin-top: 30px; font-size: 12px; color: #9390b5; text-align: center; }}
    </style>
</head>
<body>
    <div class="card">
        <div class="header">Your organization account is ready</div>
        <p>Hello <strong>{contact_name or 'Admin'}</strong>,</p>
        <p>Your organization <strong>{org_name}</strong> has been approved.</p>
        
        <div class="credentials">
            <div class="field">
                <span class="label">Email:</span> <span class="value">{login_email}</span>
            </div>
            <div class="field">
                <span class="label">Temporary Password:</span> <span class="value temp-pw">{temp_password}</span>
            </div>
        </div>

        <div class="warning">
            <strong>Important:</strong> This is a temporary password. You must change your password after your first login.
        </div>

        <p><a href="{login_url}" class="btn" target="_blank">Log In to Dashboard</a></p>

        <div class="footer">
            Regards,<br>
            <strong>{settings.SMTP_FROM_NAME} Team</strong>
        </div>
    </div>
</body>
</html>
"""

        message = MIMEMultipart("alternative")
        message["From"] = from_header
        message["To"] = recipient_email
        message["Subject"] = subject

        message.attach(MIMEText(text_content, "plain", "utf-8"))
        message.attach(MIMEText(html_content, "html", "utf-8"))

        use_tls = settings.SMTP_PORT == 465
        start_tls = settings.SMTP_USE_TLS and settings.SMTP_PORT != 465

        try:
            await aiosmtplib.send(
                message,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USERNAME or None,
                password=settings.SMTP_PASSWORD or None,
                use_tls=use_tls,
                start_tls=start_tls,
                timeout=10,
            )
            logger.info("Successfully sent organization credentials email to %s", recipient_email)
            return True, None
        except Exception as e:
            logger.error("Failed to send SMTP email to %s: %s", recipient_email, str(e))
            return False, str(e)

    @staticmethod
    async def send_password_reset_email(
        full_name: str,
        recipient_email: str,
        temp_password: str,
    ) -> Tuple[bool, Optional[str]]:
        """
        Sends a password reset email containing a new temporary password.
        """
        if not settings.SMTP_HOST:
            logger.warning("SMTP_HOST is not configured. Skipping password reset email delivery.")
            return False, "SMTP configuration missing (SMTP_HOST is not set)"

        frontend_base = getattr(settings, "FRONTEND_URL", None) or "http://localhost:3000"
        login_url = f"{frontend_base}/login"
        sender = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME or "noreply@nexora.com"
        from_header = f"{settings.SMTP_FROM_NAME} <{sender}>"

        subject = "Password Reset Request - Nexora"

        text_content = f"""Hello {full_name or 'User'},

A password reset request was received for your account.

Your temporary login credentials are:
Email: {recipient_email}
Temporary Password: {temp_password}
Login URL: {login_url}

Important:
Log in with this temporary password to create your new permanent password.

Regards,
{settings.SMTP_FROM_NAME} Team
"""

        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1a1040; background-color: #f7f3ff; margin: 0; padding: 20px; }}
        .card {{ max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e5d8ff; padding: 32px; box-shadow: 0 4px 20px rgba(124,58,237,0.08); }}
        .header {{ font-size: 22px; font-weight: 800; color: #7c3aed; margin-bottom: 16px; }}
        .credentials {{ background: #faf9ff; border: 1px solid #7c3aed33; border-radius: 12px; padding: 16px; margin: 20px 0; }}
        .field {{ margin-bottom: 8px; font-size: 14px; }}
        .label {{ font-weight: 600; color: #6b6899; }}
        .value {{ font-weight: 700; color: #1a1040; word-break: break-all; }}
        .temp-pw {{ font-family: monospace; font-size: 16px; color: #7c3aed; letter-spacing: 0.5px; }}
        .warning {{ font-size: 13px; color: #d97706; background: #fffbe8; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px; margin-top: 16px; }}
        .btn {{ display: inline-block; background: #7c3aed; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; font-size: 14px; margin-top: 20px; }}
        .footer {{ margin-top: 30px; font-size: 12px; color: #9390b5; text-align: center; }}
    </style>
</head>
<body>
    <div class="card">
        <div class="header">Password Reset Request</div>
        <p>Hello <strong>{full_name or 'User'}</strong>,</p>
        <p>A password reset request was received for your Nexora account.</p>
        
        <div class="credentials">
            <div class="field">
                <span class="label">Email:</span> <span class="value">{recipient_email}</span>
            </div>
            <div class="field">
                <span class="label">Temporary Password:</span> <span class="value temp-pw">{temp_password}</span>
            </div>
        </div>

        <div class="warning">
            <strong>Important:</strong> Log in with this temporary password to create your new permanent password.
        </div>

        <p><a href="{login_url}" class="btn" target="_blank">Log In & Reset Password</a></p>

        <div class="footer">
            Regards,<br>
            <strong>{settings.SMTP_FROM_NAME} Team</strong>
        </div>
    </div>
</body>
</html>
"""

        message = MIMEMultipart("alternative")
        message["From"] = from_header
        message["To"] = recipient_email
        message["Subject"] = subject

        message.attach(MIMEText(text_content, "plain", "utf-8"))
        message.attach(MIMEText(html_content, "html", "utf-8"))

        use_tls = settings.SMTP_PORT == 465
        start_tls = settings.SMTP_USE_TLS and settings.SMTP_PORT != 465

        try:
            await aiosmtplib.send(
                message,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USERNAME or None,
                password=settings.SMTP_PASSWORD or None,
                use_tls=use_tls,
                start_tls=start_tls,
                timeout=10,
            )
            logger.info("Successfully sent password reset email to %s", recipient_email)
            return True, None
        except Exception as e:
            logger.error("Failed to send password reset email to %s: %s", recipient_email, str(e))
            return False, str(e)

