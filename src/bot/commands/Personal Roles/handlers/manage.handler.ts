import { StringSelectMenuBuilder, ActionRowBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { PersonalRoleService } from '@bot/services/personal-role.service';
import { RoleCollector } from './collectors/role.collector';

export async function handleManage(interaction: any) {
  const roles = await PersonalRoleService.getUserOwnedRoles(
    interaction.user.id,
    interaction.guild.id
  );

  if (roles.length === 0) {
    return interaction.editReply('❌ У вас нет личных ролей');
  }

  const options: StringSelectMenuOptionBuilder[] = [];
  
  for (const r of roles) {
    const role = interaction.guild.roles.cache.get(r.role_id);
    if (!role) continue;
    
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(role.name)
        .setValue(r.role_id)
        .setEmoji('🎭')
    );
  }

  if (options.length === 0) {
    return interaction.editReply('❌ Все роли удалены');
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('role_select')
    .setPlaceholder('Выберите роль')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const message = await interaction.editReply({
    content: '🎭 **Управление личными ролями**\nВыберите роль:',
    components: [row]
  });

  const collector = new RoleCollector(interaction, message);
  await collector.start();
}
