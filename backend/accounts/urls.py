from django.urls import path
from .views import RegisterView, VerifyEmailView, ResendVerificationView, LoginView, MeView, ChangePasswordView, ForgotPasswordView, ResetPasswordView
from django_ratelimit.decorators import ratelimit

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("verify-email/", VerifyEmailView.as_view(), name="verify-email"),
    path("resend-verification/", ResendVerificationView.as_view(), name="resend-verification"),
    path("login/", LoginView.as_view(), name="login"),
    path("me/", MeView.as_view(), name="me"),
    path("change_password/", ChangePasswordView.as_view(), name="change_password"),
    # Password reset URLs
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot-password"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset-password"),
]
