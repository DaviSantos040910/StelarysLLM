# chat/views.py
"""
Views para o módulo de chat.
Inclui endpoints REST padrão e SSE para streaming.
"""

import os
import re
import json
import uuid
import mimetypes
import logging
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.http import FileResponse, StreamingHttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.core.files import File

from rest_framework import generics, permissions, status, parsers
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from .models import Chat, ChatMessage
from .serializers import (
    ChatListSerializer,
    ChatMessageSerializer,
    ChatMessageAttachmentSerializer
)
from bots.models import Bot
from studio.models import KnowledgeSource
from .services import (
    get_ai_response,
    transcribe_audio_gemini,
    generate_tts_audio,
    handle_voice_interaction,
    handle_voice_message,
    process_message_stream
)
from chat.services.image_description_service import image_description_service
from studio.services.knowledge_ingestion_service import KnowledgeIngestionService
from config.pagination import StandardMessagePagination
from .vector_service import vector_service
from .file_processor import FileProcessor

logger = logging.getLogger(__name__)


# =============================================================================
# VIEWS DE LISTAGEM DE CHATS
# =============================================================================

class ActiveChatListView(generics.ListAPIView):
    """Lista todos os chats ativos do usuário."""
    serializer_class = ChatListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Chat.objects.filter(
            user=self.request.user,
            status=Chat.ChatStatus.ACTIVE
        ).order_by('-last_message_at')


class ArchivedChatListView(generics.ListAPIView):
    """Lista chats arquivados de um bot específico."""
    serializer_class = ChatListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        bot_id = self.kwargs['bot_id']
        return Chat.objects.filter(
            user=self.request.user,
            bot_id=bot_id,
            status=Chat.ChatStatus.ARCHIVED
        ).order_by('-last_message_at')


# =============================================================================
# VIEWS DE BOOTSTRAP E MENSAGENS
# =============================================================================

