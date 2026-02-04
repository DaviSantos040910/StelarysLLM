# accounts/utils.py
from django.conf import settings
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

def send_verification_email(request, user):
    """
    Envia e-mail de verificação HTML via SendGrid.
    """
    from django.utils.http import urlsafe_base64_encode
    from django.utils.encoding import force_bytes
    from .tokens import email_verification_token

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = email_verification_token.make_token(user)

    verify_url = f"{request.scheme}://{request.get_host()}/auth/verify-email/?uid={uid}&token={token}"

    subject = "Verifique seu e-mail"
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #f2f2f2; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 30px; border-radius: 10px; text-align: center; box-shadow: 0px 0px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333;">Olá, {user.username}!</h2>
            <p style="color: #555; font-size: 16px;">
                Obrigado por se cadastrar. Clique no botão abaixo para verificar seu e-mail:
            </p>
            <a href="{verify_url}" style="display: inline-block; margin: 20px 0; padding: 12px 25px; font-size: 16px; color: #ffffff; background-color: #4CAF50; border-radius: 5px; text-decoration: none;">
                Verificar E-mail
            </a>
            <p style="color: #999; font-size: 14px; margin-top: 20px;">
                Se você não se cadastrou, ignore este e-mail.
            </p>
        </div>
    </body>
    </html>
    """
    send_email(subject, html_content, user.email)


def send_email(subject: str, html_content: str, to_email: str):
    """
    Função genérica para enviar e-mail via SendGrid.
    """
    from_email = settings.SENDGRID_SENDER

    message = Mail(
        from_email=from_email,
        to_emails=to_email,
        subject=subject,
        html_content=html_content
    )

    try:
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        sg.send(message)
        print(f"E-mail enviado para {to_email}")
    except Exception as e:
        print(f"Erro ao enviar e-mail para {to_email}: {e}")
