

import { EmbedBuilder, User } from 'discord.js';
import { BalanceService } from '@services/balance.service';


const EMOJI = {
    COIN: '🪙', 
    TOCKA: '🔹', 
    SUCCESS: '✅',
    ERROR: '❌',
    WARN: '⚠️',
    CLOCK: '⏱️'
};

export class GiveEmbeds {
  
  private static readonly COLOR = 0x2c2d31; 

  /**
   * Эмбед для подтверждения перевода.
   * Спрашивает пользователя, как он хочет оплатить комиссию.
   */
  static confirmation(
    sender: User,
    receiver: User,
    amount: number,
    commissionPercent: number
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(this.COLOR)
      .setAuthor({ name: sender.username, iconURL: sender.displayAvatarURL() })
      .setTitle('Подтверждение перевода')
      .setDescription(
        `${sender}, вы собираетесь передать **${BalanceService.format(amount)}** ${EMOJI.COIN} пользователю ${receiver}.\n\n` +
        `${EMOJI.TOCKA} **Комиссия системы:** ${commissionPercent}%\n` +
        `${EMOJI.TOCKA} **Сумма перевода:** ${BalanceService.format(amount)} ${EMOJI.COIN}\n\n` +
        `**Пожалуйста, выберите, как будет списана комиссия.**`
      )
      .setFooter({ text: 'У вас есть 30 секунд на выбор.' });
  }

  /**
   * Эмбед успешного завершения транзакции.
   */
  static success(
    sender: User,
    receiver: User,
    amountGiven: number,
    commission: number
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x2c2d31) 
      .setAuthor({ name: 'Перевод выполнен', iconURL: receiver.displayAvatarURL() })
      .setTitle(`${EMOJI.SUCCESS} Успешно!`)
      .setDescription(
        `${sender} передал пользователю ${receiver} **${BalanceService.format(amountGiven)}** ${EMOJI.COIN}\n\n` +
        `${EMOJI.TOCKA} **Комиссия:** ${BalanceService.format(commission)} ${EMOJI.COIN}\n` +
        `${EMOJI.TOCKA} **Получено:** ${BalanceService.format(amountGiven)} ${EMOJI.COIN}`
      )
      .setTimestamp();
  }
  
  /**
   * Эмбед для различных ошибок (самому себе, боту и т.д.).
   */
  static error(message: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x2c2d31) 
      .setTitle(`${EMOJI.ERROR} Ошибка перевода`)
      .setDescription(message);
  }

  /**
   * Эмбед, когда у пользователя не хватает средств.
   */
  static insufficientFunds(currentBalance: number, requiredAmount: number): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x2c2d31) 
      .setTitle(`${EMOJI.WARN} Недостаточно средств`)
      .setDescription(
        `На вашем балансе **${BalanceService.format(currentBalance)}** ${EMOJI.COIN}, а для выполнения операции требуется **${BalanceService.format(requiredAmount)}** ${EMOJI.COIN}.`
      );
  }

  /**
   * Эмбед, когда время на взаимодействие вышло.
   */
  static timeout(): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x2c2d31) 
      .setTitle(`${EMOJI.CLOCK} Время вышло`)
      .setDescription('Вы не подтвердили перевод вовремя. Операция отменена.');
  }
}