class ChatBootstrapView(APIView):
    """Inicializa ou retorna o chat ativo para um bot."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, bot_id):
        bot = get_object_or_404(Bot, id=bot_id)
        active_chat = Chat.objects.filter(
            user=request.user,
            bot=bot,
            status=Chat.ChatStatus.ACTIVE
        ).first()

        if not active_chat:
            active_chat = Chat.objects.create(
                user=request.user,
                bot=bot,
                status=Chat.ChatStatus.ACTIVE
            )

        # Construir URL do avatar
        avatar_url_path = None
        if bot.avatar_url and hasattr(bot.avatar_url, 'url'):
            try:
                avatar_url_path = request.build_absolute_uri(bot.avatar_url.url)
            except Exception:
                avatar_url_path = bot.avatar_url.url

        return Response({
            "conversationId": str(active_chat.id),
            "bot": {
                "name": bot.name,
                "handle": f"@{bot.owner.username}",
                "avatarUrl": avatar_url_path,
                "avatar_url": avatar_url_path, # Legacy/Consistency alias
                "createdByMe": bot.owner == request.user # Informa ao frontend se sou o dono
            },
            "welcome": bot.description or "Hello! How can I help you today?",
            "suggestions": [s for s in [bot.suggestion1, bot.suggestion2, bot.suggestion3] if s]
        }, status=status.HTTP_200_OK)


class ChatMessageListView(generics.ListCreateAPIView):
    """Lista e cria mensagens em um chat (modo não-streaming)."""
    serializer_class = ChatMessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardMessagePagination

    def get_queryset(self):
        chat_id = self.kwargs['chat_pk']
        get_object_or_404(Chat, id=chat_id, user=self.request.user)
        return ChatMessage.objects.filter(chat_id=chat_id).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        # Validar Content-Type
        if not request.content_type or 'application/json' not in request.content_type.lower():
            return Response(
                {"detail": "Content-Type must be application/json for text messages."},
                status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        chat_id = self.kwargs['chat_pk']
        chat = get_object_or_404(Chat, id=chat_id, user=self.request.user)

        if chat.status != Chat.ChatStatus.ACTIVE:
            return Response(
                {"detail": "This chat is archived and read-only."},
                status=status.HTTP_403_FORBIDDEN
            )

        reply_with_audio = request.data.get('reply_with_audio', False)

        # Salvar mensagem do usuário
        user_message = serializer.save(chat=chat, role=ChatMessage.Role.USER)
        chat.last_message_at = timezone.now()
        chat.save()

        # Obter resposta da IA
        ai_response_data = get_ai_response(
            chat_id,
            user_message.content,
            user_message_obj=user_message,
            reply_with_audio=reply_with_audio
        )

        ai_content = ai_response_data.get('content')
        ai_suggestions = ai_response_data.get('suggestions', [])
        ai_sources = ai_response_data.get('sources', [])
        audio_path = ai_response_data.get('audio_path')
        duration_ms = ai_response_data.get('duration_ms', 0)
        generated_image_path = ai_response_data.get('generated_image_path')

        ai_messages = []

        # Fluxo de imagem gerada
        if generated_image_path:
            ai_message = ChatMessage(
                chat=chat,
                role=ChatMessage.Role.ASSISTANT,
                content=ai_content,
                suggestion1=ai_suggestions[0] if len(ai_suggestions) > 0 else None,
                suggestion2=ai_suggestions[1] if len(ai_suggestions) > 1 else None,
                sources=ai_sources
            )
            ai_message.attachment.name = generated_image_path
            ai_message.attachment_type = 'image'
            ai_message.original_filename = "generated_image.png"
            ai_message.save()
            ai_messages.append(ai_message)
            chat.last_message_at = timezone.now()
            chat.save()

        # Fluxo de áudio TTS
        elif audio_path and os.path.exists(audio_path):
            ai_message = ChatMessage(
                chat=chat,
                role=ChatMessage.Role.ASSISTANT,
                content=ai_content,
                suggestion1=ai_suggestions[0] if len(ai_suggestions) > 0 else None,
                suggestion2=ai_suggestions[1] if len(ai_suggestions) > 1 else None,
                duration=duration_ms,
                sources=ai_sources
            )
            try:
                with open(audio_path, 'rb') as f:
                    filename = f"reply_tts_{uuid.uuid4().hex[:10]}.wav"
                    ai_message.attachment.save(filename, File(f), save=False)
                ai_message.attachment_type = 'audio'
                ai_message.original_filename = "voice_reply.wav"
                os.remove(audio_path)
            except Exception as e:
                logger.error(f"Erro ao anexar áudio TTS: {e}")
            ai_message.save()
            ai_messages.append(ai_message)

        # Fluxo de texto padrão
        else:
            paragraphs = re.split(r'\n{2,}', ai_content.strip()) if ai_content else []
            if not paragraphs:
                paragraphs = ["..."]

            total_paragraphs = len(paragraphs)
            for i, paragraph_content in enumerate(paragraphs):
                is_last_paragraph = i == (total_paragraphs - 1)
                suggestions = ai_suggestions if is_last_paragraph else []
                # Only attach sources to the LAST paragraph to avoid duplication in UI
                sources = ai_sources if is_last_paragraph else []
                
                ai_message = ChatMessage(
                    chat=chat,
                    role=ChatMessage.Role.ASSISTANT,
                    content=paragraph_content,
                    suggestion1=suggestions[0] if len(suggestions) > 0 else None,
                    suggestion2=suggestions[1] if len(suggestions) > 1 else None,
                    sources=sources
                )
                ai_message.save()
                ai_messages.append(ai_message)

        if ai_messages:
            chat.last_message_at = ai_messages[-1].created_at
            chat.save()

        all_new_messages = [user_message] + ai_messages
        response_serializer = self.get_serializer(
            all_new_messages,
            many=True,
            context={'request': request}
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


# =============================================================================
# VIEW DE STREAMING SSE (Usando Django View básico)
# =============================================================================

@method_decorator(csrf_exempt, name='dispatch')
class StreamChatMessageView(View):
    """
    Endpoint SSE para chat com streaming de texto.

    Usa Django View básico (não DRF) para evitar problemas de
    content negotiation com Server-Sent Events.

    URL: POST /api/v1/chats/<pk>/stream/
    """

    def _authenticate(self, request):
        """
        Autentica o usuário via JWT Bearer token.
        Retorna o usuário ou None se falhar.
        """
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return None

        token = auth_header.split(' ', 1)[1]
        jwt_auth = JWTAuthentication()

        try:
            validated_token = jwt_auth.get_validated_token(token)
            user = jwt_auth.get_user(validated_token)
            return user
        except (InvalidToken, TokenError) as e:
            logger.warning(f"[Stream] JWT auth failed: {e}")
            return None

    def post(self, request, pk):
        """Processa POST request e retorna SSE stream."""
        # 1. Autenticação manual
        user = self._authenticate(request)
        if not user:
            return JsonResponse(
                {"detail": "Authentication credentials were not provided."},
                status=401
            )

        # 2. Verificar se o chat pertence ao usuário
        try:
            chat = Chat.objects.get(id=pk, user=user)
        except Chat.DoesNotExist:
            return JsonResponse({"detail": "Chat not found."}, status=404)

        if chat.status != Chat.ChatStatus.ACTIVE:
            return JsonResponse(
                {"detail": "This chat is archived."},
                status=403
            )

        # 3. Parsear body JSON
        try:
            body = json.loads(request.body.decode('utf-8'))
            content = body.get('content', '').strip()
        except (json.JSONDecodeError, UnicodeDecodeError):
            return JsonResponse({"detail": "Invalid JSON body."}, status=400)

        if not content:
            return JsonResponse({"detail": "Content is required."}, status=400)

        # 4. Salvar mensagem do usuário
        ChatMessage.objects.create(
            chat=chat,
            role=ChatMessage.Role.USER,
            content=content
        )
        chat.last_message_at = timezone.now()
        chat.save()

        # 5. Criar e retornar StreamingHttpResponse
        response = StreamingHttpResponse(
            process_message_stream(user.id, chat.id, content),
            content_type='text/event-stream'
        )

        # Headers essenciais para SSE
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'

        return response


# =============================================================================
# VIEWS DE ANEXOS E UPLOAD
# =============================================================================

class ChatMessageAttachmentView(generics.CreateAPIView):
    """
    Upload de anexos com processamento RAG síncrono.
    Suporta PDFs, DOCX e TXT para indexação vetorial.
    """
    serializer_class = ChatMessageAttachmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def create(self, request, *args, **kwargs):
        chat_id = self.kwargs['chat_pk']
        chat = get_object_or_404(Chat, id=chat_id, user=self.request.user)

        if chat.status != Chat.ChatStatus.ACTIVE:
            return Response({"detail": "Archived."}, status=403)

        files = request.FILES.getlist('attachments') or (
            [request.FILES.get('attachment')] if request.FILES.get('attachment') else []
        )

        if not files:
            return Response({"detail": "No files."}, status=400)

        created_msgs = []
        try:
            with transaction.atomic():
                for f in files:
                    mime, _ = mimetypes.guess_type(f.name)

                    # Salvar arquivo
                    m = self.get_serializer(data={'attachment': f, 'content': ''})
                    m.is_valid(raise_exception=True)
                    obj = m.save(
                        chat=chat,
                        role=ChatMessage.Role.USER,
                        attachment_type='image' if mime and mime.startswith('image/') else 'file',
                        original_filename=f.name
                    )
                    created_msgs.append(obj)

                    # Processamento RAG para documentos
                    processable_mimes = [
                        'application/pdf',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'text/plain'
                    ]
                    
                    text = None
                    if obj.attachment_type == 'file' and mime in processable_mimes:
                         text = FileProcessor.extract_text(obj.attachment.path, mime)
                    elif obj.attachment_type == 'image' and mime and mime.startswith('image/'):
                         logger.info(f"[RAG Image] Descrevendo: {obj.original_filename}")
                         text = image_description_service.describe_image(obj.attachment.path)

                    if text:
                        try:
                            logger.info(f"[RAG] Indexando texto extraído de: {obj.original_filename}")
                            # Salva o texto extraído no modelo para cache/debug
                            obj.extracted_text = text
                            obj.save(update_fields=['extracted_text'])

                            chunks = FileProcessor.chunk_text(text)
                            if chunks:
                                vector_service.add_document_chunks(
                                    user_id=chat.user.id,
                                    chunks=chunks,
                                    source_name=obj.original_filename,
                                    source_id=f"msg_{obj.id}",
                                    bot_id=chat.bot.id,
                                    study_space_id=None
                                )
                        except Exception as rag_error:
                            logger.error(f"[RAG ERROR] {obj.original_filename}: {rag_error}")

            if created_msgs:
                chat.last_message_at = created_msgs[-1].created_at
                chat.save()

            return Response(
                ChatMessageSerializer(created_msgs, many=True, context={'request': request}).data,
                status=201
            )
        except Exception as e:
            logger.error(f"Erro no upload: {e}")
            return Response({"detail": str(e)}, status=500)


# =============================================================================
# VIEWS DE ÁUDIO E TRANSCRIÇÃO
# =============================================================================

class AudioTranscriptionView(APIView):
    """Transcreve áudio usando Gemini."""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def post(self, request, chat_pk):
        get_object_or_404(Chat, id=chat_pk, user=request.user)
        f = request.FILES.get('audio')
        if not f:
            return Response({"detail": "No audio."}, status=400)

        res = transcribe_audio_gemini(f)
        if res['success']:
            return Response({"transcription": res['transcription']}, status=200)
        return Response({"detail": res['error']}, status=500)


class VoiceInteractionView(APIView):
    """Interação por voz sem resposta em áudio."""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def post(self, request, chat_pk):
        chat = get_object_or_404(Chat, id=chat_pk, user=request.user)
        f = request.FILES.get('audio')
        if not f:
            return Response({"detail": "No audio."}, status=400)

        try:
            res = handle_voice_interaction(chat.id, f, request.user)
            return Response({
                "transcription": res['transcription'],
                "ai_response_text": res['ai_response_text'],
                "user_message": ChatMessageSerializer(res['user_message'], context={'request': request}).data,
                "ai_messages": ChatMessageSerializer(res['ai_messages'], many=True, context={'request': request}).data
            }, status=200)
        except Exception as e:
            return Response({"detail": str(e)}, status=500)


class VoiceMessageView(APIView):
    """Processa mensagem de voz com resposta opcional em áudio."""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def post(self, request, chat_pk):
        chat = get_object_or_404(Chat, id=chat_pk, user=request.user)
        f = request.FILES.get('audio') or request.FILES.get('file') or request.FILES.get('attachment')
        if not f:
            return Response({"detail": "No audio."}, status=400)

        reply_audio = str(request.data.get('reply_with_audio', 'false')).lower() == 'true'

        try:
            user_duration = int(float(request.data.get('duration', 0)))
        except (ValueError, TypeError):
            user_duration = 0

        try:
            res = handle_voice_message(chat.id, f, reply_audio, request.user)
            if user_duration > 0:
                res['user_message'].duration = user_duration
                res['user_message'].save()

            return Response([
                ChatMessageSerializer(res['user_message'], context={'request': request}).data,
                ChatMessageSerializer(res['ai_message'], context={'request': request}).data
            ], status=201)
        except Exception as e:
            return Response({"detail": str(e)}, status=500)


# =============================================================================
# VIEWS DE GERENCIAMENTO DE CHAT
# =============================================================================

class ArchiveChatView(APIView):
    """Arquiva chat atual e cria um novo."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, chat_id):
        c = get_object_or_404(Chat, id=chat_id, user=request.user)
        c.status = Chat.ChatStatus.ARCHIVED
        c.save()

        n = Chat.objects.create(
            user=request.user,
            bot=c.bot,
            status=Chat.ChatStatus.ACTIVE
        )
        return Response({"new_chat_id": n.id}, status=201)


