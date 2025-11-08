

import { ChatInputCommandInteraction, SlashCommandBuilder, ComponentType, StringSelectMenuInteraction, User } from 'discord.js';
import { TransactionManager } from '@services/transaction-manager';
import { BalanceService } from '@services/balance.service';
import { logger } from '@utils/logger';
import type { BotCommand } from '@types';
import { GiveEmbeds } from './components/embed/give.embeds';
import { GiveComponents } from './components/selectmenu/give.components';

const COMMISSION_PERCENT = 5;
const INTERACTION_TIMEOUT = 30_000;

const data = new SlashCommandBuilder()
  .setName('give')
  .setDescription(`Перевести валюту другому игроку (комиссия ${COMMISSION_PERCENT}%)`)
  
  .addUserOption(option => option.setName('пользователь').setDescription('Кому перевести').setRequired(true))
  .addIntegerOption(option => option.setName('количество').setDescription('Сколько монет перевести').setRequired(true).setMinValue(1));

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  
  const sender = interaction.user;
  const recipient = interaction.options.getUser('пользователь', true);
  const amount = interaction.options.getInteger('количество', true);
  const guildId = interaction.guildId!;

  if (sender.id === recipient.id) {
    await interaction.reply({ embeds: [GiveEmbeds.error('Нельзя перевести монеты самому себе!')], ephemeral: true });
    return;
  }
  if (recipient.bot) {
    await interaction.reply({ embeds: [GiveEmbeds.error('Нельзя перевести монеты боту!')], ephemeral: true });
    return;
  }

  const senderBalance = await BalanceService.get(sender.id);
  const commission = Math.max(1, Math.ceil((amount * COMMISSION_PERCENT) / 100));

  if (senderBalance.coins < amount) {
    await interaction.reply({ embeds: [GiveEmbeds.insufficientFunds(senderBalance.coins, amount)], ephemeral: true });
    return;
  }

  const canAffordSeparate = senderBalance.coins >= amount + commission;
  const confirmationEmbed = GiveEmbeds.confirmation(sender, recipient, amount, COMMISSION_PERCENT);
  const commissionMenu = GiveComponents.createCommissionMenu({ amount, commission, canAffordSeparate });

  await interaction.reply({
    embeds: [confirmationEmbed],
    components: [commissionMenu],
  });
  
  const reply = await interaction.fetchReply();

  try {
    const selectInteraction = await reply.awaitMessageComponent<ComponentType.StringSelect>({
      filter: i => i.user.id === sender.id,
      time: INTERACTION_TIMEOUT,
    });
    await handleCommissionChoice(selectInteraction, { sender, recipient, guildId }, { amount, commission });
  } catch (error) {
    await interaction.editReply({ embeds: [GiveEmbeds.timeout()], components: [] }).catch(() => {});
  }
}



async function handleCommissionChoice(
    interaction: StringSelectMenuInteraction,
    context: { sender: User, recipient: User, guildId: string },
    transfer: { amount: number, commission: number }
): Promise<void> {
    await interaction.deferUpdate();

    const { sender, recipient, guildId } = context;
    const { amount, commission } = transfer;
    const choice = interaction.values[0];

    try {
        const currentBalance = await BalanceService.get(sender.id);
        
        if (choice === 'from_transfer') {
            
            const amountToReceive = amount - commission;
            
            if (amountToReceive <= 0) {
                await interaction.editReply({ 
                    embeds: [GiveEmbeds.error(`Сумма перевода после комиссии (${commission}) слишком мала.`)], 
                    components: [] 
                });
                return;
            }
            
            if (currentBalance.coins < amount) {
                await interaction.editReply({ 
                    embeds: [GiveEmbeds.insufficientFunds(currentBalance.coins, amount)], 
                    components: [] 
                });
                return;
            }

            
            await TransactionManager.createTransfer(
                sender.id, 
                recipient.id, 
                guildId, 
                amountToReceive,  
                `Перевод для ${recipient.username}`
            );
            
            
            await TransactionManager.addTransaction({
                userId: sender.id,
                guildId,
                amount: -commission,
                currencyType: 'coins',
                reason: `Комиссия ${COMMISSION_PERCENT}% за перевод для ${recipient.username}`,
                merchant: 'System',
            });
            
            await interaction.editReply({
                embeds: [GiveEmbeds.success(sender, recipient, amountToReceive, commission)],
                components: [],
            });

            logger.info(`💸 Transfer (from_transfer): ${sender.tag} → ${recipient.tag} | Sent: ${amountToReceive} | Fee: ${commission} (included)`);
            
        } else { 
            
            const totalNeeded = amount + commission;
            
            if (currentBalance.coins < totalNeeded) {
                await interaction.editReply({ 
                    embeds: [GiveEmbeds.insufficientFunds(currentBalance.coins, totalNeeded)], 
                    components: [] 
                });
                return;
            }

            
            await TransactionManager.createTransfer(
                sender.id, 
                recipient.id, 
                guildId, 
                amount,  
                `Перевод для ${recipient.username}`
            );

            
            await TransactionManager.addTransaction({
                userId: sender.id,
                guildId,
                amount: -commission,
                currencyType: 'coins',
                reason: `Комиссия ${COMMISSION_PERCENT}% за перевод для ${recipient.username}`,
                merchant: 'System',
                
            });
            
            await interaction.editReply({
                embeds: [GiveEmbeds.success(sender, recipient, amount, commission)],
                components: [],
            });

            logger.info(`💸 Transfer (from_balance): ${sender.tag} → ${recipient.tag} | Sent: ${amount} | Fee: ${commission} (separate)`);
        }

    } catch (error) {
        logger.error('Give command execution error:', error);
        await interaction.editReply({ 
            embeds: [GiveEmbeds.error('Произошла внутренняя ошибка при выполнении перевода.')], 
            components: [] 
        });
    }
}

export const giveCommand: BotCommand = { data, execute };
