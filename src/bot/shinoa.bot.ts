import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { CommandManager } from '@managers/command.manager';
import { ApiModule } from '@api/api.module';
import { EmojiService } from '@services/emoji.service';
import { logger } from '@utils/logger';
import type { BotCommand } from '@types';
import { VoiceTrackerManager } from '@managers/voice-tracker.manager';
import { MessageTrackerManager } from '@managers/message-tracker.manager';

export class ShinoaBot {
  private client: Client;
  private api: ReturnType<ApiModule['create']>;
  private commandManager: CommandManager;
  public commands: Collection<string, BotCommand>;
  private readyResolver?: () => void;
  private readyPromise: Promise<void>;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
      ],
    });

    this.commands = new Collection();
    this.commandManager = new CommandManager(this.client, this.commands);
    this.api = new ApiModule(this).create();

    this.readyPromise = new Promise((resolve) => {
      this.readyResolver = resolve;
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.once(Events.ClientReady, async (client) => {
      if (this.readyResolver) {
        this.readyResolver();
      }

      await EmojiService.initialize(this.client, 5000);

      logger.section('Discord Commands', '📝');
      await this.commandManager.loadCommands();
      await this.commandManager.registerCommands();
      logger.sectionEnd();

      VoiceTrackerManager.startBatchProcessor();
      MessageTrackerManager.startBatchProcessor();
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const command = this.commands.get(interaction.commandName);
      if (!command) {
        logger.warn(`Не найдена команда "${interaction.commandName}"`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(`Ошибка выполнения команды /${interaction.commandName}`, error);
        const reply = {
          content: '❌ Произошла ошибка при выполнении команды!',
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
    });

    import('./events/voiceStateUpdate')
      .then((module) => {
        this.client.on(Events.VoiceStateUpdate, module.default.execute);
        logger.info('🎶 VoiceStateUpdate обработчик зарегистрирован.');
      })
      .catch((err) => {
        logger.error('Не удалось загрузить VoiceStateUpdate обработчик:', err);
      });

    import('./events/messageCreate')
      .then((module) => {
        this.client.on(Events.MessageCreate, module.default.execute);
        logger.info('💬 MessageCreate обработчик зарегистрирован.');
      })
      .catch((err) => {
        logger.error('Не удалось загрузить MessageCreate обработчик:', err);
      });
  }

  public async start() {
    const token = process.env.DISCORD_TOKEN;
    if (!token) throw new Error('Отсутствует DISCORD_TOKEN в .env');

    await this.client.login(token);
    await this.readyPromise;

    const totalMembers = this.client.guilds.cache.reduce(
      (acc, guild) => acc + guild.memberCount,
      0
    );

    logger.box(
      `Бот: ${this.client.user?.tag}\nСерверы: ${this.client.guilds.cache.size}\nУчастников: ${totalMembers}`,
      '🤖 БОТ ОНЛАЙН'
    );

    logger.section('API Server', '🌐');
    this.api.listen(3000);
    logger.successQuiet('Запущен на http://localhost:3000');
    logger.sectionEnd();
  }

  public getClient(): Client {
    return this.client;
  }
}
