# accounts/tokens.py
from django.contrib.auth.tokens import PasswordResetTokenGenerator
import six

# Token generator to be used in email verification links
class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    def _make_hash_value(self, user, timestamp):
        # include is_email_verified to invalidate token after verification
        return (
            six.text_type(user.pk) + six.text_type(timestamp) + six.text_type(user.is_email_verified)
        )

email_verification_token = EmailVerificationTokenGenerator()
