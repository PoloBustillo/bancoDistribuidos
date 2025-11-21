export enum TipoRecurso {
  CUENTA = "CUENTA",
  TARJETA = "TARJETA",
}

export interface RecursoId {
  tipo: TipoRecurso;
  id: string;
}

export enum Prioridad {
  BAJA = 0,
  NORMAL = 1,
  ALTA = 2,
  CRITICA = 3,
}

export enum TipoMensaje {
  REGISTER_WORKER = "REGISTER_WORKER",
  LOCK_REQUEST = "LOCK_REQUEST",
  LOCK_RELEASE = "LOCK_RELEASE",
  HEARTBEAT = "HEARTBEAT",
  WORKER_REGISTERED = "WORKER_REGISTERED",
  LOCK_GRANTED = "LOCK_GRANTED",
  LOCK_DENIED = "LOCK_DENIED",
  FORCE_RELEASE = "FORCE_RELEASE",
}

export interface MensajeBase {
  tipo: TipoMensaje;
  timestamp: number;
  workerId: string;
  requestId: string;
}

export interface RegisterWorker extends MensajeBase {
  tipo: TipoMensaje.REGISTER_WORKER;
  puerto: number;
  capacidad: number;
  token?: string; // Token de autenticación HMAC
}

export interface LockRequest extends MensajeBase {
  tipo: TipoMensaje.LOCK_REQUEST;
  recursos: RecursoId[];
  prioridad: Prioridad;
  timeout: number;
  operacion: string;
}

export interface LockRelease extends MensajeBase {
  tipo: TipoMensaje.LOCK_RELEASE;
  recursos: RecursoId[];
}

export interface LockGranted extends MensajeBase {
  tipo: TipoMensaje.LOCK_GRANTED;
  recursos: RecursoId[];
  expiresAt: number;
}

export interface LockDenied extends MensajeBase {
  tipo: TipoMensaje.LOCK_DENIED;
  recursos: RecursoId[];
  razon: string;
  bloqueadoPor?: string;
}

export interface Heartbeat extends MensajeBase {
  tipo: TipoMensaje.HEARTBEAT;
  estado: "IDLE" | "BUSY";
  locksActivos: number;
}

export function generarClaveRecurso(recurso: RecursoId): string {
  return `${recurso.tipo}:${recurso.id}`;
}

export function tienenConflicto(
  recursos1: RecursoId[],
  recursos2: RecursoId[]
): boolean {
  const claves1 = new Set(recursos1.map(generarClaveRecurso));
  return recursos2.some((r) => claves1.has(generarClaveRecurso(r)));
}
