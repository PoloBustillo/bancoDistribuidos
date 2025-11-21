import type { Socket } from "socket.io";
import {
  TipoMensaje,
  generarClaveRecurso,
  type LockRequest,
  type RecursoId,
} from "@banco/shared/types";
import { logger } from "@banco/shared/logger";
import type { LockInfo } from "./types";
import { ResponseBuilder } from "./responseBuilder";

export class LockManager {
  private locksActivos: Map<string, LockInfo> = new Map();
  private readonly MAX_LOCK_TIME: number;

  constructor(maxLockTime: number) {
    this.MAX_LOCK_TIME = maxLockTime;
  }

  verificarConflicto(recursos: RecursoId[]): LockInfo | null {
    for (const recurso of recursos) {
      const clave = generarClaveRecurso(recurso);
      const lockActivo = this.locksActivos.get(clave);
      if (lockActivo) {
        return lockActivo;
      }
    }
    return null;
  }

  conceder(socket: Socket, request: LockRequest): void {
    const now = Date.now();
    const expiresAt = now + Math.min(request.timeout, this.MAX_LOCK_TIME);
    const lockInfo: LockInfo = {
      recursos: request.recursos,
      workerId: request.workerId,
      requestId: request.requestId,
      timestamp: now,
      expiresAt,
      prioridad: request.prioridad,
      operacion: request.operacion,
    };
    for (const recurso of request.recursos) {
      const clave = generarClaveRecurso(recurso);
      this.locksActivos.set(clave, lockInfo);
    }

    socket.emit(
      TipoMensaje.LOCK_GRANTED,
      ResponseBuilder.buildLockGranted(
        request.workerId,
        request.requestId,
        request.recursos,
        expiresAt
      )
    );
    logger.lock(
      `✅ Lock concedido a ${request.workerId}: ${
        request.operacion
      } (expira en ${(expiresAt - now) / 1000}s)`,
      {
        workerId: request.workerId,
        operacion: request.operacion,
        requestId: request.requestId,
        expiresAt,
      }
    );
  }

  liberar(recursos: RecursoId[]): void {
    for (const recurso of recursos) {
      const clave = generarClaveRecurso(recurso);
      this.locksActivos.delete(clave);
    }
  }

  verificarExpirados(): string[] {
    const now = Date.now();
    const expirados: string[] = [];
    for (const [clave, lock] of this.locksActivos) {
      if (now > lock.expiresAt) {
        expirados.push(clave);
        logger.warn(`⏰ Lock expirado: ${lock.operacion} de ${lock.workerId}`, {
          operacion: lock.operacion,
          workerId: lock.workerId,
          requestId: lock.requestId,
          recurso: clave,
        });
      }
    }
    for (const clave of expirados) {
      this.locksActivos.delete(clave);
    }
    return expirados;
  }

  obtenerPorWorker(workerId: string): Array<[string, LockInfo]> {
    return Array.from(this.locksActivos.entries()).filter(
      ([_, lock]) => lock.workerId === workerId
    );
  }

  obtenerLockPorRecurso(claveRecurso: string): LockInfo | undefined {
    return this.locksActivos.get(claveRecurso);
  }

  obtenerTodos(): Array<{
    recurso: string;
    workerId: string;
    operacion: string;
    expiraEn: number;
  }> {
    return Array.from(this.locksActivos.entries()).map(([clave, lock]) => ({
      recurso: clave,
      workerId: lock.workerId,
      operacion: lock.operacion,
      expiraEn: Math.max(0, lock.expiresAt - Date.now()),
    }));
  }

  get tamaño(): number {
    return this.locksActivos.size;
  }
}
