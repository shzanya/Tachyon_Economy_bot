

import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { BalanceService } from '@services/balance.service';


const EMOJI = {
    COIN: '🪙',
    TOCKA: '🔹'
};

interface CommissionMenuOptions {
  amount: number;
  commission: number;
  canAffordSeparate: boolean; 
}

export class GiveComponents {
  /**
   * Создает выпадающее меню для выбора способа оплаты комиссии.
   */
  static createCommissionMenu(options: CommissionMenuOptions): ActionRowBuilder<StringSelectMenuBuilder> {
    const { amount, commission, canAffordSeparate } = options;

    const amountAfterCommission = amount - commission;
    const totalWithCommission = amount + commission;

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('give_commission_select')
      .setPlaceholder('Выберите способ списания комиссии...');

    
    const fromTransferOption = new StringSelectMenuOptionBuilder()
      .setLabel('Списать из суммы перевода')
      .setDescription(`Получатель получит: ${BalanceService.format(amountAfterCommission)} ${EMOJI.COIN}`)
      .setValue('from_transfer')
      .setEmoji(EMOJI.TOCKA);

    selectMenu.addOptions(fromTransferOption);
    
    
    if (canAffordSeparate) {
        const fromBalanceOption = new StringSelectMenuOptionBuilder()
          .setLabel('Оплатить комиссию с баланса')
          .setDescription(`С вас будет списано: ${BalanceService.format(totalWithCommission)} ${EMOJI.COIN}`)
          .setValue('from_balance')
          .setEmoji(EMOJI.TOCKA);
          
        selectMenu.addOptions(fromBalanceOption);
    }

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  }
}
