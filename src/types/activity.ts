export interface UserActivity {
    user_id: string;
    guild_id: string;
    total_voice: number;
    total_messages: number;
    xp: number;
    level: number;
    xp_for_next_level: number;
    last_voice_join: Date | null;
    updated_at: Date;
  }
