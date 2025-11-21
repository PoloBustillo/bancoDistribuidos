import type { Server as SocketServer, Socket } from "socket.io";
import { TipoMensaje, generarClaveRecurso } from "@banco/shared/types";
import { CONFIG } from "@banco/shared/config";
import { logger } from "@banco/shared/logger";
import { withErrorHandling } from "@banco/shared/errorHandling";
import { WorkerManager } from "./workers";
import { LockManager } from "./locks";
import { QueueManager } from "./queue";
import { EventManager } from "./events";
import { DeadlockDetector } from "./deadlock";

// Clase principal del Coordinador de Locks Distribuidos
export class LockCoordinator {
  private io: SocketServer;
  private workerManager: WorkerManager;
  private lockManager: LockManager;
  private queueManager: QueueManager;
  private eventManager: EventManager;
  private deadlockDetector: DeadlockDetector;

  constructor(io: SocketServer) {
    this.io = io;
    this.workerManager = new WorkerManager(CONFIG.TIMEOUTS.HEARTBEAT_TIMEOUT);
    this.lockManager = new LockManager(CONFIG.TIMEOUTS.MAX_LOCK_TIME);
    this.queueManager = new QueueManager();
    this.eventManager = new EventManager(this);
    this.deadlockDetector = new DeadlockDetector();

    this.eventManager.configurar(io);
    this.iniciarMonitoreo();
    logger.coordinator(
      "LockCoordinator inicializado con managers especializados + detección de deadlocks"
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
        // Verificar autenticación antes de procesar
        if (!this.workerManager.estaAutenticado(msg.workerId)) {
          logger.warn(
            `❌ Lock request rechazado: worker no autenticado ${msg.workerId}`,
            { workerId: msg.workerId, operacion: msg.operacion }
          );
          socket.emit("auth-error", {
            error: "Worker no autenticado",
            requestId: msg.requestId,
          });
          return;
        }
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

    // Limpiar requests huérfanos antes de procesar
    const huerfanosEliminados = this.queueManager.limpiarHuerfanos(this.io);
    if (huerfanosEliminados > 0) {
      logger.lock(
        `🧹 Eliminados ${huerfanosEliminados} requests huérfanos de la cola`
      );
    }

    const procesados = new Set<string>(); // Evitar procesar el mismo request múltiples veces
    let entry = this.queueManager.obtenerPrimero();

    while (entry && procesados.size < 100) {
      // Límite de seguridad
      procesados.add(entry.request.requestId);

      // Verificar que el socket siga conectado
      const socket = this.io.sockets.sockets.get(entry.socketId);
      if (!socket || !socket.connected) {
        logger.warn(
          `Socket desconectado, eliminando request ${entry.request.requestId}`,
          { workerId: entry.request.workerId }
        );
        entry = this.queueManager.obtenerPrimero();
        continue;
      }

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
          // Worker está a capacidad, re-encolar con backoff
          if (this.queueManager.reencolar(entry)) {
            logger.lock(
              `⏳ Worker a capacidad, re-encolando ${entry.request.operacion} (reintento ${entry.reintentos})`,
              {
                workerId: entry.request.workerId,
                reintentos: entry.reintentos,
              }
            );
          } else {
            // Excedió límite, notificar al worker
            socket.emit(TipoMensaje.LOCK_DENIED, {
              tipo: TipoMensaje.LOCK_DENIED,
              timestamp: Date.now(),
              workerId: entry.request.workerId,
              requestId: entry.request.requestId,
              recursos: entry.request.recursos,
              razon: "Excedió límite de reintentos",
            });
          }
          entry = this.queueManager.obtenerPrimero();
          continue;
        }

        // Sin conflicto, conceder lock
        this.concederLock(socket, entry.request);
        this.deadlockDetector.eliminarEspera(entry.request.workerId);
      } else {
        // Hay conflicto, registrar para detección de deadlock
        for (const recurso of entry.request.recursos) {
          const clave = generarClaveRecurso(recurso);
          const lockActivo = this.lockManager.obtenerLockPorRecurso(clave);
          if (lockActivo) {
            this.deadlockDetector.registrarEspera(
              entry.request.workerId,
              lockActivo.workerId,
              clave
            );
          }
        }

        // Re-encolar con backoff
        if (this.queueManager.reencolar(entry)) {
          logger.lock(
            `⏸️ Recursos ocupados, re-encolando ${entry.request.operacion} (reintento ${entry.reintentos})`,
            {
              workerId: entry.request.workerId,
              reintentos: entry.reintentos,
            }
          );
        } else {
          // Excedió límite, notificar al worker
          socket.emit(TipoMensaje.LOCK_DENIED, {
            tipo: TipoMensaje.LOCK_DENIED,
            timestamp: Date.now(),
            workerId: entry.request.workerId,
            requestId: entry.request.requestId,
            recursos: entry.request.recursos,
            razon: "Excedió límite de reintentos por recursos ocupados",
          });
          this.deadlockDetector.eliminarEspera(entry.request.workerId);
        }
      }

      entry = this.queueManager.obtenerPrimero();
    }

    // Detectar deadlocks después de procesar la cola
    const deadlock = this.deadlockDetector.detectarDeadlock();
    if (deadlock) {
      const victima = this.deadlockDetector.seleccionarVictima(
        deadlock,
        this.queueManager.obtenerTodos().map((q, idx) => ({
          request: q as any,
          socketId: "",
          timestamp: Date.now(),
          reintentos: 0,
        }))
      );

      if (victima) {
        const socket = this.io.sockets.sockets.get(victima.socketId);
        if (socket) {
          socket.emit(TipoMensaje.LOCK_DENIED, {
            tipo: TipoMensaje.LOCK_DENIED,
            timestamp: Date.now(),
            workerId: victima.request.workerId,
            requestId: victima.request.requestId,
            recursos: victima.request.recursos,
            razon: "Cancelado para resolver deadlock",
          });
        }
        this.deadlockDetector.resolverDeadlock(victima);
        this.queueManager.eliminarPorWorker(victima.request.workerId);
      }
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
    // Monitoreo cada 5 segundos
    setInterval(() => {
      this.verificarHeartbeats();
      this.verificarLocksExpirados();
      this.queueManager.limpiarHuerfanos(this.io);
    }, 5000);

    // Limpieza de tokens y deadlocks cada minuto
    setInterval(() => {
      this.workerManager.limpiarTokensExpirados();
      this.deadlockDetector.limpiarEdgesAntiguos();
    }, 60000);
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
      deadlocks: this.deadlockDetector.getEstadisticas(),
      metricas: {
        ...this.queueManager.getMetricas(),
      },
    };
  }

  /**
   * Genera un token para un worker autorizado (uso administrativo)
   */
  public generarTokenWorker(workerId: string): string {
    return this.workerManager.generarToken(workerId);
  }
}
