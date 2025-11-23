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
        let categoryName = TransactionCategorizer.getCategoryName(tx.category as TransactionCategory);
        const sign = tx.amount >= 0 ? '+' : '−';
        const amountStr = `${sign} ${BalanceService.format(Math.abs(tx.amount))}`;
        
        let coinEmoji = Emoji.coin.string;
        try {
          if (tx.metadata) {
            const meta = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : tx.metadata;
            if (meta.currencyType === 'diamonds') {
              coinEmoji = Emoji.diamond.string;
            }
          }
        } catch (e) {
          if (tx.category === 'admin_award' || tx.category === 'admin_take') {
            if (tx.reason?.includes('донатной валюты')) {
              coinEmoji = Emoji.diamond.string;
            }
          }
        }

        
        if (coinEmoji === Emoji.diamond.string && (tx.category === 'admin_award' || tx.category === 'admin_take')) {
          categoryName = tx.category === 'admin_award' ? 'Выдача донат-валюты' : 'Списание донат-валюты';
        }
        
        const timestamp = `<t:${Math.floor(tx.created_at.getTime() / 1000)}:f>`;
        
        let note = '';

        
        if ((tx.category === 'admin_award' || tx.category === 'admin_take') && tx.metadata) {
          try {
            const meta = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : tx.metadata;
            if (meta.adminId) {
              const reasonText = tx.reason?.split('администратором: ').pop()?.trim() || 'Без причины';
              note = `Админом <@${meta.adminId}>\n> ${reasonText}`;
            } else {
              note = tx.reason?.trim() || '';
            }
          } catch (e) {
            note = tx.reason?.trim() || '';
          }
        }
        
        else if (tx.category === 'p2p' && tx.related_user_id) {
          note = tx.amount > 0 
            ? `От <@${tx.related_user_id}>` 
            : `Для <@${tx.related_user_id}>`;
        }
        
        else {
          note = tx.reason?.trim() || '';
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
