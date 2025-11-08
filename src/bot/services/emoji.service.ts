import { Client, ApplicationEmoji, Collection } from 'discord.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { logger } from '@utils/logger';

interface EmojiMetadata {
  name: string;
  hash: string;
  id: string;
}

interface EmojiChanges {
  toAdd: string[];
  toUpdate: Array<{ file: string; name: string; serverEmoji: ApplicationEmoji }>;
  toDelete: ApplicationEmoji[];
  unchanged: string[];
}

export class EmojiService {
  private static readonly ASSETS_DIR = join(process.cwd(), 'src/assets/emoji');
  private static readonly METADATA_FILE = join(this.ASSETS_DIR, '.emoji-metadata.json');
  private static readonly HELPER_FILE = join(this.ASSETS_DIR, 'emoji.helper.ts');

  private static client: Client;


  private static async writeFileIfChanged(filePath: string, newContent: string): Promise<void> {
    try {
      const currentContent = await fs.readFile(filePath, 'utf8');
      if (currentContent === newContent) {
        return;
      }
    } catch (error) {
    }

    await fs.writeFile(filePath, newContent);
  }

  static async initialize(client: Client, delayMs = 5000): Promise<void> {
    this.client = client;

    if (!this.client.isReady()) {
      await new Promise<void>((resolve) => {
        this.client.once('ready', () => resolve());
      });
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
    await this.syncEmojis();
  }

  static async syncEmojis(): Promise<void> {
    const appEmojis = this.client.application?.emojis;
    if (!appEmojis) {
      logger.error('❌ Application Emoji Manager недоступен.');
      return;
    }

    try {
      logger.section('Синхронизация эмодзи', '🎭');
      const spinner = logger.spinner('Анализ локальных и серверных эмодзи...').start();

      const localFiles = await fs.readdir(this.ASSETS_DIR).catch(() => []);
      const emojiFiles = localFiles.filter(file => !file.startsWith('.') && /\.(png|jpg|jpeg|gif|webp)$/i.test(file));

      const currentHashes = await this.calculateFileHashes(emojiFiles);
      const metadata = await this.loadMetadata();
      const serverEmojis = await appEmojis.fetch();
      
      spinner.stop();

      const changes = this.analyzeChanges(emojiFiles, currentHashes, metadata, serverEmojis);

      if (this.hasNoChanges(changes)) {
        logger.successQuiet(`✅ Все эмодзи (${emojiFiles.length} шт.) актуальны.`);
        await this.generateHelper(serverEmojis, true);
        logger.sectionEnd();
        return;
      }

      await this.applyChanges(appEmojis, changes);
      
      const updatedServerEmojis = await appEmojis.fetch();
      await this.saveMetadata(currentHashes, updatedServerEmojis);
      await this.generateHelper(updatedServerEmojis);

      this.printSummary(changes);
      logger.sectionEnd();

    } catch (error) {
      logger.error('💥 Критическая ошибка при синхронизации эмодзи', error);
    }
  }

  private static hasNoChanges(changes: EmojiChanges): boolean {
    return changes.toAdd.length === 0 && changes.toUpdate.length === 0 && changes.toDelete.length === 0;
  }

  private static async calculateFileHashes(files: string[]): Promise<Map<string, string>> {
    const hashes = new Map<string, string>();
    for (const file of files) {
      const name = file.split('.')[0];
      const path = join(this.ASSETS_DIR, file);
      try {
        const buffer = await fs.readFile(path);
        const hash = createHash('md5').update(buffer).digest('hex');
        hashes.set(name, hash);
      } catch (error) {
        logger.warn(`⚠️ Не удалось прочитать файл: ${file}`);
      }
    }
    return hashes;
  }

  private static async loadMetadata(): Promise<Map<string, EmojiMetadata>> {
    try {
      const data = await fs.readFile(this.METADATA_FILE, 'utf8');
      const parsed = JSON.parse(data) as EmojiMetadata[];
      return new Map(parsed.map(item => [item.name, item]));
    } catch {
      return new Map();
    }
  }

  private static async saveMetadata(hashes: Map<string, string>, serverEmojis: Collection<string, ApplicationEmoji>): Promise<void> {
    const metadata: EmojiMetadata[] = [];
    serverEmojis.forEach(emoji => {
        if (emoji.name && hashes.has(emoji.name)) {
            metadata.push({
                name: emoji.name,
                hash: hashes.get(emoji.name)!,
                id: emoji.id,
            });
        }
    });
    await this.writeFileIfChanged(this.METADATA_FILE, JSON.stringify(metadata, null, 2));
  }

  private static analyzeChanges(
    emojiFiles: string[],
    currentHashes: Map<string, string>,
    metadata: Map<string, EmojiMetadata>,
    serverEmojis: Collection<string, ApplicationEmoji>
  ): EmojiChanges {
    const changes: EmojiChanges = { toAdd: [], toUpdate: [], toDelete: [], unchanged: [] };
    const localNames = new Set(emojiFiles.map(f => f.split('.')[0]));

    serverEmojis.forEach((emoji) => {
      if (emoji.name && !localNames.has(emoji.name)) {
        changes.toDelete.push(emoji);
      }
    });

    for (const file of emojiFiles) {
      const name = file.split('.')[0];
      const currentHash = currentHashes.get(name);
      const savedMeta = metadata.get(name);
      const serverEmoji = serverEmojis.find((e) => e.name === name);

      if (!serverEmoji) {
        changes.toAdd.push(file);
      } else if (!savedMeta || savedMeta.hash !== currentHash) {
        changes.toUpdate.push({ file, name, serverEmoji });
      } else {
        changes.unchanged.push(name);
      }
    }
    return changes;
  }

  private static async applyChanges(appEmojis: any, changes: EmojiChanges): Promise<void> {
    for (const emoji of changes.toDelete) {
        logger.info(`- Удаление эмодзи: ${emoji.name}`);
        await emoji.delete().catch((err: Error) => logger.warn(`Не удалось удалить ${emoji.name}: ${err.message}`));
    }
    for (const { file, name, serverEmoji } of changes.toUpdate) {
        logger.info(`~ Обновление эмодзи: ${name}`);
        const path = join(this.ASSETS_DIR, file);
        await serverEmoji.delete().catch((err: Error) => logger.warn(`Не удалось удалить старый ${name}: ${err.message}`));
        await appEmojis.create({ name, attachment: path }).catch((err: Error) => logger.warn(`Не удалось создать новый ${name}: ${err.message}`));
    }
    for (const file of changes.toAdd) {
        const name = file.split('.')[0];
        logger.info(`+ Добавление эмодзи: ${name}`);
        const path = join(this.ASSETS_DIR, file);
        await appEmojis.create({ name, attachment: path }).catch((err: Error) => logger.warn(`Не удалось добавить ${name}: ${err.message}`));
    }
  }

  private static async generateHelper(serverEmojis: Collection<string, ApplicationEmoji>, forceCheckOnly = false): Promise<void> {

    const lines: string[] = [
      '// 🤖 Автоматически сгенерировано EmojiService',
      '// ⚠️ НЕ РЕДАКТИРУЙТЕ ВРУЧНУЮ - изменения будут перезаписаны',
      '',
      '/** Типизированный объект эмодзи */',
      'export interface EmojiObject {',
      '  readonly string: string;',
      '  readonly id: string;',
      '}',
      '',
      '/** Хелпер для удобного использования кастомных эмодзи */',
      'export class Emoji {',
    ];
    const isValid = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
    const nameMapping: Record<string, string> = {
      'a_admin': 'admin', 'a_give': 'admin_give', 'a_trans': 'admin_trans',
      'givehuman': 'pay_give', 'k_komissia': 'cat_fees', 'k_shop': 'cat_shopping',
      'k_trans': 'cat_p2p', 'k_win': 'cat_casino_win_alt', 'p_convert': 'pay_convert',
      'p_invist': 'pay_invest', 'p_swift': 'pay_swift', 'trans': 'pay_transfer',
      't_vsetip': 'type_all', 'income': 'type_income', 'expense': 'type_expense',
      'transfer': 'type_transfer',
    };
    const grouped: Record<string, Array<{ name: string; emoji: ApplicationEmoji }>> = {
      admin: [], categories: [], payments: [], types: [], navigation: [], currencies: [], other: [],
    };
    for (const emoji of serverEmojis.values()) {
        if (!emoji.name) continue;
        const originalName = emoji.name;
        const mappedName = nameMapping[originalName] || originalName;
        if (mappedName.startsWith('admin')) grouped.admin.push({ name: mappedName, emoji });
        else if (mappedName.startsWith('cat_')) grouped.categories.push({ name: mappedName, emoji });
        else if (mappedName.startsWith('pay_')) grouped.payments.push({ name: mappedName, emoji });
        else if (mappedName.startsWith('type_')) grouped.types.push({ name: mappedName, emoji });
        else if (mappedName.startsWith('nav_')) grouped.navigation.push({ name: mappedName, emoji });
        else if (['coin', 'diamond'].includes(mappedName)) grouped.currencies.push({ name: mappedName, emoji });
        else grouped.other.push({ name: mappedName, emoji });
    }
    const sections = [
      { title: 'ADMIN (Администрирование)', key: 'admin', icon: '👤' },
      { title: 'КАТЕГОРИИ ТРАНЗАКЦИЙ (Categories)', key: 'categories', icon: '📊' },
      { title: 'ОПЕРАЦИИ (Payments/Transfers)', key: 'payments', icon: '💱' },
      { title: 'ТИПЫ ТРАНЗАКЦИЙ (Transaction Types)', key: 'types', icon: '📈' },
      { title: 'НАВИГАЦИЯ (Navigation)', key: 'navigation', icon: '🧭' },
      { title: 'ВАЛЮТЫ (Currencies)', key: 'currencies', icon: '💎' },
    ];
    for (const section of sections) {
      const items = grouped[section.key];
      if (items.length === 0) continue;
      lines.push('', '  // ═══════════════════════════════════════════════════════════', `  // ${section.icon} ${section.title}`, '  // ═══════════════════════════════════════════════════════════');
      for (const { name, emoji } of items) {
        const safeName = isValid.test(name) ? name : `'${name}'`;
        lines.push(`  static readonly ${safeName}: EmojiObject = { string: '<:${emoji.name}:${emoji.id}>', id: '${emoji.id}' };`);
      }
    }
    if (grouped.other.length > 0) {
      lines.push('', '  // ═══════════════════════════════════════════════════════════', '  // 📦 ПРОЧИЕ', '  // ═══════════════════════════════════════════════════════════');
      for (const { name, emoji } of grouped.other) {
        const safeName = isValid.test(name) ? name : `'${name}'`;
        lines.push(`  static readonly ${safeName}: EmojiObject = { string: '<:${emoji.name}:${emoji.id}>', id: '${emoji.id}' };`);
      }
    }
    lines.push(
      '', '  // ═══════════════════════════════════════════════════════════', '  // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ', '  // ═══════════════════════════════════════════════════════════', '',
      '  /** Получить эмодзи по имени */', '  static get(name: string): EmojiObject | undefined {', '    return (this as any)[name];', '  }', '',
      '  /** Получить строку эмодзи для вставки в сообщения */', '  static str(name: string): string {', '    return this.get(name)?.string ?? `:${name}:`;', '  }', '',
      '  /** Получить ID эмодзи для использования в компонентах */', '  static id(name: string): string | undefined {', '    return this.get(name)?.id;', '  }', '}'
    );

    await this.writeFileIfChanged(this.HELPER_FILE, lines.join('\n'));
    if (!forceCheckOnly) {
        logger.successQuiet('✓ Файл emoji.helper.ts успешно сгенерирован/обновлен.');
    }
  }

  private static printSummary(changes: EmojiChanges): void {
    const total = changes.toAdd.length + changes.toUpdate.length + changes.toDelete.length + changes.unchanged.length;
    logger.box(
      [
        `✨ Добавлено: ${changes.toAdd.length}`,
        `🔄 Обновлено: ${changes.toUpdate.length}`,
        `🗑️  Удалено: ${changes.toDelete.length}`,
        `✓ Без изменений: ${changes.unchanged.length}`,
        `📦 Всего: ${total}`
      ].join('\n'),
      '🎉 СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА'
    );
  }
}
