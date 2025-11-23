

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } from 'discord.js';
import { PersonalRoleService } from '@bot/services/personal-role.service';
import { BalanceService } from '@bot/services/balance.service';
import { TransactionManager } from '@bot/services/transaction-manager';
import { pool } from '@db/index';
import { PRICES, LIMITS } from '../../constants';
import { showRoleMenu } from '../../ui/role-menu';
import { handleModal } from './modal.handler'; 

export async function handleButton(interaction: any, i: any, collector: any) {
  const [roleId, action] = i.customId.split(':');
  const role = interaction.guild.roles.cache.get(roleId);

  if (!role) {
    await i.update({ content: '❌ Роль удалена.', components: [] });
    return collector.stop();
  }

  
  const showAndAwaitModal = async (modal: ModalBuilder) => {
    await i.showModal(modal);
    try {
      const modalSubmitInteraction = await i.awaitModalSubmit({
        filter: (modalInt: any) => modalInt.customId === modal.data.custom_id && modalInt.user.id === interaction.user.id,
        time: 180_000, 
      });
      
      await handleModal(interaction, modalSubmitInteraction);
    } catch (err) {
      console.log(`Модальное окно ${modal.data.custom_id} не было отправлено вовремя.`);
    }
  };

  switch (action) {
    case 'name': {
      const modal = new ModalBuilder()
        .setCustomId(`${roleId}:name_modal`)
        .setTitle('Изменить название')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('name').setLabel('Новое название').setStyle(TextInputStyle.Short).setMaxLength(48).setRequired(true)
          )
        );
      await showAndAwaitModal(modal);
      break;
    }
    case 'color': {
      const modal = new ModalBuilder()
        .setCustomId(`${roleId}:color_modal`)
        .setTitle('Изменить цвет')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('color').setLabel('HEX-цвет (например: #FF5733)').setStyle(TextInputStyle.Short).setMinLength(7).setMaxLength(7).setRequired(true)
          )
        );
      await showAndAwaitModal(modal);
      break;
    }
    case 'give':
      await i.update({ content: '➕ Выберите пользователя, которому хотите выдать роль:', components: [
          new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
            new UserSelectMenuBuilder().setCustomId(`${roleId}:give_user`).setPlaceholder('Выберите пользователя').setMaxValues(1)
          )
        ]
      });
      break;
    case 'take':
      await i.update({ content: '➖ Выберите пользователя, у которого хотите забрать роль:', components: [
          new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
            new UserSelectMenuBuilder().setCustomId(`${roleId}:take_user`).setPlaceholder('Выберите пользователя').setMaxValues(1)
          )
        ]
      });
      break;
    case 'sell': {
      const roleData = await PersonalRoleService.getRoleInfo(roleId);
      if (roleData?.in_shop) {
        await PersonalRoleService.setRoleInShop(roleId, false);
        await i.update({ content: '✅ Роль убрана с продажи.', components: [] });
        setTimeout(() => showRoleMenu(interaction, i, role), 2000);
      } else {
        const modal = new ModalBuilder()
          .setCustomId(`${roleId}:sell_modal`)
          .setTitle('Выставить на продажу')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder().setCustomId('price').setLabel(`Цена (мин. ${LIMITS.MIN_SELL_PRICE})`).setStyle(TextInputStyle.Short).setRequired(true)
            )
          );
        await showAndAwaitModal(modal);
      }
      break;
    }
    case 'price': {
      const modal = new ModalBuilder()
        .setCustomId(`${roleId}:price_modal`)
        .setTitle('Изменить цену')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('price').setLabel(`Цена (мин. ${LIMITS.MIN_SELL_PRICE})`).setStyle(TextInputStyle.Short).setRequired(true)
          )
        );
      await showAndAwaitModal(modal);
      break;
    }
    case 'prolong': {
      
      break;
    }
    case 'delete':
      
      break;
    case 'confirm_delete':
      
      break;
    case 'cancel':
      await showRoleMenu(interaction, i, role);
      break;
  }
}
