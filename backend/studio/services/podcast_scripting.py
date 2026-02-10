import json
import logging
from google.genai import types
from chat.services.ai_client import get_ai_client
from core.genai_models import GENAI_MODEL_TEXT

logger = logging.getLogger(__name__)

class PodcastScriptingService:
    @staticmethod
    def generate_script(title: str, context: str, duration_constraint: str = "Medium", bot_name: str = "Alex", bot_prompt: str = "") -> list:
        """
        Generates a podcast script dialogue between the Bot (Host) and a Co-host.
        Returns a list of dicts: [{"speaker": "Host (BotName)", "text": "..."}, ...]
        """
        client = get_ai_client()
        model_name = GENAI_MODEL_TEXT

        host_display = f"Host ({bot_name})"

        # Define Final Schema (NotebookLM-like)
        script_schema = types.Schema(
            type=types.Type.OBJECT,
            properties={
                "episode_title": types.Schema(type=types.Type.STRING, description="Catchy title (4-80 chars)"),
                "episode_summary": types.Schema(type=types.Type.STRING, description="Brief summary (2-4 lines, no markdown)"),
                "chapters": types.Schema(
                    type=types.Type.ARRAY,
                    items=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "title": types.Schema(type=types.Type.STRING),
                            "start_turn_index": types.Schema(type=types.Type.INTEGER)
                        }
                    )
                ),
                "dialogue": types.Schema(
                    type=types.Type.ARRAY,
                    items=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "speaker": types.Schema(type=types.Type.STRING, enum=["HOST", "COHOST"]),
                            "display_name": types.Schema(type=types.Type.STRING),
                            "text": types.Schema(type=types.Type.STRING)
                        },
                        required=["speaker", "text"]
                    )
                )
            },
            required=["episode_title", "episode_summary", "chapters", "dialogue"]
        )

        # 1. SYSTEM INSTRUCTION
        persona_instruction = ""
        if bot_prompt:
            persona_instruction = f"{{BOT_PERSONA}} content:\n{bot_prompt}\n"

        system_instruction = f"""You are generating a short educational podcast script for a study assistant app.

The script has two speakers:
- HOST: the tutor (must sound like the tutor personality).
- COHOST: a neutral co-host who asks clarifying questions and keeps the conversation structured.

STYLE / FLOW
- Sound natural, like a friendly NotebookLM-style conversation.
- Keep turns short and clear (1–4 sentences per turn).
- COHOST should ask questions that help the listener understand.
- HOST should explain clearly and teach.

LANGUAGE
- Write in the user's language: Portuguese (unless context strongly implies English).

HOST IDENTITY
- HOST display name MUST be exactly: "{host_display}".
- HOST personality (follow for tone only):
  {persona_instruction}

CONTEXT
You will receive SOURCE MATERIAL. It is the ONLY allowed source for factual statements.

OUTPUT FORMAT (STRICT)
- Output MUST be valid JSON that matches the provided schema.
- Do not include markdown.
- Do not include citations like [1].
- Do not include any extra keys outside the schema.
- Chapters must be 3 to 7 items and must point to valid dialogue indexes.

FACT POLICY (HARD RULES — MUST FOLLOW)
- USE ONLY THE SOURCE MATERIAL FOR FACTS.
- DO NOT INVENT DETAILS, NUMBERS, OR EXAMPLES THAT ARE NOT IN THE SOURCE MATERIAL.
- IF THE SOURCE MATERIAL IS INSUFFICIENT TO SUPPORT A TOPIC, YOU MUST SAY SO CLEARLY IN THE DIALOGUE.
- DO NOT USE WEB KNOWLEDGE OR PRIOR KNOWLEDGE.
- NEVER CLAIM YOU READ OR ACCESSED ANYTHING OUTSIDE THE SOURCE MATERIAL.
"""

        # 2. USER PROMPT
        user_prompt = f"""TITLE: {title}
TARGET DURATION: {duration_constraint}
AUDIENCE: A learner studying this topic.

SOURCE MATERIAL:
<<<
{context}
>>>

TASK
Create a podcast script JSON using the required schema:
1) episode_title: a concise title derived from the material
2) episode_summary: 2–4 lines describing what will be covered
3) chapters: 3–7 short chapter titles with start_turn_index pointing into dialogue
4) dialogue: 2-speaker conversation (HOST and COHOST), where HOST teaches from the material

Remember:
- HOST display_name MUST be "{host_display}"
- COHOST display_name MUST be "Co-host"
- If the user’s question/topic is not supported by SOURCE MATERIAL, say that clearly instead of inventing.
"""

        try:
            response = client.models.generate_content(
                model=model_name,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_schema=script_schema,
                    temperature=0.45
                )
            )

            if response.parsed:
                return response.parsed
            else:
                # Fallback
                return json.loads(response.text)

        except Exception as e:
            logger.error(f"Error generating podcast script: {e}")
            raise