class SetActiveChatView(APIView):
    """Define um chat arquivado como ativo."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, chat_id):
        c = get_object_or_404(Chat, id=chat_id, user=request.user)

        # Arquivar outros chats ativos do mesmo bot
        Chat.objects.filter(
            user=request.user,
            bot=c.bot,
            status=Chat.ChatStatus.ACTIVE
        ).update(status=Chat.ChatStatus.ARCHIVED)

        c.status = Chat.ChatStatus.ACTIVE
        c.last_message_at = timezone.now()
        c.save()

        return Response(
            ChatListSerializer(c, context={'request': request}).data,
            status=200
        )


class MessageFeedbackView(APIView):
    """
    Atualiza o feedback de uma mensagem (like/dislike/null).
    Substitui o antigo MessageLikeToggleView.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, chat_pk, message_id):
        m = get_object_or_404(
            ChatMessage,
            id=message_id,
            chat_id=chat_pk,
            chat__user=request.user
        )

        feedback = request.data.get('feedback')
        if feedback not in ['like', 'dislike', None]:
            return Response({'detail': 'Invalid feedback value. Use "like", "dislike" or null.'}, status=400)

        m.feedback = feedback
        m.save()

        return Response({'feedback': m.feedback}, status=200)


class RegenerateMessageView(APIView):
    """
    Regera a última resposta do assistente.
    Apaga as mensagens do assistente que seguiram a última mensagem do usuário
    e gera uma nova resposta.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, chat_pk):
        chat = get_object_or_404(Chat, id=chat_pk, user=request.user)

        # Encontra a última mensagem do usuário
        last_user_msg = chat.messages.filter(role=ChatMessage.Role.USER).order_by('-created_at').first()

        if not last_user_msg:
             return Response({"detail": "No user message to reply to."}, status=400)

        # Apaga todas as mensagens que vieram DEPOIS dessa mensagem do usuário (normalmente a resposta antiga)
        # Isso garante que limpamos a resposta anterior antes de gerar a nova.
        chat.messages.filter(created_at__gt=last_user_msg.created_at).delete()

        # Gera nova resposta (reusando a lógica de get_ai_response)
        # Nota: reply_with_audio defaults to False here for simplicity, or we could pass it from request
        reply_with_audio = request.data.get('reply_with_audio', False)

        ai_response_data = get_ai_response(
            chat.id,
            last_user_msg.content,
            user_message_obj=last_user_msg,
            reply_with_audio=reply_with_audio
        )

        # ... (Logica de salvar a resposta similar ao ChatMessageListView.create)
        # Para evitar duplicação, o ideal seria refatorar a lógica de salvamento em um service,
        # mas por brevidade vou replicar a parte essencial aqui ou chamar o service se existir.

        ai_content = ai_response_data.get('content')
        ai_suggestions = ai_response_data.get('suggestions', [])
        # Ignore audio generation for regenerate for now unless strictly needed

        paragraphs = re.split(r'\\n{2,}', ai_content.strip()) if ai_content else []
        if not paragraphs:
            paragraphs = ["..."]

        ai_messages = []
        total_paragraphs = len(paragraphs)
        for i, paragraph_content in enumerate(paragraphs):
            is_last_paragraph = i == (total_paragraphs - 1)
            suggestions = ai_suggestions if is_last_paragraph else []
            ai_message = ChatMessage(
                chat=chat,
                role=ChatMessage.Role.ASSISTANT,
                content=paragraph_content,
                suggestion1=suggestions[0] if len(suggestions) > 0 else None,
                suggestion2=suggestions[1] if len(suggestions) > 1 else None,
            )
            ai_message.save()
            ai_messages.append(ai_message)

        if ai_messages:
            chat.last_message_at = ai_messages[-1].created_at
            chat.save()

        response_serializer = ChatMessageSerializer(
            ai_messages,
            many=True,
            context={'request': request}
        )

        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


# =============================================================================
# VIEWS DE TTS
# =============================================================================

class CleanupFileResponse(FileResponse):
    """FileResponse que remove o arquivo após envio."""

    def __init__(self, *args, cleanup_path=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.cleanup_path = cleanup_path

    def close(self):
        super().close()
        if self.cleanup_path and os.path.exists(self.cleanup_path):
            try:
                os.remove(self.cleanup_path)
            except OSError:
                pass


class MessageTTSView(APIView):
    """Gera áudio TTS para uma mensagem específica."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, chat_pk, message_id):
        m = get_object_or_404(
            ChatMessage,
            id=message_id,
            chat_id=chat_pk,
            role=ChatMessage.Role.ASSISTANT
        )

        if not m.content:
            return Response({"detail": "No content"}, status=400)

        # We don't define a path here, we let the service manage cache paths
        # Passed user for rate limiting
        res = generate_tts_audio(m.content, voice_name="Kore", user=request.user)

        if res.get('success'):
            file_path = res['file_path']
            if os.path.exists(file_path):
                return FileResponse(
                    open(file_path, 'rb'),
                    content_type='audio/wav'
                )

        error_msg = res.get('error', 'Unknown Error')
        status_code = 429 if "limit exceeded" in error_msg else 500
        return Response({"detail": error_msg}, status=status_code)

