# chat/services/voice_mapping.py

BOT_VOICE_TO_GEMINI = {
    "energetic_youth": "Puck",
    "calm_adult": "Kore",
    "professor": "Fenrir",
    "storyteller": "Aoede",
}

DEFAULT_GEMINI_VOICE = "Kore"

def get_gemini_voice(bot_voice_enum: str) -> str:
    """
    Maps a Bot voice ENUM (e.g., 'energetic_youth') to a Google Gemini voice name (e.g., 'Puck').
    Returns a safe fallback ('Kore') if the input is invalid or None.
    """
    if not bot_voice_enum:
        return DEFAULT_GEMINI_VOICE

    # Normalize input to lowercase for mapping
    key = bot_voice_enum.lower()
    return BOT_VOICE_TO_GEMINI.get(key, DEFAULT_GEMINI_VOICE)
