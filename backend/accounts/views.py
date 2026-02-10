# accounts/views.py
from django.contrib.auth import get_user_model
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.encoding import force_bytes, force_str
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .serializers import RegisterSerializer, UserSerializer
from .tokens import email_verification_token
from .utils import send_verification_email, send_email
from rest_framework_simplejwt.tokens import RefreshToken
from django.shortcuts import render
from django.urls import reverse
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.tokens import PasswordResetTokenGenerator

User = get_user_model()
password_reset_token = PasswordResetTokenGenerator()


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    @method_decorator(ratelimit(key="ip", rate="5/m", method='POST', block=True), name='dispatch')
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            send_verification_email(request, user)
            return Response(
                {"message": "User registered. Please verify your email."},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        uidb64 = request.GET.get("uid")
        token = request.GET.get("token")
        if not uidb64 or not token:
            return render(request, "accounts/email_verification_failed.html")

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if user and email_verification_token.check_token(user, token):
            user.is_email_verified = True
            user.save()
            return render(request, "accounts/email_verified.html", {"user": user})

        return render(request, "accounts/email_verification_failed.html")


class ResendVerificationView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"email": "This field is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        if user.is_email_verified:
            return Response({"detail": "Email already verified."}, status=status.HTTP_400_BAD_REQUEST)
        send_verification_email(request, user)
        return Response({"message": "Verification email resent."})


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identifier = request.data.get("identifier")
        password = request.data.get("password")
        if not identifier or not password:
            return Response({"detail": "Missing credentials."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(username__iexact=identifier)
        except User.DoesNotExist:
            try:
                user = User.objects.get(email__iexact=identifier)
            except User.DoesNotExist:
                user = None

        if not user or not user.check_password(password):
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        access = str(refresh.access_token)
        return Response({
            "token": access,
            "refresh": str(refresh),
            "user": UserSerializer(user).data
        })


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        user = request.user
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request):
        user = request.user
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password")

        if not old_password or not new_password:
            return Response({"detail": "Ambos campos são obrigatórios."}, status=status.HTTP_400_BAD_REQUEST)

        if not user.check_password(old_password):
            return Response({"detail": "Senha atual incorreta."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({"message": "Senha alterada com sucesso."})


# -----------------------
# Password Reset Flow
# -----------------------

class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    @method_decorator(csrf_exempt)
    def get(self, request):
        return render(request, "accounts/forgot_password.html")

    @method_decorator(csrf_exempt)
    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"detail": "O campo email é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"detail": "Usuário não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = password_reset_token.make_token(user)
        reset_url = f"{request.scheme}://{request.get_host()}{reverse('reset-password')}?uid={uid}&token={token}"

        subject = "Redefinição de senha"
        html_content = f"""
        <html>
        <body style="font-family: Arial,sans-serif; background:#f2f2f2; padding:30px;">
            <div style="max-width:600px; margin:auto; background:#fff; padding:30px; border-radius:10px; text-align:center;">
                <h2>Redefinição de senha</h2>
                <p>Clique no botão abaixo para redefinir sua senha:</p>
                <a href="{reset_url}" style="padding:12px 25px; background:#007BFF; color:#fff; border-radius:5px; text-decoration:none;">Redefinir Senha</a>
                <p style="margin-top:20px; color:#999;">Se você não solicitou, ignore este e-mail.</p>
            </div>
        </body>
        </html>
        """
        send_email(subject, html_content, user.email)
        return Response({"message": "E-mail de redefinição enviado."})


class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    @method_decorator(csrf_exempt)
    def get(self, request):
        uidb64 = request.GET.get("uid")
        token = request.GET.get("token")
        if not uidb64 or not token:
            return render(request, "accounts/reset_password_failed.html")

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if user and password_reset_token.check_token(user, token):
            return render(request, "accounts/reset_password_form.html", {"uid": uidb64, "token": token})
        return render(request, "accounts/reset_password_failed.html")

    @method_decorator(csrf_exempt)
    def post(self, request):
        uidb64 = request.GET.get("uid")
        token = request.GET.get("token")
        password = request.data.get("password")
        confirm_password = request.data.get("confirm_password")

        if not uidb64 or not token:
            return Response({"detail": "Link inválido."}, status=status.HTTP_400_BAD_REQUEST)
        if not password or not confirm_password:
            return Response({"detail": "Ambos campos de senha são obrigatórios."}, status=status.HTTP_400_BAD_REQUEST)
        if password != confirm_password:
            return Response({"detail": "As senhas não coincidem."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({"detail": "Usuário não encontrado."}, status=status.HTTP_404_NOT_FOUND)

        if not password_reset_token.check_token(user, token):
            return Response({"detail": "Token inválido ou expirado."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(password)
        user.save()
       # Se o cliente pedir HTML (ex.: submit tradicional), entregue a página
        accept = (request.headers.get("Accept") or "").lower()
        if "text/html" in accept:
            return render(request, "accounts/reset_password_success.html")

        # Por padrão, responda JSON para o fetch()
        return Response({"message": "Senha redefinida com sucesso!"}, status=status.HTTP_200_OK)
