import { pool } from '@db/index';

async function resetDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🗑️ Удаление старых таблиц...');
    
    await client.query('DROP TABLE IF EXISTS transactions CASCADE;');
    await client.query('DROP TABLE IF EXISTS users CASCADE;');
    await client.query('DROP TABLE IF EXISTS migrations CASCADE;');
    
    console.log('✅ Таблицы удалены');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

resetDatabase();
