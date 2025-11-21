import type { Socket } from "socket.io";
import { logger } from "@banco/shared/logger";
import type { LockQueueEntry } from "./types";

export class QueueManager {
  private cola: LockQueueEntry[] = [];
  private readonly MAX_REINTENTOS = 10; // Límite para evitar loop infinito
  private requestsEliminadosPorReintentos = 0;
  private requestsHuerfanos = 0;

  agregar(socketId: string, request: any): void {
    this.cola.push({
      socketId,
      request,
      timestamp: Date.now(),
      reintentos: 0,
    });
    logger.lock(
      `📝 Solicitud en cola: ${request.operacion} de ${request.workerId}`,
      {
        operacion: request.operacion,
        workerId: request.workerId,
        requestId: request.requestId,
        posicionCola: this.cola.length,
      }
    );
  }

  ordenar(): void {
    this.cola.sort((a, b) => {
      // Prioridad primero
      const prioDiff = b.request.prioridad - a.request.prioridad;
      if (prioDiff !== 0) return prioDiff;
      // Luego timestamp (primero el más antiguo)
      return a.timestamp - b.timestamp;
    });
  }

  obtenerPrimero(): LockQueueEntry | undefined {
    return this.cola.shift();
  }

  /**
   * Re-encola un request con backoff exponencial
   * Retorna false si excede el límite de reintentos
   */
  reencolar(entry: LockQueueEntry): boolean {
    entry.reintentos++;

    if (entry.reintentos > this.MAX_REINTENTOS) {
      this.requestsEliminadosPorReintentos++;
      logger.warn(
        `❌ Request eliminado por exceder reintentos: ${entry.request.operacion} de ${entry.request.workerId}`,
        {
          workerId: entry.request.workerId,
          operacion: entry.request.operacion,
          requestId: entry.request.requestId,
          reintentos: entry.reintentos,
        }
      );
      return false;
    }

    // Backoff exponencial: 100ms, 200ms, 400ms, 800ms, etc.
    const backoff = Math.min(100 * Math.pow(2, entry.reintentos - 1), 5000);
    entry.timestamp = Date.now() + backoff;

    this.cola.push(entry);
    return true;
  }

  eliminarPorWorker(workerId: string): LockQueueEntry[] {
    const eliminados = this.cola.filter(
      (entry) => entry.request.workerId === workerId
    );
    this.cola = this.cola.filter(
      (entry) => entry.request.workerId !== workerId
    );
    return eliminados;
  }

  obtenerTodos(): Array<{
    operacion: string;
    workerId: string;
    prioridad: number;
    esperando: number;
  }> {
    return this.cola.map((entry) => ({
      operacion: entry.request.operacion,
      workerId: entry.request.workerId,
      prioridad: entry.request.prioridad,
      esperando: Date.now() - entry.timestamp,
    }));
  }

  get tamaño(): number {
    return this.cola.length;
  }

  limpiar(): void {
    this.cola = [];
  }

  /**
   * Elimina requests de sockets desconectados (huérfanos)
   */
  limpiarHuerfanos(io: any): number {
    const antes = this.cola.length;
    this.cola = this.cola.filter((entry) => {
      const socket = io.sockets.sockets.get(entry.socketId);
      const conectado = socket && socket.connected;

      if (!conectado) {
        logger.warn(
          `🧹 Request huérfano eliminado: ${entry.request.operacion} de ${entry.request.workerId}`,
          {
            workerId: entry.request.workerId,
            requestId: entry.request.requestId,
            esperando: Math.round((Date.now() - entry.timestamp) / 1000) + "s",
          }
        );
      }

      return conectado;
    });

    const eliminados = antes - this.cola.length;
    if (eliminados > 0) {
      this.requestsHuerfanos += eliminados;
    }
    return eliminados;
  }

  getMetricas() {
    return {
      requestsEliminadosPorReintentos: this.requestsEliminadosPorReintentos,
      requestsHuerfanos: this.requestsHuerfanos,
    };
  }
}
