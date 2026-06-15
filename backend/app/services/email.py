import os
import smtplib
import ssl
from email.message import EmailMessage


def send_password_reset_email(to_email: str, reset_url: str) -> None:
    delivery_provider = os.getenv("EMAIL_PROVIDER", "smtp").strip().lower()

    if delivery_provider in {"local", "console", "debug"}:
        print(f"[password-reset] {to_email}: {reset_url}")
        return {"provider": delivery_provider, "reset_url": reset_url}

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM_EMAIL", smtp_username or "no-reply@voxindex.local")
    use_ssl = os.getenv("SMTP_USE_SSL", "false").lower() == "true"
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    timeout = int(os.getenv("SMTP_TIMEOUT_SECONDS", "20"))

    if not smtp_host:
        raise ValueError("SMTP_HOST is not configured")
    if not smtp_username:
        raise ValueError("SMTP_USERNAME is not configured")
    if not smtp_password:
        raise ValueError("SMTP_PASSWORD is not configured")

    message = EmailMessage()
    message["Subject"] = "Reset your VoxIndex password"
    message["From"] = smtp_from
    message["To"] = to_email

    text_body = (
        "You requested a password reset for VoxIndex.\n\n"
        f"Reset your password here: {reset_url}\n\n"
        "If you did not request this, you can ignore this email."
    )
    html_body = f"""
    <html>
      <body style=\"font-family: Arial, sans-serif; color: #111827;\">
        <h2>Reset your VoxIndex password</h2>
        <p>You requested a password reset for your VoxIndex account.</p>
        <p><a href=\"{reset_url}\">Reset your password</a></p>
        <p>If you did not request this, you can ignore this email.</p>
      </body>
    </html>
    """

    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    if use_ssl or smtp_port == 465:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=timeout, context=context) as server:
            server.login(smtp_username, smtp_password)
            server.send_message(message)
        return {"provider": "smtp"}

    with smtplib.SMTP(smtp_host, smtp_port, timeout=timeout) as server:
        if use_tls:
            context = ssl.create_default_context()
            server.starttls(context=context)
        server.login(smtp_username, smtp_password)
        server.send_message(message)
    return {"provider": "smtp"}