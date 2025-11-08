import { spawn, exec } from 'child_process';
import { logger } from './logger';

const REDIS_READY_MESSAGE = 'Ready to accept connections';
let redisProcess: ReturnType<typeof spawn> | null = null;

export function startRedis(): Promise<void> {
  return new Promise((resolve, reject) => {
    exec('redis-cli PING', (error, stdout) => {
      if (!error && stdout.includes('PONG')) {
        logger.info('📡 Redis уже запущен. Используем существующий экземпляр.');
        return resolve();
      }

      logger.info('🚀 Запускаем локальный сервер Redis...');
      redisProcess = spawn('redis-server');

      
      
      if (!redisProcess || !redisProcess.stdout || !redisProcess.stderr) {
        const errorMessage = 'Не удалось создать дочерний процесс для redis-server.';
        logger.error(`💥 ${errorMessage}`);
        return reject(new Error(errorMessage));
      }
      

      redisProcess.stdout.on('data', (data: Buffer) => {
        const message = data.toString();
        
        if (message.includes(REDIS_READY_MESSAGE)) {
          logger.success('✅ Redis сервер готов к работе.');
          resolve();
        }
      });

      redisProcess.stderr.on('data', (data: Buffer) => {
        logger.error('💥 Ошибка сервера Redis:', data.toString());
      });

      redisProcess.on('error', (err) => {
        logger.error('💥 Не удалось запустить процесс redis-server.', err);
        logger.warn('Убедитесь, что Redis установлен и путь к нему добавлен в системную переменную PATH.');
        reject(err);
      });

      redisProcess.on('close', (code) => {
        if (code !== 0) {
            logger.warn(`Процесс Redis завершился с кодом ${code}`);
        }
      });
    });
  });
}

process.on('exit', () => {
    if (redisProcess) {
        logger.info('🔌 Останавливаем дочерний процесс Redis...');
        redisProcess.kill();
    }
});
