import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { BotCommand } from '@types';
import { InventoryService } from '@bot/services/inventory.service';
import { BalanceService } from '@bot/services/balance.service';

export const inventoryCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Проверить инвентарь')
    .addUserOption(option =>
      option
        .setName('пользователь')
        .setDescription('Пользователь, чей инвентарь нужно проверить')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const targetUser = interaction.options.getUser('пользователь') || interaction.user;
      const targetMember = await interaction.guild!.members.fetch(targetUser.id);

      if (targetUser.bot) {
        await interaction.editReply({
          embeds: [createErrorEmbed('Инвентарь', 'Нельзя просмотреть инвентарь бота')]
        });
        return;
      }

      const embed = createMainEmbed(targetMember.displayName);
      const components = createMainComponents();

      const message = await interaction.editReply({
        embeds: [embed],
        components
      });

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 300000
      });

      collector.on('collect', async (i: any) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({ content: 'Это не ваше меню!', ephemeral: true });
          return;
        }

        await i.deferUpdate();

        const value = i.values[0];
        await handleInventorySelection(interaction, targetMember, targetUser, value);
      });

      collector.on('end', () => {
        interaction.editReply({ components: [] }).catch(() => {});
      });

    } catch (error) {
      console.error('Ошибка в команде inventory:', error);
      await interaction.editReply({
        content: 'Произошла ошибка при загрузке инвентаря',
        components: []
      });
    }
  }
};

function createMainEmbed(userName: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`📦 Инвентарь ${userName}`)
    .setDescription('Что вы хотите посмотреть?')
    .setTimestamp();
}

function createMainComponents(): ActionRowBuilder<StringSelectMenuBuilder>[] {
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('chooseInventory')
          .setPlaceholder('Выберите категорию')
          .addOptions([
            { label: '🎭 Роли', value: 'roles', description: 'Просмотр личных ролей' },
            { label: '🏠 Комнаты', value: 'rooms', description: 'Просмотр личных комнат' },
            { label: '🔑 Ключи', value: 'items', description: 'Просмотр ключей и предметов' }
          ])
      )
  ];
}

async function handleInventorySelection(
  interaction: any,
  targetMember: any,
  targetUser: any,
  value: string
) {
  switch (value) {
    case 'roles':
      await handleRolesView(interaction, targetMember);
      break;
    case 'rooms':
      await handleRoomsView(interaction, targetMember);
      break;
    case 'items':
      await handleItemsView(interaction, targetMember, targetUser);
      break;
  }
}

async function handleRolesView(interaction: any, targetMember: any) {
  const roles = await InventoryService.getUserRoles(targetMember.id, interaction.guild!.id);
  const embed = createRolesEmbed(targetMember, roles);
  const components = createRolesComponents(roles, targetMember.id === interaction.user.id);

  const message = await interaction.editReply({
    embeds: [embed],
    components
  });

  if (targetMember.id === interaction.user.id && roles.length > 0) {
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000
    });

    collector.on('collect', async (i: any) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'Это не ваше меню!', ephemeral: true });
        return;
      }

      await i.deferUpdate();

      if (i.customId === 'leave') {
        const embed = createMainEmbed(targetMember.displayName);
        const components = createMainComponents();
        await interaction.editReply({ embeds: [embed], components });
        collector.stop();
      } else if (i.customId.startsWith('toggle.')) {
        await handleRoleToggle(interaction, targetMember, i);
      }
    });
  }
}

async function handleRoleToggle(interaction: any, targetMember: any, buttonInteraction: any) {
  const roleId = buttonInteraction.customId.split('.')[1];
  const role = interaction.guild!.roles.cache.get(roleId);

  if (!role) {
    await interaction.editReply({
      embeds: [createErrorEmbed('Инвентарь ролей', 'Роль была удалена')],
      components: createLeaveComponents()
    });
    return;
  }

  const hidePrice = 100; 
  const balance = await BalanceService.get(interaction.user.id);

  if (balance.coins < hidePrice) {
    await interaction.editReply({
      embeds: [createErrorEmbed('Инвентарь ролей', `Недостаточно монет. Необходимо: ${hidePrice} 💰`)],
      components: createLeaveComponents()
    });
    return;
  }

  const hasRole = targetMember.roles.cache.has(roleId);
  
  if (hasRole) {
    await targetMember.roles.remove(roleId);
    await InventoryService.setRoleHidden(interaction.user.id, interaction.guild!.id, roleId, true);
  } else {
    await targetMember.roles.add(roleId);
    await InventoryService.setRoleHidden(interaction.user.id, interaction.guild!.id, roleId, false);
  }

  await BalanceService.subtract(interaction.user.id, hidePrice, 0);

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Успешно')
        .setDescription(`Вы ${hasRole ? 'скрыли' : 'раскрыли'} роль <@&${roleId}>`)
    ],
    components: createLeaveComponents(true)
  });
}

