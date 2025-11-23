import { ColorResolvable } from 'discord.js';
import { PersonalRoleService } from '@bot/services/personal-role.service';
import { BalanceService } from '@bot/services/balance.service';
import { TransactionManager } from '@bot/services/transaction-manager';
import { pool } from '@db/index';
import { PRICES, LIMITS } from '../constants';
import { isValidHex } from '../utils';

export async function handleCreate(interaction: any) {
  const color = interaction.options.getString('цвет', true);
  const name = interaction.options.getString('название', true);
  const key = interaction.options.getString('ключ');

  if (!isValidHex(color)) {
    return interaction.editReply('❌ Укажите корректный HEX-цвет (например: #FF5733)');
  }

  if (interaction.guild.roles.cache.size >= LIMITS.MAX_SERVER_ROLES) {
    return interaction.editReply('❌ На сервере достигнут лимит ролей (250)');
  }

  const userRoles = await PersonalRoleService.getUserOwnedRoles(
    interaction.user.id, 
    interaction.guild.id
  );

  if (userRoles.length >= LIMITS.MAX_ROLES_PER_USER) {
    return interaction.editReply(`❌ Максимум ${LIMITS.MAX_ROLES_PER_USER} личных ролей`);
  }

  let usedKey = false;

  if (key) {
    const keyData = await PersonalRoleService.validateKey(key, interaction.user.id);
    if (!keyData) {
      return interaction.editReply('❌ Недействительный ключ');
    }
    usedKey = true;
  } else {
    const client = await pool.connect();
    try {
      await client.query(
        'INSERT INTO users (id, coins, diamonds) VALUES ($1, 0, 0) ON CONFLICT (id) DO NOTHING',
        [interaction.user.id]
      );
    } finally {
      client.release();
    }

    const balance = await BalanceService.get(interaction.user.id);
    if (balance.coins < PRICES.CREATE_ROLE) {
      return interaction.editReply(`❌ Недостаточно монет. Нужно: ${PRICES.CREATE_ROLE} 💰`);
    }
  }

  const role = await interaction.guild.roles.create({
    name,
    color: color as ColorResolvable,
    permissions: [],
    hoist: false,
    mentionable: false,
    reason: `Личная роль для ${interaction.user.tag}`
  });

  await PersonalRoleService.createPersonalRole({
    userId: interaction.user.id,
    guildId: interaction.guild.id,
    roleId: role.id,
    type: 'Owner'
  });

  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO shop_roles (role_id, user_id, name, price, in_shop, purchased)
      VALUES ($1, $2, $3, 0, false, 0)
    `, [role.id, interaction.user.id, name]);
  } finally {
    client.release();
  }

  await interaction.member.roles.add(role);

  if (usedKey && key) {
    await PersonalRoleService.useKey(key);
  } else {
    await TransactionManager.addTransaction({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      amount: -PRICES.CREATE_ROLE,
      currencyType: 'coins',
      reason: 'Создание личной роли',
      metadata: { roleId: role.id }
    });
  }

  await interaction.editReply(
    `✅ Роль ${role} создана! Стоимость: ${usedKey ? '0 (ключ)' : `${PRICES.CREATE_ROLE} 💰`}`
  );
}
