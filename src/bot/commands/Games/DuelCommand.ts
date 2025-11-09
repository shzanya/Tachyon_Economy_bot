import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, GuildMember, ButtonInteraction, Collection } from 'discord.js';
import type { BotCommand } from '@types';
import { BalanceService } from '@bot/services/balance.service';
import { TransactionManager } from '@services/transaction-manager';

const activeGames = new Map<string, { type: string; messageUrl: string }>();

export const duelCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('duel')
    .setDescription('Сыграть дуэль')
    .addNumberOption(option =>
      option.setName('сумма')
        .setDescription('Сумма ставки')
        .setRequired(true)
        .setMinValue(50)
    )
    .addUserOption(option =>
      option.setName('пользователь')
        .setDescription('Пользователь, с которым Вы хотите сыграть')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const userId = interaction.user.id;
      const guildId = interaction.guildId!;

      if (activeGames.has(userId)) {
        const game = activeGames.get(userId)!;
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x2c2d31)
              .setTitle('❌ Активная игра')
              .setDescription(`У вас есть [активную игру](${game.messageUrl}): ${game.type}`)
          ],
          ephemeral: true
        });
      }

      const amount = Math.trunc(interaction.options.getNumber('сумма', true));
      const balance = await BalanceService.get(userId);
      let target = interaction.options.getMember('пользователь') as GuildMember | null;

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

      if (target) {
        if (target.user.bot) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x2c2d31)
                .setTitle('❌ Ошибка')
                .setDescription('Вы не можете **взаимодействовать** с ботом')
            ],
            ephemeral: true
          });
        }

        if (target.id === userId) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x2c2d31)
                .setTitle('❌ Ошибка')
                .setDescription('Вы **не можете** бросить вызов **самому себе**')
            ],
            ephemeral: true
          });
        }

        const targetBalance = await BalanceService.get(target.id);
        if (amount > targetBalance.coins) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x2c2d31)
                .setTitle('❌ Недостаточно монет')
                .setDescription(`У ${target.toString()} нет **${amount}** 🪙`)
            ],
            ephemeral: true
          });
        }
      }

      const agreeBtn = new ButtonBuilder()
        .setCustomId('agree')
        .setLabel('✅ Принять')
        .setStyle(ButtonStyle.Secondary);

      const refuseBtn = new ButtonBuilder()
        .setCustomId('refuse')
        .setLabel('❌ Отказать')
        .setStyle(ButtonStyle.Secondary);

      const joinBtn = new ButtonBuilder()
        .setCustomId('join')
        .setLabel('🎮 Присоединиться')
        .setStyle(ButtonStyle.Secondary);

      const trashBtn = new ButtonBuilder()
        .setCustomId('trash')
        .setLabel('🗑️')
        .setStyle(ButtonStyle.Secondary);

      const row = target 
        ? new ActionRowBuilder<ButtonBuilder>().addComponents(agreeBtn, refuseBtn)
        : new ActionRowBuilder<ButtonBuilder>().addComponents(joinBtn, trashBtn);

      const message = await interaction.reply({
        content: target ? target.toString() : undefined,
        embeds: [
          new EmbedBuilder()
            .setColor(0x2c2d31)
            .setTitle('🔫 Дуэль')
            .setDescription(
              target 
                ? `${interaction.user.toString()} хочет сыграть с Вами на **${amount}** 🪙`
                : `${interaction.user.toString()} хочет поиграть с кем-нибудь на **${amount}** 🪙`
            )
        ],
        components: [row],
        fetchReply: true
      });

      activeGames.set(userId, { type: 'duel', messageUrl: message.url });
      if (target) activeGames.set(target.id, { type: 'duel', messageUrl: message.url });

      const collector = message.createMessageComponentCollector({
        time: 30000,
        filter: (i: ButtonInteraction) => target ? (i.user.id === target.id || i.user.id === userId) : true
      });

      collector.on('collect', async (i: ButtonInteraction) => {
        if (i.customId === 'trash' || i.customId === 'refuse') {
          collector.stop('cancelled');
          return;
        }

        if (i.customId === 'join') {
          if (i.user.id === userId) {
            i.reply({
                embeds: [
                    new EmbedBuilder()
                    .setColor(0x2c2d31)
                    .setTitle('❌ Ошибка')
                    .setDescription('Вы **не можете** присоединиться к **своей игре**')
                ],
                ephemeral: true
            });
            return;
          }
          target = i.member as GuildMember;
          const targetBalance = await BalanceService.get(target.id);
          if (amount > targetBalance.coins) {
            await i.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor(0x2c2d31)
                  .setTitle('❌ Недостаточно монет')
                  .setDescription(`У ${target.toString()} нет **${amount}** 🪙`)
              ],
              ephemeral: true
            });
            return;
          }
          activeGames.set(target.id, { type: 'duel', messageUrl: message.url });
        }

        if ((i.customId === 'agree' || i.customId === 'join') && target) {
          const initiator = interaction.user;
          const opponent = target.user;

          const embed = new EmbedBuilder()
            .setColor(0x2c2d31)
            .setTitle(`🔫 Дуэль: ${initiator.username} vs ${opponent.username}`)
            .setDescription('**3**')
            .setImage('https://i.imgur.com/86sL39H.gif');

          await i.update({ content: null, embeds: [embed], components: [] });

          for (let t = 2; t >= 1; t--) {
            await new Promise(r => setTimeout(r, 1000));
            await interaction.editReply({ embeds: [embed.setDescription(`**${t}**`)] });
          }

          await new Promise(r => setTimeout(r, 1000));

          const winner = Math.random() > 0.5 ? target : interaction.member as GuildMember;
          const loser = winner.id === target.id ? interaction.member as GuildMember : target;

          await interaction.editReply({
            embeds: [embed.setDescription(`${winner.toString()} **выстрелил!**`).setImage('https://i.imgur.com/ZebwNIe.gif')]
          });

          await new Promise(r => setTimeout(r, 1500));

          const commission = 5;
          const winAmount = Math.round((amount/100) * (100 - commission));

          await TransactionManager.addTransaction({
            userId: winner.id,
            guildId,
            amount: winAmount,
            currencyType: 'coins',
            reason: 'Выигрыш в дуэль',
            relatedUserId: loser.id,
            metadata: {
              game: 'duel',
              bet: amount,
              opponent_id: loser.id,
              won: true,
              commission: amount - winAmount
            }
          });

          await TransactionManager.addTransaction({
            userId: loser.id,
            guildId,
            amount: -amount,
            currencyType: 'coins',
            reason: 'Проигрыш в дуэль',
            relatedUserId: winner.id,
            metadata: {
              game: 'duel',
              bet: amount,
              opponent_id: winner.id,
              won: false
            }
          });

          await interaction.editReply({
            embeds: [embed.setColor(0x2c2d31).setDescription(`${winner.toString()} **выигрывает** дуэль и забирает **${winAmount}** 🪙`).setImage(null)]
          });

          collector.stop('completed');
        }
      });

      collector.on('end', async (_collected: Collection<string, ButtonInteraction>, reason: string) => {
        activeGames.delete(userId);
        if (target) activeGames.delete(target.id);

        if (reason === 'time') {
          await interaction.editReply({
            content: null,
            embeds: [
              new EmbedBuilder()
                .setColor(0x2c2d31)
                .setTitle('🔫 Дуэль')
                .setDescription(`${target ? target.toString() : 'Никто'} **не ответил** на Ваше предложение`)
            ],
            components: []
          });
        } else if (reason === 'cancelled') {
          await interaction.deleteReply().catch(() => {});
        }
      });

    } catch (error) {
      console.error('Ошибка в duel:', error);
      activeGames.delete(interaction.user.id);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0x2c2d31)
        .setTitle('❌ Ошибка')
        .setDescription('Произошла ошибка при игре');

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }
};
