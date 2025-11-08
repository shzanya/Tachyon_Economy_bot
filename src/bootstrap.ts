import { ShinoaBot } from '@bot/shinoa.bot';
import { initializeDatabase } from './db/bootstrapDb';
import { logger } from '@utils/logger';
import { startRedis } from '@utils/redis-launcher'; 
import { initializeRedis } from '@db/redis';

export async function bootstrap() {
  logger.clear();
  logger.banner();
  
  const spinner = logger.spinner('Инициализация системы...');
  spinner.start();
  
  try {
    
    spinner.text = 'Запуск Redis...';
    await startRedis();
    
    
    spinner.text = 'Подключение к базе данных...';
    await initializeDatabase(); 
    await initializeRedis();
    
    
    spinner.text = 'Запуск Discord бота...';
    const bot = new ShinoaBot();
    await bot.start();
    
    spinner.succeed('Система готова к работе');
    logger.newLine();
    
  } catch (error) {
    spinner.fail('Ошибка запуска');
    logger.newLine();
    logger.box(
      'Критическая ошибка при запуске.\nПроверьте логи для деталей.',
      '❌ ОШИБКА',
      'error'
    );
    
    if (error instanceof Error) {
      logger.error('Детали:', error);
    }
    process.exit(1);
  }
}
