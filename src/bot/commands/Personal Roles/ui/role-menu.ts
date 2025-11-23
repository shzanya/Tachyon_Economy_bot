import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PersonalRoleService } from '@bot/services/personal-role.service';

export async function showRoleMenu(interaction: any, i: any, role: any) {
  const roleData = await PersonalRoleService.getRoleInfo(role.id);
  const members = await PersonalRoleService.getRoleMembers(role.id, interaction.guild.id);

  const embed = new EmbedBuilder()
    .setColor(role.color)
    .setTitle(`🎭 Управление: ${role.name}`)
    .addFields(
      { name: '📊 Участников', value: members.length.toString(), inline: true },
      { name: '🎨 Цвет', value: role.hexColor, inline: true },
      { name: '💰 Цена', value: roleData?.price ? `${roleData.price} 💰` : 'Не продается', inline: true },
      { name: '🏪 В магазине', value: roleData?.in_shop ? '✅ Да' : '❌ Нет', inline: true },
      { name: '📈 Продаж', value: (roleData?.purchased || 0).toString(), inline: true }
    );

  const buttons1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`${role.id}:name`).setLabel('Название').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
    new ButtonBuilder().setCustomId(`${role.id}:color`).setLabel('Цвет').setStyle(ButtonStyle.Secondary).setEmoji('🎨'),
    new ButtonBuilder().setCustomId(`${role.id}:icon`).setLabel('Иконка').setStyle(ButtonStyle.Secondary).setEmoji('🖼️'),
    new ButtonBuilder().setCustomId(`${role.id}:give`).setLabel('Выдать').setStyle(ButtonStyle.Success).setEmoji('➕'),
    new ButtonBuilder().setCustomId(`${role.id}:take`).setLabel('Забрать').setStyle(ButtonStyle.Danger).setEmoji('➖')
  );

  const buttons2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`${role.id}:sell`).setLabel(roleData?.in_shop ? 'Убрать с продажи' : 'Продавать').setStyle(roleData?.in_shop ? ButtonStyle.Secondary : ButtonStyle.Success).setEmoji('🏪'),
    new ButtonBuilder().setCustomId(`${role.id}:price`).setLabel('Цена').setStyle(ButtonStyle.Secondary).setEmoji('💰'),
    new ButtonBuilder().setCustomId(`${role.id}:prolong`).setLabel('Продлить').setStyle(ButtonStyle.Primary).setEmoji('⏰'),
    new ButtonBuilder().setCustomId(`${role.id}:delete`).setLabel('Удалить').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
  );

  await i.update({
    content: '',
    embeds: [embed],
    components: [buttons1, buttons2]
  });
}
