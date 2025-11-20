// ========================================
// 🎯 SISTEMA DE MANEJO DE ERRORES CENTRALIZADO
// ========================================
// Manejo consistente de errores con códigos, categorías y contexto
// Reemplaza los try-catch dispersos por un sistema unificado
// ========================================

import { logger } from "./logger";
import type { LogContext } from "./logger";

// ========================================
// 🎯 TIPOS DE ERRORES
// ========================================
export enum ErrorType {
  // Errores de negocio
  BUSINESS_RULE = "BUSINESS_RULE",
  VALIDATION = "VALIDATION",

  // Errores de autenticación y autorización
  AUTHENTICATION = "AUTHENTICATION",
  AUTHORIZATION = "AUTHORIZATION",

  // Errores de recursos
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  RESOURCE_CONFLICT = "RESOURCE_CONFLICT",
  RESOURCE_LOCKED = "RESOURCE_LOCKED",

  // Errores de red y conectividad
  NETWORK = "NETWORK",
  TIMEOUT = "TIMEOUT",
  CONNECTION = "CONNECTION",

  // Errores de base de datos
  DATABASE = "DATABASE",
  TRANSACTION = "TRANSACTION",

  // Errores del sistema
  SYSTEM = "SYSTEM",
  CONFIGURATION = "CONFIGURATION",

  // Errores de terceros
  EXTERNAL_SERVICE = "EXTERNAL_SERVICE",

  // Errores desconocidos
  UNKNOWN = "UNKNOWN",
}

// ========================================
// 🎯 CÓDIGOS DE ERROR HTTP
// ========================================
export enum HttpStatusCode {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  TIMEOUT = 408,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}

// ========================================
// 🎯 INTERFAZ BASE DE ERROR
// ========================================
export interface ErrorDetails {
  code: string;
  type: ErrorType;
  message: string;
  httpStatus: HttpStatusCode;
  context?: LogContext;
  cause?: Error;
  timestamp: Date;
  requestId?: string;
  userId?: string;
  recoverable: boolean;
  retryAfter?: number; // seconds
}

// ========================================
// 🎯 CLASE BASE DE ERROR PERSONALIZADA
// ========================================
export class AppError extends Error {
  public readonly details: ErrorDetails;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    httpStatus: HttpStatusCode = HttpStatusCode.INTERNAL_SERVER_ERROR,
    code?: string,
    context?: LogContext,
    cause?: Error
  ) {
    super(message);
    this.name = "AppError";

    this.details = {
      code: code || this.generateErrorCode(type),
      type,
      message,
      httpStatus,
      context,
      cause,
      timestamp: new Date(),
      recoverable: this.isRecoverable(type),
    };

    // Mantener stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  private generateErrorCode(type: ErrorType): string {
    const timestamp = Date.now().toString().slice(-6);
    return `${type}_${timestamp}`;
  }

  private isRecoverable(type: ErrorType): boolean {
    const recoverableTypes = [
      ErrorType.NETWORK,
      ErrorType.TIMEOUT,
      ErrorType.CONNECTION,
      ErrorType.EXTERNAL_SERVICE,
    ];
    return recoverableTypes.includes(type);
  }

  public withContext(context: LogContext): AppError {
    this.details.context = { ...this.details.context, ...context };
    return this;
  }

  public withRequestId(requestId: string): AppError {
    this.details.requestId = requestId;
    return this;
  }

  public withUserId(userId: string): AppError {
    this.details.userId = userId;
    return this;
  }

  public toJSON(): ErrorDetails {
    return this.details;
  }
}

// ========================================
// 🎯 ERRORES ESPECÍFICOS PRE-DEFINIDOS
// ========================================

// Errores de autenticación
export class AuthenticationError extends AppError {
  constructor(
    message: string = "Credenciales inválidas",
    context?: LogContext,
    cause?: Error
  ) {
    super(
      message,
      ErrorType.AUTHENTICATION,
      HttpStatusCode.UNAUTHORIZED,
      "AUTH_FAILED",
      context,
      cause
    );
  }
}

export class TokenExpiredError extends AppError {
  constructor(message: string = "Token expirado", context?: LogContext) {
    super(
      message,
      ErrorType.AUTHENTICATION,
      HttpStatusCode.UNAUTHORIZED,
      "TOKEN_EXPIRED",
      context
    );
  }
}

export class SessionExpiredError extends AppError {
  constructor(message: string = "Sesión expirada", context?: LogContext) {
    super(
      message,
      ErrorType.AUTHENTICATION,
      HttpStatusCode.UNAUTHORIZED,
      "SESSION_EXPIRED",
      context
    );
  }
}

// Errores de autorización
export class AuthorizationError extends AppError {
  constructor(
    message: string = "No tienes permisos para realizar esta acción",
    context?: LogContext
  ) {
    super(
      message,
      ErrorType.AUTHORIZATION,
      HttpStatusCode.FORBIDDEN,
      "INSUFFICIENT_PERMISSIONS",
      context
    );
  }
}

