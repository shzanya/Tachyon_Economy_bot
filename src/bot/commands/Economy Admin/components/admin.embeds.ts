

import { EmbedBuilder, User } from 'discord.js';
import { BalanceService } from '@services/balance.service';

const EMOJI = { COIN: '🪙', DIAMOND: '💎', SUCCESS: '✅', ERROR: '❌', REMOVE: '➖', ADD: '➕' };

export class AdminEmbeds {
  /**
   * Эмбед для операций выдачи/списания.
   * @param admin - Администратор.
   * @param recipients - Массив получателей.
   * @param amount - Сумма.
   * @param currencyType - Тип валюты ('coin' или 'diamond').
   * @param action - 'award' (выдача) или 'take' (списание).
   */
  static success(
    admin: User, 
    recipients: User[], 
    amount: number, 
    currencyType: 'coin' | 'diamond',
    action: 'award' | 'take'
  ): EmbedBuilder {
    const isMultiple = recipients.length > 1;
    const currencyEmoji = currencyType === 'coin' ? EMOJI.COIN : EMOJI.DIAMOND;
    const actionVerb = action === 'award' ? 'выдал' : 'списал';
    const actionPreposition = action === 'take' ? 'у' : '';
    const title = action === 'award' ? `${EMOJI.ADD} Валюта выдана` : `${EMOJI.REMOVE} Валюта списана`;

    let description = `**${admin.username}** ${actionVerb} **${BalanceService.format(amount)}** ${currencyEmoji} ${actionPreposition} `;
    description += isMultiple ? `пользователям:` : `пользователя ${recipients[0]}.`;

    const embed = new EmbedBuilder()
      .setColor(action === 'award' ? '#0x2c2d31' : '#0x2c2d31')
      .setAuthor({ name: admin.username, iconURL: admin.displayAvatarURL() })
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();

    if (isMultiple) {
      const userList = recipients.map(u => `• ${u.toString()}`).join('\n');
      embed.addFields({ name: 'Пользователи:', value: userList });
    }

    return embed;
  }

  static error(message: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x2c2d31)
      .setTitle(`${EMOJI.ERROR} Ошибка выполнения`)
      .setDescription(message);
  }
}
