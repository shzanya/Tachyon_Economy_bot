import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { Client, Collection } from 'discord.js';
import { logger } from '@utils/logger';
import type { BotCommand } from '@types';
import fs from 'fs';
import path from 'path';

export class CommandManager {
  constructor(
    private client: Client,
    private commands: Collection<string, BotCommand>
  ) {}

  async loadCommands() {
    const commandsPath = path.resolve(__dirname, '../commands');
    await this.loadCommandsFromDir(commandsPath);
    logger.successQuiet(`Всего команд: ${this.commands.size}`);
  }

  private async loadCommandsFromDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.loadCommandsFromDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
        try {
          const commandModule = await import(fullPath);
          const command: BotCommand = commandModule.default || commandModule[Object.keys(commandModule)[0]];
          
          
          
          if (command && command.data && typeof command.execute === 'function') {
            this.commands.set(command.data.name, command);
            logger.successQuiet(`✔ Загружена команда: ${command.data.name}`);
          }
        } catch (err) {
          logger.error(`Ошибка загрузки ${entry.name}:`, err);
        }
      }
    }
  }

  public async registerCommands() {
    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.DEV_GUILD_ID;

    if (!token || !clientId) {
      logger.warn('Пропуск регистрации команд — отсутствуют TOKEN или CLIENT_ID в .env');
      return;
    }

    const commandsData = Array.from(this.commands.values()).map((c) => c.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(token);

    try {
      logger.info('Начата синхронизация (/) команд приложения.');
      if (guildId) {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandsData });
        logger.success(`✔ Успешно синхронизировано ${commandsData.length} команд для тестового сервера.`);
      } else {
        await rest.put(Routes.applicationCommands(clientId), { body: commandsData });
        logger.success(`✔ Успешно синхронизировано ${commandsData.length} глобальных команд.`);
      }
    } catch (err) {
      logger.error('Ошибка синхронизации команд', err);
    }
  }
}
