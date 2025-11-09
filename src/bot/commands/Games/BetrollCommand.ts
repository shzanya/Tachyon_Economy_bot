import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { BotCommand } from '@types';
import { BalanceService } from '@bot/services/balance.service';
import { TransactionManager } from '@services/transaction-manager';

const activeGames = new Map<string, { type: string; messageUrl: string }>();
const cooldowns = new Map<string, number>();

export const betrollCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('betroll')
    .setDescription('Сыграть в бросок')
    .addNumberOption(option =>
      option.setName('сумма')
        .setDescription('Сумма ставки')
        .setRequired(true)
        .setMinValue(50)
    ),

  async execute(interaction) {
    try {
      const userId = interaction.user.id;
      const guildId = interaction.guildId!;

      
      const activeGame = activeGames.get(userId);
      if (activeGame) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x2c2d31)
              .setTitle('❌ Активная игра')
              .setDescription(`У вас есть [активную игру](${activeGame.messageUrl}): ${activeGame.type}`)
          ],
          ephemeral: true
        });
      }

      
      const cooldown = cooldowns.get(userId);
      if (cooldown && cooldown > Date.now()) {
        const timestamp = Math.round(cooldown / 1000);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x2c2d31)
              .setTitle('⏰ Кулдаун')
              .setDescription(`Попробуйте <t:${timestamp}:R>`)
          ],
          ephemeral: true
        });
      }

      const amount = Math.trunc(interaction.options.getNumber('сумма', true));
      const balance = await BalanceService.get(userId);

      if (amount > balance.coins) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x2c2d31)
              .setTitle('❌ Недостаточно монет')
              .setDescription(`Необходимо: **${amount}** 🪙\nУ вас: **${balance.coins}** 🪙`)
          ],
          ephemeral: true
        });
      }

      
      cooldowns.set(userId, Date.now() + 10000);
      activeGames.set(userId, { type: 'betroll', messageUrl: '' });

      await interaction.deferReply();

      
      const roll = Math.floor(Math.random() * 100) + 1;
      
      let won = false;
      let multiplier = 0;
      let winAmount = 0;
      const commission = 5; 

      
      if (roll === 100) {
        won = true;
        multiplier = 3;
        winAmount = amount * 3;
      } else if (roll >= 90) {
        won = true;
        multiplier = 2;
        winAmount = amount * 2;
      } else if (roll >= 66) {
        won = true;
        multiplier = 1;
        winAmount = amount;
      }

      let finalAmount: number;

      if (won) {
        finalAmount = Math.round((winAmount/100) * (100 - commission));

        await TransactionManager.addTransaction({
          userId,
          guildId,
          amount: finalAmount,
          currencyType: 'coins',
          reason: 'Выигрыш в бросок',
          metadata: {
            game: 'betroll',
            bet: amount,
            roll,
            multiplier,
            winAmount,
            commission: winAmount - finalAmount
          }
        });
      } else {
        finalAmount = amount;

        await TransactionManager.addTransaction({
          userId,
          guildId,
          amount: -finalAmount,
          currencyType: 'coins',
          reason: 'Проигрыш в бросок',
          metadata: {
            game: 'betroll',
            bet: amount,
            roll
          }
        });
      }

      const newBalance = await BalanceService.get(userId);

      let description = `🎲 Выпало: **${roll}**\n\n`;
      
      if (won && multiplier > 1) {
        description += `✨ **Множитель: x${multiplier}**\n`;
      }
      
      description += `> Вы **${won ? 'выиграли' : 'проиграли'}** **${finalAmount}** 🪙\n`;
      description += `> Баланс: **${newBalance.coins}** 🪙`;

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2c2d31)
            .setTitle('🎲 Бросок')
            .setDescription(description)
            .setFooter({ 
              text: `${interaction.user.username} | 66+ = выигрыш | 90+ = x2 | 100 = x3`, 
              iconURL: interaction.user.displayAvatarURL() 
            })
        ]
      });

      activeGames.delete(userId);

    } catch (error) {
      console.error('Ошибка в betroll:', error);
      activeGames.delete(interaction.user.id);
      cooldowns.delete(interaction.user.id);

      const errorEmbed = new EmbedBuilder()
        .setColor(0x2c2d31)
        .setTitle('❌ Ошибка')
        .setDescription('Произошла ошибка при игре');

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      } else {
        await interaction.editReply({ embeds: [errorEmbed] });
      }
    }
  }
};
