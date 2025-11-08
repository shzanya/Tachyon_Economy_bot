
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
      logger.warn(`⚠️ Попытка подключения ${i}/${maxRetries} не удалась: ${error instanceof Error ? error.message : String(error)}`);
      
      if (i === maxRetries) {
        throw error;
      }
      
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
      )
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
        metadata JSONB DEFAULT '{}', -- Изменено на JSONB для более гибких метаданных
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    
    await client.query(`
      CREATE INDEX IF NOT EXISTS transactions_user_idx ON transactions(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS transactions_guild_idx ON transactions(guild_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS transactions_type_idx ON transactions(type)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS transactions_category_idx ON transactions(category)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions(created_at) DESC -- Добавил DESC для запросов по времени
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS transactions_user_guild_created_idx 
      ON transactions(user_id, guild_id, created_at DESC)
    `); 

    logger.success('✅ Таблицы и индексы созданы/проверены.');
  } finally {
    client.release();
  }
}

export async function initializeDatabase(): Promise<void> {
  logger.section('База данных (CockroachDB)', '💾');
  const spinner = logger.spinner('Подключение к CockroachDB...');
  spinner.start();

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL не установлен в .env файле');
    }

    spinner.text = 'Установка соединения...';
    await retryConnect(5, 3000);
    
    spinner.text = 'Создание/проверка таблиц...';
    await createTablesIfNotExist();
    
    spinner.succeed('База данных CockroachDB готова к работе.');
    
    
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'transactions', 'user_activity') -- Добавил user_activity
        ORDER BY table_name
      `);
      
      if (rows.length > 0) {
        logger.info(`📊 Обнаружены таблицы: ${rows.map(r => r.table_name).join(', ')}`);
      } else {
        logger.warn('⚠️ Не удалось обнаружить основные таблицы.');
      }
    } finally {
      client.release();
    }
    
    logger.sectionEnd();
  } catch (err) {
    spinner.fail('Не удалось подключиться или инициализировать CockroachDB.');
    logger.error('Ошибка инициализации CockroachDB:', err as Error);
    process.exit(1);
  }
}
