// ========================================
// 🏗️ RESPONSE BUILDER - Constructor de Respuestas
// ========================================
// Helper para construir respuestas consistentes
// y eliminar duplicación de código
// ========================================

import { TipoMensaje, type RecursoId } from "@banco/shared/types";
import type { LockGranted, LockDenied } from "@banco/shared/types";
import type { LockDeniedData } from "./interfaces";

export class ResponseBuilder {
  /**
   * Construye respuesta de lock concedido
   */
  static buildLockGranted(
    workerId: string,
    requestId: string,
    recursos: RecursoId[],
    expiresAt: number
  ): LockGranted {
    return {
      tipo: TipoMensaje.LOCK_GRANTED,
      timestamp: Date.now(),
      workerId,
      requestId,
      recursos,
      expiresAt,
    };
  }

  /**
   * Construye respuesta de lock denegado
   */
  static buildLockDenied(data: LockDeniedData): LockDenied {
    return {
      tipo: TipoMensaje.LOCK_DENIED,
      timestamp: Date.now(),
      workerId: data.workerId,
      requestId: data.requestId,
      recursos: data.recursos,
      razon: data.razon,
      bloqueadoPor: data.bloqueadoPor,
    };
  }

  /**
   * Construye respuesta de error de autenticación
   */
  static buildAuthError(
    requestId: string,
    message: string = "Worker no autenticado"
  ) {
    return {
      error: message,
      requestId,
      timestamp: Date.now(),
    };
  }

  /**
   * Construye respuesta de estado/estadísticas
   */
  static buildStatusResponse(stats: {
    trabajadores: number;
    locks: number;
    cola: number;
    deadlocks: number;
  }) {
    return {
      ...stats,
      timestamp: Date.now(),
    };
  }
}
