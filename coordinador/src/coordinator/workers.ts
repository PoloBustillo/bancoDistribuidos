import type { Socket, Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import {
  TipoMensaje,
  type RegisterWorker,
  type Heartbeat,
} from "@banco/shared/types";
import { logger } from "@banco/shared/logger";
import type { WorkerInfo } from "./types";
import { WorkerAuth } from "./auth";

export class WorkerManager {
  private trabajadores: Map<string, WorkerInfo> = new Map();
  private readonly HEARTBEAT_TIMEOUT: number;
  private auth: WorkerAuth;

  constructor(heartbeatTimeout: number) {
    this.HEARTBEAT_TIMEOUT = heartbeatTimeout;
    this.auth = new WorkerAuth();
  }

  registrar(socket: Socket, msg: RegisterWorker): void {
    // Validar token de autenticación
    const token = msg.token || socket.handshake.auth?.token;
    const tokenValido = token && this.auth.validarToken(token, msg.workerId);

    if (!tokenValido) {
      logger.warn(
        `❌ Intento de registro rechazado por token inválido: ${msg.workerId}`,
        { workerId: msg.workerId, puerto: msg.puerto, socketId: socket.id }
      );
      socket.emit("auth-error", {
        error: "Token de autenticación inválido",
        workerId: msg.workerId,
      });
      socket.disconnect(true);
      return;
    }

    const worker: WorkerInfo = {
      workerId: msg.workerId,
      socketId: socket.id,
      puerto: msg.puerto,
      estado: "IDLE",
      ultimoHeartbeat: Date.now(),
      locksActivos: 0,
      capacidad: msg.capacidad,
      autenticado: true,
    };
    this.trabajadores.set(msg.workerId, worker);
    logger.worker(
      `✅ Trabajador autenticado y registrado: ${msg.workerId} (puerto ${msg.puerto})`,
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

  estaAutenticado(workerId: string): boolean {
    const worker = this.trabajadores.get(workerId);
    return worker?.autenticado ?? false;
  }

  actualizarHeartbeat(msg: Heartbeat): void {
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

  verificarHeartbeats(io: Server): void {
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

  /**
   * Genera un token para un worker autorizado (usar en setup inicial)
   */
  generarToken(workerId: string): string {
    return this.auth.generarToken(workerId);
  }

  /**
   * Limpia tokens expirados periódicamente
   */
  limpiarTokensExpirados(): void {
    this.auth.limpiarTokensExpirados();
  }
}
