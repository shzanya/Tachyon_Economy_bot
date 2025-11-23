import { pool } from './index';
import { logger } from '@utils/logger';

async function retryConnect(maxRetries = 5, delay = 3000): Promise<boolean> {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      logger.warn(`⚠️ Попытка ${i}/${maxRetries}: ${error instanceof Error ? error.message : String(error)}`);
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
        metadata JSONB DEFAULT '{}',
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

    
    await client.query(`
      CREATE TABLE IF NOT EXISTS shop_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role_id TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price BIGINT NOT NULL DEFAULT 0,
        in_shop BOOLEAN NOT NULL DEFAULT true,
        purchased INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'Buy',
        hidden BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        UNIQUE(user_id, guild_id, role_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL UNIQUE,
        name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, guild_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_purchases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        type TEXT NOT NULL,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, guild_id, type)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        used BOOLEAN NOT NULL DEFAULT false,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    
    await client.query(`CREATE INDEX IF NOT EXISTS user_activity_guild_user_idx ON user_activity(guild_id, user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS transactions_user_guild_idx ON transactions(user_id, guild_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS transactions_category_idx ON transactions(category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS transactions_type_idx ON transactions(type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions(created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS transactions_user_guild_created_idx ON transactions(user_id, guild_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS user_activity_history_date_idx ON user_activity_history(date DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS user_activity_history_user_guild_date_idx ON user_activity_history(user_id, guild_id, date DESC)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS shop_roles_user_idx ON shop_roles(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS shop_roles_in_shop_idx ON shop_roles(in_shop)`);
    await client.query(`CREATE INDEX IF NOT EXISTS shop_roles_price_idx ON shop_roles(price)`);
    
    await client.query(`CREATE INDEX IF NOT EXISTS user_roles_user_guild_idx ON user_roles(user_id, guild_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS user_roles_expires_idx ON user_roles(expires_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS user_rooms_user_guild_idx ON user_rooms(user_id, guild_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS user_purchases_user_guild_idx ON user_purchases(user_id, guild_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS user_purchases_expires_idx ON user_purchases(expires_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS user_keys_user_idx ON user_keys(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS user_keys_code_idx ON user_keys(code)`);
    await client.query(`CREATE INDEX IF NOT EXISTS user_keys_used_idx ON user_keys(used)`);

    logger.success('✅ Таблицы созданы');
  } finally {
    client.release();
  }
}

export async function initializeDatabase(): Promise<void> {
  logger.section('База данных', '💾');
  const spinner = logger.spinner('Подключение...');
  spinner.start();

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL не установлен');
    }

    await retryConnect(5, 3000);
    await createTablesIfNotExist();
    
    spinner.succeed('БД готова');

    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      
      logger.info(`📊 Таблиц: ${rows.length}`);
    } finally {
      client.release();
    }
    
    logger.sectionEnd();
  } catch (err) {
    spinner.fail('Ошибка БД');
    logger.error('Ошибка:', err as Error);
    process.exit(1);
  }
}
