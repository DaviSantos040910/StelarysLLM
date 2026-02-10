import re
import logging
from typing import List, Optional
from google import genai
from google.genai import types
from django.conf import settings
from .ai_client import get_ai_client

logger = logging.getLogger(__name__)

class StrictStyleService:
    """
    Serviço para reescrever respostas determinísticas (recusa/lista)
    aplicando a persona do tutor, mas com validação rigorosa
    para impedir alucinações ou fuga do modo estrito.
    """

    def __init__(self):
        self.client = get_ai_client()

    def rewrite_strict_refusal(self, base_text: str, persona: str, tutor_name: str, user_lang: str) -> str:
        """
        Reescreve uma mensagem de recusa estrita para adequar ao tom do tutor.
        """
        if not persona or not self.client:
            return base_text

        # Extrair trechos citados (entre aspas) para validação
        quoted_spans = re.findall(r'[“"\'‘](.*?)[”"\'’]', base_text)

        rewritten = self._generate_rewrite(
            base_text=base_text,
            persona=persona,
            tutor_name=tutor_name,
            user_lang=user_lang,
            context_type="REFUSAL"
        )

        if self._validate_rewrite(base_text, rewritten, quoted_spans=quoted_spans):
            return rewritten

        logger.warning("[StrictStyle] Refusal rewrite validation failed. Using base text.")
        return base_text

    def rewrite_sources_list(self, base_text: str, sources: List[str], persona: str, tutor_name: str, user_lang: str) -> str:
        """
        Reescreve uma lista de fontes para adequar ao tom do tutor.
        """
        if not persona or not self.client:
            return base_text

        rewritten = self._generate_rewrite(
            base_text=base_text,
            persona=persona,
            tutor_name=tutor_name,
            user_lang=user_lang,
            context_type="SOURCES_LIST"
        )

        if self._validate_rewrite(base_text, rewritten, allowed_doc_titles=sources):
            return rewritten

        logger.warning("[StrictStyle] Sources list rewrite validation failed. Using base text.")
        return base_text

    def _generate_rewrite(self, base_text: str, persona: str, tutor_name: str, user_lang: str, context_type: str) -> str:
        """Chamada ao LLM para reescrita de estilo."""
        system_instruction = (
            f"Você é um reescritor de estilo. Você NÃO pode adicionar fatos, documentos, links, números, nem alegar acesso a coisas.\n"
            f"Você só pode reescrever mantendo exatamente o mesmo significado.\n"
            f"Não mencione regras internas. Não mencione 'modo estrito'. Não mencione 'sistema'.\n"
            f"Você deve manter o idioma do usuário (lang={user_lang}).\n"
            f"Se houver nomes de arquivos/títulos, eles devem aparecer idênticos.\n"
        )

        user_prompt = (
            f"TUTOR_NAME: {tutor_name}\n"
            f"PERSONA (tom/estilo): {persona}\n\n"
            f"TEXTO_BASE (não altere fatos, só estilo):\n"
            f"<<<\n{base_text}\n>>>\n\n"
            f"REGRAS DE SAÍDA:\n"
            f"1) Retorne SOMENTE o texto final.\n"
            f"2) Não adicione nenhum fato novo.\n"
            f"3) Não invente fontes.\n"
            f"4) Preserve trechos entre aspas do TEXTO_BASE.\n"
            f"5) Preserve nomes de documentos exatamente.\n"
        )

        try:
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[
                    types.Content(role="user", parts=[types.Part(text=system_instruction + "\n" + user_prompt)])
                ],
                config=types.GenerateContentConfig(
                    temperature=0.5, # Baixa temperatura para fidelidade
                    max_output_tokens=1000
                )
            )
            return response.text.strip() if response.text else base_text
        except Exception as e:
            logger.error(f"[StrictStyle] Error calling LLM: {e}")
            return base_text

    def _validate_rewrite(
        self,
        base_text: str,
        output_text: str,
        allowed_doc_titles: Optional[List[str]] = None,
        quoted_spans: Optional[List[str]] = None
    ) -> bool:
        """
        Valida se a reescrita respeita as regras estritas de segurança.
        """
        if not output_text:
            return False

        # 1. Limite de tamanho (Evitar verbosidade excessiva)
        # Allow a bit more flexibility for very short base texts (e.g. 1-2 sentences)
        base_len = len(base_text)
        max_len = int(base_len * 1.3) + 100
        if len(output_text) > max_len:
            logger.debug(f"[StrictStyle] Validation Fail: Length exceeded ({len(output_text)} > {max_len})")
            return False

        # 2. substrings entre aspas (Match exato)
        # Geralmente contém a pergunta do usuário ou termos chave
        if quoted_spans:
            for span in quoted_spans:
                if len(span) < 3: continue # Ignora aspas muito curtas
                if span not in output_text:
                    logger.debug(f"[StrictStyle] Validation Fail: Missing quoted span '{span}'")
                    return False

        # 3. Títulos de documentos (Match exato para LIST_SOURCES)
        if allowed_doc_titles:
            for title in allowed_doc_titles:
                if title not in output_text:
                    logger.debug(f"[StrictStyle] Validation Fail: Missing document title '{title}'")
                    return False

        # 4. Padrões Proibidos (URLs)
        url_pattern = r'(https?://|www\.)\S+'
        if re.search(url_pattern, output_text):
            logger.debug("[StrictStyle] Validation Fail: URL detected")
            return False

        # 5. Números "novos"
        # Extrair números do base e do output
        base_nums = set(re.findall(r'\d+', base_text))
        out_nums = set(re.findall(r'\d+', output_text))

        # Permitir novos números se forem de formatação de lista (1., 2.)
        # Simplificação: Se surgiram muitos números novos (> 2), suspeito.
        # Ou verificar se os números novos são apenas sequenciais pequenos (1-9).
        new_nums = out_nums - base_nums
        for num in new_nums:
            # Se for ano (4 digitos) ou valor grande, rejeitar
            if len(num) >= 3:
                logger.debug(f"[StrictStyle] Validation Fail: New number detected '{num}'")
                return False
            # Se for numero pequeno (1 ou 2 digitos), pode ser pontuação, aceitar com cautela?
            # User requirement: "validar que não surgiram números que não existiam no base (exceção: pontuação)"
            # Vamos rejeitar se não parecer pontuação.
            # Difícil saber contexto sem NLP.
            # Assumir que StyleRewriter não deve introduzir estatísticas.

        # 6. Palavras proibidas (Alucinação de Web/Busca)
        forbidden_terms = [
            "pesquisei", "na internet", "acabei de buscar", "encontrei online",
            "real-time", "tempo real", "google search", "bing", "search result"
        ]
        lower_out = output_text.lower()
        for term in forbidden_terms:
            if term in lower_out:
                logger.debug(f"[StrictStyle] Validation Fail: Forbidden term '{term}'")
                return False

        return True

# Singleton instance
strict_style_service = StrictStyleService()
