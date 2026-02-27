/**
 * Intent: Provide structured logging with level control.
 * Guarantees: Only messages at or above the configured level are printed.
 * All output goes to stderr to keep stdout clean for JSON/data output.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_PREFIX: Record<LogLevel, string> = {
  debug: '[DEBUG]',
  info: '[INFO]',
  warn: '[WARN]',
  error: '[ERROR]',
};

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel];
}

function formatMessage(level: LogLevel, message: string, context?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const prefix = LEVEL_PREFIX[level];
  const base = `${timestamp} ${prefix} ${message}`;
  if (context && Object.keys(context).length > 0) {
    return `${base} ${JSON.stringify(context)}`;
  }
  return base;
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    if (shouldLog('debug')) {
      console.error(formatMessage('debug', message, context));
    }
  },

  info(message: string, context?: Record<string, unknown>): void {
    if (shouldLog('info')) {
      console.error(formatMessage('info', message, context));
    }
  },

  warn(message: string, context?: Record<string, unknown>): void {
    if (shouldLog('warn')) {
      console.error(formatMessage('warn', message, context));
    }
  },

  error(message: string, context?: Record<string, unknown>): void {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, context));
    }
  },
};
