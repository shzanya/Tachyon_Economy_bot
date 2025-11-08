import { EmbedBuilder, type User } from 'discord.js';
import { BalanceService } from '../../../services/balance.service';

export class BalanceEmbed {
  static create(user: User, coins: number, diamonds: number) {
    const embed = new EmbedBuilder()
      .setTitle(`—・Текущий баланс — ${user.username}`)
      .setColor(0x2c2d31)
      .setThumbnail(user.displayAvatarURL({ size: 4096 }))
      .addFields(
        {
          name: '> Монеты:',
          value: `\`\`\`${BalanceService.format(coins)}\`\`\``,
          inline: true
        },
        {
          name: '> Алмазы:',
          value: `\`\`\`${BalanceService.format(diamonds)}\`\`\``,
          inline: true
        }
      );

    return { embeds: [embed] };
  }

  static error(message: string) {
    const embed = new EmbedBuilder()
      .setTitle('❌ Ошибка')
      .setDescription(message)
      .setColor(0x2c2d31);

    return { embeds: [embed] };
  }
}
