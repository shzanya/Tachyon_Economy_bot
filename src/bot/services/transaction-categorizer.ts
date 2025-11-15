import { Emoji } from '@assets/emoji/emoji.helper';
import type { TransactionType, TransactionCategory, CategoryRules } from '@types';

export class TransactionCategorizer {
  private static readonly RULES: CategoryRules = {
    
    
    
    'ежедневный бонус': ['income', 'daily_bonus'],
    'ежедневный': ['income', 'daily_bonus'],
    'daily_bonus': ['income', 'daily_bonus'],
    'daily': ['income', 'daily_bonus'],
    'timely': ['income', 'daily_bonus'],
    
    
    'работа': ['income', 'work'],
    'work': ['income', 'work'],
    'job': ['income', 'work'],
    
    
    'зарплата': ['income', 'salary'],
    'salary': ['income', 'salary'],
    'wage': ['income', 'salary'],
    
    
    'выигрыш в монетку': ['income', 'casino_win'],
    'выигрыш в бросок': ['income', 'casino_win'],
    'выигрыш в дуэль': ['income', 'casino_win'],
    'выигрыш в камень, ножницы, бумага': ['income', 'casino_win'],
    'coinflipwin': ['income', 'casino_win'],
    'betrollwin': ['income', 'casino_win'],
    'duelwin': ['income', 'casino_win'],
    'rpswin': ['income', 'casino_win'],
    'выигрыш': ['income', 'casino_win'],
    'casino_win': ['income', 'casino_win'],
    'jackpot': ['income', 'casino_win'],
    'won': ['income', 'casino_win'],
    
    
    'квест': ['income', 'quest_reward'],
    'quest': ['income', 'quest_reward'],
    
    
    'награда': ['income', 'reward'],
    'reward': ['income', 'reward'],
    'бонус': ['income', 'reward'],
    'bonus': ['income', 'reward'],
    
    
    'подарок': ['income', 'gift'],
    'gift': ['income', 'gift'],
    'present': ['income', 'gift'],
    
    
    
    
    'магазин': ['expense', 'shopping'],
    'покупка': ['expense', 'shopping'],
    'купил': ['expense', 'shopping'],
    'shop': ['expense', 'shopping'],
    'buy': ['expense', 'shopping'],
    'purchase': ['expense', 'shopping'],
    'bought': ['expense', 'shopping'],
    
    
    'проигрыш в монетку': ['expense', 'gambling'],
    'проигрыш в бросок': ['expense', 'gambling'],
    'проигрыш в дуэль': ['expense', 'gambling'],
    'проигрыш в камень, ножницы, бумага': ['expense', 'gambling'],
    'coinfliplose': ['expense', 'gambling'],
    'betrolllose': ['expense', 'gambling'],
    'duellose': ['expense', 'gambling'],
    'rpslose': ['expense', 'gambling'],
    'ставка': ['expense', 'gambling'],
    'казино': ['expense', 'gambling'],
    'casino': ['expense', 'gambling'],
    'bet': ['expense', 'gambling'],
    'gamble': ['expense', 'gambling'],
    'slots': ['expense', 'gambling'],
    'проигрыш': ['expense', 'gambling'],
    
    
    'ресторан': ['expense', 'food'],
    'кафе': ['expense', 'food'],
    'еда': ['expense', 'food'],
    'restaurant': ['expense', 'food'],
    'coffee': ['expense', 'food'],
    'food': ['expense', 'food'],
    'eat': ['expense', 'food'],
    
    
    'игра': ['expense', 'entertainment'],
    'развлечение': ['expense', 'entertainment'],
    'game': ['expense', 'entertainment'],
    'entertainment': ['expense', 'entertainment'],
    'fun': ['expense', 'entertainment'],
    
    
    'подписка': ['expense', 'subscription'],
    'премиум': ['expense', 'subscription'],
    'premium': ['expense', 'subscription'],
    'subscription': ['expense', 'subscription'],
    
    
    'аренда': ['expense', 'rent'],
    'rent': ['expense', 'rent'],
    
    
    'услуга': ['expense', 'services'],
    'service': ['expense', 'services'],
    
    
    'комиссия': ['expense', 'fees'],
    'налог': ['expense', 'fees'],
    'fee': ['expense', 'fees'],
    'tax': ['expense', 'fees'],
    'commission': ['expense', 'fees'],
    'за перевод': ['expense', 'fees'],
    
    
    'административная выдача': ['income', 'admin_award'],
    'выдача администратором': ['income', 'admin_award'],
    'выдача донатной валюты администратором': ['income', 'admin_award'],
    'списание донатной валюты администратором': ['expense', 'admin_take'],
    'award': ['income', 'admin_award'],
    'административное списание': ['expense', 'admin_take'],
    'списание администратором': ['expense', 'admin_take'],
    'take': ['expense', 'admin_take'],
    
    
    'перевод': ['transfer', 'p2p'],
    'transfer': ['transfer', 'p2p'],
    'send': ['transfer', 'p2p'],
    'give': ['transfer', 'p2p'],
    'donate': ['transfer', 'p2p'],
    'pay': ['transfer', 'p2p'],
  };

