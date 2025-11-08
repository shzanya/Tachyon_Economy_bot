
import { pool } from './index';
import { logger } from '@utils/logger';
import type { UserBalance } from '@types'; 

const MAX_BALANCE = 999_999_999;
const MAX_RETRIES = 3;

export const balanceQueries = {
  async get(userId: string): Promise<UserBalance> {
    const { rows } = await pool.query(
      'SELECT id, coins, diamonds, created_at, updated_at FROM users WHERE id = $1', 
      [userId]
    );
    
    if (rows[0]) {
      return this._normalize(rows[0]);
    }
    
    
    
    const { rows: [newUser] } = await pool.query(
      `INSERT INTO users (id, coins, diamonds)
       VALUES ($1, 0, 0)
       ON CONFLICT (id) DO UPDATE SET updated_at = NOW() -- Обновим updated_at, если запись уже существует
       RETURNING id, coins, diamonds, created_at, updated_at`, 
      [userId]
    );
    
    return this._normalize(newUser);
  },

  async add(userId: string, coins: number = 0, diamonds: number = 0): Promise<UserBalance> {
    if (!Number.isInteger(coins) || !Number.isInteger(diamonds)) {
      throw new Error('Coins и diamonds должны быть целыми числами');
    }
    if (coins < 0 || diamonds < 0) {
      throw new Error('Нельзя добавлять отрицательные значения');
    }

    return this._withRetry(async () => {
      const { rows: [updated] } = await pool.query(
        `INSERT INTO users (id, coins, diamonds)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET
           coins = LEAST(users.coins + $2, $4),
           diamonds = LEAST(users.diamonds + $3, $5),
           updated_at = NOW()
         RETURNING id, coins, diamonds, created_at, updated_at`,
        [userId, coins, diamonds, MAX_BALANCE, MAX_BALANCE]
      );

      return this._normalize(updated);
    });
  },

  async subtract(userId: string, coins: number = 0, diamonds: number = 0): Promise<UserBalance> {
    if (coins < 0 || diamonds < 0) {
      throw new Error('Значения для вычитания должны быть положительными');
    }

    return this._withRetry(async () => {
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');

        
        const { rows: [current] } = await client.query(
          'SELECT coins, diamonds FROM users WHERE id = $1 FOR UPDATE',
          [userId]
        );

        if (!current) {
          
          
          
          throw new Error(`Пользователь ${userId} не найден или недостаточно средств.`);
        }

        const currentCoins = Number(current.coins);
        const currentDiamonds = Number(current.diamonds);

        if (currentCoins < coins) {
          throw new Error(`Недостаточно монет: есть ${currentCoins}, нужно ${coins}`);
        }
        if (currentDiamonds < diamonds) {
          throw new Error(`Недостаточно алмазов: есть ${currentDiamonds}, нужно ${diamonds}`);
        }

        const { rows: [updated] } = await client.query(
          `UPDATE users SET
             coins = coins - $1,
             diamonds = diamonds - $2,
             updated_at = NOW()
           WHERE id = $3
           RETURNING id, coins, diamonds, created_at, updated_at`,
          [coins, diamonds, userId]
        );

        await client.query('COMMIT');
        return this._normalize(updated);

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });
  },

  async update(userId: string, coins: number, diamonds: number): Promise<UserBalance> {
    if (coins < 0 || diamonds < 0) {
      throw new Error('Баланс не может быть отрицательным');
    }
    if (coins > MAX_BALANCE || diamonds > MAX_BALANCE) {
      throw new Error(`Баланс превышает лимит ${MAX_BALANCE}`);
    }

    const { rows: [updated] } = await pool.query(
      `UPDATE users SET
         coins = $1,
         diamonds = $2,
         updated_at = NOW()
       WHERE id = $3
       RETURNING id, coins, diamonds, created_at, updated_at`,
      [coins, diamonds, userId]
    );

    
    if (!updated) {
        throw new Error(`Пользователь с ID ${userId} не найден для обновления.`);
    }

    return this._normalize(updated);
  },

  async batchAdd(updates: Array<{ userId: string; coins?: number; diamonds?: number }>): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      
      
      
      
      
      await Promise.all(updates.map(async ({ userId, coins = 0, diamonds = 0 }) => {
        if (!Number.isInteger(coins) || !Number.isInteger(diamonds)) {
          throw new Error(`Некорректные значения для пользователя ${userId}: coins: ${coins}, diamonds: ${diamonds}`);
        }
        if (coins < 0 || diamonds < 0) {
          throw new Error(`Нельзя добавлять отрицательные значения для пользователя ${userId}`);
        }

        await client.query(
          `INSERT INTO users (id, coins, diamonds)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET
             coins = LEAST(users.coins + $2, $4),
             diamonds = LEAST(users.diamonds + $3, $5),
             updated_at = NOW()`,
          [userId, coins, diamonds, MAX_BALANCE, MAX_BALANCE]
        );
      }));

      await client.query('COMMIT');
      logger.success(`✅ Batch: обновлено ${updates.length} пользователей`);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async getStats() {
    const { rows: [stats] } = await pool.query(`
      SELECT 
        COUNT(*)::int as total_users,
        COALESCE(SUM(coins)::bigint, 0) as total_coins,
        COALESCE(SUM(diamonds)::bigint, 0) as total_diamonds,
        COALESCE(AVG(coins)::numeric, 0) as avg_coins,
        COALESCE(AVG(diamonds)::numeric, 0) as avg_diamonds
      FROM users
    `);

    
    return {
      totalUsers: stats.total_users || 0,
      totalCoins: Number(stats.total_coins) || 0,
      totalDiamonds: Number(stats.total_diamonds) || 0,
      avgCoins: parseFloat(stats.avg_coins) || 0, 
      avgDiamonds: parseFloat(stats.avg_diamonds) || 0, 
    };
  },

  async _withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await operation();
      } catch (error: any) {
        attempt++;
        
        
        const isDeadlockOrSerializationFailure = error.code === '40P01' || error.code === '40001';
        
        if (isDeadlockOrSerializationFailure && attempt < MAX_RETRIES) {
          const delay = Math.min(100 * Math.pow(2, attempt), 1000); 
          logger.warn(`⚠️ Deadlock/Serialization Failure, retry ${attempt}/${MAX_RETRIES} через ${delay}ms: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error; 
      }
    }
  },

  _normalize(row: any): UserBalance {
    
    return {
      id: row.id,
      coins: Number(row.coins),
      diamonds: Number(row.diamonds),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  },
};
