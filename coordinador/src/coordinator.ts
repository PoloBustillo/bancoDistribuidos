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
import {
  TipoMensaje,
  generarClaveRecurso,
  tienenConflicto,
} from "./shared/types";

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
  private locksActivos: Map<string, LockInfo> = new Map();
  private cola: LockQueueEntry[] = [];
  private trabajadores: Map<string, WorkerInfo> = new Map();

  private readonly HEARTBEAT_TIMEOUT = 15000;
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

    const conflicto = this.verificarConflicto(request.recursos);

    if (!conflicto) {
      this.concederLock(socket, request);
    } else {
      this.agregarACola(socket, request);
    }
  }

  private verificarConflicto(recursos: RecursoId[]): LockInfo | null {
    for (const recurso of recursos) {
      const clave = generarClaveRecurso(recurso);
      const lockActivo = this.locksActivos.get(clave);
      if (lockActivo) {
        return lockActivo;
      }
    }
    return null;
  }

  private concederLock(socket: Socket, request: LockRequest): void {
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
    const entry: LockQueueEntry = {
      request,
      socketId: socket.id,
      timestamp: Date.now(),
    };

    this.cola.push(entry);
    this.cola.sort((a, b) => {
      if (a.request.prioridad !== b.request.prioridad) {
        return b.request.prioridad - a.request.prioridad;
      }
      return a.request.timestamp - b.request.timestamp;
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

    for (const recurso of msg.recursos) {
      const clave = generarClaveRecurso(recurso);
      this.locksActivos.delete(clave);
    }

    const worker = this.trabajadores.get(msg.workerId);
    if (worker) {
      worker.locksActivos = Math.max(0, worker.locksActivos - 1);
      if (worker.locksActivos === 0) {
        worker.estado = "IDLE";
      }
    }

    this.procesarCola();
  }

  private procesarCola(): void {
    if (this.cola.length === 0) return;

    const pendientes: LockQueueEntry[] = [];

    for (const entry of this.cola) {
      const conflicto = this.verificarConflicto(entry.request.recursos);

      if (!conflicto) {
        const socket = this.io.sockets.sockets.get(entry.socketId);
        if (socket) {
          this.concederLock(socket, entry.request);
        }
      } else {
        pendientes.push(entry);
      }
    }

    this.cola = pendientes;

    if (this.cola.length > 0) {
      console.log(`📋 Cola de espera: ${this.cola.length} requests`);
    }
  }

  private actualizarHeartbeat(msg: Heartbeat): void {
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
