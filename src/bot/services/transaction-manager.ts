import { pool } from '@db/index';
import { TransactionCategorizer } from './transaction-categorizer';
import type { Transaction, TransactionType, TransactionCategory } from '@types';

export class TransactionManager {
  static async addTransaction(data: {
    userId: string;
    guildId: string;
    amount: number;
    currencyType: 'coins' | 'diamonds';
    reason: string;
    merchant?: string;
    relatedUserId?: string;
    metadata?: Record<string, any>;
  }): Promise<Transaction> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const field = data.currencyType === 'coins' ? 'coins' : 'diamonds';

      
      if (data.amount < 0) {
        const { rows: [current] } = await client.query(
          `SELECT ${field} FROM users WHERE id = $1 FOR UPDATE`,
          [data.userId]
        );
        
        if (!current || current[field] < Math.abs(data.amount)) {
          throw new Error(`Недостаточно ${data.currencyType === 'coins' ? 'монет' : 'алмазов'}`);
        }
      }

      
      const { rows: [user] } = await client.query(
        `INSERT INTO users (id, coins, diamonds)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET
           ${field} = users.${field} + $4,
           updated_at = NOW()
         RETURNING *`,
        [
          data.userId,
          data.currencyType === 'coins' ? Math.max(0, data.amount) : 0,
          data.currencyType === 'diamonds' ? Math.max(0, data.amount) : 0,
          data.amount
        ]
      );

      const [type, category] = TransactionCategorizer.categorize(
        data.reason,
        data.merchant,
        data.relatedUserId
      );

      const balanceAfter = Number(user[field]);

      
      const { rows: [transaction] } = await client.query<Transaction>(
        `INSERT INTO transactions (
          user_id, guild_id, type, category, amount, balance_after,
          reason, merchant, related_user_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          data.userId,
          data.guildId,
          data.amount >= 0 ? 'income' : 'expense',
          category,
          data.amount,
          balanceAfter,
          data.reason,
          data.merchant || null,
          data.relatedUserId || null,
          data.metadata ? JSON.stringify({
            ...data.metadata,
            currencyType: data.currencyType
          }) : JSON.stringify({ currencyType: data.currencyType })
        ]
      );

      await client.query('COMMIT');
      return transaction;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getTransactions(
    userId: string,
    guildId: string,
    options?: {
      type?: TransactionType;
      category?: TransactionCategory;
      limit?: number;
      offset?: number;
    }
  ): Promise<Transaction[]> {
    let query = `SELECT * FROM transactions WHERE user_id = $1 AND guild_id = $2`;
    const params: any[] = [userId, guildId];
    let paramIndex = 3;

    if (options?.type) {
      query += ` AND type = $${paramIndex}`;
      params.push(options.type);
      paramIndex++;
    }

    if (options?.category) {
      query += ` AND category = $${paramIndex}`;
      params.push(options.category);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(options?.limit || 1000, options?.offset || 0);

    const { rows } = await pool.query<Transaction>(query, params);
    return rows;
  }








  static async getAnalytics(
    userId: string,
    guildId: string,
    period: 'day' | 'week' | 'month' | 'year'
  ): Promise<Array<{ type: TransactionType; category: TransactionCategory; total: number; count: number; average: number }>> {
    const periodMap = {
      day: "NOW() - INTERVAL '1 day'",
      week: "NOW() - INTERVAL '7 days'",
      month: "NOW() - INTERVAL '30 days'",
      year: "NOW() - INTERVAL '365 days'",
    };
  
    const { rows } = await pool.query(
      `SELECT 
        CASE 
          WHEN type = 'transfer' AND amount < 0 THEN 'expense'
          WHEN type = 'transfer' AND amount > 0 THEN 'income'
          ELSE type
        END as type,
        category,
        SUM(ABS(amount))::bigint as total,
        COUNT(*)::int as count,
        AVG(ABS(amount))::numeric as average
      FROM transactions
      WHERE user_id = $1 
        AND guild_id = $2 
        AND created_at >= ${periodMap[period]}
      GROUP BY 
        CASE 
          WHEN type = 'transfer' AND amount < 0 THEN 'expense'
          WHEN type = 'transfer' AND amount > 0 THEN 'income'
          ELSE type
        END,
        category
      ORDER BY total DESC`,
      [userId, guildId]
    );
  
    return rows.map(row => ({
      type: row.type as TransactionType,
      category: row.category as TransactionCategory,
      total: Number(row.total),
      count: row.count,
      average: Number(row.average),
    }));
  }






  static async createTransfer(
    senderId: string,
    recipientId: string,
    guildId: string,
    amount: number,
    reason: string
  ): Promise<{ senderTx: Transaction; recipientTx: Transaction }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      
      const { rows: [sender] } = await client.query(
        'SELECT coins FROM users WHERE id = $1 FOR UPDATE',
        [senderId]
      );

      if (!sender || sender.coins < amount) {
        throw new Error('Недостаточно монет');
      }

      
      const { rows: [updatedSender] } = await client.query(
        `UPDATE users SET coins = coins - $1, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [amount, senderId]
      );

      const { rows: [updatedRecipient] } = await client.query(
        `INSERT INTO users (id, coins, diamonds)
         VALUES ($1, $2, 0)
         ON CONFLICT (id) DO UPDATE SET
           coins = users.coins + $2,
           updated_at = NOW()
         RETURNING *`,
        [recipientId, amount]
      );

      
      const { rows: [senderTx] } = await client.query<Transaction>(
        `INSERT INTO transactions (
          user_id, guild_id, type, category, amount, balance_after,
          reason, related_user_id
        ) VALUES ($1, $2, 'transfer', 'p2p', $3, $4, $5, $6)
        RETURNING *`,
        [senderId, guildId, -amount, updatedSender.coins, reason, recipientId]
      );

      const { rows: [recipientTx] } = await client.query<Transaction>(
        `INSERT INTO transactions (
          user_id, guild_id, type, category, amount, balance_after,
          reason, related_user_id
        ) VALUES ($1, $2, 'transfer', 'p2p', $3, $4, $5, $6)
        RETURNING *`,
        [recipientId, guildId, amount, updatedRecipient.coins, `Перевод от пользователя`, senderId]
      );

      await client.query('COMMIT');
      return { senderTx, recipientTx };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
