import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { BotCommand } from "@types";
import { pool } from "@db/index";
import { redis } from "@db/redis";
import { VoiceTrackerManager } from "@managers/voice-tracker.manager";
import { logger } from "@utils/logger";

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0 сек.";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours} ч. ${minutes} мин.`;
  }
  if (minutes > 0) {
    return `${minutes} мин. ${secs} сек.`;
  }
  return `${secs} сек.`;
}

export const onlineCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("online")
    .setDescription("Посмотреть активность")
    .addUserOption(option =>
      option.setName("пользователь")
            .setDescription("Пользователь, чью активность нужно проверить")
            .setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser("пользователь") || interaction.user;
    await interaction.deferReply();

    try {
      const guildId = interaction.guildId!;
      const redisClient = redis();
      
      
      const [dbResult, todayTime, weekTime, redisData] = await Promise.all([
        (async () => {
          const client = await pool.connect();
          try {
            const { rows } = await client.query(
              `SELECT total_voice FROM user_activity 
               WHERE user_id = $1 AND guild_id = $2`,
              [target.id, guildId]
            );
            return rows.length > 0 ? Number(rows[0].total_voice) || 0 : 0;
          } finally {
            client.release();
          }
        })(),
        VoiceTrackerManager.getTodayStats(target.id, guildId),
        VoiceTrackerManager.getStatsForPeriod(target.id, guildId, 7),
        
        (async () => {
          const pipeline = redisClient.multi();
          pipeline.hget(`voice:completed:${guildId}`, target.id);
          pipeline.get(`voice:active:${target.id}:${guildId}`);
          
          const [[, completed], [, active]] = await pipeline.exec() as [
            [Error | null, string | null],
            [Error | null, string | null]
          ];
          
          return { completed, active };
        })()
      ]);

      
      let totalTime = dbResult;
      
      
      if (redisData.completed) {
        totalTime += parseInt(redisData.completed, 10);
      }
      
      
      if (redisData.active) {
        const joinTime = parseInt(redisData.active, 10);
        totalTime += Math.floor((Date.now() - joinTime) / 1000);
      }

      const embed = new EmbedBuilder()
        .setTitle(`—・Голосовая активность — ${target.username}`)
        .addFields(
          { 
            name: "> За день:", 
            value: `\`\`\`${formatDuration(todayTime)}\`\`\``, 
            inline: true 
          },
          { 
            name: "> За неделю:", 
            value: `\`\`\`${formatDuration(weekTime)}\`\`\``, 
            inline: true 
          },
          { 
            name: ">  За все время:", 
            value: `\`\`\`${formatDuration(totalTime)}\`\`\``, 
            inline: false 
          }
        )
        .setThumbnail(target.displayAvatarURL({ size: 4096 }));

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      logger.error("Ошибка при выполнении команды /online:", err);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2c2d31)
            .setDescription("❌ Произошла ошибка при получении данных активности.")
        ]
      });
    }
  },
};
