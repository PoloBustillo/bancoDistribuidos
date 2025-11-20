import type { Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { TipoMensaje } from "@banco/shared/types";
import { logger } from "@banco/shared/logger";
import type { WorkerInfo } from "./types";

export class WorkerManager {
  private trabajadores: Map<string, WorkerInfo> = new Map();
  private readonly HEARTBEAT_TIMEOUT: number;

  constructor(heartbeatTimeout: number) {
    this.HEARTBEAT_TIMEOUT = heartbeatTimeout;
  }

  registrar(socket: Socket, msg: any): void {
    const worker: WorkerInfo = {
      workerId: msg.workerId,
      socketId: socket.id,
      puerto: msg.puerto,
      estado: "IDLE",
      ultimoHeartbeat: Date.now(),
      locksActivos: 0,
      capacidad: msg.capacidad,
    };
    this.trabajadores.set(msg.workerId, worker);
    logger.worker(
      `✅ Trabajador registrado: ${msg.workerId} (puerto ${msg.puerto})`,
      { workerId: msg.workerId, puerto: msg.puerto, capacidad: msg.capacidad }
    );
    socket.emit(TipoMensaje.WORKER_REGISTERED, {
      tipo: TipoMensaje.WORKER_REGISTERED,
      workerId: msg.workerId,
      timestamp: Date.now(),
      requestId: uuidv4(),
    });
  }

  obtener(workerId: string): WorkerInfo | undefined {
    return this.trabajadores.get(workerId);
  }

  actualizarHeartbeat(msg: any): void {
    const worker = this.trabajadores.get(msg.workerId);
    if (worker) {
      worker.ultimoHeartbeat = Date.now();
      worker.estado = msg.estado;
      worker.locksActivos = msg.locksActivos;
    }
  }

  incrementarLocks(workerId: string): void {
    const worker = this.trabajadores.get(workerId);
    if (worker) {
      worker.locksActivos++;
      worker.estado = "BUSY";
    }
  }

  decrementarLocks(workerId: string): void {
    const worker = this.trabajadores.get(workerId);
    if (worker) {
      worker.locksActivos = Math.max(0, worker.locksActivos - 1);
      if (worker.locksActivos === 0) {
        worker.estado = "IDLE";
      }
    }
  }

  eliminar(workerId: string): void {
    this.trabajadores.delete(workerId);
  }

  encontrarPorSocket(socketId: string): WorkerInfo | undefined {
    return Array.from(this.trabajadores.values()).find(
      (w) => w.socketId === socketId
    );
  }

  verificarHeartbeats(io: any): void {
    const now = Date.now();
    for (const [workerId, worker] of this.trabajadores) {
      const tiempoSinHeartbeat = now - worker.ultimoHeartbeat;
      if (tiempoSinHeartbeat > this.HEARTBEAT_TIMEOUT) {
        logger.error(
          `💀 Trabajador sin heartbeat: ${workerId} (${tiempoSinHeartbeat}ms)`,
          undefined,
          { workerId, tiempoSinHeartbeat, socketId: worker.socketId }
        );
        const socket = io.sockets.sockets.get(worker.socketId);
        if (socket) {
          socket.disconnect(true);
        }
      }
    }
  }

  obtenerTodos(): WorkerInfo[] {
    return Array.from(this.trabajadores.values());
  }

  get tamaño(): number {
    return this.trabajadores.size;
  }
}
