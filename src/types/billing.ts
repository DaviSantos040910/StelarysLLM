export interface Limits {
  messages_monthly: number;
  sources_total: number;
  artifacts_monthly: number;
  tts_seconds_monthly: number;
  [key: string]: number;
}

export interface Usage {
  messages_count: number;
  artifacts_count: number;
  tts_seconds_count: number;
  sources_count: number; // Added to match typical needs, though strictly in basic it's total not monthly
  bot_tutor_count?: number;
  study_space_count?: number;
  artifacts_breakdown?: Record<string, number>;
  [key: string]: any;
}

export interface Flags {
  can_use_tts: boolean;
  can_create_bots: boolean;
  can_access_studio: boolean;
  [key: string]: boolean;
}

export interface BillingStatus {
  plan: 'TRIAL' | 'BASIC' | 'PRO' | 'LOCKED';
  trial_days_left: number | null;
  limits: Limits;
  usage: Usage;
  flags: Flags;
}
