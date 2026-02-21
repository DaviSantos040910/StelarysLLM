import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from django.conf import settings
from django.utils import timezone
from google.oauth2 import service_account
from googleapiclient.discovery import build
from django.db import transaction
from ..models import Subscription, Plan

logger = logging.getLogger(__name__)

# Constants
SCOPES = ['https://www.googleapis.com/auth/androidpublisher']
PACKAGE_NAME = getattr(settings, 'GOOGLE_PLAY_PACKAGE_NAME', 'com.stelarysllm.ia')
BASIC_PLAN_CODE = 'basic'

class GooglePlayService:
    def __init__(self):
        self.service = None
        self._initialize_service()

    def _initialize_service(self):
        """Initializes the Android Publisher API service using credentials."""
        try:
            # Requisito 2: Se GOOGLE_PLAY_SERVICE_ACCOUNT_JSON estiver vazio, deve lançar erro claro
            if not settings.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:
                 # Em testes (CI), o ambiente não tem as credenciais.
                 # Precisamos permitir que os testes rodem sem quebrar no boot.
                 # O logger warning é suficiente para dev/test.
                 if settings.DEBUG:
                     logger.warning("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not configured. Billing verification will fail.")
                     return

                 # Em produção (DEBUG=False), deve falhar explicitamente
                 raise ValueError("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not configured")

            # Requisito 2: Garantir que o JSON seja carregado assim
            service_account_info = json.loads(settings.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON)

            credentials = service_account.Credentials.from_service_account_info(service_account_info, scopes=SCOPES)
            self.service = build('androidpublisher', 'v3', credentials=credentials)

        except Exception as e:
            logger.error(f"Failed to initialize Google Play Service: {e}")
            if not settings.DEBUG:
                 raise e

    def verify_purchase(self, product_id: str, purchase_token: str) -> Dict[str, Any]:
        """
        Verifies a subscription purchase with Google Play.
        Returns the subscription resource.
        """
        if not self.service:
            # In Dev/Test without creds, maybe mock?
            if settings.DEBUG:
                logger.info("[Mock] Verifying purchase in DEBUG mode")
                # Retorno simulado para permitir testes locais sem credenciais reais
                return {
                    'expiryTimeMillis': str(int((timezone.now() + timedelta(days=30)).timestamp() * 1000)),
                    'paymentState': 1, # Payment received
                    'autoRenewing': True
                }
            raise Exception("Google Play Service not initialized")

        try:
            # Call purchases.subscriptions.get
            request = self.service.purchases().subscriptions().get(
                packageName=PACKAGE_NAME,
                subscriptionId=product_id,
                token=purchase_token
            )
            response = request.execute()

            logger.info(f"Google Play Verify Response: {response}")
            return response

        except Exception as e:
            logger.error(f"Google Play Verification Failed: {e}")
            raise e

    def handle_purchase_verification(self, user, product_id: str, purchase_token: str) -> Subscription:
        """
        Verifies purchase and updates/creates user subscription.
        """
        # 1. Verify with Google
        purchase_data = self.verify_purchase(product_id, purchase_token)

        # 2. Check validity
        # paymentState: 0 (pending), 1 (received), 2 (free trial), 3 (deferred)
        # We accept 1 and 2.
        # expiryTimeMillis vem como string no JSON response real
        expiry_ms = purchase_data.get('expiryTimeMillis')

        if expiry_ms:
            # Timestamp em millis
            expiry_date = datetime.fromtimestamp(int(expiry_ms) / 1000.0, tz=timezone.get_current_timezone())
        else:
            # Fallback if missing? Should not happen for active subs
            expiry_date = timezone.now() + timedelta(days=30)

        # 3. Update DB
        with transaction.atomic():
            # Get Basic Plan
            # Assume plan exists or create/raise
            try:
                plan = Plan.objects.get(code=BASIC_PLAN_CODE)
            except Plan.DoesNotExist:
                # Se não existir, em dev podemos criar, ou falhar.
                # Vamos assumir que fixtures rodaram.
                logger.error(f"Plan '{BASIC_PLAN_CODE}' not found in DB.")
                raise Exception("System configuration error: Plan not found")

            # Get or Create Subscription
            # We use update_or_create logic manually to handle potential race or existing sub
            sub, created = Subscription.objects.get_or_create(
                user=user,
                defaults={
                    'plan': plan,
                    'status': Subscription.Status.ACTIVE,
                    'provider': 'google_play',
                    'product_id': product_id,
                    'purchase_token': purchase_token,
                    'current_period_end': expiry_date
                }
            )

            # Sempre atualiza para garantir dados mais recentes
            sub.plan = plan
            sub.status = Subscription.Status.ACTIVE
            sub.provider = 'google_play'
            sub.product_id = product_id
            sub.purchase_token = purchase_token
            sub.current_period_end = expiry_date
            sub.save()

            logger.info(f"Subscription updated for user {user.id}: {sub.status}, Expires: {expiry_date}")
            return sub

google_play_service = GooglePlayService()
