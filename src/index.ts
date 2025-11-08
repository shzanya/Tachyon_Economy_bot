import dotenv from 'dotenv';
dotenv.config();

import { bootstrap } from './bootstrap';

bootstrap().catch(err => {
  
  
  console.error('Критическая ошибка при запуске', err);
  process.exit(1);
});
