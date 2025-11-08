import { VoiceState } from 'discord.js';
import { redis } from '@db/redis';
import { pool } from '@db/index';
import { logger } from '@utils/logger';
import format from 'pg-format';

type Timer = ReturnType<typeof setInterval>;

export class VoiceTrackerManager {
  private static BATCH_INTERVAL = 30_000;
  private static CLEANUP_INTERVAL = 86_400_000;
  private static XP_PER_MINUTE = 5;
  private static PARALLEL_FLUSH_LIMIT = 10;
  private static MAX_BATCH_SIZE = 500; 
  private static batchTimer: Timer | null = null;
  private static cleanupTimer: Timer | null = null;

  static startBatchProcessor() {
    if (this.batchTimer) return;
    this.batchTimer = setInterval(() => this.flushCompletedSessions(), this.BATCH_INTERVAL);
    logger.info('🎙️ VoiceTracker batch processor started (30s interval, parallel processing)');
    
    this.startCleanupProcessor();
  }

  static async stopBatchProcessor() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    await this.flushCompletedSessions();
    logger.info('🎙️ VoiceTracker stopped, all batches flushed');
  }

  private static startCleanupProcessor() {
    if (this.cleanupTimer) return;
    
    this.cleanupOldData();
    
    this.cleanupTimer = setInterval(() => this.cleanupOldData(), this.CLEANUP_INTERVAL);
    logger.info('🗑️ Cleanup processor started (runs every 24h)');
  }

  private static async cleanupOldData() {
    try {
      const client = await pool.connect();
      
      const { rowCount } = await client.query(
        `DELETE FROM user_activity_history 
         WHERE date < CURRENT_DATE - INTERVAL '30 days'`
      );
      
      client.release();
      
      if (rowCount && rowCount > 0) {
        logger.info(`🗑️ Cleaned up ${rowCount} old activity records`);
      }
    } catch (err) {
      logger.error('Cleanup error:', err);
    }
  }

  static async handleSessionStart(newState: VoiceState) {
    const { id: userId, bot } = newState.member!.user;
    if (bot) return;

    const isActive = newState.channel && !newState.selfDeaf && !newState.serverDeaf;
    if (!isActive) return;

    const redisClient = redis();
    const key = `voice:active:${userId}:${newState.guild.id}`;
    
    const wasSet = await redisClient.set(key, Date.now().toString(), 'NX');
    
    if (wasSet) {
      logger.debug(`🎤 Session started: ${newState.member!.user.tag}`);
    }
  }

  static async handleSessionEnd(oldState: VoiceState) {
    const { id: userId, bot, tag } = oldState.member!.user;
    if (bot) return;

    const redisClient = redis();
    const activeKey = `voice:active:${userId}:${oldState.guild.id}`;
    const joinTimeStr = await redisClient.get(activeKey);
    if (!joinTimeStr) return;

    await redisClient.del(activeKey);

    const joinTime = parseInt(joinTimeStr, 10);
    const duration = Math.floor((Date.now() - joinTime) / 1000);

    if (duration > 0) {
      const completedKey = `voice:completed:${oldState.guild.id}`;
      await redisClient.hincrby(completedKey, userId, duration);
      
      logger.debug(`🎤 Session ended: ${tag}, ${duration}s`);
    }
  }

  private static async flushCompletedSessions() {
    const redisClient = redis();
    const guildIds: string[] = [];
    
    let cursor = '0';
    do {
      const result = await redisClient.scan(cursor, 'MATCH', 'voice:completed:*', 'COUNT', 100);
      
      cursor = result[0];
      const keys = result[1];
      
      for (const key of keys) {
        guildIds.push(key.replace('voice:completed:', ''));
      }
    } while (cursor !== '0');

    if (guildIds.length === 0) return;

    for (let i = 0; i < guildIds.length; i += this.PARALLEL_FLUSH_LIMIT) {
      const batch = guildIds.slice(i, i + this.PARALLEL_FLUSH_LIMIT);
      await Promise.allSettled(batch.map(guildId => this.flushBatch(guildId)));
    }
  }

  private static async flushBatch(guildId: string) {
    const redisClient = redis();
    const completedKey = `voice:completed:${guildId}`;
    
    const pipeline = redisClient.multi();
    pipeline.hgetall(completedKey);
    pipeline.del(completedKey);
    
    const [[, batch]] = await pipeline.exec() as [[Error | null, Record<string, string>], [Error | null, number]];
    
    if (!batch || Object.keys(batch).length === 0) return;

    const client = await pool.connect();

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const entries: Array<{
        userId: string;
        seconds: number;
        xpGained: number;
      }> = [];
      
      for (const [userId, secondsStr] of Object.entries(batch)) {
        const seconds = parseInt(secondsStr, 10);
        if (seconds <= 0) continue;

        const xpGained = Math.max(Math.floor((seconds / 60) * this.XP_PER_MINUTE), 0);
        entries.push({ userId, seconds, xpGained });
      }

      if (entries.length === 0) return;

      await client.query('BEGIN');

      
      for (let i = 0; i < entries.length; i += this.MAX_BATCH_SIZE) {
        const chunk = entries.slice(i, i + this.MAX_BATCH_SIZE);
        
        
        const activityValues = chunk.map(e => [e.userId, guildId, e.seconds, e.xpGained]);
        const activityQuery = format(
          `INSERT INTO user_activity (user_id, guild_id, total_voice, xp, updated_at, last_voice_join)
           VALUES %L
           ON CONFLICT (user_id, guild_id) DO UPDATE SET
             total_voice = user_activity.total_voice + EXCLUDED.total_voice,
             xp = GREATEST(user_activity.xp + EXCLUDED.xp, 0),
             updated_at = NOW()`,
          activityValues.map(v => [...v, new Date(), new Date()])
        );
        await client.query(activityQuery);

        
        const historyValues = chunk.map(e => [e.userId, guildId, today, e.seconds]);
        const historyQuery = format(
          `INSERT INTO user_activity_history (user_id, guild_id, date, voice_seconds)
           VALUES %L
           ON CONFLICT (user_id, guild_id, date) DO UPDATE SET
             voice_seconds = user_activity_history.voice_seconds + EXCLUDED.voice_seconds`,
          historyValues
        );
        await client.query(historyQuery);
      }

      
      const userIds = entries.map(e => e.userId);
      const { rows } = await client.query(
        `SELECT user_id, xp, level, xp_for_next_level 
         FROM user_activity 
         WHERE guild_id = $1 AND user_id = ANY($2)`,
        [guildId, userIds]
      );

      const levelUpdates: Array<[number, number, number, string]> = [];
      
      for (const row of rows) {
        let { xp, level, xp_for_next_level } = row;
        xp = Math.max(xp, 0);
        let levelsGained = 0;

        while (xp >= xp_for_next_level) {
          level++;
          xp -= xp_for_next_level;
          xp_for_next_level = this.calculateXpForLevel(level);
          levelsGained++;
        }

        if (levelsGained > 0) {
          levelUpdates.push([level, xp, xp_for_next_level, row.user_id]);
          logger.info(`🎉 Level up: ${row.user_id} → ${level}`);
        }
      }

      
      if (levelUpdates.length > 0) {
        const updateQuery = format(
          `UPDATE user_activity SET
             level = updates.level,
             xp = updates.xp,
             xp_for_next_level = updates.xp_for_next_level
           FROM (VALUES %L) AS updates(level, xp, xp_for_next_level, user_id)
           WHERE user_activity.user_id = updates.user_id 
             AND user_activity.guild_id = $1`,
          levelUpdates
        );
        await client.query(updateQuery, [guildId]);
      }

      await client.query('COMMIT');
      logger.info(`📊 Flushed batch [${guildId}]: ${entries.length} users, ${levelUpdates.length} level ups`);
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error(`Batch flush error [${guildId}]:`, err);
      
      
      const pipeline = redisClient.multi();
      for (const [userId, seconds] of Object.entries(batch)) {
        pipeline.hset(completedKey, userId, seconds);
      }
      await pipeline.exec();
    } finally {
      client.release();
    }
  }

  private static calculateXpForLevel(level: number): number {
    return Math.floor(100 * Math.pow(1.5, level - 1));
  }

  static async getTodayStats(userId: string, guildId: string): Promise<number> {
    const redisClient = redis();
    
    const pipeline = redisClient.multi();
    pipeline.hget(`voice:completed:${guildId}`, userId);
    pipeline.get(`voice:active:${userId}:${guildId}`);
    
    const [[, completedSeconds], [, joinTimeStr]] = await pipeline.exec() as [[Error | null, string | null], [Error | null, string | null]];
    
    const client = await pool.connect();
    try {
      const today = new Date().toISOString().split('T')[0];
      const { rows } = await client.query(
        `SELECT COALESCE(voice_seconds, 0) as total
         FROM user_activity_history
         WHERE user_id = $1 AND guild_id = $2 AND date = $3`,
        [userId, guildId, today]
      );
      
      let totalSeconds = Number(rows[0]?.total || 0);
      
      if (completedSeconds) {
        totalSeconds += parseInt(completedSeconds, 10);
      }
      
      if (joinTimeStr) {
        totalSeconds += Math.floor((Date.now() - parseInt(joinTimeStr, 10)) / 1000);
      }
      
      return totalSeconds;
    } finally {
      client.release();
    }
  }

  static async getStatsForPeriod(userId: string, guildId: string, days: number): Promise<number> {
    const redisClient = redis();
    
    const pipeline = redisClient.multi();
    pipeline.hget(`voice:completed:${guildId}`, userId);
    pipeline.get(`voice:active:${userId}:${guildId}`);
    
    const [[, completedSeconds], [, joinTimeStr]] = await pipeline.exec() as [[Error | null, string | null], [Error | null, string | null]];
    
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT COALESCE(SUM(voice_seconds), 0) as total
         FROM user_activity_history
         WHERE user_id = $1 AND guild_id = $2 AND date >= CURRENT_DATE - $3::interval`,
        [userId, guildId, `${days} days`]
      );
      
      let totalSeconds = Number(rows[0]?.total || 0);
      
      if (completedSeconds) {
        totalSeconds += parseInt(completedSeconds, 10);
      }
      
      if (joinTimeStr) {
        totalSeconds += Math.floor((Date.now() - parseInt(joinTimeStr, 10)) / 1000);
      }
      
      return totalSeconds;
    } finally {
      client.release();
    }
  }
}
