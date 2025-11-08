import { Pool } from 'pg';
import { logger } from '@utils/logger';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : undefined,
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  logger.error('❌ Неожиданная ошибка PostgreSQL:', err);
});

process.on('SIGTERM', async () => {
  logger.info('🔄 Закрытие пула подключений...');
  await pool.end();
  process.exit(0);
});
