# studio/schemas.py

# Definindo esquemas como dicionários puros (JSON Schema) para evitar
# conflitos de versão ou namespace com o SDK google.genai (types.Type).
# O SDK aceita dicionários crus para response_schema.

# Esquema para Quiz
QUIZ_SCHEMA = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "question": {"type": "STRING"},
            "options": {
                "type": "ARRAY",
                "items": {"type": "STRING"}
            },
            "correctAnswerIndex": {"type": "INTEGER"}
        },
        "required": ["question", "options", "correctAnswerIndex"]
    }
}

# Esquema para Flashcards
FLASHCARD_SCHEMA = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "front": {"type": "STRING"},
            "back": {"type": "STRING"}
        },
        "required": ["front", "back"]
    }
}

# Esquema para Resumo
SUMMARY_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "summary": {"type": "STRING"},
        "key_points": {
            "type": "ARRAY",
            "items": {"type": "STRING"}
        }
    },
    "required": ["summary"]
}

# Esquema para Slides
SLIDE_SCHEMA = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "title": {"type": "STRING"},
            "bullets": {
                "type": "ARRAY",
                "items": {"type": "STRING"}
            }
        },
        "required": ["title", "bullets"]
    }
}
