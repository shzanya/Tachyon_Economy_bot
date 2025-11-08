// 🤖 Автоматически сгенерировано EmojiService
// ⚠️ НЕ РЕДАКТИРУЙТЕ ВРУЧНУЮ - изменения будут перезаписаны

/** Типизированный объект эмодзи */
export interface EmojiObject {
  readonly string: string;
  readonly id: string;
}

/** Хелпер для удобного использования кастомных эмодзи */
export class Emoji {

  // ═══════════════════════════════════════════════════════════
  // 👤 ADMIN (Администрирование)
  // ═══════════════════════════════════════════════════════════
  static readonly admin: EmojiObject = { string: '<:admin:1434608950883516547>', id: '1434608950883516547' };
  static readonly admin_give: EmojiObject = { string: '<:admin_give:1434608952871485702>', id: '1434608952871485702' };
  static readonly admin_trans: EmojiObject = { string: '<:admin_trans:1434608954293616680>', id: '1434608954293616680' };

  // ═══════════════════════════════════════════════════════════
  // 📊 КАТЕГОРИИ ТРАНЗАКЦИЙ (Categories)
  // ═══════════════════════════════════════════════════════════
  static readonly cat_casino_win: EmojiObject = { string: '<:cat_casino_win:1434606465099759696>', id: '1434606465099759696' };
  static readonly cat_daily_bonus: EmojiObject = { string: '<:cat_daily_bonus:1434606467423408258>', id: '1434606467423408258' };
  static readonly cat_gift: EmojiObject = { string: '<:cat_gift:1434606469432606851>', id: '1434606469432606851' };
  static readonly cat_reward: EmojiObject = { string: '<:cat_reward:1434606471185829950>', id: '1434606471185829950' };
  static readonly cat_work: EmojiObject = { string: '<:cat_work:1434606472741912810>', id: '1434606472741912810' };
  static readonly cat_casino_win_alt: EmojiObject = { string: '<:cat_casino_win_alt:1434608955929264158>', id: '1434608955929264158' };
  static readonly cat_fees: EmojiObject = { string: '<:cat_fees:1434608958269554811>', id: '1434608958269554811' };
  static readonly cat_p2p: EmojiObject = { string: '<:cat_p2p:1434608960832405534>', id: '1434608960832405534' };
  static readonly cat_shopping: EmojiObject = { string: '<:cat_shopping:1434608963005186209>', id: '1434608963005186209' };

  // ═══════════════════════════════════════════════════════════
  // 💱 ОПЕРАЦИИ (Payments/Transfers)
  // ═══════════════════════════════════════════════════════════
  static readonly pay_convert: EmojiObject = { string: '<:pay_convert:1434608966649909289>', id: '1434608966649909289' };
  static readonly pay_give: EmojiObject = { string: '<:pay_give:1434608968512180294>', id: '1434608968512180294' };
  static readonly pay_invest: EmojiObject = { string: '<:pay_invest:1434608970214932601>', id: '1434608970214932601' };
  static readonly pay_swift: EmojiObject = { string: '<:pay_swift:1434608972018618400>', id: '1434608972018618400' };
  static readonly pay_transfer: EmojiObject = { string: '<:pay_transfer:1434608973415186434>', id: '1434608973415186434' };
  static readonly pay_card: EmojiObject = { string: '<:pay_card:1434613505335623690>', id: '1434613505335623690' };

  // ═══════════════════════════════════════════════════════════
  // 📈 ТИПЫ ТРАНЗАКЦИЙ (Transaction Types)
  // ═══════════════════════════════════════════════════════════
  static readonly type_all: EmojiObject = { string: '<:type_all:1434608975227388025>', id: '1434608975227388025' };
  static readonly type_expense: EmojiObject = { string: '<:type_expense:1434608977395843223>', id: '1434608977395843223' };
  static readonly type_income: EmojiObject = { string: '<:type_income:1434608979023237210>', id: '1434608979023237210' };
  static readonly type_transfer: EmojiObject = { string: '<:type_transfer:1434608981086699530>', id: '1434608981086699530' };

  // ═══════════════════════════════════════════════════════════
  // 🧭 НАВИГАЦИЯ (Navigation)
  // ═══════════════════════════════════════════════════════════
  static readonly nav_first: EmojiObject = { string: '<:nav_first:1434605165633077383>', id: '1434605165633077383' };
  static readonly nav_last: EmojiObject = { string: '<:nav_last:1434605167256408275>', id: '1434605167256408275' };
  static readonly nav_next: EmojiObject = { string: '<:nav_next:1434605169143709840>', id: '1434605169143709840' };
  static readonly nav_prev: EmojiObject = { string: '<:nav_prev:1434605171232735277>', id: '1434605171232735277' };
  static readonly nav_trash: EmojiObject = { string: '<:nav_trash:1434605173245874378>', id: '1434605173245874378' };

  // ═══════════════════════════════════════════════════════════
  // 💎 ВАЛЮТЫ (Currencies)
  // ═══════════════════════════════════════════════════════════
  static readonly coin: EmojiObject = { string: '<:coin:1434606474989928581>', id: '1434606474989928581' };
  static readonly diamond: EmojiObject = { string: '<:diamond:1434606477846515734>', id: '1434606477846515734' };

  // ═══════════════════════════════════════════════════════════
  // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ═══════════════════════════════════════════════════════════

  /** Получить эмодзи по имени */
  static get(name: string): EmojiObject | undefined {
    return (this as any)[name];
  }

  /** Получить строку эмодзи для вставки в сообщения */
  static str(name: string): string {
    return this.get(name)?.string ?? `:${name}:`;
  }

  /** Получить ID эмодзи для использования в компонентах */
  static id(name: string): string | undefined {
    return this.get(name)?.id;
  }
}