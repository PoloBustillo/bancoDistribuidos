// ========================================
// 🎯 CONFIGURACIÓN CENTRALIZADA
// ========================================
// Centraliza todas las constantes y configuraciones
// para evitar números mágicos y mejorar mantenibilidad
// ========================================

export const CONFIG = {
  // 🔒 Timeouts y Tiempos (en milisegundos)
  TIMEOUTS: {
    HEARTBEAT: 3000, // 3 segundos - Worker → Coordinador
    HEARTBEAT_TIMEOUT: 15000, // 15 segundos - Timeout para considerar worker muerto
    MAX_LOCK_TIME: 30000, // 30 segundos - Tiempo máximo de lock
    DEFAULT_LOCK_TIMEOUT: 10000, // 10 segundos - Timeout por defecto
    VERIFICATION_CODE_TTL: 10 * 60 * 1000, // 10 minutos - Código de verificación
    ADVISOR_SESSION_TTL: 30 * 60 * 1000, // 30 minutos - Sesión de asesor
    SESSION_CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hora - Limpieza de sesiones
  },

  // 🎯 Puertos por Defecto
  PORTS: {
    COORDINATOR: 4000,
    WORKER_START: 3001,
    FRONTEND: 3000,
  },

  // 🔐 Autenticación
  AUTH: {
    JWT_EXPIRATION: "24h",
    SALT_ROUNDS: 10,
    MIN_PASSWORD_LENGTH: 8,
    VERIFICATION_CODE_LENGTH: 6,
    LAST_DIGITS_LENGTH: 4,
  },

  // 🏦 Límites Bancarios
  BANKING: {
    MIN_AMOUNT: 0.01,
    MAX_DAILY_LIMIT: 50000,
    MAX_TRANSFER_AMOUNT: 100000,
    ACCOUNT_NUMBER_LENGTH: 12,
    CARD_NUMBER_LENGTH: 16,
    CVV_LENGTH: 3,
  },

  // 🔄 Reconexión y Reintentos
  CONNECTION: {
    MAX_RECONNECTION_ATTEMPTS: 5,
    RECONNECTION_DELAY: 1000,
    MAX_QUEUE_SIZE: 1000,
    WORKER_CAPACITY_DEFAULT: 10,
  },

  // 📊 Monitoreo
  MONITORING: {
    STATS_UPDATE_INTERVAL: 5000, // 5 segundos
    LOG_ROTATION_SIZE: "10M",
    MAX_EVENT_HISTORY: 100,
  },

  // 🌐 URLs por Defecto
  URLS: {
    COORDINATOR: "http://localhost:4000",
    DEFAULT_CORS_ORIGINS: [
      "http://localhost:3000",
      "https://banco-distribuidos.vercel.app",
    ],
  },
} as const;

// ========================================
// 🎓 ENUMS CENTRALIZADOS
// ========================================
export const ACCOUNT_ROLES = {
  TITULAR: "TITULAR",
  AUTORIZADO: "AUTORIZADO",
  CONSULTA: "CONSULTA",
} as const;

export const CARD_STATES = {
  ACTIVA: "ACTIVA",
  BLOQUEADA: "BLOQUEADA",
  CANCELADA: "CANCELADA",
} as const;

export const ACCOUNT_STATES = {
  ACTIVA: "ACTIVA",
  BLOQUEADA: "BLOQUEADA",
  CERRADA: "CERRADA",
} as const;

export const WORKER_STATES = {
  IDLE: "IDLE",
  BUSY: "BUSY",
  DISCONNECTED: "DISCONNECTED",
} as const;

// ========================================
// 🔧 UTILIDADES DE CONFIGURACIÓN
// ========================================
export class ConfigManager {
  static getEnvVar(key: string, defaultValue?: string): string {
    const value = process.env[key];
    if (!value && defaultValue === undefined) {
      throw new Error(`Variable de entorno requerida no encontrada: ${key}`);
    }
    return value || defaultValue!;
  }

  static getEnvNumber(key: string, defaultValue?: number): number {
    const value = process.env[key];
    if (!value) {
      if (defaultValue === undefined) {
        throw new Error(
          `Variable de entorno numérica requerida no encontrada: ${key}`
        );
      }
      return defaultValue;
    }
    const parsed = parseInt(value);
    if (isNaN(parsed)) {
      throw new Error(`Variable de entorno ${key} debe ser un número válido`);
    }
    return parsed;
  }

  static getEnvBoolean(key: string, defaultValue?: boolean): boolean {
    const value = process.env[key];
    if (!value) {
      if (defaultValue === undefined) {
        throw new Error(
          `Variable de entorno booleana requerida no encontrada: ${key}`
        );
      }
      return defaultValue;
    }
    return value.toLowerCase() === "true";
  }

  static getCorsOrigins(): string[] {
    const corsOrigin = process.env.CORS_ORIGIN;
    if (corsOrigin) {
      return corsOrigin.split(",").map((origin) => origin.trim());
    }
    return [...CONFIG.URLS.DEFAULT_CORS_ORIGINS];
  }

  static getJwtSecret(): string {
    return this.getEnvVar(
      "JWT_SECRET",
      "B4nc0S3cr3_2024_D1str1but3d_JWT_S3cr3t"
    );
  }

  static getDatabaseUrl(): string {
    return this.getEnvVar("DATABASE_URL");
  }
}

// ========================================
// 🎯 VALIDADORES
// ========================================
export class Validators {
  static isValidAmount(amount: number): boolean {
    return (
      amount >= CONFIG.BANKING.MIN_AMOUNT &&
      amount <= CONFIG.BANKING.MAX_TRANSFER_AMOUNT
    );
  }

  static isValidAccountNumber(accountNumber: string): boolean {
    return (
      accountNumber.length === CONFIG.BANKING.ACCOUNT_NUMBER_LENGTH &&
      /^\d+$/.test(accountNumber)
    );
  }

  static isValidCardNumber(cardNumber: string): boolean {
    return (
      cardNumber.length === CONFIG.BANKING.CARD_NUMBER_LENGTH &&
      /^\d+$/.test(cardNumber)
    );
  }

  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidPassword(password: string): boolean {
    return password.length >= CONFIG.AUTH.MIN_PASSWORD_LENGTH;
  }

  static isValidVerificationCode(code: string): boolean {
    return (
      code.length === CONFIG.AUTH.VERIFICATION_CODE_LENGTH && /^\d+$/.test(code)
    );
  }

  static isValidLastDigits(digits: string): boolean {
    return (
      digits.length === CONFIG.AUTH.LAST_DIGITS_LENGTH && /^\d+$/.test(digits)
    );
  }
}

// Type exports para TypeScript
export type AccountRole = keyof typeof ACCOUNT_ROLES;
export type CardState = keyof typeof CARD_STATES;
export type AccountState = keyof typeof ACCOUNT_STATES;
export type WorkerState = keyof typeof WORKER_STATES;
