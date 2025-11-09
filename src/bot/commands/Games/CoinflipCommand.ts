import { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder, ButtonInteraction, Collection } from 'discord.js';
import type { BotCommand } from '@types';
import { BalanceService } from '@bot/services/balance.service';
import { TransactionManager } from '@services/transaction-manager';


const activeGames = new Map<string, { type: string; messageUrl: string }>();

export const coinflipCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Сыграть в монетку')
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
              .setDescription(`У вас есть [активная игра](${activeGame.messageUrl}): ${activeGame.type}`)
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

      const eagleBtn = new ButtonBuilder()
        .setCustomId('eagle')
        .setLabel('🦅 Орёл')
        .setStyle(ButtonStyle.Secondary);

      const tailsBtn = new ButtonBuilder()
        .setCustomId('tails')
        .setLabel('🎯 Решка')
        .setStyle(ButtonStyle.Secondary);

      const trashBtn = new ButtonBuilder()
        .setCustomId('trash')
        .setLabel('❌')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(eagleBtn, tailsBtn, trashBtn);
      
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2c2d31)
            .setTitle('🪙 Монетка')
            .setDescription(`Выберите **сторону** за которую **хотите** поставить Ваши **${amount}** 🪙`)
            .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
        ],
        components: [row]
      });
      const message = await interaction.fetchReply();

      activeGames.set(userId, { type: 'coinflip', messageUrl: message.url });

      const collector = message.createMessageComponentCollector({
        filter: (i: ButtonInteraction) => i.user.id === userId,
        time: 60000
      });

      collector.on('collect', async (i: ButtonInteraction) => {
        if (i.customId === 'trash') {
          activeGames.delete(userId);
          await i.update({
            embeds: [
              new EmbedBuilder()
                .setColor(0x2c2d31)
                .setTitle('🪙 Монетка')
                .setDescription('Игра отменена')
            ],
            components: []
          });
          collector.stop();
          return;
        }

        const currentBalance = await BalanceService.get(userId);
        if (amount > currentBalance.coins) {
          await i.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x2c2d31)
                .setTitle('❌ Недостаточно монет')
                .setDescription(`Необходимо: **${amount}** 🪙`)
            ],
            ephemeral: true
          });
          return;
        }

        const userChoice = i.customId;
        const result = Math.random() > 0.5 ? 'tails' : 'eagle';
        const won = result === userChoice;

        const images = {
          eagle: 'https://i.imgur.com/ZGrjQZw.gif',
          tails: 'https://i.imgur.com/eZbhjUw.gif'
        };

        await i.update({
          embeds: [
            new EmbedBuilder()
              .setColor(0x2c2d31)
              .setTitle('🪙 Коинфлип')
              .setDescription(
                `Ставка: **${amount}** 🪙\n` +
                `Выбранная сторона: **${userChoice === 'eagle' ? 'Орёл' : 'Решка'}**`
              )
              .setImage(images[result])
          ],
          components: []
        });

        const commission = 5;
        let finalAmount: number;

        if (won) {
          finalAmount = Math.round((amount/100) * (100 - commission));
          
          await TransactionManager.addTransaction({
            userId,
            guildId,
            amount: finalAmount,
            currencyType: 'coins',
            reason: 'Выигрыш в монетку',
            metadata: {
              game: 'coinflip',
              bet: amount,
              choice: userChoice,
              result,
              commission: amount - finalAmount
            }
          });
        } else {
          finalAmount = amount;
          
          await TransactionManager.addTransaction({
            userId,
            guildId,
            amount: -finalAmount,
            currencyType: 'coins',
            reason: 'Проигрыш в монетку',
            metadata: {
              game: 'coinflip',
              bet: amount,
              choice: userChoice,
              result
            }
          });
        }

        const newBalance = await BalanceService.get(userId);

        setTimeout(async () => {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x2c2d31)
                .setTitle('🪙 Монетка')
                .setDescription(
                  `Выпало: **${result === 'eagle' ? '🦅 Орёл' : '🎯 Решка'}**\n\n` +
                  `> Вы ${won ? '**выиграли**' : '**проиграли**'} **${finalAmount}** 🪙\n` +
                  `> Баланс: **${newBalance.coins}** 🪙`
                )
                .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
            ]
          });
        }, 5000);

        activeGames.delete(userId);
        collector.stop();
      });

      collector.on('end', (_collected: Collection<string, ButtonInteraction>, reason: string) => {
        if (reason === 'time') {
          activeGames.delete(userId);
          interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x2c2d31)
                .setTitle('🪙 Монетка')
                .setDescription('Время вышло')
            ],
            components: []
          }).catch(() => {});
        }
      });

    } catch (error) {
      console.error('Ошибка в coinflip:', error);
      activeGames.delete(interaction.user.id);
      
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
