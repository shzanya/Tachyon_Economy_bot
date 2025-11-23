import { EmbedBuilder } from 'discord.js';
import { PersonalRoleService } from '@bot/services/personal-role.service';

export async function handleInfo(interaction: any) {
  const role = interaction.options.getRole('роль', true);
  const roleData = await PersonalRoleService.getRoleInfo(role.id);

  if (!roleData) {
    return interaction.editReply('❌ Эта роль не является личной');
  }

  const owner = await interaction.guild.members.fetch(roleData.user_id).catch(() => null);
  const members = await PersonalRoleService.getRoleMembers(role.id, interaction.guild.id);

  const embed = new EmbedBuilder()
    .setColor(role.color)
    .setTitle(`🎭 ${role.name}`)
    .addFields(
      { name: '👤 Владелец', value: owner ? `<@${owner.id}>` : 'Неизвестен', inline: true },
      { name: '👥 Участников', value: members.length.toString(), inline: true },
      { name: '🎨 Цвет', value: role.hexColor, inline: true },
      { name: '🏪 В магазине', value: roleData.in_shop ? '✅ Да' : '❌ Нет', inline: true },
      { name: '💰 Цена', value: roleData.price ? `${roleData.price} 💰` : 'Не продается', inline: true },
      { name: '📈 Продано', value: roleData.purchased?.toString() || '0', inline: true }
    )
    .setTimestamp(new Date(roleData.created_at));

  await interaction.editReply({ embeds: [embed] });
}
