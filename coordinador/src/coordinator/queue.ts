import type { Socket } from "socket.io";
import { logger } from "@banco/shared/logger";
import type { LockQueueEntry } from "./types";

export class QueueManager {
  private cola: LockQueueEntry[] = [];

  agregar(socketId: string, request: any): void {
    this.cola.push({
      socketId,
      request,
      timestamp: Date.now(),
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
}
