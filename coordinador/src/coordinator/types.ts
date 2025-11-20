// Tipos e interfaces para el Coordinador de Locks Distribuidos
import type { LockRequest, RecursoId } from "../../../shared/types";

export interface LockInfo {
  recursos: RecursoId[];
  workerId: string;
  requestId: string;
  timestamp: number;
  expiresAt: number;
  prioridad: number;
  operacion: string;
}

export interface LockQueueEntry {
  request: LockRequest;
  socketId: string;
  timestamp: number;
}

export interface WorkerInfo {
  workerId: string;
  socketId: string;
  puerto: number;
  estado: string;
  ultimoHeartbeat: number;
  locksActivos: number;
  capacidad: number;
}
