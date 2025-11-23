import { pool } from '@db/index';

interface PersonalRole {
  id: string;
  user_id: string;
  guild_id: string;
  role_id: string;
  type: 'Owner' | 'Buy';
  hidden: boolean;
  created_at: Date;
  expires_at: Date | null;
}

interface ShopRole {
  id: string;
  role_id: string;
  user_id: string;
  name: string;
  price: number;
  in_shop: boolean;
  purchased: number;
  created_at: Date;
  updated_at: Date;
}

export class PersonalRoleService {
  static async createPersonalRole(data: {
    userId: string;
    guildId: string;
    roleId: string;
    type: 'Owner' | 'Buy';
  }): Promise<void> {
    await pool.query(
      `INSERT INTO user_roles (user_id, guild_id, role_id, type)
       VALUES ($1, $2, $3, $4)`,
      [data.userId, data.guildId, data.roleId, data.type]
    );
  }

  static async getUserOwnedRoles(userId: string, guildId: string): Promise<PersonalRole[]> {
    const { rows } = await pool.query<PersonalRole>(
      `SELECT * FROM user_roles 
       WHERE user_id = $1 AND guild_id = $2 AND type = 'Owner'
       ORDER BY created_at DESC`,
      [userId, guildId]
    );
    return rows;
  }

  static async getRoleInfo(roleId: string): Promise<ShopRole | null> {
    const { rows } = await pool.query<ShopRole>(
      `SELECT * FROM shop_roles WHERE role_id = $1`,
      [roleId]
    );
    return rows[0] || null;
  }

  static async getRoleMembers(roleId: string, guildId: string): Promise<PersonalRole[]> {
    const { rows } = await pool.query<PersonalRole>(
      `SELECT * FROM user_roles 
       WHERE role_id = $1 AND guild_id = $2`,
      [roleId, guildId]
    );
    return rows;
  }

  static async updateRoleName(roleId: string, name: string): Promise<void> {
    await pool.query(
      `UPDATE shop_roles SET name = $2, updated_at = NOW() WHERE role_id = $1`,
      [roleId, name]
    );
  }

  static async updateRolePrice(roleId: string, price: number): Promise<void> {
    await pool.query(
      `UPDATE shop_roles SET price = $2, updated_at = NOW() WHERE role_id = $1`,
      [roleId, price]
    );
  }

  static async setRoleInShop(roleId: string, inShop: boolean): Promise<void> {
    const client = await pool.connect();
    try {
      if (inShop) {
        
        const { rows } = await client.query(
          `SELECT * FROM shop_roles WHERE role_id = $1`,
          [roleId]
        );

        if (rows.length === 0) {
          
          await client.query(
            `INSERT INTO shop_roles (role_id, user_id, name, price, in_shop)
             SELECT role_id, user_id, $2, 1000, true
             FROM user_roles 
             WHERE role_id = $1 AND type = 'Owner'
             LIMIT 1`,
            [roleId, 'Личная роль']
          );
        } else {
          await client.query(
            `UPDATE shop_roles SET in_shop = true WHERE role_id = $1`,
            [roleId]
          );
        }
      } else {
        
        await client.query(
          `UPDATE shop_roles SET in_shop = false WHERE role_id = $1`,
          [roleId]
        );
      }
    } finally {
      client.release();
    }
  }

  static async deleteRole(roleId: string, guildId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      
      await client.query(
        `DELETE FROM user_roles WHERE role_id = $1 AND guild_id = $2`,
        [roleId, guildId]
      );

      
      await client.query(
        `DELETE FROM shop_roles WHERE role_id = $1`,
        [roleId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async giveRole(roleId: string, userId: string, guildId: string): Promise<void> {
    await pool.query(
      `INSERT INTO user_roles (user_id, guild_id, role_id, type, expires_at)
       VALUES ($1, $2, $3, 'Buy', NOW() + INTERVAL '30 days')
       ON CONFLICT (user_id, guild_id, role_id) 
       DO UPDATE SET expires_at = NOW() + INTERVAL '30 days'`,
      [userId, guildId, roleId]
    );
  }

  static async takeRole(roleId: string, userId: string, guildId: string): Promise<void> {
    await pool.query(
      `DELETE FROM user_roles 
       WHERE role_id = $1 AND user_id = $2 AND guild_id = $3 AND type = 'Buy'`,
      [roleId, userId, guildId]
    );
  }

  static async validateKey(code: string, userId: string): Promise<any> {
    const { rows } = await pool.query(
      `SELECT * FROM user_keys 
       WHERE code = $1 AND user_id = $2 AND used = false AND type = 'PersonalRole'`,
      [code, userId]
    );
    return rows[0] || null;
  }

  static async useKey(code: string): Promise<void> {
    await pool.query(
      `UPDATE user_keys SET used = true, used_at = NOW() WHERE code = $1`,
      [code]
    );
  }

  static async prolongRole(roleId: string, userId: string, guildId: string, days: number = 30): Promise<void> {
    await pool.query(
      `UPDATE user_roles 
       SET expires_at = COALESCE(expires_at, NOW()) + INTERVAL '${days} days'
       WHERE role_id = $1 AND user_id = $2 AND guild_id = $3`,
      [roleId, userId, guildId]
    );
  }

  static async getOwnerByRoleId(roleId: string, guildId: string): Promise<string | null> {
    const { rows } = await pool.query(
      `SELECT user_id FROM user_roles 
       WHERE role_id = $1 AND guild_id = $2 AND type = 'Owner'`,
      [roleId, guildId]
    );
    return rows[0]?.user_id || null;
  }

  static async cleanExpiredRoles(guildId: string): Promise<number> {
    const { rowCount } = await pool.query(
      `DELETE FROM user_roles 
       WHERE guild_id = $1 
       AND type = 'Buy' 
       AND expires_at IS NOT NULL 
       AND expires_at < NOW()`,
      [guildId]
    );
    return rowCount || 0;
  }
}
