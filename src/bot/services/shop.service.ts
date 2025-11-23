import { pool } from '@db/index';
import { BalanceService } from './balance.service';
import { TransactionManager } from './transaction-manager';


export interface ShopRole {
  id: string;
  roleId: string;
  userId: string;
  name: string;
  price: number;
  inShop: boolean;
  purchased: number;
  createdAt: Date;
}


export interface ShopItem {
  id: number;
  name: string;
  type: string;
  price: number;
  value: 'Donate' | 'Standard';
  period?: string;
}

export class ShopService {
  static async getShopRoles(): Promise<ShopRole[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM shop_roles 
        WHERE in_shop = true 
        ORDER BY created_at DESC
      `);
      
      return result.rows.map(row => ({
        id: row.id,
        roleId: row.role_id,
        userId: row.user_id,
        name: row.name,
        price: Number(row.price),
        inShop: row.in_shop,
        purchased: row.purchased || 0,
        createdAt: row.created_at
      }));
    } finally {
      client.release();
    }
  }

  static filterRoles(roles: ShopRole[], filter: string): ShopRole[] {
    
    const sortedRoles = [...roles];

    switch (filter) {
      case 'new':
        return sortedRoles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      case 'old':
        return sortedRoles.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      case 'price_asc':
        return sortedRoles.sort((a, b) => a.price - b.price);
      case 'price_desc':
        return sortedRoles.sort((a, b) => b.price - a.price);
      
      case 'popular':
        return sortedRoles.sort((a, b) => b.purchased - a.purchased);
      
      case 'unpopular':
        return sortedRoles.sort((a, b) => a.purchased - b.purchased);
      default:
        return sortedRoles;
    }
  }

  static async getRoleData(roleId: string): Promise<ShopRole | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM shop_roles WHERE role_id = $1',
        [roleId]
      );
      
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        id: row.id,
        roleId: row.role_id,
        userId: row.user_id,
        name: row.name,
        price: Number(row.price),
        inShop: row.in_shop,
        purchased: row.purchased || 0,
        createdAt: row.created_at
      };
    } finally {
      client.release();
    }
  }

  static async purchaseRole(userId: string, guildId: string, roleId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const roleData = await this.getRoleData(roleId);
      if (!roleData) throw new Error('Role not found');

      
      const commission = Math.round(roleData.price * 0.1);

      
      await client.query(`
        INSERT INTO user_roles (user_id, guild_id, role_id, expires_at)
        VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')
      `, [userId, guildId, roleId]);

      
      await client.query(`
    UPDATE shop_roles 
        SET purchased = purchased + 1 
        WHERE role_id = $1
      `, [roleId]);

      
      await TransactionManager.addTransaction({
        userId,
        guildId,
        amount: -roleData.price,
        currencyType: 'coins',
        reason: 'Покупка роли',
        merchant: roleData.userId,
        metadata: { roleId }
      });

      await TransactionManager.addTransaction({
        userId: roleData.userId,
        guildId,
        amount: commission,
        currencyType: 'coins',
        reason: 'Продажа роли',
        relatedUserId: userId,
        metadata: { roleId }
      });

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getOtherItem(itemId: string): Promise<ShopItem | null> {
    
    const shopItems: ShopItem[] = [
      { id: 0, name: 'Скрыть пол', type: 'Gender', price: 1000, value: 'Standard', period: '30d' },
      { id: 1, name: 'Медиафайлы', type: 'Media', price: 2000, value: 'Standard', period: '30d' },
      { id: 2, name: 'Спонсор', type: 'Sponsor', price: 5000, value: 'Donate', period: '30d' },
      { id: 3, name: 'Личная роль', type: 'PersonalRole', price: 10000, value: 'Donate' },
      { id: 4, name: 'Личная комната', type: 'PersonalRoom', price: 15000, value: 'Donate' },
      { id: 5, name: 'Лотерея', type: 'Lottery', price: 500, value: 'Standard' }
    ];

    return shopItems.find(item => item.id === Number(itemId)) || null;
  }

  static async purchaseOtherItem(userId: string, guildId: string, itemId: string, member: any): Promise<void> {
    const client = await pool.connect();
    const item = await this.getOtherItem(itemId);
    if (!item) throw new Error('Item not found');

    try {
      await client.query('BEGIN');

      
      switch (item.type) {
        case 'Gender':
          await this.handleGenderPurchase(client, userId, guildId, member, item);
          break;
        case 'Media':
          await this.handleMediaPurchase(client, userId, guildId, member, item);
          break;
        case 'Sponsor':
          await this.handleSponsorPurchase(client, userId, guildId, member, item);
          break;
        case 'PersonalRole':
        case 'PersonalRoom':
        case 'Lottery':
          await this.handleKeyPurchase(client, userId, item);
          break;
      }

      
      await TransactionManager.addTransaction({
        userId,
        guildId,
        amount: -item.price,
        currencyType: item.value === 'Donate' ? 'diamonds' : 'coins',
        reason: `Покупка: ${item.name}`,
        metadata: { itemType: item.type, itemId }
      });

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private static async handleGenderPurchase(client: any, userId: string, guildId: string, member: any, item: ShopItem): Promise<void> {
    const expiresAt = item.period ? this.calculateExpiry(item.period) : null;
    
    await client.query(`
      INSERT INTO user_purchases (user_id, guild_id, type, expires_at)
      VALUES ($1, $2, 'gender_hide', $3)
      ON CONFLICT (user_id, guild_id, type) 
      DO UPDATE SET expires_at = $3
    `, [userId, guildId, expiresAt]);
  }

  private static async handleMediaPurchase(client: any, userId: string, guildId: string, member: any, item: ShopItem): Promise<void> {
    const expiresAt = item.period ? this.calculateExpiry(item.period) : null;
    
    await client.query(`
      INSERT INTO user_purchases (user_id, guild_id, type, expires_at)
      VALUES ($1, $2, 'media_files', $3)
      ON CONFLICT (user_id, guild_id, type) 
      DO UPDATE SET expires_at = $3
    `, [userId, guildId, expiresAt]);
  }

  private static async handleSponsorPurchase(client: any, userId: string, guildId: string, member: any, item: ShopItem): Promise<void> {
    const expiresAt = item.period ? this.calculateExpiry(item.period) : null;
    
    await client.query(`
      INSERT INTO user_purchases (user_id, guild_id, type, expires_at)
      VALUES ($1, $2, 'sponsor', $3)
      ON CONFLICT (user_id, guild_id, type) 
      DO UPDATE SET expires_at = $3
    `, [userId, guildId, expiresAt]);
  }

  private static async handleKeyPurchase(client: any, userId: string, item: ShopItem): Promise<void> {
    const code = this.generateKey();
    
    await client.query(`
      INSERT INTO user_keys (user_id, code, type, used)
      VALUES ($1, $2, $3, false)
    `, [userId, code, item.type]);
  }

  private static generateKey(): string {
    const segments = 4;
    const segmentLength = 4;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    
    const key = [];
    for (let i = 0; i < segments; i++) {
      let segment = '';
      for (let j = 0; j < segmentLength; j++) {
        segment += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      key.push(segment);
    }
    
    return key.join('-');
  }

  private static calculateExpiry(period: string): Date {
    const now = new Date();
    const match = period.match(/(\d+)([dhms])/);
    
    if (!match) return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const [, amount, unit] = match;
    const value = parseInt(amount);
    
    switch (unit) {
      case 'd':
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
      case 'h':
        return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'm':
        return new Date(now.getTime() + value * 60 * 1000);
      case 's':
        return new Date(now.getTime() + value * 1000);
      default:
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }
}
