// ========================================
// 🎯 INTERFACES INTERNAS DEL COORDINADOR
// ========================================
// Interfaces tipadas para eliminar uso de 'any'
// y mejorar type safety en el coordinador
// ========================================

import type { Socket } from "socket.io";
import type {
  RegisterWorker,
  LockRequest,
  LockRelease,
  Heartbeat,
  LockGranted,
  LockDenied,
  RecursoId,
} from "@banco/shared/types";
import type { LockQueueEntry, WorkerInfo } from "./types";

// ========================================
// Interfaces para Coordinador
// ========================================

/**
 * Interface para el coordinador que EventManager necesita
 */
export interface ILockCoordinator {
  manejarRegistroWorker(socket: Socket, msg: RegisterWorker): void;
  manejarHeartbeat(socket: Socket, msg: Heartbeat): void;
  manejarLockRequest(socket: Socket, msg: LockRequest): void;
  manejarLockRelease(socket: Socket, msg: LockRelease): void;
  manejarEstadoRequest(socket: Socket): void;
  manejarDisconnect(socket: Socket): void;
}

/**
 * Configuración del coordinador
 */
export interface CoordinatorConfig {
  heartbeatTimeout: number;
  maxLockTime: number;
  maxColaProcessing: number; // Límite de seguridad para procesamiento
  monitoringInterval: number;
  cleanupInterval: number;
}

// ========================================
// Interfaces para Respuestas
// ========================================

/**
 * Razones para denegar un lock
 */
export enum LockDeniedReason {
  EN_COLA = "Recursos ocupados, en cola de espera",
  RECURSOS_OCUPADOS = "Excedió límite de reintentos por recursos ocupados",
  CAPACIDAD_EXCEDIDA = "Excedió límite de reintentos",
  CAPACIDAD_WORKER = "Worker a capacidad máxima",
  DEADLOCK_RESUELTO = "Cancelado para resolver deadlock",
  NO_AUTENTICADO = "Worker no autenticado",
}

/**
 * Datos para construir respuesta de lock denegado
 */
export interface LockDeniedData {
  workerId: string;
  requestId: string;
  recursos: RecursoId[];
  razon: LockDeniedReason | string;
  bloqueadoPor?: string;
}

/**
 * Resultado del procesamiento de un entry en cola
 */
export enum ProcessingResult {
  GRANTED = "granted", // Lock concedido
  REQUEUED = "requeued", // Re-encolado para reintento
  REJECTED = "rejected", // Rechazado (excedió límite)
  SKIPPED = "skipped", // Saltado (socket desconectado)
}

/**
 * Contexto para procesar una entrada de cola
 */
export interface QueueEntryContext {
  socket: Socket;
  entry: LockQueueEntry;
  isConnected: boolean;
  hasConflict: boolean;
  worker?: WorkerInfo;
}

// ========================================
// Constantes de Configuración
// ========================================

export const COORDINATOR_CONSTANTS = {
  MAX_QUEUE_PROCESSING_ITERATIONS: 100,
  DEFAULT_MONITORING_INTERVAL: 5000, // 5s
  DEFAULT_CLEANUP_INTERVAL: 60000, // 60s
} as const;
