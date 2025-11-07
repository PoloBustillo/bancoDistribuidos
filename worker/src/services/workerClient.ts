import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import { TipoMensaje, TipoRecurso, Prioridad } from "../shared/types";
import type {
  RecursoId,
  LockRequest,
  LockRelease,
  LockGranted,
  LockDenied,
  Heartbeat,
  RegisterWorker,
} from "../shared/types";

interface LockPendiente {
  requestId: string;
  resolve: (granted: boolean) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class WorkerClient {
  private socket: Socket | null = null;
  private workerId: string;
  private puerto: number;
  private coordinadorUrl: string;
  private conectado: boolean = false;
  private locksActivos: Map<string, string[]> = new Map();
  private locksPendientes: Map<string, LockPendiente> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private readonly HEARTBEAT_INTERVAL = 3000;
  private readonly DEFAULT_LOCK_TIMEOUT = 10000;

  constructor(
    workerId: string,
    puerto: number,
    coordinadorUrl: string = "http://localhost:4000"
  ) {
    this.workerId = workerId;
    this.puerto = puerto;
    this.coordinadorUrl = coordinadorUrl;
  }

  async conectar(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`🔌 Conectando al coordinador: ${this.coordinadorUrl}`);

      this.socket = io(this.coordinadorUrl, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      });

      this.socket.on("connect", () => {
        console.log(`✅ Conectado al coordinador`);
        this.registrar();
        this.iniciarHeartbeat();
        this.conectado = true;
        resolve();
      });

      this.socket.on("disconnect", () => {
        console.log(`⚠️ Desconectado del coordinador`);
        this.conectado = false;
        this.detenerHeartbeat();
      });

      this.socket.on("connect_error", (error: Error) => {
        console.log(`❌ Error de conexión: ${error.message}`);
        reject(error);
      });

      this.socket.on(TipoMensaje.WORKER_REGISTERED, () => {
        console.log(`✅ Trabajador registrado: ${this.workerId}`);
      });

      this.socket.on(TipoMensaje.LOCK_GRANTED, (msg: LockGranted) => {
        this.manejarLockGranted(msg);
      });

      this.socket.on(TipoMensaje.LOCK_DENIED, (msg: LockDenied) => {
        this.manejarLockDenied(msg);
      });

      this.socket.on(TipoMensaje.FORCE_RELEASE, (msg: any) => {
        console.log(`⚠️ Forzando liberación de lock: ${msg.requestId}`);
        this.liberarLockLocal(msg.requestId);
      });
    });
  }

  private registrar(): void {
    if (!this.socket) return;

    const msg: RegisterWorker = {
      tipo: TipoMensaje.REGISTER_WORKER,
      timestamp: Date.now(),
      workerId: this.workerId,
      requestId: uuidv4(),
      puerto: this.puerto,
      capacidad: 50,
    };

    this.socket.emit(TipoMensaje.REGISTER_WORKER, msg);
  }

  private iniciarHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.enviarHeartbeat();
    }, this.HEARTBEAT_INTERVAL);
  }

  private detenerHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private enviarHeartbeat(): void {
    if (!this.socket || !this.conectado) return;

    const msg: Heartbeat = {
      tipo: TipoMensaje.HEARTBEAT,
      timestamp: Date.now(),
      workerId: this.workerId,
      requestId: uuidv4(),
      estado: this.locksActivos.size > 0 ? "BUSY" : "IDLE",
      locksActivos: this.locksActivos.size,
    };

    this.socket.emit(TipoMensaje.HEARTBEAT, msg);
  }

  async solicitarLock(
    recursos: RecursoId[],
    operacion: string,
    prioridad: Prioridad = Prioridad.NORMAL,
    timeout: number = this.DEFAULT_LOCK_TIMEOUT
  ): Promise<string> {
    if (!this.socket || !this.conectado) {
      throw new Error("No conectado al coordinador");
    }

    const requestId = uuidv4();

    return new Promise((resolve, reject) => {
      const request: LockRequest = {
        tipo: TipoMensaje.LOCK_REQUEST,
        timestamp: Date.now(),
        workerId: this.workerId,
        requestId,
        recursos,
        prioridad,
        timeout,
        operacion,
      };

      const timeoutId = setTimeout(() => {
        this.locksPendientes.delete(requestId);
        reject(new Error(`Timeout esperando lock: ${operacion}`));
      }, timeout);

      this.locksPendientes.set(requestId, {
        requestId,
        resolve: (granted) => {
          if (granted) {
            resolve(requestId);
          } else {
            reject(new Error(`Lock denegado: ${operacion}`));
          }
        },
        reject,
        timeout: timeoutId,
      });

      this.socket!.emit(TipoMensaje.LOCK_REQUEST, request);
    });
  }

  async liberarLock(requestId: string, recursos: RecursoId[]): Promise<void> {
    if (!this.socket || !this.conectado) {
      this.liberarLockLocal(requestId);
      return;
    }

    const msg: LockRelease = {
      tipo: TipoMensaje.LOCK_RELEASE,
      timestamp: Date.now(),
      workerId: this.workerId,
      requestId,
      recursos,
    };

    this.socket.emit(TipoMensaje.LOCK_RELEASE, msg);
    this.liberarLockLocal(requestId);
  }

  private liberarLockLocal(requestId: string): void {
    this.locksActivos.delete(requestId);
  }

  private manejarLockGranted(msg: LockGranted): void {
    const pendiente = this.locksPendientes.get(msg.requestId);

    if (pendiente) {
      clearTimeout(pendiente.timeout);
      this.locksPendientes.delete(msg.requestId);

      const clavesRecursos = msg.recursos.map((r) => `${r.tipo}:${r.id}`);
      this.locksActivos.set(msg.requestId, clavesRecursos);

      console.log(`✅ Lock concedido: ${msg.requestId}`);
      pendiente.resolve(true);
    }
  }

  private manejarLockDenied(msg: LockDenied): void {
    const pendiente = this.locksPendientes.get(msg.requestId);

    if (pendiente) {
      clearTimeout(pendiente.timeout);
      this.locksPendientes.delete(msg.requestId);

      console.log(`❌ Lock denegado: ${msg.razon}`);
    }
  }

  desconectar(): void {
    this.detenerHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.conectado = false;
  }

  estaConectado(): boolean {
    return this.conectado;
  }

  async lockCuenta(
    cuentaId: string,
    operacion: string,
    prioridad: Prioridad = Prioridad.NORMAL
  ): Promise<string> {
    const recurso: RecursoId = { tipo: TipoRecurso.CUENTA, id: cuentaId };
    return this.solicitarLock([recurso], operacion, prioridad);
  }

  async lockCuentas(
    cuentaIds: string[],
    operacion: string,
    prioridad: Prioridad = Prioridad.NORMAL
  ): Promise<string> {
    const recursos: RecursoId[] = cuentaIds.map((id) => ({
      tipo: TipoRecurso.CUENTA,
      id,
    }));
    return this.solicitarLock(recursos, operacion, prioridad);
  }

  async unlockCuentas(requestId: string, cuentaIds: string[]): Promise<void> {
    const recursos: RecursoId[] = cuentaIds.map((id) => ({
      tipo: TipoRecurso.CUENTA,
      id,
    }));
    return this.liberarLock(requestId, recursos);
  }
}
