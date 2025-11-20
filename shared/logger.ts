// ========================================
// 🎯 SISTEMA DE LOGGING CENTRALIZADO
// ========================================
// Logger estructurado con niveles, contexto y formato consistente
// Reemplaza los console.log dispersos por logging profesional
// ========================================

import { CONFIG } from "./config";

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

export interface LogContext {
  workerId?: string;
  userId?: string;
  requestId?: string;
  operation?: string;
  ip?: string;
  userAgent?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: LogContext;
  error?: Error;
  category: string;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];

  private constructor() {
    // Configurar nivel desde variable de entorno
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLevel && LogLevel[envLevel as keyof typeof LogLevel] !== undefined) {
      this.logLevel = LogLevel[envLevel as keyof typeof LogLevel];
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level].padEnd(5);
    const contextStr = context ? ` | ${JSON.stringify(context)}` : "";
    return `${timestamp} [${levelName}] ${message}${contextStr}`;
  }

  private log(
    level: LogLevel,
    message: string,
    category: string,
    context?: LogContext,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      error,
      category,
    };

    // Mantener historial limitado en memoria
    this.logs.push(entry);
    if (this.logs.length > CONFIG.MONITORING.MAX_EVENT_HISTORY) {
      this.logs.shift();
    }

    // Output a consola con formato
    const formatted = this.formatMessage(level, message, context);

    switch (level) {
      case LogLevel.ERROR:
        console.error(formatted, error || "");
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.DEBUG:
      case LogLevel.TRACE:
        console.log(formatted);
        break;
    }
  }

  // ========================================
  // 🎯 MÉTODOS DE LOGGING POR NIVEL
  // ========================================

  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, "ERROR", context, error);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, "WARN", context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, "INFO", context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, "DEBUG", context);
  }

  trace(message: string, context?: LogContext): void {
    this.log(LogLevel.TRACE, message, "TRACE", context);
  }

  // ========================================
  // 🎯 MÉTODOS DE LOGGING ESPECIALIZADOS
  // ========================================

  // Logs de autenticación
  auth(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, `🔐 ${message}`, "AUTH", context);
  }

  // Logs de transacciones bancarias
  banking(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, `💰 ${message}`, "BANKING", context);
  }

  // Logs de locks distribuidos
  lock(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, `🔒 ${message}`, "LOCK", context);
  }

  // Logs de red/conexión
  network(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, `🌐 ${message}`, "NETWORK", context);
  }

  // Logs de eventos en tiempo real
  event(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, `📡 ${message}`, "EVENT", context);
  }

  // Logs de coordinador
  coordinator(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, `🎯 ${message}`, "COORDINATOR", context);
  }

  // Logs de worker
  worker(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, `⚡ ${message}`, "WORKER", context);
  }

  // Logs de asesor
  advisor(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, `👤 ${message}`, "ADVISOR", context);
  }

  // ========================================
  // 🎯 UTILIDADES
  // ========================================

  setLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  getLogs(category?: string, limit?: number): LogEntry[] {
    let filteredLogs = this.logs;

    if (category) {
      filteredLogs = this.logs.filter((log) => log.category === category);
    }

    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }

    return filteredLogs;
  }

  clearLogs(): void {
    this.logs = [];
  }

  // Crear logger con contexto fijo
  createContextLogger(baseContext: LogContext): ContextLogger {
    return new ContextLogger(this, baseContext);
  }
}

// ========================================
// 🎯 LOGGER CON CONTEXTO
// ========================================
export class ContextLogger {
  constructor(private logger: Logger, private baseContext: LogContext) {}

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.baseContext, ...context };
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.logger.error(message, error, this.mergeContext(context));
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, this.mergeContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(message, this.mergeContext(context));
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, this.mergeContext(context));
  }

  trace(message: string, context?: LogContext): void {
    this.logger.trace(message, this.mergeContext(context));
  }

  auth(message: string, context?: LogContext): void {
    this.logger.auth(message, this.mergeContext(context));
  }

  banking(message: string, context?: LogContext): void {
    this.logger.banking(message, this.mergeContext(context));
  }

  lock(message: string, context?: LogContext): void {
    this.logger.lock(message, this.mergeContext(context));
  }

  network(message: string, context?: LogContext): void {
    this.logger.network(message, this.mergeContext(context));
  }

  event(message: string, context?: LogContext): void {
    this.logger.event(message, this.mergeContext(context));
  }

  coordinator(message: string, context?: LogContext): void {
    this.logger.coordinator(message, this.mergeContext(context));
  }

  worker(message: string, context?: LogContext): void {
    this.logger.worker(message, this.mergeContext(context));
  }

  advisor(message: string, context?: LogContext): void {
    this.logger.advisor(message, this.mergeContext(context));
  }
}

// ========================================
// 🎯 INSTANCIA GLOBAL
// ========================================
export const logger = Logger.getInstance();

// ========================================
// 🎯 UTILIDADES PARA TIMING
// ========================================
export class Timer {
  private startTime: number;
  private logger: Logger;
  private operation: string;
  private context?: LogContext;

  constructor(
    operation: string,
    logger: Logger = Logger.getInstance(),
    context?: LogContext
  ) {
    this.startTime = Date.now();
    this.logger = logger;
    this.operation = operation;
    this.context = context;
    this.logger.debug(`⏱️ Iniciando: ${operation}`, context);
  }

  end(message?: string): number {
    const duration = Date.now() - this.startTime;
    const logMessage = message || `Completado: ${this.operation}`;
    this.logger.info(`⏱️ ${logMessage} (${duration}ms)`, {
      ...this.context,
      duration,
      operation: this.operation,
    });
    return duration;
  }
}

// ========================================
// 🎯 DECORATOR PARA TIMING AUTOMÁTICO
// ========================================
export function timed(operation?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const operationName =
      operation || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const timer = new Timer(operationName, logger, {
        method: propertyKey,
        class: target.constructor.name,
      });

      try {
        const result = await originalMethod.apply(this, args);
        timer.end();
        return result;
      } catch (error) {
        timer.end("Error");
        throw error;
      }
    };

    return descriptor;
  };
}
