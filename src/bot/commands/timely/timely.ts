import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { TransactionManager } from '@services/transaction-manager';
import { pool } from '@db/index';
import { logger } from '@utils/logger';
import type { Transaction, BotCommand } from '@types';


import {
  createTimelySuccessEmbed,
  createTimelyCooldownEmbed,
  createTimelyErrorEmbed,
} from './embed/timely.embed'; 

const TIMELY_AMOUNT = 50; 
const TIMELY_COOLDOWN = 24 * 60 * 60 * 1000; 

const data = new SlashCommandBuilder()
  .setName('timely')
  .setDescription('Получить временную награду');

async function execute(interaction: ChatInputCommandInteraction) {
  const { user } = interaction;
  const { id: userId } = user;
  const guildId = interaction.guildId!;

  try {
    await interaction.deferReply();

    
    
    const { rows: lastTimelyRows } = await pool.query<Transaction>(
      `SELECT created_at FROM transactions 
       WHERE user_id = $1 AND guild_id = $2 AND category = 'daily_bonus' 
       ORDER BY created_at DESC LIMIT 1`,
      [userId, guildId]
    );

    const lastTimely = lastTimelyRows[0];
    if (lastTimely) {
      const timeSinceLastTimely = Date.now() - new Date(lastTimely.created_at).getTime();

      if (timeSinceLastTimely < TIMELY_COOLDOWN) {
        const nextRewardTime = new Date(lastTimely.created_at).getTime() + TIMELY_COOLDOWN;
        const nextRewardTimestamp = Math.floor(nextRewardTime / 1000);

        const embed = createTimelyCooldownEmbed(user, nextRewardTimestamp);
        await interaction.editReply({ embeds: [embed] });
        return;
      }
    }

    
    
    await TransactionManager.addTransaction({
        userId,
        guildId,
        amount: TIMELY_AMOUNT,
        currencyType: 'coins', 
        reason: 'Ежедневный бонус', 
        merchant: 'System',
      });

    
    const nextRewardTimestamp = Math.floor((Date.now() + TIMELY_COOLDOWN) / 1000);
    const successEmbed = createTimelySuccessEmbed(user, TIMELY_AMOUNT, nextRewardTimestamp);

    await interaction.editReply({ embeds: [successEmbed] });

    logger.info(`⏰ Timely: User ${user.tag} received ${TIMELY_AMOUNT}`);

  } catch (error) {
    logger.error('Timely command error:', error);
    const message = error instanceof Error ? error.message : 'Не удалось получить награду. Попробуйте позже.';
    const errorEmbed = createTimelyErrorEmbed(message);
    
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

export const timelyCommand: BotCommand = {
  data,
  execute,
};
