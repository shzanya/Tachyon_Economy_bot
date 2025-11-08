import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { TransactionManager } from '@services/transaction-manager';
import { TransactionCategorizer } from '@services/transaction-categorizer';
import { BalanceService } from '@services/balance.service';
import { logger } from '@utils/logger';
import type { BotCommand, TransactionAnalytics } from '@types';

const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('📊 Финансовая статистика')
  .addStringOption(option =>
    option
      .setName('period')
      .setDescription('Период')
      .addChoices(
        { name: 'День', value: 'day' },
        { name: 'Неделя', value: 'week' },
        { name: 'Месяц', value: 'month' },
        { name: 'Год', value: 'year' }
      )
  );

async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;
  const period = (interaction.options.getString('period') || 'month') as 'day' | 'week' | 'month' | 'year';

  try {
    await interaction.deferReply();

    const analytics = await TransactionManager.getAnalytics(userId, guildId, period);

    if (analytics.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x2c2d31) 
        .setAuthor({ 
          name: interaction.user.username,
          iconURL: interaction.user.displayAvatarURL({ size: 128 })
        })
        .setDescription('Нет данных за этот период')
        .setFooter({ text: getPeriodText(period) });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const income = analytics.filter((a: TransactionAnalytics) => a.type === 'income');
    const expense = analytics.filter((a: TransactionAnalytics) => a.type === 'expense');

    const totalIncome = income.reduce((sum: number, a: TransactionAnalytics) => sum + a.total, 0);
    const totalExpense = expense.reduce((sum: number, a: TransactionAnalytics) => sum + a.total, 0);
    const net = totalIncome - totalExpense;

    const balance = await BalanceService.get(userId);

    const embed = new EmbedBuilder()
      .setColor(net >= 0 ? 0x2c2d31 : 0x2c2d31) 
      .setAuthor({ 
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL({ size: 128 })
      })
      .setDescription(`**${getPeriodText(period)}**`)
      .setFooter({ text: `Баланс  •  ${BalanceService.format(balance.coins)} 🪙` });

    
    const metrics = [];
    if (totalIncome > 0) metrics.push(`**+${BalanceService.format(totalIncome)}** 🪙`);
    if (totalExpense > 0) metrics.push(`**−${BalanceService.format(totalExpense)}** 🪙`);
    
    if (metrics.length > 0) {
      embed.addFields({ 
        name: '\u200b', 
        value: metrics.join('\n'), 
        inline: false 
      });
    }

    
    if (income.length > 0) {
      const top = income
        .sort((a: TransactionAnalytics, b: TransactionAnalytics) => b.total - a.total)
        .slice(0, 3)
        .map((a: TransactionAnalytics) => {
          const emoji = TransactionCategorizer.getCategoryEmoji(a.category);
          const name = TransactionCategorizer.getCategoryName(a.category);
          return `${emoji}  ${name}  •  ${BalanceService.format(a.total)}`;
        })
        .join('\n');

      embed.addFields({ name: 'Доходы', value: top, inline: false });
    }

    if (expense.length > 0) {
      const top = expense
        .sort((a: TransactionAnalytics, b: TransactionAnalytics) => b.total - a.total)
        .slice(0, 3)
        .map((a: TransactionAnalytics) => {
          const emoji = TransactionCategorizer.getCategoryEmoji(a.category);
          const name = TransactionCategorizer.getCategoryName(a.category);
          return `${emoji}  ${name}  •  ${BalanceService.format(a.total)}`;
        })
        .join('\n');

      embed.addFields({ name: 'Расходы', value: top, inline: false });
    }

    await interaction.editReply({ embeds: [embed] });

    logger.info(`📊 ${interaction.user.tag} | ${period} | +${totalIncome} −${totalExpense}`);

  } catch (error) {
    logger.error('Stats error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0x2c2d31)
      .setDescription(error instanceof Error ? error.message : 'Ошибка');

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

function getPeriodText(period: string): string {
  const map = { day: 'Сегодня', week: 'Эта неделя', month: 'Этот месяц', year: 'Этот год' };
  return map[period as keyof typeof map] || period;
}

export const statsCommand: BotCommand = { data, execute };
