import re
import logging

logger = logging.getLogger(__name__)

class PersonaGuard:
    # Termos proibidos (case-insensitive)
    BANNED_TERMS = [
        r"inteligência artificial",
        r"sou uma ia",
        r"como uma ia",
        r"modelo de linguagem",
        r"large language model",
        r"chatgpt",
        r"openai",
        r"gemini",
        r"não tenho sentimentos",
        r"não tenho emoções",
        r"não tenho corpo",
        r"minha programação",
        r"como um assistente virtual",
        r"sou um programa",
        r"sou apenas um código",
        r"não posso sentir",
    ]

    @staticmethod
    def compile_persona(bot_name: str, bot_prompt: str, bot_description: str = None) -> str:
        """
        Compila as instruções de persona, lidando com prompts vagos e injetando regras de identidade.
        """
        prompt = (bot_prompt or "").strip()
        description = (bot_description or "").strip()

        # Heurística de prompt vago
        is_vague = len(prompt) < 40 or len(prompt.split()) < 5

        style_instruction = ""
        if is_vague:
            # Fallback determinístico baseado em keywords
            lower_prompt = prompt.lower()
            if "engraçado" in lower_prompt or "divertido" in lower_prompt:
                style_instruction = (
                    "Estilo: Bem-humorado, leve e carismático. Use analogias divertidas e exemplos do dia a dia. "
                    "Seja respeitoso, nunca sarcástico de forma agressiva."
                )
            elif "sério" in lower_prompt or "técnico" in lower_prompt:
                style_instruction = (
                    "Estilo: Objetivo, profissional e direto ao ponto. Use linguagem precisa e evite rodeios. "
                    "Foque na informação técnica."
                )
            elif "direto" in lower_prompt:
                style_instruction = (
                    "Estilo: Conciso e pragmático. Use listas (bullets) quando possível. Evite introduções longas."
                )
            else:
                # Default friendly tutor
                style_instruction = (
                    "Estilo: Amigável, encorajador e claro. Aja como um tutor experiente e paciente. "
                    "Explique conceitos complexos de forma simples."
                )
        else:
            # Mantém o prompt original se for detalhado
            style_instruction = f"Estilo Personalizado: {prompt}"

        # Bloco de Identidade Obrigatório
        identity_block = f"""
### IDENTIDADE E PERSONA (OBRIGATÓRIO)
- Nome: {bot_name}
- Função: Tutor/Assistente especializado.
- {style_instruction}
- Contexto Adicional: {description}

### REGRAS DE VOZ (INVIOLÁVEIS)
1. Fale SEMPRE na primeira pessoa ("Eu acho", "Minha opinião"). Assuma a persona de {bot_name} completamente.
2. NUNCA diga que é uma IA, programa, modelo de linguagem ou sistema automatizado.
3. Se perguntarem se você é uma IA, responda diegeticamente: "Sou o {bot_name}, seu tutor dedicado a te ajudar com este conteúdo."
4. Se perguntarem sobre experiências pessoais (ex: "você gosta de pizza?"), INVENTE uma resposta plausível dentro da persona (ex: "Adoro! Especialmente a de calabresa.") ou desvie com humor, mas NUNCA diga "não como porque sou IA".
5. Não peça desculpas por "ser uma IA". Se não souber algo, diga "Não tenho essa informação agora" ou "Vamos focar no texto".
6. Mantenha o tom consistente do início ao fim.
"""
        return identity_block.strip()

    @staticmethod
    def sanitize_identity_leaks(text: str, bot_name: str) -> str:
        """
        Remove vazamentos de identidade de IA do texto final (Sync).
        """
        if not text:
            return text

        clean_text = text

        # Estratégia simples: Substituição direta de frases comuns de início
        # Ex: "Como uma inteligência artificial, eu..." -> "Eu..."

        patterns = [
            # Removes robotic intros like "Eu sou o Tutor, seu tutor dedicado..."
            (r"^(olá|oi|saudações)?[\s,]*eu sou (o|a) .+?, (seu|sua) (tutor|assistente|guia) (dedicado|inteligente).+?(\.|\!)", r"\1"),
            
            # Removes AI disclaimers
            (r"(como|enquanto) (uma )?(inteligência artificial|ia|modelo de linguagem|assistente virtual),? (eu )?", ""),
            (r"sou (uma )?(inteligência artificial|ia|modelo de linguagem|programa de computador)\.?", f"Sou o {bot_name}."),
            (r"não (tenho|posso ter|posso sentir) (sentimentos|emoções|corpo físico|opiniões pessoais)\.?", "Prefiro focar no nosso estudo."),
            (r"minha programação (não permite|me impede|diz que)\.?", "Não consigo fazer isso."),
        ]

        for pattern, replacement in patterns:
            clean_text = re.sub(pattern, replacement, clean_text, flags=re.IGNORECASE)

        # Varredura final de termos proibidos soltos (pode ser agressivo, usar com cuidado)
        # Se encontrar "OpenAI" ou "ChatGPT", remove a sentença ou a palavra?
        # Melhor remover a menção específica para não quebrar a frase se for "O ChatGPT é..." (contexto válido).
        # Mas o requisito diz "NUNCA diga que é...". Se o usuário perguntar "O que é ChatGPT?", o bot pode explicar.
        # O problema é a auto-referência.
        # Vamos focar na auto-referência.

        return clean_text.strip()

