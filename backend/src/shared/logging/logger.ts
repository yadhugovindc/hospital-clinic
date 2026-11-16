import pino from 'pino';
import { env } from '../../config/env.js';

/** App-wide JSON logger. Human-readable pretty output in development only. */
export const logger = pino(
  env.NODE_ENV === 'development'
    ? {
        level: env.LOG_LEVEL,
        transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
        redact: { paths: ['password', '*.password', 'token', '*.token', 'req.headers.authorization'] },
      }
    : { level: env.LOG_LEVEL },
);
