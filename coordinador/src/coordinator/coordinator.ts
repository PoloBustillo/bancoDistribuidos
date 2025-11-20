import type { Server as SocketServer, Socket } from "socket.io";
import { TipoMensaje } from "@banco/shared/types";
import { CONFIG } from "@banco/shared/config";
import { logger } from "@banco/shared/logger";
import { withErrorHandling } from "@banco/shared/errorHandling";
import { WorkerManager } from "./workers";
import { LockManager } from "./locks";
import { QueueManager } from "./queue";
import { EventManager } from "./events";

// Clase principal del Coordinador de Locks Distribuidos
export class LockCoordinator {
  private io: SocketServer;
  private workerManager: WorkerManager;
  private lockManager: LockManager;
  private queueManager: QueueManager;
  private eventManager: EventManager;

  constructor(io: SocketServer) {
    this.io = io;
    this.workerManager = new WorkerManager(CONFIG.TIMEOUTS.HEARTBEAT_TIMEOUT);
    this.lockManager = new LockManager(CONFIG.TIMEOUTS.MAX_LOCK_TIME);
    this.queueManager = new QueueManager();
    this.eventManager = new EventManager(this);

    this.eventManager.configurar(io);
    this.iniciarMonitoreo();
    logger.coordinator(
      "LockCoordinator inicializado con managers especializados"
    );
  }

  // Métodos públicos llamados por EventManager
  public manejarRegistroWorker(socket: Socket, msg: any): void {
    withErrorHandling(
      async () => {
        this.workerManager.registrar(socket, msg);
      },
      {
        socketId: socket.id,
        workerId: msg.workerId,
      }
    );
  }

  public manejarHeartbeat(socket: Socket, msg: any): void {
    withErrorHandling(
      async () => {
        this.workerManager.actualizarHeartbeat(msg);
      },
      {
        socketId: socket.id,
        workerId: msg.workerId,
      }
    );
  }

  public manejarLockRequest(socket: Socket, msg: any): void {
    withErrorHandling(
      async () => {
        this.procesarSolicitudLock(socket, msg);
      },
      {
        socketId: socket.id,
        workerId: msg.workerId,
        operacion: msg.operacion,
      }
    );
  }

  public manejarLockRelease(socket: Socket, msg: any): void {
    withErrorHandling(
      async () => {
        this.liberarLock(socket, msg);
      },
      {
        socketId: socket.id,
        workerId: msg.workerId,
      }
    );
  }

  public manejarEstadoRequest(socket: Socket): void {
    withErrorHandling(
      async () => {
        socket.emit("status-response", this.getEstadisticas());
      },
      {
        socketId: socket.id,
      }
    );
  }

  public manejarDisconnect(socket: Socket): void {
    withErrorHandling(
      async () => {
        this.manejarDesconexion(socket);
      },
      {
        socketId: socket.id,
      }
    );
  }

  private procesarSolicitudLock(socket: Socket, request: any): void {
    logger.lock(
      `📥 Lock request de ${request.workerId}: ${request.operacion} (${request.recursos.length} recursos)`,
      {
        workerId: request.workerId,
        operacion: request.operacion,
        requestId: request.requestId,
      }
    );

    // Verificar capacidad del worker
    const solicitante = this.workerManager.obtener(request.workerId);
    if (solicitante && solicitante.locksActivos >= solicitante.capacidad) {
      logger.warn(
        `⚠️ Worker ${request.workerId} alcanzó su capacidad (${solicitante.capacidad}), encolando request ${request.requestId}`,
        {
          workerId: request.workerId,
          capacidad: solicitante.capacidad,
          requestId: request.requestId,
        }
      );
      this.agregarACola(socket, request);
      return;
    }

    // Verificar conflictos de recursos
    const conflicto = this.lockManager.verificarConflicto(request.recursos);
    if (!conflicto) {
      this.concederLock(socket, request);
    } else {
      this.agregarACola(socket, request);
    }
  }

  private concederLock(socket: Socket, request: any): void {
    // Conceder el lock
    this.lockManager.conceder(socket, request);

    // Actualizar estado del worker
    this.workerManager.incrementarLocks(request.workerId);
  }

