import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, GuildMember, ButtonInteraction, StringSelectMenuInteraction, Collection } from 'discord.js';
import type { BotCommand } from '@types';
import { BalanceService } from '@bot/services/balance.service';
import { TransactionManager } from '@services/transaction-manager';

const activeGames = new Map<string, { type: string; messageUrl: string }>();

type RPSChoice = 'stone' | 'paper' | 'shears';
type RPSInteraction = ButtonInteraction | StringSelectMenuInteraction;

function resolveRPS(c1: RPSChoice, c2: RPSChoice): 'win' | 'lose' | 'draw' {
  if (c1 === c2) return 'draw';
  if ((c1 === 'stone' && c2 === 'shears') || (c1 === 'paper' && c2 === 'stone') || (c1 === 'shears' && c2 === 'paper')) return 'win';
  return 'lose';
}

function getRPSEmoji(choice: RPSChoice): string {
  return { stone: '🗿', paper: '📄', shears: '✂️' }[choice];
}

export const rpsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Сыграть в камень, ножницы, бумага')
    .addNumberOption(o => o.setName('сумма').setDescription('Сумма ставки').setRequired(true).setMinValue(50))
    .addUserOption(o => o.setName('пользователь').setDescription('Пользователь, с которым хотите сыграть')),

  async execute(interaction) {
    try {
      const userId = interaction.user.id;
      const guildId = interaction.guildId!;

      if (activeGames.has(userId)) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x2c2d31).setTitle('❌ Активная игра').setDescription(`У вас есть активная игра`)],
          ephemeral: true
        });
      }

      const amount = Math.trunc(interaction.options.getNumber('сумма', true));
      const balance = await BalanceService.get(userId);
      let target = interaction.options.getMember('пользователь') as GuildMember | null;
      const choices = new Map<string, RPSChoice>();

      if (amount > balance.coins) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x2c2d31).setTitle('❌ Недостаточно монет')],
          ephemeral: true
        });
      }

      if (target?.user.bot || target?.id === userId) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x2c2d31).setTitle('❌ Ошибка').setDescription(target?.user.bot ? 'Нельзя играть с ботом' : 'Нельзя играть с самим собой')],
          ephemeral: true
        });
      }

      if (target) {
        const tb = await BalanceService.get(target.id);
        if (amount > tb.coins) {
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0x2c2d31).setTitle('❌ Недостаточно монет у оппонента')],
            ephemeral: true
          });
        }
      }

      const createSelectMenu = (uid: string) => new StringSelectMenuBuilder()
        .setCustomId(`rps_choice.${uid}`)
        .setPlaceholder('Выбери свою сторону')
        .addOptions([
          { label: 'Камень', value: 'stone', emoji: '🗿' },
          { label: 'Бумага', value: 'paper', emoji: '📄' },
          { label: 'Ножницы', value: 'shears', emoji: '✂️' }
        ]);

      const message = await interaction.reply({
        content: target?.toString(),
        embeds: [new EmbedBuilder().setColor(0x2c2d31).setTitle('✊ КНБ').setDescription(
          target ? `${interaction.user} хочет сыграть с вами на **${amount}** 🪙` : '**Выбери** свою **сторону**!'
        )],
        components: target 
          ? [new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder().setCustomId('agree').setLabel('✅ Принять').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('refuse').setLabel('❌ Отказать').setStyle(ButtonStyle.Secondary)
            )]
          : [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(createSelectMenu(userId))],
        fetchReply: true
      });

      activeGames.set(userId, { type: 'rps', messageUrl: message.url });
      if (target) activeGames.set(target.id, { type: 'rps', messageUrl: message.url });

      const collector = message.createMessageComponentCollector({ time: 30000 });

      collector.on('collect', async (i: RPSInteraction) => {
        if (i.isButton()) {
          if (i.customId === 'refuse') return collector.stop('cancelled');
          
          if (i.customId === 'agree' && target) {
            await i.update({
              content: null,
              embeds: [new EmbedBuilder().setColor(0x2c2d31).setTitle('✊ КНБ').setDescription('**Выбери** свою **сторону**!')],
              components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(createSelectMenu(interaction.user.id))]
            });
          }
        }

        if (i.isStringSelectMenu()) {
          const uid = i.customId.split('.')[1];
          if (uid !== i.user.id) return;

          choices.set(uid, i.values[0] as RPSChoice);
          await i.deferUpdate();

          if (choices.size === 1 && !target) {
            await interaction.editReply({
              embeds: [new EmbedBuilder().setColor(0x2c2d31).setTitle('✊ КНБ').setDescription(`Хочет поиграть с кем-нибудь на **${amount}** 🪙`)],
              components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('join').setLabel('🎮 Присоединиться').setStyle(ButtonStyle.Secondary)
              )]
            });
          } else if (choices.size === 1 && target) {
            await interaction.editReply({
              embeds: [new EmbedBuilder().setColor(0x2c2d31).setTitle('✊ КНБ').setDescription('**Выбери** свою **сторону**!')],
              components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(createSelectMenu(target.id))]
            });
          } else if (choices.size === 2 && target) {
            await interaction.editReply({
              embeds: [new EmbedBuilder().setColor(0x2c2d31).setTitle(`✊ КНБ`).setImage('https://media.discordapp.net/attachments/1176189366062809168/1181459989785759775/321-count-down.gif')],
              components: []
            });

            await new Promise(r => setTimeout(r, 3000));

            const p1Choice = choices.get(interaction.user.id)!;
            const p2Choice = choices.get(target.id)!;
            const result = resolveRPS(p1Choice, p2Choice);

            if (result === 'draw') {
              await interaction.editReply({
                embeds: [new EmbedBuilder().setColor(0x2c2d31).setTitle('✊ КНБ').setDescription(
                  `**Ничья:** оба выбрали ${getRPSEmoji(p1Choice)}`
                )]
              });
            } else {
              const winner = result === 'win' ? interaction.member as GuildMember : target;
              const loser = winner.id === target.id ? interaction.member as GuildMember : target;
              const commission = 5;
              const winAmount = Math.round((amount/100) * (100 - commission));

              await TransactionManager.addTransaction({
                userId: winner.id, guildId, amount: winAmount, currencyType: 'coins',
                reason: 'Выигрыш в камень, ножницы, бумага', relatedUserId: loser.id,
                metadata: { game: 'rps', bet: amount, choice: choices.get(winner.id)!, opponent_id: loser.id, opponent_choice: choices.get(loser.id)!, result: 'win', commission: amount - winAmount }
              });

              await TransactionManager.addTransaction({
                userId: loser.id, guildId, amount: -amount, currencyType: 'coins',
                reason: 'Проигрыш в камень, ножницы, бумага', relatedUserId: winner.id,
                metadata: { game: 'rps', bet: amount, choice: choices.get(loser.id)!, opponent_id: winner.id, opponent_choice: choices.get(winner.id)!, result: 'lose' }
              });

              await interaction.editReply({
                embeds: [new EmbedBuilder().setColor(0x2c2d31).setTitle('✊ КНБ').setDescription(
                  `${getRPSEmoji(p1Choice)}・${interaction.user} — ${winner.id === interaction.user.id ? `выиграл **${winAmount}**` : `проиграл **${amount}**`} 🪙\n` +
                  `${getRPSEmoji(p2Choice)}・${target} — ${winner.id === target.id ? `выиграл **${winAmount}**` : `проиграл **${amount}**`} 🪙`
                )]
              });
            }

            collector.stop('completed');
          }
        }
      });

      collector.on('end', async (_collected: Collection<string, RPSInteraction>, reason: string) => {
        activeGames.delete(userId);
        if (target) activeGames.delete(target.id);

        if (reason === 'time') {
          await interaction.editReply({
            embeds: [new EmbedBuilder().setColor(0x2c2d31).setTitle('✊ КНБ').setDescription('Время вышло')],
            components: []
          });
        } else if (reason === 'cancelled') {
          await interaction.deleteReply().catch(() => {});
        }
      });

    } catch (error) {
      console.error('Ошибка в rps:', error);
      activeGames.delete(interaction.user.id);
    }
  }
};
