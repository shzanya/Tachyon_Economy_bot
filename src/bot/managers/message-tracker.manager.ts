import { Message } from 'discord.js';
import { redis } from '@db/redis';
import { pool } from '@db/index';
import { logger } from '@utils/logger';

type Timer = ReturnType<typeof setInterval>;

export class MessageTrackerManager {
  private static BATCH_INTERVAL = 60_000;
  private static XP_PER_MESSAGE = 2;
  private static MESSAGE_COOLDOWN = 3000;
  private static SPAM_THRESHOLD = 5;
  private static SPAM_WINDOW = 5000;
  private static batchTimer: Timer | null = null;

  static startBatchProcessor() {
    if (this.batchTimer) return;
    this.batchTimer = setInterval(() => this.flushAllBatches(), this.BATCH_INTERVAL);
    logger.info('💬 MessageTracker batch processor started');
  }

  static async stopBatchProcessor() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    await this.flushAllBatches();
    logger.info('💬 MessageTracker stopped, all batches flushed');
  }

  static async handleMessage(message: Message) {
    const { id: userId, bot } = message.author;
    const guildId = message.guild?.id;
    if (bot || !guildId || message.content.length < 3) return;

    const redisClient = redis();
    const now = Date.now();

    if (await this.checkSpam(userId, now)) return;

    const lastMessageKey = `msg:cooldown:${userId}:${guildId}`;
    const lastMessageTime = await redisClient.get(lastMessageKey);
    if (lastMessageTime && now - parseInt(lastMessageTime, 10) < this.MESSAGE_COOLDOWN) {
      await redisClient.hincrby(`msg:batch:${guildId}`, `${userId}:count`, 1);
      return;
    }

    await redisClient.setex(lastMessageKey, 10, now.toString());

    await redisClient.hincrby(`msg:batch:${guildId}`, `${userId}:count`, 1);
    await redisClient.hincrby(`msg:batch:${guildId}`, `${userId}:xp`, this.XP_PER_MESSAGE);

    const charBonus = Math.min(Math.floor(message.content.length / 100), 3);
    if (charBonus > 0)
      await redisClient.hincrby(`msg:batch:${guildId}`, `${userId}:xp`, charBonus);
  }

  private static async checkSpam(userId: string, now: number): Promise<boolean> {
    const redisClient = redis();
    const spamKey = `spam:${userId}`;
    const timestamps = await redisClient.lrange(spamKey, 0, -1);
    const recent = timestamps.map(t => parseInt(t, 10)).filter(t => now - t < this.SPAM_WINDOW);

    if (recent.length >= this.SPAM_THRESHOLD) return true;

    await redisClient.lpush(spamKey, now.toString());
    await redisClient.ltrim(spamKey, 0, this.SPAM_THRESHOLD - 1);
    await redisClient.expire(spamKey, Math.ceil(this.SPAM_WINDOW / 1000));
    return false;
  }

  private static async flushAllBatches() {
    const redisClient = redis();
    const keys = await redisClient.keys('msg:batch:*');
    for (const key of keys) await this.flushBatch(key.replace('msg:batch:', ''));
  }

  private static async flushBatch(guildId: string) {
    const redisClient = redis();
    const batch = await redisClient.hgetall(`msg:batch:${guildId}`);
    if (!batch || Object.keys(batch).length === 0) return;

    await redisClient.del(`msg:batch:${guildId}`);

    const userData = new Map<string, { count: number; xp: number }>();
    for (const [key, val] of Object.entries(batch)) {
      const [userId, type] = key.split(':');
      const u = userData.get(userId) ?? { count: 0, xp: 0 };
      if (type === 'count') u.count = parseInt(val, 10);
      if (type === 'xp') u.xp = parseInt(val, 10);
      userData.set(userId, u);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const [userId, { count, xp }] of userData.entries()) {
        if (count <= 0) continue;

        const safeXp = Math.max(xp, 0);
        const { rows } = await client.query(
          `INSERT INTO user_activity (user_id, guild_id, total_messages, xp, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (user_id, guild_id) DO UPDATE SET
             total_messages = user_activity.total_messages + $3,
             xp = GREATEST(user_activity.xp + $4, 0),
             updated_at = NOW()
           RETURNING xp, level, xp_for_next_level`,
          [userId, guildId, count, safeXp]
        );

        if (rows[0]) await this.checkLevelUp(client, userId, guildId, rows[0]);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error(`Ошибка сброса батча сообщений (${guildId}):`, err);
    } finally {
      client.release();
    }
  }

  private static async checkLevelUp(client: any, userId: string, guildId: string, data: any) {
    let { xp, level, xp_for_next_level } = data;
    let levelsGained = 0;

    xp = Math.max(xp, 0);
    while (xp >= xp_for_next_level) {
      level++;
      xp -= xp_for_next_level;
      xp_for_next_level = this.calculateXpForLevel(level);
      levelsGained++;
    }
    if (xp < 0) xp = 0;

    if (levelsGained > 0) {
      await client.query(
        `UPDATE user_activity SET level=$1, xp=$2, xp_for_next_level=$3 WHERE user_id=$4 AND guild_id=$5`,
        [level, xp, xp_for_next_level, userId, guildId]
      );
      logger.info(`🎉 User ${userId} leveled up to ${level}! (+${levelsGained} levels)`);
    }
  }

  private static calculateXpForLevel(level: number): number {
    return Math.floor(100 * Math.pow(1.5, level - 1));
  }
}
