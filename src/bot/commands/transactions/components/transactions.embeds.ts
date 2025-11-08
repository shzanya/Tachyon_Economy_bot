import { EmbedBuilder, User } from 'discord.js';
import { TransactionCategorizer } from '@services/transaction-categorizer';
import { BalanceService } from '@services/balance.service';
import { Emoji } from '@assets/emoji/emoji.helper';
import type { Transaction, TransactionCategory } from '@types';

export class TransactionsEmbeds {
  static create(
    user: User,
    transactions: Transaction[],
    page: number,
    totalPages: number,
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(0x2f3136)
      .setTitle(`Транзакции — ${user.username}`)
      .setThumbnail(user.displayAvatarURL())
      .setFooter({ text: `Страница ${page} из ${totalPages}` });

    if (transactions.length === 0) {
      embed.setDescription('📭 По этим фильтрам транзакций не найдено.');
      return embed;
    }

    const groupedByDate: Record<string, Transaction[]> = transactions.reduce((acc, tx) => {
      const txDate = new Date(tx.created_at).toDateString();
      if (!acc[txDate]) acc[txDate] = [];
      acc[txDate].push(tx);
      return acc;
    }, {} as Record<string, Transaction[]>);

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    for (const dateStr in groupedByDate) {
      const txsForDate = groupedByDate[dateStr];
      const txDate = new Date(txsForDate[0].created_at);
      
      let dateHeader = '';
      if (dateStr === today) {
        dateHeader = '🗓️ Сегодня';
      } else if (dateStr === yesterday) {
        dateHeader = '🗓️ Вчера';
      } else {
        const timestampForDate = Math.floor(txDate.getTime() / 1000);
        dateHeader = `🗓️ <t:${timestampForDate}:D>`;
      }
      
      const fieldValue = txsForDate.map(tx => {
        const categoryEmoji = TransactionCategorizer.getCategoryEmoji(tx.category as TransactionCategory);
        const categoryName = TransactionCategorizer.getCategoryName(tx.category as TransactionCategory);
        const sign = tx.amount >= 0 ? '+' : '−';
        const amountStr = `${sign} ${BalanceService.format(Math.abs(tx.amount))}`;
        const coinEmoji = Emoji.coin?.string || '🪙';
        const timestamp = `<t:${Math.floor(tx.created_at.getTime() / 1000)}:f>`;
        
        
        let note = tx.reason ? tx.reason.trim() : '';
        
        
        if (tx.category === 'p2p' && tx.related_user_id) {
          if (tx.amount > 0) {
            
            note = `Перевод от <@${tx.related_user_id}>`;
          } else {
            
            note = `Перевод для <@${tx.related_user_id}>`;
          }
        }

        let txString = `${categoryEmoji} **${categoryName}**\n\`${amountStr}\` ${coinEmoji} • ${timestamp}`;
        
        if (note) {
          txString += `\n> ${note.replace(/\n/g, '\n> ')}`;
        }
        
        return txString;
      }).join('\n');

      embed.addFields({
        name: `**${dateHeader}**`,
        value: fieldValue,
        inline: false,
      });
    }

    return embed;
  }

  static error(message: string): EmbedBuilder {
    return new EmbedBuilder().setColor(0x2c2d31).setDescription(`❌ ${message}`);
  }
}