export class InsufficientFundsError extends AppError {
  constructor(available: number, requested: number, context?: LogContext) {
    const message = `Fondos insuficientes. Disponible: $${available}, solicitado: $${requested}`;
    super(
      message,
      ErrorType.BUSINESS_RULE,
      HttpStatusCode.UNPROCESSABLE_ENTITY,
      "INSUFFICIENT_FUNDS",
      context
    );
  }
}

// Errores de recursos
export class ResourceNotFoundError extends AppError {
  constructor(resource: string, id?: string, context?: LogContext) {
    const message = `${resource}${id ? ` con ID ${id}` : ""} no encontrado`;
    super(
      message,
      ErrorType.RESOURCE_NOT_FOUND,
      HttpStatusCode.NOT_FOUND,
      "RESOURCE_NOT_FOUND",
      context
    );
  }
}

export class ResourceConflictError extends AppError {
  constructor(message: string = "Conflicto de recursos", context?: LogContext) {
    super(
      message,
      ErrorType.RESOURCE_CONFLICT,
      HttpStatusCode.CONFLICT,
      "RESOURCE_CONFLICT",
      context
    );
  }
}

export class ResourceLockedError extends AppError {
  constructor(resource: string, lockId?: string, context?: LogContext) {
    const message = `Recurso ${resource} está bloqueado${
      lockId ? ` (Lock ID: ${lockId})` : ""
    }`;
    super(
      message,
      ErrorType.RESOURCE_LOCKED,
      HttpStatusCode.CONFLICT,
      "RESOURCE_LOCKED",
      context
    );
  }
}

// Errores de red y conectividad
export class NetworkError extends AppError {
  constructor(
    message: string = "Error de red",
    context?: LogContext,
    cause?: Error
  ) {
    super(
      message,
      ErrorType.NETWORK,
      HttpStatusCode.BAD_GATEWAY,
      "NETWORK_ERROR",
      context,
      cause
    );
    this.details.retryAfter = 5; // Reintentar después de 5 segundos
  }
}

export class TimeoutError extends AppError {
  constructor(
    operation: string = "Operación",
    timeout: number,
    context?: LogContext
  ) {
    const message = `${operation} excedió el tiempo límite (${timeout}ms)`;
    super(
      message,
      ErrorType.TIMEOUT,
      HttpStatusCode.TIMEOUT,
      "OPERATION_TIMEOUT",
      context
    );
    this.details.retryAfter = Math.ceil(timeout / 1000);
  }
}

export class ConnectionError extends AppError {
  constructor(
    service: string = "Servicio",
    context?: LogContext,
    cause?: Error
  ) {
    const message = `No se pudo conectar con ${service}`;
    super(
      message,
      ErrorType.CONNECTION,
      HttpStatusCode.SERVICE_UNAVAILABLE,
      "CONNECTION_FAILED",
      context,
      cause
    );
    this.details.retryAfter = 10;
  }
}

// Errores de base de datos
export class DatabaseError extends AppError {
  constructor(
    message: string = "Error de base de datos",
    context?: LogContext,
    cause?: Error
  ) {
    super(
      message,
      ErrorType.DATABASE,
      HttpStatusCode.INTERNAL_SERVER_ERROR,
      "DATABASE_ERROR",
      context,
      cause
    );
  }
}

export class TransactionError extends AppError {
  constructor(
    message: string = "Error en transacción",
    context?: LogContext,
    cause?: Error
  ) {
    super(
      message,
      ErrorType.TRANSACTION,
      HttpStatusCode.UNPROCESSABLE_ENTITY,
      "TRANSACTION_ERROR",
      context,
      cause
    );
  }
}

// Errores de validación (ya definido en validation.ts, pero incluido aquí para completitud)
export class ValidationError extends AppError {
  constructor(message: string = "Datos inválidos", context?: LogContext) {
    super(
      message,
      ErrorType.VALIDATION,
      HttpStatusCode.BAD_REQUEST,
      "VALIDATION_ERROR",
      context
    );
  }
}

// Errores de configuración
export class ConfigurationError extends AppError {
  constructor(setting: string, context?: LogContext) {
    const message = `Configuración inválida o faltante: ${setting}`;
    super(
      message,
      ErrorType.CONFIGURATION,
      HttpStatusCode.INTERNAL_SERVER_ERROR,
      "CONFIG_ERROR",
      context
    );
  }
}

// ========================================
// 🎯 MANEJADOR DE ERRORES PRINCIPAL
// ========================================
export class ErrorHandler {
  // Manejar errores conocidos
  static handle(error: unknown, context?: LogContext): AppError {
    if (error instanceof AppError) {
      // Ya es un error de aplicación, solo agregar contexto si es necesario
      if (context) {
        error.withContext(context);
      }
      this.logError(error);
      return error;
    }

    // Convertir errores nativos a errores de aplicación
    if (error instanceof Error) {
      const appError = this.convertNativeError(error, context);
      this.logError(appError);
      return appError;
    }

    // Error desconocido
    const appError = new AppError(
      "Error interno del servidor",
      ErrorType.UNKNOWN,
      HttpStatusCode.INTERNAL_SERVER_ERROR,
      "UNKNOWN_ERROR",
      context,
      error instanceof Error ? error : new Error(String(error))
    );

    this.logError(appError);
    return appError;
  }

