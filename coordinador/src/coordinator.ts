import type { Server as SocketServer, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import type {
  LockRequest,
  LockRelease,
  LockGranted,
  LockDenied,
  Heartbeat,
  RegisterWorker,
  RecursoId,
} from "./shared/types";
import { TipoMensaje, generarClaveRecurso } from "./shared/types";

// ========================================
// 🎓 COORDINADOR CENTRAL DE LOCKS
// ========================================
// Implementa el patrón COORDINADOR-TRABAJADOR donde:
// - Coordinador: Gestiona acceso exclusivo a recursos compartidos
// - Trabajadores: Solicitan permisos para acceder a recursos
//
// CONCEPTOS APLICADOS:
// - Exclusión mutua distribuida
// - Tabla de locks centralizada
// - Cola de espera con prioridades
// - Detección de workers muertos (heartbeat)
// - Timeouts para prevenir deadlocks permanentes
// ========================================

interface LockInfo {
  recursos: RecursoId[];
  workerId: string;
  requestId: string;
  timestamp: number;
  expiresAt: number;
  prioridad: number;
  operacion: string;
}

interface LockQueueEntry {
  request: LockRequest;
  socketId: string;
  timestamp: number;
}

interface WorkerInfo {
  workerId: string;
  socketId: string;
  puerto: number;
  estado: "IDLE" | "BUSY";
  ultimoHeartbeat: number;
  locksActivos: number;
  capacidad: number;
}

export class LockCoordinator {
  private io: SocketServer;

  // ========================================
  // 🎓 TABLA DE LOCKS ACTIVOS (Estado compartido)
  // ========================================
  // Mapa de recursos → información del lock
  // Key: "CUENTA:abc-123"
  // Value: { workerId, timestamp, etc. }
  // ========================================
  private locksActivos: Map<string, LockInfo> = new Map();

  // ========================================
  // 🎓 COLA DE PRIORIDAD
  // ========================================
  // Solicitudes que no pudieron ser atendidas
  // se encolan y se procesan cuando se liberen recursos
  // ========================================
  private cola: LockQueueEntry[] = [];

  // ========================================
  // 🎓 REGISTRO DE WORKERS (Fault Tolerance)
  // ========================================
  // Información de workers conectados para detectar fallos
  // ========================================
  private trabajadores: Map<string, WorkerInfo> = new Map();

  private readonly HEARTBEAT_TIMEOUT = 15000; // 🎓 Timeout para detectar workers muertos
  private readonly MAX_LOCK_TIME = 30000;

  constructor(io: SocketServer) {
    this.io = io;
    this.inicializarEventos();
    this.iniciarMonitoreo();
    console.log("🎯 LockCoordinator inicializado");
  }

  private inicializarEventos(): void {
    this.io.on("connection", (socket: Socket) => {
      console.log(`🔌 Nueva conexión: ${socket.id}`);

      socket.on(TipoMensaje.REGISTER_WORKER, (msg: RegisterWorker) => {
        this.registrarTrabajador(socket, msg);
      });

      socket.on(TipoMensaje.LOCK_REQUEST, (msg: LockRequest) => {
        this.procesarSolicitudLock(socket, msg);
      });

      socket.on(TipoMensaje.LOCK_RELEASE, (msg: LockRelease) => {
        this.liberarLock(socket, msg);
      });

      socket.on(TipoMensaje.HEARTBEAT, (msg: Heartbeat) => {
        this.actualizarHeartbeat(msg);
      });

      socket.on("disconnect", () => {
        this.manejarDesconexion(socket);
      });
    });
  }

  private registrarTrabajador(socket: Socket, msg: RegisterWorker): void {
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

    console.log(
      `✅ Trabajador registrado: ${msg.workerId} (puerto ${msg.puerto})`
    );

    socket.emit(TipoMensaje.WORKER_REGISTERED, {
      tipo: TipoMensaje.WORKER_REGISTERED,
      workerId: msg.workerId,
      timestamp: Date.now(),
      requestId: uuidv4(),
    });
  }

  private procesarSolicitudLock(socket: Socket, request: LockRequest): void {
    console.log(
      `📥 Lock request de ${request.workerId}: ${request.operacion} (${request.recursos.length} recursos)`
    );

    // Si el worker está al máximo de su capacidad, no intentamos concederle
    // más locks; lo enviamos a la cola para que se procese cuando libere
    // recursos (evita sobrecargar un worker con demasiadas operaciones)
    const solicitante = this.trabajadores.get(request.workerId);
    if (solicitante && solicitante.locksActivos >= solicitante.capacidad) {
      console.log(
        `⚠️ Worker ${request.workerId} alcanzó su capacidad (${solicitante.capacidad}), encolando request ${request.requestId}`
      );
      this.agregarACola(socket, request);
      return;
    }

    // ========================================
    // 🎓 VERIFICACIÓN DE CONFLICTOS
    // ========================================
    // Verifica si algún recurso solicitado ya está bloqueado.
    // Si hay conflicto → request va a COLA
    // Si no hay conflicto → lock se CONCEDE inmediatamente
    // ========================================
    const conflicto = this.verificarConflicto(request.recursos);

    if (!conflicto) {
      // ✅ Recurso disponible → EXCLUSIÓN MUTUA garantizada
      this.concederLock(socket, request);
    } else {
      // ⏳ Recurso ocupado → Agregar a COLA DE ESPERA
      this.agregarACola(socket, request);
    }
  }

  private verificarConflicto(recursos: RecursoId[]): LockInfo | null {
    // ========================================
    // 🎓 DETECCIÓN DE CONFLICTOS
    // ========================================
    // Recorre los recursos solicitados y verifica
    // si alguno ya está en la tabla de locks activos
    // ========================================
    for (const recurso of recursos) {
      const clave = generarClaveRecurso(recurso);
      const lockActivo = this.locksActivos.get(clave);
      if (lockActivo) {
        return lockActivo; // Conflicto encontrado
      }
    }
    return null; // No hay conflictos
  }

  private concederLock(socket: Socket, request: LockRequest): void {
    const now = Date.now();
    const expiresAt = now + Math.min(request.timeout, this.MAX_LOCK_TIME);

    // ========================================
    // 🎓 CONCESIÓN DE LOCK (Exclusión Mutua)
    // ========================================
    // Registra el lock en la tabla de locks activos.
    // A partir de ahora, ningún otro worker puede acceder
    // a estos recursos hasta que se liberen.
    // ========================================
    const lockInfo: LockInfo = {
      recursos: request.recursos,
      workerId: request.workerId,
      requestId: request.requestId,
      timestamp: now,
      expiresAt,
      prioridad: request.prioridad,
      operacion: request.operacion,
    };

    // ========================================
    // 🎓 ACTUALIZACIÓN DE TABLA DE LOCKS
    // ========================================
    // Registra cada recurso en la tabla de locks activos
    // para prevenir acceso concurrente
    // ========================================
    for (const recurso of request.recursos) {
      const clave = generarClaveRecurso(recurso);
      this.locksActivos.set(clave, lockInfo);
    }

    // ========================================
    // 🎓 ACTUALIZACIÓN DE ESTADO DE WORKER
    // ========================================
    // Marca el worker como ocupado y aumenta su
    // contador de locks para monitoreo
    // ========================================
    const worker = this.trabajadores.get(request.workerId);
    if (worker) {
      worker.locksActivos++;
      worker.estado = "BUSY";
    }

    const response: LockGranted = {
      tipo: TipoMensaje.LOCK_GRANTED,
      timestamp: now,
      workerId: request.workerId,
      requestId: request.requestId,
      recursos: request.recursos,
      expiresAt,
    };

    socket.emit(TipoMensaje.LOCK_GRANTED, response);

    console.log(
      `✅ Lock concedido a ${request.workerId}: ${
        request.operacion
      } (expira en ${(expiresAt - now) / 1000}s)`
    );
  }

  private agregarACola(socket: Socket, request: LockRequest): void {
    // ========================================
    // 🎓 COLA DE ESPERA CON PRIORIDADES
    // ========================================
    // Si el recurso está ocupado, la solicitud se
    // agrega a una cola ordenada por prioridad.
    // Prioridades: ALTA > MEDIA > BAJA
    // Dentro de cada prioridad: FIFO (First In, First Out)
    // ========================================
    const entry: LockQueueEntry = {
      request,
      socketId: socket.id,
      timestamp: Date.now(),
    };

    this.cola.push(entry);

    // ========================================
    // 🎓 ORDENAMIENTO DE LA COLA
    // ========================================
    // Ordenamiento por 2 criterios:
    // 1. Prioridad (ALTA > MEDIA > BAJA)
    // 2. Timestamp (primero en llegar, primero en salir)
    // Esto previene inanición (starvation) de requests
    // de baja prioridad
    // ========================================
    this.cola.sort((a, b) => {
      if (a.request.prioridad !== b.request.prioridad) {
        return b.request.prioridad - a.request.prioridad; // Mayor prioridad primero
      }
      return a.request.timestamp - b.request.timestamp; // FIFO dentro de misma prioridad
    });

    console.log(
      `⏳ Lock request agregado a cola: ${request.workerId} (posición ${this.cola.length})`
    );

    const conflicto = this.verificarConflicto(request.recursos);
    const response: LockDenied = {
      tipo: TipoMensaje.LOCK_DENIED,
      timestamp: Date.now(),
      workerId: request.workerId,
      requestId: request.requestId,
      recursos: request.recursos,
      razon: "Recursos ocupados, en cola de espera",
      bloqueadoPor: conflicto?.workerId,
    };

    socket.emit(TipoMensaje.LOCK_DENIED, response);
  }

  private liberarLock(socket: Socket, msg: LockRelease): void {
    console.log(`🔓 Liberando lock de ${msg.workerId}: ${msg.requestId}`);

    // ========================================
    // 🎓 LIBERACIÓN DE LOCKS
    // ========================================
    // Elimina los recursos de la tabla de locks activos,
    // permitiendo que otros workers puedan accederlos.
    // Después de liberar, se procesa la cola para ver
    // si algún request pendiente puede ejecutarse.
    // ========================================
    for (const recurso of msg.recursos) {
      const clave = generarClaveRecurso(recurso);
      this.locksActivos.delete(clave);
    }

    // ========================================
    // 🎓 ACTUALIZACIÓN DE ESTADO DEL WORKER
    // ========================================
    // Reduce el contador de locks activos del worker
    // Si llega a 0 → worker vuelve a estado IDLE
    // ========================================
    const worker = this.trabajadores.get(msg.workerId);
    if (worker) {
      worker.locksActivos = Math.max(0, worker.locksActivos - 1);
      if (worker.locksActivos === 0) {
        worker.estado = "IDLE";
      }
    }

    // Procesar cola → ver si algún request pendiente puede ejecutarse ahora
    this.procesarCola();
  }

  private procesarCola(): void {
    if (this.cola.length === 0) return;

    // ========================================
    // 🎓 PROCESAMIENTO DE COLA DE ESPERA
    // ========================================
    // Recorre la cola (ya ordenada por prioridad)
    // e intenta conceder locks a los requests que
    // ya no tienen conflictos.
    //
    // Previene inanición (starvation) al procesar
    // siempre en orden de prioridad y FIFO.
    // ========================================
    const pendientes: LockQueueEntry[] = [];

    for (const entry of this.cola) {
      const conflicto = this.verificarConflicto(entry.request.recursos);

      if (!conflicto) {
        // ✅ Recurso ya disponible → conceder lock
        // Antes de conceder, comprobar que el worker solicitante no esté
        // al máximo de su capacidad
        const workerPendiente = this.trabajadores.get(entry.request.workerId);
        if (
          workerPendiente &&
          workerPendiente.locksActivos >= workerPendiente.capacidad
        ) {
          // mantiene en pendientes para revisar más tarde
          pendientes.push(entry);
          continue;
        }

        const socket = this.io.sockets.sockets.get(entry.socketId);
        if (socket) {
          this.concederLock(socket, entry.request);
        }
      } else {
        // ⏳ Todavía hay conflicto → mantener en cola
        pendientes.push(entry);
      }
    }

    // Actualizar cola solo con requests pendientes
    this.cola = pendientes;

    if (this.cola.length > 0) {
      console.log(`📋 Cola de espera: ${this.cola.length} requests`);
    }
  }

  private actualizarHeartbeat(msg: Heartbeat): void {
    // ========================================
    // 🎓 HEARTBEAT (Detección de Fallas)
    // ========================================
    // Los workers envían heartbeats cada 10s.
    // El coordinador actualiza el timestamp.
    // Si un worker no envía heartbeat por 30s,
    // se considera muerto y sus locks se liberan.
    //
    // Concepto: Fault Tolerance (Tolerancia a Fallas)
    // ========================================
    const worker = this.trabajadores.get(msg.workerId);
    if (worker) {
      worker.ultimoHeartbeat = Date.now();
      worker.estado = msg.estado;
      worker.locksActivos = msg.locksActivos;
    }
  }

  private manejarDesconexion(socket: Socket): void {
    const worker = Array.from(this.trabajadores.values()).find(
      (w) => w.socketId === socket.id
    );

    if (!worker) return;

    console.log(`⚠️ Trabajador desconectado: ${worker.workerId}`);

    const locksALiberar = Array.from(this.locksActivos.entries()).filter(
      ([_, lock]) => lock.workerId === worker.workerId
    );

    for (const [clave, _] of locksALiberar) {
      this.locksActivos.delete(clave);
    }

    this.trabajadores.delete(worker.workerId);
    this.procesarCola();

    console.log(
      `🔓 Liberados ${locksALiberar.length} locks del trabajador desconectado`
    );
  }

  private iniciarMonitoreo(): void {
    setInterval(() => {
      this.verificarHeartbeats();
      this.verificarLocksExpirados();
    }, 5000);
  }

  private verificarHeartbeats(): void {
    const now = Date.now();

    for (const [workerId, worker] of this.trabajadores) {
      const tiempoSinHeartbeat = now - worker.ultimoHeartbeat;

      if (tiempoSinHeartbeat > this.HEARTBEAT_TIMEOUT) {
        console.log(
          `💀 Trabajador sin heartbeat: ${workerId} (${tiempoSinHeartbeat}ms)`
        );

        const socket = this.io.sockets.sockets.get(worker.socketId);
        if (socket) {
          socket.disconnect(true);
        }
      }
    }
  }

  private verificarLocksExpirados(): void {
    const now = Date.now();
    const expirados: string[] = [];

    for (const [clave, lock] of this.locksActivos) {
      if (now > lock.expiresAt) {
        expirados.push(clave);
        console.log(`⏰ Lock expirado: ${lock.operacion} de ${lock.workerId}`);
      }
    }

    for (const clave of expirados) {
      this.locksActivos.delete(clave);
    }

    if (expirados.length > 0) {
      this.procesarCola();
    }
  }

  public getEstadisticas() {
    return {
      trabajadoresActivos: this.trabajadores.size,
      locksActivos: this.locksActivos.size,
      colaEspera: this.cola.length,
      trabajadores: Array.from(this.trabajadores.values()),
      locks: Array.from(this.locksActivos.entries()).map(([clave, lock]) => ({
        recurso: clave,
        workerId: lock.workerId,
        operacion: lock.operacion,
        expiraEn: Math.max(0, lock.expiresAt - Date.now()),
      })),
    };
  }
}