  private agregarACola(socket: Socket, request: any): void {
    this.queueManager.agregar(socket.id, request);
    this.queueManager.ordenar();

    const conflicto = this.lockManager.verificarConflicto(request.recursos);
    const response = {
      tipo: TipoMensaje.LOCK_DENIED,
      timestamp: Date.now(),
      workerId: request.workerId,
      requestId: request.requestId,
      recursos: request.recursos,
      razon: "Recursos ocupados, en cola de espera",
      bloqueadoPor: conflicto ? "worker desconocido" : undefined,
    };
    socket.emit(TipoMensaje.LOCK_DENIED, response);
  }

  private liberarLock(socket: Socket, msg: any): void {
    logger.lock(`🔓 Liberando lock de ${msg.workerId}: ${msg.requestId}`, {
      workerId: msg.workerId,
      requestId: msg.requestId,
    });

    // Liberar locks
    this.lockManager.liberar(msg.recursos);

    // Actualizar estado del worker
    this.workerManager.decrementarLocks(msg.workerId);

    // Procesar cola de espera
    this.procesarCola();
  }

  private procesarCola(): void {
    if (this.queueManager.tamaño === 0) return;

    let entry = this.queueManager.obtenerPrimero();
    while (entry) {
      const conflicto = this.lockManager.verificarConflicto(
        entry.request.recursos
      );

      if (!conflicto) {
        const workerPendiente = this.workerManager.obtener(
          entry.request.workerId
        );

        if (
          workerPendiente &&
          workerPendiente.locksActivos >= workerPendiente.capacidad
        ) {
          // Worker está a capacidad, re-encolar
          this.queueManager.agregar(entry.socketId, entry.request);
          entry = this.queueManager.obtenerPrimero();
          continue;
        }

        const socket = this.io.sockets.sockets.get(entry.socketId);
        if (socket) {
          this.concederLock(socket, entry.request);
        }
      } else {
        // Hay conflicto, re-encolar
        this.queueManager.agregar(entry.socketId, entry.request);
      }

      entry = this.queueManager.obtenerPrimero();
    }

    if (this.queueManager.tamaño > 0) {
      logger.lock(`📋 Cola de espera: ${this.queueManager.tamaño} requests`, {
        colaLength: this.queueManager.tamaño,
      });
    }
  }

  private manejarDesconexion(socket: Socket): void {
    const worker = this.workerManager.encontrarPorSocket(socket.id);
    if (!worker) return;

    logger.warn(`⚠️ Trabajador desconectado: ${worker.workerId}`, {
      workerId: worker.workerId,
      socketId: socket.id,
    });

    // Liberar todos los locks del worker
    const locksALiberar = this.lockManager.obtenerPorWorker(worker.workerId);
    for (const [_, lock] of locksALiberar) {
      this.lockManager.liberar(lock.recursos);
    }

    // Eliminar worker
    this.workerManager.eliminar(worker.workerId);

    // Eliminar de la cola
    this.queueManager.eliminarPorWorker(worker.workerId);

    // Procesar cola
    this.procesarCola();

    logger.lock(
      `🔓 Liberados ${locksALiberar.length} locks del trabajador desconectado`,
      { workerId: worker.workerId, locksLiberados: locksALiberar.length }
    );
  }

  private iniciarMonitoreo(): void {
    setInterval(() => {
      this.verificarHeartbeats();
      this.verificarLocksExpirados();
    }, 5000);
  }

  private verificarHeartbeats(): void {
    this.workerManager.verificarHeartbeats(this.io);
  }

  private verificarLocksExpirados(): void {
    const expirados = this.lockManager.verificarExpirados();
    if (expirados.length > 0) {
      this.procesarCola();
    }
  }

  public getEstadisticas() {
    return {
      trabajadoresActivos: this.workerManager.tamaño,
      locksActivos: this.lockManager.tamaño,
      colaEspera: this.queueManager.tamaño,
      trabajadores: this.workerManager.obtenerTodos(),
      locks: this.lockManager.obtenerTodos(),
      cola: this.queueManager.obtenerTodos(),
    };
  }
}