# =============================================================================
# VIEWS DE CONTEXTO E FONTES (NOVO)
# =============================================================================

class ChatSourceView(APIView):
    """
    Manage sources specific to a chat.
    POST: Upload/Link a source.
    DELETE: Remove a source.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def post(self, request, chat_id):
        chat = get_object_or_404(Chat, id=chat_id, user=request.user)

        # 1. Create KnowledgeSource
        title = request.data.get('title', 'Chat Upload')
        source_type = request.data.get('source_type', 'FILE')

        source = KnowledgeSource(
            user=request.user,
            title=title,
            source_type=source_type
        )

        if source_type == 'FILE' and request.FILES.get('file'):
            source.file = request.FILES['file']
        elif source_type in ['URL', 'YOUTUBE']:
            source.url = request.data.get('url')

        source.save()

        # 2. Ingest using centralized service for this Chat's Bot
        KnowledgeIngestionService.ingest_source(source, bot_id=chat.bot.id)

        # 4. Link to Chat
        chat.sources.add(source)

        return Response({
            'id': source.id,
            'title': source.title,
            'source_type': source.source_type,
            'created_at': source.created_at
        }, status=status.HTTP_201_CREATED)

    def delete(self, request, chat_id, source_id):
        chat = get_object_or_404(Chat, id=chat_id, user=request.user)
        source = get_object_or_404(KnowledgeSource, id=source_id, user=request.user)

        if source in chat.sources.all():
            chat.sources.remove(source)
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(status=status.HTTP_404_NOT_FOUND)


class ContextSourcesView(APIView):
    """
    Retorna a lista de fontes disponíveis para um chat (documentos indexados).
    Inclui fontes da KB do bot e fontes específicas do chat.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, chat_id):
        chat = get_object_or_404(Chat, id=chat_id, user=request.user)

        sources_list = []
        seen_ids = set()

        # Helper para formatar
        def add_source(s, origin_type, prefix):
            # Use prefixed ID to prevent collision between ChatMessage (source) and KnowledgeSource
            # Actually Chat.sources links to KnowledgeSource model now?
            # Wait. Chat.sources is ManyToMany to KnowledgeSource.
            # StudySpace.sources is ManyToMany to KnowledgeSource.
            # THEY ARE THE SAME MODEL.
            # KnowledgeSource IDs are unique across the table.
            # So collisions are NOT possible between a chat source and a space source because they are the same entity type.
            # BUT, SourceAssemblyService currently looks at ChatMessage.
            # Does Chat.sources link to ChatMessage or KnowledgeSource?
            # backend/chat/models.py: sources = models.ManyToManyField('studio.KnowledgeSource', ...)
            # So they ARE KnowledgeSource.

            # HOWEVER, SourceAssemblyService (read in previous step) looks at ChatMessage.objects.filter(id__in=source_ids).
            # This is WRONG if the sources are KnowledgeSource objects.
            # Previously, "sources" were file attachments on messages.
            # Now, we have a distinct KnowledgeSource model.
            # The SourceAssemblyService must be updated to look at KnowledgeSource model, NOT ChatMessage (or both if we support legacy).

            # Legacy support: Messages with attachments.
            # New support: KnowledgeSource objects.

            # Let's verify what `ContextSourcesView` returns.
            # It iterates `chat.sources.all()` -> These are KnowledgeSource.
            # It iterates `space.sources.all()` -> These are KnowledgeSource.
            # So the IDs are consistent (KnowledgeSource IDs).

            # The PROBLEM is SourceAssemblyService is querying ChatMessage with these IDs.
            # I need to update SourceAssemblyService to query KnowledgeSource.

            if s.id in seen_ids: return
            seen_ids.add(s.id)
            sources_list.append({
                'id': s.id,
                'title': s.title,
                'type': origin_type, # 'chat_source' ou 'space_source'
                'source_type': s.source_type,
                'url': s.url or (s.file.url if s.file else None),
                'created_at': s.created_at,
                'selected': True
            })

        # 1. Fontes Específicas do Chat
        for s in chat.sources.all():
            add_source(s, 'chat_source', '')

        # 2. Fontes dos Espaços de Estudo vinculados ao Bot
        if chat.bot:
            for space in chat.bot.study_spaces.all():
                for s in space.sources.all():
                    add_source(s, 'space_source', '')

        return Response(sources_list, status=200)
