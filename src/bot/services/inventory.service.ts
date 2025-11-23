import { pool } from '@db/index';

interface UserRole {
  id: string;
  user_id: string;
  guild_id: string;
  role_id: string;
  type: string;
  hidden: boolean;
  created_at: Date;
  expires_at: Date | null;
}

interface UserRoom {
  id: string;
  user_id: string;
  guild_id: string;
  channel_id: string;
  name: string | null;
  created_at: Date;
}

interface UserKey {
  id: string;
  user_id: string;
  code: string;
  type: string;
  used: boolean;
  used_at: Date | null;
  created_at: Date;
}

export class InventoryService {
  static async getUserRoles(userId: string, guildId: string): Promise<UserRole[]> {
    const { rows } = await pool.query<UserRole>(
      `SELECT * FROM user_roles 
       WHERE user_id = $1 AND guild_id = $2 
       ORDER BY created_at DESC`,
      [userId, guildId]
    );
    return rows;
  }

  static async getUserRooms(userId: string, guildId: string): Promise<UserRoom[]> {
    const { rows } = await pool.query<UserRoom>(
      `SELECT * FROM user_rooms 
       WHERE user_id = $1 AND guild_id = $2 
       ORDER BY created_at DESC`,
      [userId, guildId]
    );
    return rows;
  }

  static async getUserKeys(userId: string): Promise<UserKey[]> {
    const { rows } = await pool.query<UserKey>(
      `SELECT * FROM user_keys 
       WHERE user_id = $1 AND used = false AND type != 'Lottery'
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  }

  static async setRoleHidden(userId: string, guildId: string, roleId: string, hidden: boolean): Promise<void> {
    await pool.query(
      `UPDATE user_roles 
       SET hidden = $4 
       WHERE user_id = $1 AND guild_id = $2 AND role_id = $3`,
      [userId, guildId, roleId, hidden]
    );
  }

  static async addUserRole(userId: string, guildId: string, roleId: string, type: string = 'Buy', expiresInDays: number = 30): Promise<void> {
    await pool.query(
      `INSERT INTO user_roles (user_id, guild_id, role_id, type, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${expiresInDays} days')
       ON CONFLICT (user_id, guild_id, role_id) 
       DO UPDATE SET expires_at = NOW() + INTERVAL '${expiresInDays} days'`,
      [userId, guildId, roleId, type]
    );
  }

  static async addUserRoom(userId: string, guildId: string, channelId: string, name?: string): Promise<void> {
    await pool.query(
      `INSERT INTO user_rooms (user_id, guild_id, channel_id, name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, guild_id) DO NOTHING`,
      [userId, guildId, channelId, name]
    );
  }

  static async removeUserRoom(userId: string, guildId: string): Promise<void> {
    await pool.query(
      `DELETE FROM user_rooms WHERE user_id = $1 AND guild_id = $2`,
      [userId, guildId]
    );
  }

  static async useKey(code: string, userId: string): Promise<UserKey | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query<UserKey>(
        `SELECT * FROM user_keys WHERE code = $1 AND user_id = $2 AND used = false FOR UPDATE`,
        [code, userId]
      );

      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query(
        `UPDATE user_keys SET used = true, used_at = NOW() WHERE code = $1`,
        [code]
      );

      await client.query('COMMIT');
      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async cleanExpiredRoles(guildId: string): Promise<number> {
    const { rowCount } = await pool.query(
      `DELETE FROM user_roles 
       WHERE guild_id = $1 AND expires_at IS NOT NULL AND expires_at < NOW()`,
      [guildId]
    );
    return rowCount || 0;
  }

  static async cleanExpiredPurchases(guildId: string): Promise<number> {
    const { rowCount } = await pool.query(
      `DELETE FROM user_purchases 
       WHERE guild_id = $1 AND expires_at IS NOT NULL AND expires_at < NOW()`,
      [guildId]
    );
    return rowCount || 0;
  }
}
