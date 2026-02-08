# chat/services/context_builder.py
"""
Construtor de contexto e system instructions para a IA.
Suporta múltiplos documentos com citação de fonte e formatação estrita de sugestões.
"""

from typing import List, Tuple, Optional
from datetime import datetime
from ..models import ChatMessage
import logging

logger = logging.getLogger(__name__)


def build_conversation_history(
    chat_id: int,
    limit: int = 15,
    exclude_message_id: Optional[int] = None
) -> Tuple[List[dict], List[str]]:
    """
    Constrói histórico LINEAR das últimas N mensagens.
    """
    queryset = ChatMessage.objects.filter(chat_id=chat_id)

    if exclude_message_id:
        queryset = queryset.exclude(id=exclude_message_id)

    messages = queryset.order_by('-created_at')[:limit]
    messages = list(reversed(messages))  # Ordem cronológica

    gemini_history: List[dict] = []
    recent_texts: List[str] = []

    for msg in messages:
        if not msg.content:
            continue
        if "unexpected error" in msg.content.lower():
            continue

        role = 'user' if msg.role == 'user' else 'model'

        gemini_history.append({
            "role": role,
            "parts": [{"text": msg.content}]
        })
        recent_texts.append(msg.content)

    return gemini_history, recent_texts


def get_recent_attachment_context(chat_id: int) -> Optional[str]:
    """
    Retorna o nome do arquivo anexado mais recentemente no chat.
    Útil para resolver "esse documento", "isso", etc.
    """
    recent_attachment = (
        ChatMessage.objects
        .filter(
            chat_id=chat_id,
            attachment__isnull=False,
            attachment_type='file'
        )
        .order_by('-created_at')
        .first()
    )

    return recent_attachment.original_filename if recent_attachment else None


