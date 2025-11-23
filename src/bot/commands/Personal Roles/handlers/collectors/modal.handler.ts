

import {
    ColorResolvable,
    ModalSubmitInteraction,
    CacheType,
    
    ChatInputCommandInteraction,
  } from "discord.js";
  import { PersonalRoleService } from "@bot/services/personal-role.service";
  import { BalanceService } from "@bot/services/balance.service";
  import { TransactionManager } from "@bot/services/transaction-manager";
  import { pool } from "@db/index";
  import { PRICES, LIMITS } from "../../constants";
  import { isValidHex } from "../../utils";
  import { showRoleMenu } from "../../ui/role-menu";
  
  
  export async function handleModal(
    interaction: ChatInputCommandInteraction<CacheType>,
    modalInteraction: ModalSubmitInteraction<CacheType>
  ) {
    const [roleId, modalType] = modalInteraction.customId.split(":");
    const role = modalInteraction.guild?.roles.cache.get(roleId);
  
    if (!role) {
      return modalInteraction.reply({
        content: "❌ Роль, которую вы пытаетесь изменить, больше не существует.",
        ephemeral: true,
      });
    }
  
    const client = await pool.connect();
    try {
      await client.query(
        "INSERT INTO users (id, coins, diamonds) VALUES ($1, 0, 0) ON CONFLICT (id) DO NOTHING",
        [interaction.user.id]
      );
    } finally {
      client.release();
    }
  
    
    switch (modalType) {
      case "name_modal": {
        const newName = modalInteraction.fields.getTextInputValue("name");
        if (newName === role.name) {
          return modalInteraction.reply({ content: "❌ Вы указали то же самое название.", ephemeral: true });
        }
  
        const balance = await BalanceService.get(interaction.user.id);
        if (balance.coins < PRICES.SET_NAME) {
          return modalInteraction.reply({ content: `❌ Недостаточно средств. Нужно: ${PRICES.SET_NAME} 💰`, ephemeral: true });
        }
  
        const oldName = role.name;
        await role.setName(newName);
        await PersonalRoleService.updateRoleName(roleId, newName);
        await TransactionManager.addTransaction({
          userId: interaction.user.id,
          guildId: interaction.guildId!,
          amount: -PRICES.SET_NAME,
          currencyType: "coins",
          reason: "Изменение названия роли",
          metadata: { roleId, oldName, newName },
        });
  
        await modalInteraction.reply({ content: `✅ Название успешно изменено на **${newName}**. Списано: ${PRICES.SET_NAME} 💰`, ephemeral: true });
        break;
      }
  
      case "color_modal": {
        const newColor = modalInteraction.fields.getTextInputValue("color");
        if (!isValidHex(newColor)) {
          return modalInteraction.reply({ content: "❌ Вы ввели неверный HEX-код цвета. Пример: `#FF5733`.", ephemeral: true });
        }
        if (newColor.toUpperCase() === role.hexColor) {
          return modalInteraction.reply({ content: "❌ Вы указали тот же самый цвет.", ephemeral: true });
        }
  
        const balance = await BalanceService.get(interaction.user.id);
        if (balance.coins < PRICES.SET_COLOR) {
          return modalInteraction.reply({ content: `❌ Недостаточно средств. Нужно: ${PRICES.SET_COLOR} 💰`, ephemeral: true });
        }
        
        const oldColor = role.hexColor;
        await role.setColor(newColor as ColorResolvable);
        await TransactionManager.addTransaction({
          userId: interaction.user.id,
          guildId: interaction.guildId!,
          amount: -PRICES.SET_COLOR,
          currencyType: "coins",
          reason: "Изменение цвета роли",
          metadata: { roleId, oldColor, newColor },
        });
  
        await modalInteraction.reply({ content: `✅ Цвет успешно изменен на **${newColor}**. Списано: ${PRICES.SET_COLOR} 💰`, ephemeral: true });
        break;
      }
  
      case "price_modal": {
        const price = parseInt(modalInteraction.fields.getTextInputValue("price"));
        if (isNaN(price) || price < LIMITS.MIN_SELL_PRICE) {
          return modalInteraction.reply({ content: `❌ Цена должна быть числом, не меньше ${LIMITS.MIN_SELL_PRICE}.`, ephemeral: true });
        }
        await PersonalRoleService.updateRolePrice(roleId, price);
        await modalInteraction.reply({ content: `✅ Цена роли в магазине успешно изменена на **${price}** 💰.`, ephemeral: true });
        break;
      }
  
      case "sell_modal": {
        const sellPrice = parseInt(modalInteraction.fields.getTextInputValue("price"));
        if (isNaN(sellPrice) || sellPrice < LIMITS.MIN_SELL_PRICE) {
          return modalInteraction.reply({ content: `❌ Цена должна быть числом, не меньше ${LIMITS.MIN_SELL_PRICE}.`, ephemeral: true });
        }
        await PersonalRoleService.setRoleInShop(roleId, true);
        await PersonalRoleService.updateRolePrice(roleId, sellPrice);
        await modalInteraction.reply({ content: `✅ Роль успешно выставлена на продажу за **${sellPrice}** 💰.`, ephemeral: true });
        break;
      }
    }
  
    
    setTimeout(async () => {
      showRoleMenu(
        interaction,
        { update: (data: any) => interaction.editReply(data) },
        role
      );
    }, 1500);
  }
