

import { PersonalRoleService } from "@bot/services/personal-role.service";
import { BalanceService } from "@bot/services/balance.service";
import { TransactionManager } from "@bot/services/transaction-manager";
import { pool } from "@db/index";
import { PRICES } from "../../constants";
import { showRoleMenu } from "../../ui/role-menu";

export async function handleUserSelect(interaction: any, i: any) {
  const [roleId, action] = i.customId.split(":");
  const role = interaction.guild.roles.cache.get(roleId);
  const target = i.members.first();

  if (!role || !target) {
    return i.update({ content: "❌ Не удалось найти роль или пользователя.", components: [] });
  }

  if (target.id === interaction.user.id) {
    return i.update({ content: "❌ Вы не можете выбрать самого себя.", components: [] });
  }

  const client = await pool.connect();
  try {
    await client.query("INSERT INTO users (id, coins, diamonds) VALUES ($1, 0, 0) ON CONFLICT (id) DO NOTHING", [interaction.user.id]);
  } finally {
    client.release();
  }

  const balance = await BalanceService.get(interaction.user.id);

  if (action === "give_user") {
    if (balance.coins < PRICES.GIVE_ROLE) {
      return i.update({ content: `❌ Недостаточно средств. Нужно: ${PRICES.GIVE_ROLE} 💰`, components: [] });
    }
    await PersonalRoleService.giveRole(roleId, target.id, interaction.guild.id);
    await target.roles.add(role);

    
    await TransactionManager.addTransaction({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      amount: -PRICES.GIVE_ROLE,
      currencyType: 'coins',
      reason: 'Выдача личной роли',
      relatedUserId: target.id,
      metadata: { roleId }
    });

    await i.update({ content: `✅ Роль ${role} выдана пользователю ${target}. Списано: ${PRICES.GIVE_ROLE} 💰`, components: [] });
  } else if (action === "take_user") {
    if (balance.coins < PRICES.TAKE_ROLE) {
      return i.update({ content: `❌ Недостаточно средств. Нужно: ${PRICES.TAKE_ROLE} 💰`, components: [] });
    }
    await PersonalRoleService.takeRole(roleId, target.id, interaction.guild.id);
    await target.roles.remove(role);

    
    await TransactionManager.addTransaction({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      amount: -PRICES.TAKE_ROLE,
      currencyType: 'coins',
      reason: 'Снятие личной роли',
      relatedUserId: target.id,
      metadata: { roleId }
    });

    await i.update({ content: `✅ Роль ${role} снята с пользователя ${target}. Списано: ${PRICES.TAKE_ROLE} 💰`, components: [] });
  }

  setTimeout(() => {
    const interactionProxy = {
      update: async (data: any) => interaction.editReply(data),
      guild: i.guild,
      user: i.user,
    };
    showRoleMenu(interaction, interactionProxy, role);
  }, 2500);
}
