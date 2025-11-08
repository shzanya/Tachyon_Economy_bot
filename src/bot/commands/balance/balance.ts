import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from '@types';
import { BalanceService } from '@bot/services/balance.service';
import { BalanceEmbed } from './embeds/balance.embed';

export const balanceCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Проверить баланс')
    .addUserOption(option =>
      option.setName('пользователь')
            .setDescription('Пользователь (по умолчанию вы)')
            .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const user = interaction.options.getUser('пользователь') || interaction.user;
      const balance = await BalanceService.get(user.id);
      await interaction.editReply(BalanceEmbed.create(user, balance.coins, balance.diamonds));

    } catch (error) {
      console.error('Ошибка в команде balance:', error);
      await interaction.editReply(BalanceEmbed.error('Произошла ошибка при получении баланса'));
    }
  }
};