  private static convertNativeError(
    error: Error,
    context?: LogContext
  ): AppError {
    // Detectar tipos comunes de errores
    if (
      error.message.includes("ENOTFOUND") ||
      error.message.includes("ECONNREFUSED")
    ) {
      return new NetworkError(error.message, context, error);
    }

    if (
      error.message.includes("timeout") ||
      error.message.includes("ETIMEDOUT")
    ) {
      return new TimeoutError("Operación", 30000, context);
    }

    if (
      error.message.includes("unique constraint") ||
      error.message.includes("duplicate key")
    ) {
      return new ResourceConflictError("Recurso ya existe", context);
    }

    if (
      error.message.includes("not found") ||
      error.message.includes("does not exist")
    ) {
      return new ResourceNotFoundError("Recurso", undefined, context);
    }

    // Error genérico del sistema
    return new AppError(
      error.message,
      ErrorType.SYSTEM,
      HttpStatusCode.INTERNAL_SERVER_ERROR,
      "SYSTEM_ERROR",
      context,
      error
    );
  }

  private static logError(error: AppError): void {
    const logContext: LogContext = {
      ...error.details.context,
      errorCode: error.details.code,
      errorType: error.details.type,
      httpStatus: error.details.httpStatus,
      requestId: error.details.requestId,
      userId: error.details.userId,
      recoverable: error.details.recoverable,
    };

    if (error.details.httpStatus >= 500) {
      logger.error(error.message, error.details.cause, logContext);
    } else {
      logger.warn(error.message, logContext);
    }
  }

  // Determinar si un error debe ser reintentado
  static shouldRetry(error: AppError, attemptCount: number = 0): boolean {
    const maxRetries = 3;
    return error.details.recoverable && attemptCount < maxRetries;
  }

  // Obtener delay para reintento
  static getRetryDelay(error: AppError, attemptCount: number = 0): number {
    if (error.details.retryAfter) {
      return error.details.retryAfter * 1000; // Convertir a milisegundos
    }

    // Backoff exponencial: 1s, 2s, 4s
    return Math.pow(2, attemptCount) * 1000;
  }

  // Sanitizar error para respuesta al cliente (no exponer detalles internos)
  static toClientError(error: AppError): {
    error: string;
    code: string;
    timestamp: string;
  } {
    // En producción, no exponer stack traces o detalles internos
    const isProduction = process.env.NODE_ENV === "production";

    let message = error.details.message;

    // En producción, usar mensajes genéricos para errores del servidor
    if (isProduction && error.details.httpStatus >= 500) {
      message = "Error interno del servidor";
    }

    return {
      error: message,
      code: error.details.code,
      timestamp: error.details.timestamp.toISOString(),
    };
  }
}

// ========================================
// 🎯 UTILIDADES DE MANEJO DE ERRORES
// ========================================

// Wrapper para operaciones que pueden fallar
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: LogContext,
  onError?: (error: AppError) => void
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const appError = ErrorHandler.handle(error, context);

    if (onError) {
      onError(appError);
    }

    throw appError;
  }
}

// Wrapper para operaciones síncronas
export function withErrorHandlingSync<T>(
  operation: () => T,
  context?: LogContext,
  onError?: (error: AppError) => void
): T {
  try {
    return operation();
  } catch (error) {
    const appError = ErrorHandler.handle(error, context);

    if (onError) {
      onError(appError);
    }

    throw appError;
  }
}

// Reintento automático con backoff
export async function withRetry<T>(
  operation: () => Promise<T>,
  context?: LogContext,
  maxAttempts: number = 3
): Promise<T> {
  let lastError: AppError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = ErrorHandler.handle(error, { ...context, attempt });

      if (
        !ErrorHandler.shouldRetry(lastError, attempt) ||
        attempt === maxAttempts - 1
      ) {
        throw lastError;
      }

      const delay = ErrorHandler.getRetryDelay(lastError, attempt);
      logger.info(`Reintentando operación en ${delay}ms`, {
        ...context,
        attempt,
        delay,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// ========================================
// 🎯 MIDDLEWARE DE EXPRESS PARA MANEJO DE ERRORES
// ========================================
// ========================================
// 🎯 MIDDLEWARE DE EXPRESS PARA MANEJO DE ERRORES
// ========================================
import type { Request, Response, NextFunction } from "express";

export function errorMiddleware(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const context: LogContext = {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("user-agent"),
    requestId: req.headers["x-request-id"] as string,
  };

  const appError = ErrorHandler.handle(error, context);
  const clientError = ErrorHandler.toClientError(appError);

  res.status(appError.details.httpStatus).json(clientError);
}

// Middleware para agregar requestId a todas las peticiones
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId =
    (req.headers["x-request-id"] as string) ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  req.headers["x-request-id"] = requestId;
  res.setHeader("X-Request-ID", requestId);

  next();
}
