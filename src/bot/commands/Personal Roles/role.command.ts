import { SlashCommandBuilder } from 'discord.js';
import type { BotCommand } from '@types';
import { handleCreate } from './handlers/create.handler';
import { handleManage } from './handlers/manage.handler';
import { handleInfo } from './handlers/info.handler';

export const roleCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Управление личными ролями')
    .addSubcommand(sub => sub
      .setName('create')
      .setDescription('Создать личную роль')
      .addStringOption(opt => opt
        .setName('цвет')
        .setDescription('HEX-цвет (например: #FF5733)')
        .setRequired(true)
        .setMinLength(7)
        .setMaxLength(7))
      .addStringOption(opt => opt
        .setName('название')
        .setDescription('Название роли')
        .setRequired(true)
        .setMaxLength(48))
      .addStringOption(opt => opt
        .setName('ключ')
        .setDescription('Ключ активации (опционально)')
        .setMinLength(19)
        .setMaxLength(19)))
    .addSubcommand(sub => sub
      .setName('manage')
      .setDescription('Управление своими ролями'))
    .addSubcommand(sub => sub
      .setName('info')
      .setDescription('Информация о роли')
      .addRoleOption(opt => opt
        .setName('роль')
        .setDescription('Личная роль')
        .setRequired(true))),

  async execute(interaction) {
    await interaction.deferReply();
    
    try {
      const sub = interaction.options.getSubcommand();
      
      switch (sub) {
        case 'create': 
          await handleCreate(interaction);
          break;
        case 'manage': 
          await handleManage(interaction);
          break;
        case 'info': 
          await handleInfo(interaction);
          break;
      }
    } catch (error) {
      console.error('Ошибка /role:', error);
      await interaction.editReply('❌ Произошла ошибка при выполнении команды').catch(() => {});
    }
  }
};