  static categorize(
    reason: string,
    merchant?: string,
    relatedUserId?: string
  ): [TransactionType, TransactionCategory] {
    const text = `${reason} ${merchant || ''}`.toLowerCase().trim();
  
    
    const sortedRules = Object.entries(this.RULES).sort((a, b) => b[0].length - a[0].length);
  
    for (const [keyword, result] of sortedRules) {
      if (text.includes(keyword)) {
        return result as [TransactionType, TransactionCategory];
      }
    }
  
    
    if (relatedUserId) {
      return ['transfer', 'p2p'];
    }
  
    return ['income', 'other'];
  }

  static getCategoryName(category: TransactionCategory): string {
    const names: Record<TransactionCategory, string> = {
      salary: 'Зарплата',
      reward: 'Награды',
      gift: 'Подарки',
      casino_win: 'Выигрыш в казино',
      quest_reward: 'Квесты',
      daily_bonus: 'Ежедневный бонус',
      work: 'Работа',
      investment_return: 'Инвестиции',
      food: 'Еда',
      entertainment: 'Развлечения',
      gambling: 'Проигрыш в казино', 
      shopping: 'Покупки',
      services: 'Услуги',
      rent: 'Аренда',
      subscription: 'Подписки',
      donation: 'Донаты',
      fees: 'Комиссии',
      p2p: 'Перевод игроку',
      bank: 'Банк',
      investment: 'Инвестиция',
      loan: 'Кредит',
      admin_award: 'Выдача админом',
      admin_take: 'Списание админом',
      other: 'Другое',
    };

    return names[category] || 'Неизвестно';
  }

  static getCategoryEmoji(category: TransactionCategory): string {
    const emojiMap: Partial<Record<TransactionCategory, keyof typeof Emoji>> = {
      casino_win: 'cat_casino_win',
      daily_bonus: 'cat_daily_bonus',
      gift: 'cat_gift',
      reward: 'cat_reward',
      work: 'cat_work',
      fees: 'cat_fees',
      shopping: 'cat_shopping',
      p2p: 'cat_p2p',
      admin_award: 'admin_give',
      admin_take: 'admin_trans',
      gambling: 'cat_casino_win', 
    };

    const emojiKey = emojiMap[category];
    if (emojiKey) {
      const emojiValue = Emoji[emojiKey];
      if (emojiValue && typeof emojiValue === 'object' && 'string' in emojiValue) {
        return (emojiValue as { string: string }).string;
      }
    }

    
    const unicodeEmojis: Record<TransactionCategory, string> = {
      salary: '💼',
      reward: '🎁',
      gift: '🎉',
      casino_win: '🎰',
      quest_reward: '⚔️',
      daily_bonus: '⏰',
      work: '🔨',
      investment_return: '📈',
      food: '🍔',
      entertainment: '🎮',
      gambling: '🎲',
      shopping: '🛒',
      services: '🔧',
      rent: '🏠',
      subscription: '💎',
      donation: '💸',
      fees: '📋',
      p2p: '↔️',
      bank: '🏦',
      investment: '💹',
      loan: '💰',
      admin_award: '🔰',
      admin_take: '⚠️',
      other: '❓',
    };

    return unicodeEmojis[category] || '❓';
  }

  static getTypeEmoji(type: TransactionType): string {
    const emojiMap: Record<TransactionType, keyof typeof Emoji> = {
      income: 'type_income',
      expense: 'type_expense',
      transfer: 'type_transfer',
    };

    const emojiKey = emojiMap[type];
    const emojiValue = Emoji[emojiKey];
    if (emojiValue && typeof emojiValue === 'object' && 'string' in emojiValue) {
      return (emojiValue as { string: string }).string;
    }

    const unicodeEmojis: Record<TransactionType, string> = {
      income: '📈',
      expense: '📉',
      transfer: '↔️',
    };

    return unicodeEmojis[type];
  }

  static getGameDisplayName(gameType: string): string {
    const gameNames: Record<string, string> = {
      'coinflip': '🪙 Монетка',
      'betroll': '🎲 Бросок',
      'duel': '🔫 Дуэль',
      'rps': '✊ КНБ',
    };

    return gameNames[gameType.toLowerCase()] || gameType;
  }
}
