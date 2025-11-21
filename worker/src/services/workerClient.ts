// ========================================
// 🎓 WORKER CLIENT - Cliente de Locks Distribuidos
// ========================================
// Este componente implementa el lado del WORKER en el
// sistema de locks distribuidos.
//
// Conceptos de Sistemas Distribuidos aplicados:
// - Cliente-Servidor: Workers son clientes del coordinador
// - Comunicación asíncrona: Socket.IO para mensajes
// - Heartbeat: Detección de fallas con envío periódico de "estoy vivo"
// - Timeouts: Prevención de espera infinita
// - Manejo de errores: Reconexión automática
// ========================================

import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import { TipoMensaje, TipoRecurso, Prioridad } from "../../../shared/types";
import type {
  RecursoId,
  LockRequest,
  LockRelease,
  LockGranted,
  LockDenied,
  Heartbeat,
  RegisterWorker,
} from "../../../shared/types";

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
  private token: string | null = null;

  // 🎓 ESTADO LOCAL: Locks activos y pendientes
  private locksActivos: Map<string, string[]> = new Map();
  private locksPendientes: Map<string, LockPendiente> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private readonly HEARTBEAT_INTERVAL = 3000; // 3s
  private readonly DEFAULT_LOCK_TIMEOUT = 10000; // 10s

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
    return new Promise(async (resolve, reject) => {
      console.log(`🔌 Conectando al coordinador: ${this.coordinadorUrl}`);

      // Obtener token de autenticación
      try {
        const response = await fetch(
          `${this.coordinadorUrl}/api/generate-token/${this.workerId}`
        );
        const data = await response.json();
        this.token = data.token;
        console.log(`🔐 Token de autenticación obtenido para ${this.workerId}`);
      } catch (error) {
        console.error(`❌ Error obteniendo token: ${error}`);
        reject(new Error("No se pudo obtener token de autenticación"));
        return;
      }

      // ========================================
      // 🏛️ CONEXIÓN CON COORDINADOR
      // ========================================
      // Socket.IO con WebSockets para comunicación
      // bidireccional en tiempo real.
      // Reconexión automática para tolerancia a fallas.
      // ========================================
      this.socket = io(this.coordinadorUrl, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        auth: {
          token: this.token,
        },
      });

      this.socket.on("connect", () => {
        console.log(`✅ Conectado al coordinador`);
        this.registrar();
        this.iniciarHeartbeat(); // 🎓 Iniciar envío de heartbeats
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

      // 🎓 MANEJADORES DE RESPUESTAS DEL COORDINADOR
      this.socket.on(TipoMensaje.LOCK_GRANTED, (msg: LockGranted) => {
        this.manejarLockGranted(msg); // Lock concedido
      });

      this.socket.on(TipoMensaje.LOCK_DENIED, (msg: LockDenied) => {
        this.manejarLockDenied(msg); // Lock denegado (en cola)
      });

      this.socket.on(TipoMensaje.FORCE_RELEASE, (msg: any) => {
        console.log(`⚠️ Forzando liberación de lock: ${msg.requestId}`);
        this.liberarLockLocal(msg.requestId);
      });
    });
  }

  private registrar(): void {
    if (!this.socket) return;

    // ========================================
    // 🎓 REGISTRO DEL WORKER
    // ========================================
    // Al conectarse, el worker se registra en el
    // coordinador enviando su ID, puerto y capacidad.
    // Esto permite al coordinador mantener un registro
    // de todos los workers activos.
    // ========================================
    const msg: RegisterWorker = {
      tipo: TipoMensaje.REGISTER_WORKER,
      timestamp: Date.now(),
      workerId: this.workerId,
      requestId: uuidv4(),
      puerto: this.puerto,
      capacidad: 50,
      token: this.token || undefined,
    };

    this.socket.emit(TipoMensaje.REGISTER_WORKER, msg);
  }

  private iniciarHeartbeat(): void {
    // ========================================
    // 🎓 HEARTBEAT (Detección de Fallas)
    // ========================================
    // Envía un mensaje cada 3 segundos al coordinador
    // para indicar que este worker está vivo y funcional.
    // Si el coordinador no recibe heartbeat por 30s,
    // marca el worker como muerto y libera sus locks.
    // ========================================
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
      estado: this.locksActivos.size > 0 ? "BUSY" : "IDLE", // Estado actual
      locksActivos: this.locksActivos.size, // Cantidad de locks activos
    };

    this.socket.emit(TipoMensaje.HEARTBEAT, msg);
  }

  // ========================================
  // 🎓 SOLICITUD DE LOCK DISTRIBUIDO
  // ========================================
  // Método principal para solicitar acceso exclusivo
  // a uno o más recursos (cuentas).
  //
  // Parámetros:
  // - recursos: Array de recursos a bloquear
  // - operacion: Descripción (ej: "transferencia")
  // - prioridad: BAJA, NORMAL o ALTA
  // - timeout: Tiempo máximo de espera
  //
  // Retorna: ID del lock (para liberarlo después)
  // Lanza excepción si no se concede en el timeout
  // ========================================
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
      // ========================================
      // 🎓 CREACIÓN DE SOLICITUD DE LOCK
      // ========================================
      // Se envía al coordinador con toda la información
      // necesaria para decidir si conceder o encolar
      // ========================================
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

      // ========================================
      // 🎓 TIMEOUT (Prevención de Espera Infinita)
      // ========================================
      // Si el coordinador no responde en el tiempo límite,
      // se rechaza la solicitud automáticamente.
      // Esto previene bloqueos indefinidos.
      // ========================================
      const timeoutId = setTimeout(() => {
        this.locksPendientes.delete(requestId);
        reject(new Error(`Timeout esperando lock: ${operacion}`));
      }, timeout);

      // Registrar solicitud pendiente
      this.locksPendientes.set(requestId, {
        requestId,
        resolve: (granted) => {
          if (granted) {
            resolve(requestId); // ✅ Lock concedido
          } else {
            reject(new Error(`Lock denegado: ${operacion}`)); // ❌ Lock denegado
          }
        },
        reject,
        timeout: timeoutId,
      });

      // Enviar solicitud al coordinador
      this.socket!.emit(TipoMensaje.LOCK_REQUEST, request);
    });
  }

  // ========================================
  // 🎓 LIBERACIÓN DE LOCK
  // ========================================
  // Notifica al coordinador que este worker ha
  // terminado de usar los recursos y libera el lock.
  // El coordinador puede entonces conceder el lock
  // a otro worker que esté esperando en la cola.
  // ========================================
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

  // ============================================
  // Métodos para Locks de TARJETAS
  // ============================================

  async lockTarjeta(
    tarjetaId: string,
    operacion: string,
    prioridad: Prioridad = Prioridad.NORMAL
  ): Promise<string> {
    const recurso: RecursoId = { tipo: TipoRecurso.TARJETA, id: tarjetaId };
    return this.solicitarLock([recurso], operacion, prioridad);
  }

  async lockTarjetas(
    tarjetaIds: string[],
    operacion: string,
    prioridad: Prioridad = Prioridad.NORMAL
  ): Promise<string> {
    const recursos: RecursoId[] = tarjetaIds.map((id) => ({
      tipo: TipoRecurso.TARJETA,
      id,
    }));
    return this.solicitarLock(recursos, operacion, prioridad);
  }

  async unlockTarjeta(requestId: string, tarjetaId: string): Promise<void> {
    const recursos: RecursoId[] = [
      { tipo: TipoRecurso.TARJETA, id: tarjetaId },
    ];
    return this.liberarLock(requestId, recursos);
  }

  async unlockTarjetas(requestId: string, tarjetaIds: string[]): Promise<void> {
    const recursos: RecursoId[] = tarjetaIds.map((id) => ({
      tipo: TipoRecurso.TARJETA,
      id,
    }));
    return this.liberarLock(requestId, recursos);
  }
}
