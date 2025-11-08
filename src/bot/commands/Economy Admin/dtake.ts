import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, User } from 'discord.js';
import { TransactionManager } from '@services/transaction-manager';
import { logger } from '@utils/logger';
import type { BotCommand } from '@types';
import { AdminEmbeds } from './components/admin.embeds';
import { PermissionsHelper } from '@bot/utils/permissions-helper'; 

const data = new SlashCommandBuilder()
  .setName('dtake')
  .setDescription('👑 [Админ] Забрать донатную валюту у пользователей.')
  .addUserOption(option => option.setName('user').setDescription('Пользователь для списания').setRequired(true))
  .addIntegerOption(option => option.setName('amount').setDescription('Сумма для списания').setRequired(true).setMinValue(1))
  .addStringOption(option => option.setName('reason').setDescription('Причина (будет в логах)').setRequired(false))
  .addUserOption(option => option.setName('user2').setDescription('(Опционально) Второй пользователь'))
  .addUserOption(option => option.setName('user3').setDescription('(Опционально) Третий пользователь'));
  
async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!PermissionsHelper.isAdmin(interaction.user, member)) {
    await interaction.reply({ embeds: [AdminEmbeds.error('У вас нет прав на использование этой команды.')], ephemeral: true });
    return;
  }
  
  await interaction.deferReply();
  const admin = interaction.user;
  const amount = interaction.options.getInteger('amount', true);
  const reason = interaction.options.getString('reason') || 'Списание Администрацией';
  const guildId = interaction.guildId!;

  const recipients = [
    interaction.options.getUser('user'),
    interaction.options.getUser('user2'),
    interaction.options.getUser('user3'),
  ].filter((u): u is User => u !== null && !u.bot);

  const uniqueRecipients = [...new Map(recipients.map(u => [u.id, u])).values()];
  if (uniqueRecipients.length === 0) {
    await interaction.editReply({ embeds: [AdminEmbeds.error('Не выбрано ни одного пользователя.')] });
    return;
  }

  try {
    const transactions = uniqueRecipients.map(user => {
      const finalReason = `Списание донатной валюты: ${reason}`;
      
      return TransactionManager.addTransaction({
        userId: user.id,
        guildId,
        amount: -amount,
        currencyType: 'diamonds',
        reason: finalReason,
        merchant: `Admin: ${admin.username}`,
        metadata: { adminId: admin.id }
      });
    });

    await Promise.all(transactions);
    await interaction.editReply({ embeds: [AdminEmbeds.success(admin, uniqueRecipients, amount, 'diamond', 'take')] });
    logger.info(`👑 DTAKE: ${admin.tag} took ${amount} diamonds from ${uniqueRecipients.length} users.`);
  } catch (error) {
    logger.error('Dtake command error:', error);
    await interaction.editReply({ embeds: [AdminEmbeds.error('Произошла ошибка при списании валюты. Возможно, у кого-то из пользователей недостаточно средств.')] });
  }
}

export const dtakeCommand: BotCommand = { data, execute };
