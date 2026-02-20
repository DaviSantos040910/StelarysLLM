"""
Constants for Billing and Quota codes.
Standardizes error codes used across the backend and frontend for entitlement enforcement.
"""

# Plan Status Codes
PLAN_LOCKED = "plan_locked"

# Trial Limits
TRIAL_MESSAGE_LIMIT = "trial_message_limit"
TRIAL_ARTIFACT_LIMIT = "trial_artifact_limit"
TRIAL_SOURCE_LIMIT = "trial_source_limit"
TRIAL_TUTOR_LIMIT = "trial_tutor_limit"
TRIAL_SPACE_LIMIT = "trial_space_limit"
TRIAL_MEMORY_LIMIT = "trial_memory_limit"
TRIAL_TTS_BLOCKED = "trial_tts_blocked"

# Basic Plan Limits
BASIC_ARTIFACT_LIMIT = "basic_artifact_limit"
BASIC_MESSAGE_LIMIT = "basic_message_limit"
BASIC_TTS_LIMIT = "basic_tts_limit"
BASIC_SOURCE_LIMIT = "basic_source_limit"

# Generic
INVALID_REQUEST = "invalid_request"
QUOTA_EXCEEDED = "quota_exceeded"
