// ========================================
// ✅ VALIDADORES DE MENSAJES
// ========================================
// Validación de mensajes entrantes para prevenir
// errores y ataques con datos malformados
// ========================================

import { z } from "zod";
import { TipoMensaje, TipoRecurso } from "@banco/shared/types";
import { logger } from "@banco/shared/logger";

// ========================================
// Schemas de Validación
// ========================================

const RecursoSchema = z.object({
  tipo: z.nativeEnum(TipoRecurso),
  id: z.string().min(1),
});

const RegisterWorkerSchema = z.object({
  tipo: z.literal(TipoMensaje.REGISTER_WORKER),
  timestamp: z.number().positive(),
  workerId: z.string().min(1),
  requestId: z.string().uuid(),
  puerto: z.number().int().min(1).max(65535),
  capacidad: z.number().int().positive(),
  token: z.string().optional(),
});

const HeartbeatSchema = z.object({
  tipo: z.literal(TipoMensaje.HEARTBEAT),
  timestamp: z.number().positive(),
  workerId: z.string().min(1),
  requestId: z.string().uuid(),
  estado: z.enum(["IDLE", "BUSY"]),
  locksActivos: z.number().int().nonnegative(),
});

const LockRequestSchema = z.object({
  tipo: z.literal(TipoMensaje.LOCK_REQUEST),
  timestamp: z.number().positive(),
  workerId: z.string().min(1),
  requestId: z.string().uuid(),
  recursos: z.array(RecursoSchema).min(1).max(100), // Max 100 recursos por request
  prioridad: z.number().int().min(0).max(10),
  timeout: z.number().positive().max(60000), // Max 60 segundos
  operacion: z.string().min(1).max(200),
});

const LockReleaseSchema = z.object({
  tipo: z.literal(TipoMensaje.LOCK_RELEASE),
  timestamp: z.number().positive(),
  workerId: z.string().min(1),
  requestId: z.string().uuid(),
  recursos: z.array(RecursoSchema).min(1),
});

// ========================================
// Resultado de Validación
// ========================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ========================================
// Clase Validadora
// ========================================

export class MessageValidator {
  /**
   * Valida mensaje de registro de worker
   */
  static validateRegisterWorker(
    msg: unknown
  ): ValidationResult<z.infer<typeof RegisterWorkerSchema>> {
    try {
      const data = RegisterWorkerSchema.parse(msg);
      return { success: true, data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMsg = error.issues
          .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
          .join(", ");
        logger.warn("Mensaje RegisterWorker inválido", {
          error: errorMsg,
          msg,
        });
        return { success: false, error: errorMsg };
      }
      return { success: false, error: "Error desconocido en validación" };
    }
  }

  /**
   * Valida mensaje de heartbeat
   */
  static validateHeartbeat(
    msg: unknown
  ): ValidationResult<z.infer<typeof HeartbeatSchema>> {
    try {
      const data = HeartbeatSchema.parse(msg);
      return { success: true, data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMsg = error.issues
          .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
          .join(", ");
        logger.warn("Mensaje Heartbeat inválido", { error: errorMsg });
        return { success: false, error: errorMsg };
      }
      return { success: false, error: "Error desconocido en validación" };
    }
  }

  /**
   * Valida mensaje de solicitud de lock
   */
  static validateLockRequest(
    msg: unknown
  ): ValidationResult<z.infer<typeof LockRequestSchema>> {
    try {
      const data = LockRequestSchema.parse(msg);
      return { success: true, data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMsg = error.issues
          .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
          .join(", ");
        logger.warn("Mensaje LockRequest inválido", { error: errorMsg });
        return { success: false, error: errorMsg };
      }
      return { success: false, error: "Error desconocido en validación" };
    }
  }

  /**
   * Valida mensaje de liberación de lock
   */
  static validateLockRelease(
    msg: unknown
  ): ValidationResult<z.infer<typeof LockReleaseSchema>> {
    try {
      const data = LockReleaseSchema.parse(msg);
      return { success: true, data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMsg = error.issues
          .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
          .join(", ");
        logger.warn("Mensaje LockRelease inválido", { error: errorMsg });
        return { success: false, error: errorMsg };
      }
      return { success: false, error: "Error desconocido en validación" };
    }
  }

  /**
   * Validación genérica con manejo de errores
   */
  private static validate<T>(
    schema: z.ZodSchema<T>,
    msg: unknown,
    msgType: string
  ): ValidationResult<T> {
    try {
      const data = schema.parse(msg);
      return { success: true, data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMsg = error.issues
          .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
          .join(", ");
        logger.warn(`Mensaje ${msgType} inválido`, { error: errorMsg });
        return { success: false, error: errorMsg };
      }
      return { success: false, error: "Error desconocido en validación" };
    }
  }
}