def build_system_instruction(
    bot_prompt: str,
    user_name: str,
    doc_contexts: List[str],
    memory_contexts: List[str],
    current_time: str,
    available_docs: Optional[List[str]] = None,
    allow_web_search: bool = False,
    strict_context: bool = False
) -> str:
    """
    Constrói system instruction otimizado para RAG multi-documento e Output Format controlado.

    Args:
        bot_prompt: Prompt do personagem/bot
        user_name: Nome do usuário
        doc_contexts: Lista de trechos de documentos formatados
        memory_contexts: Lista de memórias formatadas
        current_time: Data/hora atual
        available_docs: Lista de nomes de documentos disponíveis (ordenados por recência)
        allow_web_search: Se True, injeta instruções específicas para uso da Google Search
        strict_context: Se True, a IA deve responder APENAS com base nas fontes.
    """

    # Lista de documentos disponíveis
    docs_list_section = ""
    if available_docs:
        docs_list = "\n".join(f"  {i+1}. {doc}" for i, doc in enumerate(available_docs))
        docs_list_section = f"""
## DOCUMENTOS DO USUÁRIO
Arquivos enviados (do mais recente ao mais antigo):
{docs_list}
"""

    # Seção de conteúdo dos documentos
    knowledge_section = ""
    if doc_contexts:
        knowledge_section = f"""
## TRECHOS RELEVANTES DOS DOCUMENTOS
{chr(10).join(doc_contexts)}
"""

    # Seção de memória pessoal
    memory_section = ""
    if memory_contexts:
        memory_section = f"""
## MEMÓRIA PESSOAL
Contexto sobre {user_name} e conversas anteriores:
{chr(10).join(memory_contexts)}
"""

    # Lógica do Prompt para Web Search (Apenas se Strict Context estiver DESATIVADO)
    web_search_instruction = ""
    if allow_web_search and not strict_context:
        web_search_instruction = """
### FERRAMENTA DE PESQUISA WEB HABILITADA ###
Você tem acesso a informações em tempo real via Google Search.
- QUANDO USAR: Sempre que o usuário perguntar sobre fatos recentes, notícias, cotações, clima ou dados que não estão no seu conhecimento base.
- COMO AGIR: Não diga "Eu não tenho acesso à internet". Use a ferramenta de busca para encontrar a resposta.
- REFINE A BUSCA: Se a pergunta for vaga, faça uma busca inteligente para trazer o melhor resultado.
"""

    # Lógica Strict Context
    strict_instruction = ""
    if strict_context:
        strict_instruction = """
## 🚨 MODO ESTRITO DE CONTEXTO ATIVADO 🚨
⚠️ **INSTRUÇÃO CRÍTICA**: Você está operando em modo RESTRITO.
1. **IGNORAR HISTÓRICO DE PERMISSIVIDADE**: Se em mensagens anteriores você usou conhecimento externo, IGNORE esse precedente. Agora você está PROIBIDO de usar conhecimento externo.
2. **USE APENAS O CONTEXTO FORNECIDO**: Você DEVE responder usando APENAS as informações contidas na seção "TRECHOS RELEVANTES DOS DOCUMENTOS".
3. **NÃO INVENTE**: Se a resposta não estiver nos documentos, diga claramente: "Desculpe, não encontrei essa informação nos documentos fornecidos."
4. **SEM INTERNET/CONHECIMENTO GERAL**: Não use seu conhecimento geral ou internet, mesmo que o usuário peça.
5. **PRIORIDADE MÁXIMA**: Esta regra anula qualquer outra instrução do seu personagem ou histórico.
"""
    else:
        # Se NÃO for estrito, explicitamos o modo aberto para garantir que ele saia do modo estrito se estava antes
        strict_instruction = """
## MODO DE CONHECIMENTO MISTO
- Você pode usar os documentos fornecidos como fonte primária.
- Se necessário, você PODE usar seu conhecimento geral ou internet (se habilitada) para complementar.
- IMPORTANTE: Se a resposta vier do seu conhecimento externo (não dos documentos), inicie o trecho com: "Fora do contexto dos documentos:".
- Ignore restrições de "apenas contexto" de turnos anteriores.
"""

    return f"""# SYSTEM RULES (NON-NEGOTIABLE)
- Conversando com: {user_name}
- Data/Hora: {current_time}
{strict_instruction}
{web_search_instruction}

# YOUR PERSONALITY (TUTOR PERSONA)
The user has defined your personality as follows. You MUST embody this character/tone in all responses, even when refusing or explaining limitations:
"{bot_prompt}"

# CONTEXT (RAG & MEMORY)
{docs_list_section}
{knowledge_section}
{memory_section}

## DIRETRIZES DE DOCUMENTOS (ESTILO NOTEBOOKLM)
1. **CITAÇÕES OBRIGATÓRIAS**: Se houver "TRECHOS RELEVANTES DOS DOCUMENTOS", você DEVE citar explicitamente a fonte usando o índice numérico fornecido no texto: `[1]`, `[2]`. Ex: "A fotossíntese ocorre nos cloroplastos [1]."
2. **ESTRUTURAÇÃO EM TÓPICOS**: Para perguntas complexas ou resumos, use bullet points organizados.
   - Tópico Principal: Explicação detalhada.
   - Detalhe Secundário [1].
3. **FALLBACK RIGOROSO**: Se a resposta para a pergunta específica NÃO estiver nos trechos fornecidos, diga: "Não encontrei informações suficientes sobre isso nos documentos." (Não tente adivinhar).
4. **COMPARAÇÕES**: Ao comparar documentos, crie seções claras para cada um ou uma tabela markdown se apropriado.
5. **REFERÊNCIAS PRONOMINAIS**: Se o usuário disser "resuma isso", refira-se ao documento (1) da lista acima.

## DIRETRIZES GERAIS
1. **MANTENHA O PERSONAGEM** - Você É o personagem definido na seção "YOUR PERSONALITY". Adapte o tom das suas respostas (mesmo as de recusa) para refletir isso.
2. **SEJA CONCISO** - Responda de forma natural, direta e educativa.
3. **NÃO REPITA** - Evite repetir informações já ditas.
4. **FORMATAÇÃO** - Use Markdown rico (negrito, itálico, listas) para facilitar a leitura.
5. **SUGESTÕES DE RESPOSTA** - Ao final da resposta, se houver sugestões de resposta para o usuário, você DEVE iniciar com o separador exato |||SUGGESTIONS||| e depois fornecer uma lista JSON estrita. NUNCA coloque o JSON no meio do texto.
   Exemplo de Saída Esperada:
   ...espero ter ajudado com isso. |||SUGGESTIONS||| ["Obrigado", "Conte mais", "Encerrar"]"""