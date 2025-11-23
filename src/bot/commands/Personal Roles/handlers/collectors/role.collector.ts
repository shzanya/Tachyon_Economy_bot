

import {
    Collection,
    MessageComponentInteraction,
    StringSelectMenuInteraction
  } from 'discord.js';
  import { showRoleMenu } from '../../ui/role-menu';
  import { handleButton } from './button.handler';
  import { handleUserSelect } from './user-select.handler';
  
  export class RoleCollector {
    constructor(
      private interaction: any,
      private message: any
    ) {}
  
    async start() {
      const collector = this.message.createMessageComponentCollector({
        filter: (i: any) => i.user.id === this.interaction.user.id,
        time: 300_000 
      });
  
      collector.on('collect', async (i: any) => {
        try {
          if (i.isStringSelectMenu() && i.customId === 'role_select') {
            await this.handleRoleSelect(i);
          } else if (i.isButton()) {
            await handleButton(this.interaction, i, collector);
          } else if (i.isUserSelectMenu()) {
            await handleUserSelect(this.interaction, i);
          }
        } catch (error) {
          console.error('Ошибка в коллекторе компонентов:', error);
          if (!i.replied && !i.deferred) {
            await i.reply({ content: '❌ Произошла непредвиденная ошибка.', ephemeral: true }).catch(() => {});
          } else {
            await i.followUp({ content: '❌ Произошла непредвиденная ошибка.', ephemeral: true }).catch(() => {});
          }
        }
      });
  
      
      collector.on('end', (collected: Collection<string, MessageComponentInteraction>, reason: string) => {
        
        if (reason === 'time') {
          this.interaction.editReply({ content: 'Время на взаимодействие вышло.', components: [] }).catch(() => {});
        }
      });
    }
  
    private async handleRoleSelect(i: StringSelectMenuInteraction) {
      const roleId = i.values[0];
      const role = this.interaction.guild.roles.cache.get(roleId);
      
      if (!role) {
        await i.update({ content: '❌ Эта роль больше не существует.', components: [] });
        return;
      }
  
      await showRoleMenu(this.interaction, i, role);
    }
  }
