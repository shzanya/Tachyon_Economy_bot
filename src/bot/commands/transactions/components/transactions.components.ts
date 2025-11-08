

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { TransactionCategorizer } from '@services/transaction-categorizer';
import { Emoji } from '@assets/emoji/emoji.helper';
import type { TransactionType, TransactionCategory } from '@types';

interface PageData {
  currentPage: number;
  totalPages: number;
  typeFilter: TransactionType | 'all';
  categoryFilter: TransactionCategory | 'all';
  disabled?: boolean; 
}

const CATEGORIES_BY_TYPE: Record<TransactionType | 'all', TransactionCategory[]> = {
    all: [
      'daily_bonus', 'work', 'casino_win', 'reward', 'gift', 'salary', 'quest_reward',
      'shopping', 'gambling', 'food', 'entertainment', 'fees', 'services', 'rent', 'subscription',
      'p2p', 'bank',
      'admin_award', 'admin_take'
    ],
    income: [
      'daily_bonus', 'work', 'casino_win', 'reward', 'gift', 'salary', 'quest_reward',
      'admin_award'
    ],
    expense: [
      'shopping', 'gambling', 'food', 'entertainment', 'fees', 'services', 'rent', 'subscription',
      'admin_take'
    ],
    transfer: ['p2p', 'bank'],
  };

export class TransactionsComponents {
  static create(pageData: PageData): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
    const { currentPage, totalPages, typeFilter, categoryFilter, disabled = false } = pageData;

    
    
    
    const typeMenu = new StringSelectMenuBuilder()
      .setCustomId('transactions_type_filter')
      .setPlaceholder('Фильтр по типу транзакции')
      .setDisabled(disabled) 
      .addOptions([
        {
          label: 'Все типы',
          value: 'all',
          emoji: { id: Emoji.type_all.id },
          default: typeFilter === 'all'
        },
        {
          label: 'Доходы',
          value: 'income',
          emoji: { id: Emoji.type_income.id },
          default: typeFilter === 'income'
        },
        {
          label: 'Расходы',
          value: 'expense',
          emoji: { id: Emoji.type_expense.id },
          default: typeFilter === 'expense'
        },
        {
          label: 'Переводы',
          value: 'transfer',
          emoji: { id: Emoji.type_transfer.id },
          default: typeFilter === 'transfer'
        },
      ]);

    
    
    
    const categoryMenu = new StringSelectMenuBuilder()
      .setCustomId('transactions_category_filter')
      .setPlaceholder('Фильтр по категории')
      .setDisabled(disabled); 

    categoryMenu.addOptions({
      label: 'Все категории',
      value: 'all',
      emoji: '📦',
      default: categoryFilter === 'all'
    });

    const relevantCategories = CATEGORIES_BY_TYPE[typeFilter] || [];
    for (const category of relevantCategories) {
      const emoji = TransactionCategorizer.getCategoryEmoji(category);
      const name = TransactionCategorizer.getCategoryName(category);
      categoryMenu.addOptions({
        label: name,
        value: category,
        emoji,
        default: categoryFilter === category
      });
    }

    
    
    
    const navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('transactions_first')
        .setEmoji({ id: Emoji.nav_first.id })
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || currentPage === 1), 

      new ButtonBuilder()
        .setCustomId('transactions_prev')
        .setEmoji({ id: Emoji.nav_prev.id })
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || currentPage === 1), 

      new ButtonBuilder()
        .setCustomId('transactions_delete')
        .setEmoji({ id: Emoji.nav_trash.id })
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled), 

      new ButtonBuilder()
        .setCustomId('transactions_next')
        .setEmoji({ id: Emoji.nav_next.id })
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || currentPage >= totalPages), 

      new ButtonBuilder()
        .setCustomId('transactions_last')
        .setEmoji({ id: Emoji.nav_last.id })
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || currentPage >= totalPages) 
    );

    return [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(typeMenu),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categoryMenu),
      navigationRow
    ];
  }
}