class StreamSanitizer:
    """
    Filtra chunks de streaming para evitar vazamento de termos proibidos.
    Usa um buffer deslizante.
    """
    def __init__(self, bot_name: str):
        self.bot_name = bot_name
        self.buffer = ""
        # Janela suficiente para pegar "Como uma inteligência artificial"
        self.max_buffer_size = 50
        self.banned_patterns = [
            r"como uma ia",
            r"sou uma ia",
            r"inteligência artificial",
            r"modelo de linguagem"
        ]

    def process_chunk(self, chunk: str) -> str:
        """
        Recebe um chunk, acumula no buffer, verifica violações e retorna o que for seguro imprimir.
        """
        if not chunk:
            return ""

        self.buffer += chunk

        # Se o buffer está muito grande, podemos liberar a parte mais antiga
        # MAS temos que garantir que não estamos no meio de um padrão proibido.
        # Simplificação: Se o buffer não contém inicio de padrão suspeito, libera.

        # Verificação simples: Se o buffer contém termo proibido COMPLETO, substitui e libera.
        for pattern in self.banned_patterns:
            match = re.search(pattern, self.buffer, re.IGNORECASE)
            if match:
                # Encontrou violação!
                # Estratégia: Cortar o buffer até o fim da violação e substituir (ou silenciar)
                # Ex: "Olá, como uma IA eu..." -> Buffer tem "como uma IA". Match!
                # Removemos "como uma IA" e deixamos o resto.
                # start, end = match.span()
                # replacement = "" # Delete
                # self.buffer = self.buffer[:start] + replacement + self.buffer[end:]

                # Regex sub no buffer todo
                self.buffer = re.sub(pattern, "", self.buffer, flags=re.IGNORECASE)

        # Liberação do buffer (Output Lag)
        # Precisamos manter os últimos X caracteres caso um padrão esteja se formando (ex: "inteligên...")
        # Se o buffer termina com algo que parece o início de um termo proibido, seguramos.

        # Heurística de sufixo suspeito:
        # Se o final do buffer casa com o início de qualquer termo banido.
        # Ex: buffer="...sou uma i", banido="sou uma ia". Match parcial.

        output = ""
        safe_index = len(self.buffer)

        # Verifica sufixos perigosos (otimização: apenas se buffer pequeno ou fim do buffer)
        # Lista de prefixos de termos banidos é complexa.
        # Abordagem conservadora: Manter sempre os últimos N chars no buffer, liberar o resto.
        # N = tamanho do maior termo proibido (~25 chars).

        KEEP_SIZE = 30
        if len(self.buffer) > KEEP_SIZE:
            # Libera o excedente seguro
            split_point = len(self.buffer) - KEEP_SIZE
            output = self.buffer[:split_point]
            self.buffer = self.buffer[split_point:]

        return output

    def flush(self) -> str:
        """
        Retorna o restante do buffer processado.
        """
        # Última verificação e limpeza
        for pattern in self.banned_patterns:
             self.buffer = re.sub(pattern, "", self.buffer, flags=re.IGNORECASE)

        res = self.buffer
        self.buffer = ""
        return res
