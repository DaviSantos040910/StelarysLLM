# accounts/utils.py
from django.conf import settings
import logging

logger = logging.getLogger(__name__)
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException

def send_verification_email(request, user):
    """
    Envia e-mail de verificação HTML via Brevo.
    """
    from django.utils.http import urlsafe_base64_encode
    from django.utils.encoding import force_bytes
    from .tokens import email_verification_token

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = email_verification_token.make_token(user)

    verify_url = f"{request.scheme}://{request.get_host()}/auth/verify-email/?uid={uid}&token={token}"

    subject = "Ative sua conta no Stelarys"
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #020617; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #1e1b4b; padding: 30px; border-radius: 10px; text-align: center; border: 1px solid #312e81;">
            <h2 style="color: #f8fafc;">Bem-vindo(a) ao Stelarys, {user.username}!</h2>
            <p style="color: #cbd5e1; font-size: 16px;">
                Falta apenas um passo para você começar a aprender com IA. Clique no botão abaixo para verificar sua conta:
            </p>
            <a href="{verify_url}" style="display: inline-block; margin: 25px 0; padding: 14px 28px; font-size: 16px; font-weight: bold; color: #ffffff; background-color: #818cf8; border-radius: 8px; text-decoration: none;">
                Verificar E-mail
            </a>
            <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
                Se você não se cadastrou em nossa plataforma, basta ignorar este e-mail.
            </p>
        </div>
    </body>
    </html>
    """
    send_email(subject, html_content, user.email)


def send_email(subject: str, html_content: str, to_email: str):
    """
    Função genérica para enviar e-mail via Brevo.
    """
    if not settings.BREVO_API_KEY:
        logger.error("BREVO_API_KEY is not configured.")
        return

    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = settings.BREVO_API_KEY

    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
    
    sender_name = "Stelarys AI"
    sender_email = settings.DEFAULT_FROM_EMAIL
    
    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": to_email}],
        html_content=html_content,
        sender={"name": sender_name, "email": sender_email},
        subject=subject
    )

    try:
        api_response = api_instance.send_transac_email(send_smtp_email)
        logger.info(f"E-mail enviado para {to_email} via Brevo. response ID: {api_response.message_id}")
    except ApiException as e:
        logger.error(f"Erro ao enviar e-mail para {to_email} via Brevo: {e}")

def get_actor(request):
    """
    Returns (actor_type, actor_instance).
    actor_type: 'user' or 'guest'
    """
    if request.user and request.user.is_authenticated:
        return 'user', request.user

    # Check for attached guest_session from GuestAuthentication
    if hasattr(request, 'guest_session') and request.guest_session:
        return 'guest', request.guest_session

    return None, None