async function handleRoomsView(interaction: any, targetMember: any) {
  const rooms = await InventoryService.getUserRooms(targetMember.id, interaction.guild!.id);
  const embed = createRoomsEmbed(targetMember, rooms);
  const components = createBackComponents();

  await interaction.editReply({
    embeds: [embed],
    components
  });
}

async function handleItemsView(interaction: any, targetMember: any, targetUser: any) {
  if (targetUser.id !== interaction.user.id) {
    await interaction.followUp({
      embeds: [createErrorEmbed('Инвентарь ключей', 'Вы не можете просматривать чужой инвентарь')],
      ephemeral: true
    });
    return;
  }

  const items = await InventoryService.getUserKeys(targetUser.id);
  const embed = createItemsEmbed(items, 0);
  const components = items.length > 0 ? createPaginationComponents(0, items.length, 5) : [];

  await interaction.editReply({
    embeds: [embed],
    components
  });
}

function createRolesEmbed(member: any, roles: any[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`🎭 Роли ${member.displayName}`)
    .setDescription(roles.length > 0 ? 'Ваши личные роли:' : 'У вас нет личных ролей')
    .setTimestamp();

  if (roles.length > 0) {
    for (const role of roles) {
      const hidden = role.hidden ? '🔒 Скрыта' : '🔓 Видна';
      const expires = role.expires_at ? `\nИстекает: <t:${Math.floor(new Date(role.expires_at).getTime() / 1000)}:R>` : '';
      embed.addFields({
        name: `<@&${role.role_id}>`,
        value: `${hidden}${expires}`,
        inline: true
      });
    }
  }

  return embed;
}

function createRoomsEmbed(member: any, rooms: any[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`🏠 Комнаты ${member.displayName}`)
    .setDescription(rooms.length > 0 ? 'Ваши личные комнаты:' : 'У вас нет личных комнат')
    .setTimestamp();

  if (rooms.length > 0) {
    for (const room of rooms) {
      embed.addFields({
        name: room.name || 'Личная комната',
        value: `<#${room.channel_id}>\nСоздана: <t:${Math.floor(new Date(room.created_at).getTime() / 1000)}:R>`,
        inline: false
      });
    }
  }

  return embed;
}

function createItemsEmbed(items: any[], page: number): EmbedBuilder {
  const itemsPerPage = 5;
  const start = page * itemsPerPage;
  const end = start + itemsPerPage;
  const pageItems = items.slice(start, end);
  const totalPages = Math.ceil(items.length / itemsPerPage);

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('🔑 Ключи и предметы')
    .setDescription(items.length > 0 ? 'Ваши ключи:' : 'У вас нет ключей')
    .setFooter({ text: `Страница: ${page + 1}/${totalPages || 1}` })
    .setTimestamp();

  if (pageItems.length > 0) {
    for (const item of pageItems) {
      const typeNames: Record<string, string> = {
        PersonalRole: '🎭 Личная роль',
        PersonalRoom: '🏠 Личная комната',
        Lottery: '🎰 Лотерея'
      };
      
      embed.addFields({
        name: typeNames[item.type] || item.type,
        value: `Код: \`${item.code}\`\nСоздан: <t:${Math.floor(new Date(item.created_at).getTime() / 1000)}:R>`,
        inline: false
      });
    }
  }

  return embed;
}

function createRolesComponents(roles: any[], isOwner: boolean): ActionRowBuilder<ButtonBuilder>[] {
  if (!isOwner || roles.length === 0) {
    return createBackComponents();
  }

  const buttons: ButtonBuilder[] = [];
  
  for (const role of roles.slice(0, 5)) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`toggle.${role.role_id}`)
        .setLabel(role.hidden ? 'Раскрыть' : 'Скрыть')
        .setStyle(role.hidden ? ButtonStyle.Success : ButtonStyle.Secondary)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId('leave')
      .setLabel('Назад')
      .setStyle(ButtonStyle.Danger)
  );

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)];
}

function createBackComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('leave')
          .setLabel('Назад')
          .setStyle(ButtonStyle.Secondary)
      )
  ];
}

function createLeaveComponents(disabled = false): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('leave')
          .setLabel('Назад')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled)
      )
  ];
}

function createPaginationComponents(page: number, totalItems: number, itemsPerPage: number): ActionRowBuilder<ButtonBuilder>[] {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  return [
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('left')
          .setEmoji('◀️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('trash')
          .setEmoji('🗑️')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('right')
          .setEmoji('▶️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page >= totalPages - 1)
      )
  ];
}

function createErrorEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor('#ff0000')
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setTimestamp();
}
