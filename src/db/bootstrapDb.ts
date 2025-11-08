import { pool } from './index';

async function retryConnect(maxRetries = 5, delay = 3000): Promise<boolean> {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      if (i === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return false;
}

async function createTablesIfNotExist() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        coins BIGINT NOT NULL DEFAULT 0,
        diamonds BIGINT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        guild_id TEXT NOT NULL,
        type VARCHAR(20) NOT NULL,
        category VARCHAR(50) NOT NULL,
        amount BIGINT NOT NULL DEFAULT 0,
        balance_after BIGINT NOT NULL DEFAULT 0,
        reason TEXT,
        merchant TEXT,
        related_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        metadata TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_activity (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        total_voice BIGINT NOT NULL DEFAULT 0,
        total_messages BIGINT NOT NULL DEFAULT 0,
        xp BIGINT NOT NULL DEFAULT 0,
        level INT NOT NULL DEFAULT 1,
        xp_for_next_level BIGINT NOT NULL DEFAULT 100,
        last_voice_join TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, guild_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_activity_history (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        date DATE NOT NULL,
        voice_seconds BIGINT NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, guild_id, date)
      );
    `);

    
    await client.query(`CREATE INDEX IF NOT EXISTS user_activity_guild_user_idx ON user_activity(guild_id, user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS transactions_user_guild_idx ON transactions(user_id, guild_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS transactions_category_idx ON transactions(category);`);
    await client.query(`CREATE INDEX IF NOT EXISTS transactions_type_idx ON transactions(type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions(created_at);`);
    await client.query(`CREATE INDEX IF NOT EXISTS transactions_user_guild_created_idx ON transactions(user_id, guild_id, created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS user_activity_history_date_idx ON user_activity_history(date DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS user_activity_history_user_guild_date_idx ON user_activity_history(user_id, guild_id, date DESC);`);
  } finally {
    client.release();
  }
}

export async function initializeDatabase(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL не установлен в .env');
  }

  await retryConnect(5, 3000);
  await createTablesIfNotExist();
}
