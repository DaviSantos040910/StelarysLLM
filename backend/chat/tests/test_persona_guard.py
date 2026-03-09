from django.test import TestCase
from chat.services.persona_guard import PersonaGuard, StreamSanitizer

class PersonaGuardTest(TestCase):
    def test_compile_persona_vague_prompt(self):
        """Testa se prompts vagos geram a persona padrão."""
        persona = PersonaGuard.compile_persona("Paulo", "engraçado", "Descrição irrelevante")
        self.assertIn("Bem-humorado, leve e carismático", persona)
        self.assertIn("IDENTIDADE E PERSONA (OBRIGATÓRIO)", persona)
        self.assertIn("NUNCA diga que é uma IA", persona)

    def test_compile_persona_detailed_prompt(self):
        """Testa se prompts detalhados são preservados."""
        detailed = "Um professor de física quântica muito sério que ama gatos." * 5 # Longo
        persona = PersonaGuard.compile_persona("Paulo", detailed)
        self.assertIn(detailed, persona)
        self.assertIn("REGRAS DE VOZ (INVIOLÁVEIS)", persona)

    def test_sanitize_identity_leaks(self):
        """Testa a remoção de vazamentos de identidade em texto estático."""
        text = "Como uma inteligência artificial, eu não posso sentir emoções. Mas posso ajudar."
        sanitized = PersonaGuard.sanitize_identity_leaks(text, "Bot")
        self.assertNotIn("Como uma inteligência artificial", sanitized)
        self.assertNotIn("não posso sentir emoções", sanitized)
        # Verifica se o conteúdo útil (ou substituição) permanece
        self.assertTrue(len(sanitized) > 10)

    def test_stream_sanitizer(self):
        """Testa o filtro de streaming com chunks quebrados."""
        sanitizer = StreamSanitizer("Bot")

        # Simula: "Como uma " + "inteligência ar" + "tificial, eu..."
        sanitizer.process_chunk("Como uma ")
        sanitizer.process_chunk("inteligência ar")
        sanitizer.process_chunk("tificial, ")

        # Agora detectou e removeu.

        out4 = sanitizer.process_chunk("eu ajudo.")
        final = sanitizer.flush()

        result = out4 + final
        self.assertIn("eu ajudo", result)
        self.assertNotIn("inteligência", result)

    def test_stream_sanitizer_safe_text(self):
        sanitizer = StreamSanitizer("Bot")
        out = sanitizer.process_chunk("Olá, tudo bem?")
        final = sanitizer.flush()
        result = out + final
        self.assertIn("Olá", result)
        self.assertIn("bem?", result)
