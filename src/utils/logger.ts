import chalk from 'chalk';
import gradient from 'gradient-string';
import cliProgress from 'cli-progress';
import boxen from 'boxen';
import ora from 'ora';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

// 🔥 Оранжевая палитра
const orangeGradient = gradient(['#ff6b35', '#ff8c42', '#ffa600']);
const orangePinkGradient = gradient(['#ff6b35', '#ff8c42', '#ff4e50']);
const successGradient = gradient(['#f7971e', '#ffd200']);
const errorGradient = gradient(['#eb3349', '#f45c43']);
const infoGradient = gradient(['#ff8c42', '#ffa600', '#ffcc00']);
const warningGradient = gradient(['#ff6b35', '#f7971e']);
const accentGradient = gradient(['#ff4e50', '#ff6b35', '#ffa600']);

const logsDir = path.resolve('logs');
if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });

const fileLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info',
    }),
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
    }),
  ],
});

class Logger {
  private progressBar: cliProgress.SingleBar | null = null;

  info(message: string, meta?: any) {
    const icon = chalk.hex('#ffa600')('●');
    const text = infoGradient(message);
    console.log(`${icon} ${text}`);
    fileLogger.info(message, meta);
  }

  success(message: string, meta?: any) {
    const icon = chalk.hex('#ffd200')('✓');
    const text = successGradient(message);
    console.log(`${icon} ${text}`);
    fileLogger.info(message, meta);
  }

  successQuiet(message: string) {
    const icon = chalk.hex('#ffd200')('✓');
    const text = orangeGradient(message);
    console.log(`  ${icon} ${text}`);
  }

  error(message: string, error?: any) {
    const icon = chalk.hex('#eb3349')('✖');
    const text = errorGradient(message);
    console.log(`${icon} ${text}`);
    if (error?.stack) console.log(chalk.red(error.stack));
    fileLogger.error(message, { error: error?.message || error });
  }

  warn(message: string, meta?: any) {
    const icon = chalk.hex('#ff6b35')('⚠');
    const text = warningGradient(message);
    console.log(`${icon} ${text}`);
    fileLogger.warn(message, meta);
  }

  debug(message: string, meta?: any) {
    const icon = chalk.hex('#ff8c42')('◆');
    console.log(`${icon} ${chalk.gray(message)}`);
    fileLogger.debug(message, meta);
  }

  box(message: string, title?: string, variant: 'orange' | 'success' | 'error' = 'orange') {
    const gradientMap = {
      orange: orangePinkGradient,
      success: successGradient,
      error: errorGradient,
    };

    const colorMap = {
      orange: '#ff6b35',
      success: '#ffd200',
      error: '#eb3349',
    };

    console.log(
      boxen(gradientMap[variant](message), {
        padding: 1,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
        borderStyle: 'round',
        borderColor: colorMap[variant] as any,
        title: title,
        titleAlignment: 'center',
      })
    );
  }

  spinner(text: string) {
    return ora({
      text: orangeGradient(text),
      spinner: {
        interval: 80,
        frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
      },
      color: 'yellow',
    });
  }

  createProgress(total: number, startValue = 0) {
    this.progressBar = new cliProgress.SingleBar(
      {
        format: (options: any, params: any, payload: any) => {
          const percentage = Math.floor((params.value / params.total) * 100);
          const barLength = 30;
          const completeLength = Math.round((barLength * params.value) / params.total);
          const incompleteLength = barLength - completeLength;
          
          const bar = 
            chalk.hex('#ff6b35')('▓'.repeat(completeLength)) +
            chalk.hex('#ffa600')('░'.repeat(incompleteLength));
          
          return (
            '  ' + bar + ' ' +
            accentGradient(`${percentage}%`) + ' ' +
            chalk.dim(`(${params.value}/${params.total})`) + ' ' +
            orangeGradient(payload.status || '')
          );
        },
        barCompleteChar: '▓',
        barIncompleteChar: '░',
        hideCursor: true,
        fps: 30,
        clearOnComplete: false,
        stopOnComplete: false,
      },
      cliProgress.Presets.shades_classic
    );

    this.progressBar.start(total, startValue, { status: 'Initializing...' });
    return this.progressBar;
  }

  updateProgress(value: number, status?: string) {
    if (this.progressBar) {
      this.progressBar.update(value, { status: status || 'Processing...' });
    }
  }

  stopProgress(finalStatus?: string) {
    if (this.progressBar) {
      if (finalStatus) {
        this.progressBar.update(this.progressBar.getTotal(), {
          status: finalStatus,
        });
      }
      this.progressBar.stop();
      this.progressBar = null;
      process.stdout.write('\x1B[?25h');
    }
  }

  statsCompact(data: Record<string, string | number>) {
    const entries = Object.entries(data);
    const formatted = entries
      .map(([key, value]) => `${chalk.dim(key)}: ${orangeGradient(String(value))}`)
      .join(chalk.dim(' • '));
    console.log(`  ${formatted}`);
  }

  section(title: string, icon?: string) {
    const prefix = icon || '▸';
    console.log('\n' + accentGradient(`${prefix} ${title}`));
    console.log(chalk.hex('#ff8c42')('━'.repeat(62)));
  }

  sectionEnd() {
    // Empty
  }

  banner() {
    const banner = `
████████╗ █████╗  ██████╗██╗  ██╗██╗   ██╗ ██████╗ ███╗   ██╗
╚══██╔══╝██╔══██╗██╔════╝██║  ██║╚██╗ ██╔╝██╔═══██╗████╗  ██║
   ██║   ███████║██║     ███████║ ╚████╔╝ ██║   ██║██╔██╗ ██║
   ██║   ██╔══██║██║     ██╔══██║  ╚██╔╝  ██║   ██║██║╚██╗██║
   ██║   ██║  ██║╚██████╗██║  ██║   ██║   ╚██████╔╝██║ ╚████║
   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═══╝
    `;
    console.log(orangePinkGradient(banner));
    
    const divider = chalk.hex('#ff8c42')('━'.repeat(62));
    const subtitle = 
      chalk.hex('#ffa600')('⚡ Economy Bot') +
      chalk.dim(' • ') +
      orangeGradient('by shanya') +
      chalk.dim(' • ') +
      chalk.hex('#ffcc00')('2025');
    
    console.log(divider);
    console.log(' ' + subtitle);
    console.log(divider);
    console.log();
  }

  clear() {
    console.clear();
  }

  newLine() {
    console.log();
  }
}

export const logger = new Logger();
