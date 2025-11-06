// Tipos compartidos entre frontend y backend

export type UUID = string;

// ============================================================================
// ENUMS
// ============================================================================

export enum EstadoCuenta {
  ACTIVA = "ACTIVA",
  BLOQUEADA = "BLOQUEADA",
  CERRADA = "CERRADA",
}

export enum TipoTransaccion {
  DEPOSITO = "DEPOSITO",
  RETIRO = "RETIRO",
  TRANSFERENCIA = "TRANSFERENCIA",
}

export enum EstadoTransaccion {
  COMPLETADA = "COMPLETADA",
  PENDIENTE = "PENDIENTE",
  FALLIDA = "FALLIDA",
}

export enum Frecuencia {
  DIARIA = "DIARIA",
  SEMANAL = "SEMANAL",
  QUINCENAL = "QUINCENAL",
  MENSUAL = "MENSUAL",
  ANUAL = "ANUAL",
}

// ============================================================================
// ENTIDADES
// ============================================================================

export interface Usuario {
  id: UUID;
  nombre: string;
  email: string;
}

// ============== CUENTA BANCARIA ==============

export interface CuentaBancaria {
  id: UUID;
  numeroCuenta: string; // Formato: XXXX-XXXX-XXXX
  titularCuenta: string;
  saldo: number;
  estado: EstadoCuenta;
  limiteRetiroDiario: number;
  limiteTransferencia: number;
  createdAt: Date;
}

// ============== TRANSACCIÓN ==============

export interface Transaccion {
  id: UUID;
  tipo: TipoTransaccion;
  monto: number;
  referencia: string;
  descripcion?: string;
  estado: EstadoTransaccion;
  fecha: Date;
  cuentaOrigenId?: UUID;
  cuentaDestinoId?: UUID;
}

// ============== AUTH ==============

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  mensaje: string;
  token: string;
  usuario: Usuario;
  cuentas: CuentaBancaria[];
}

export interface RegisterRequest {
  nombre: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  mensaje: string;
  usuario: Usuario;
  cuenta: CuentaBancaria;
}

// ============== OPERACIONES ==============

export interface TransferenciaRequest {
  cuentaOrigen: string;
  cuentaDestino: string;
  monto: number;
  descripcion?: string;
}

export interface DepositoRequest {
  numeroCuenta: string;
  monto: number;
}

export interface RetiroRequest {
  numeroCuenta: string;
  monto: number;
}

// ============== WEBSOCKET EVENTS ==============

export interface SocketAuthPayload {
  token: string;
}

export interface SessionConnectedEvent {
  message: string;
  usuario: Usuario;
  sessionId: string;
}

export interface SessionKickedEvent {
  reason: string;
  message: string;
  timestamp: string;
}

export interface CuentaSaldoUpdatedEvent {
  cuentaId: string;
  numeroCuenta: string;
  saldoAnterior: number;
  saldoNuevo: number;
  timestamp: string;
}

export interface TransaccionNewEvent {
  transaccionId: string;
  tipo: TipoTransaccion;
  monto: number;
  descripcion?: string;
  timestamp: string;
}

// ============== TIPOS PARA SERVIDOR DISTRIBUIDO ==============

export interface RespuestaAPI<T = any> {
  exitoso: boolean;
  datos?: T;
  error?: string;
  marca_tiempo: Date;
}

export interface SolicitudDeposito {
  idCuenta: string;
  monto: number;
  descripcion?: string;
}

export interface SolicitudRetiro {
  idCuenta: string;
  monto: number;
  descripcion?: string;
}

export interface SolicitudTransferencia {
  idCuentaOrigen: string;
  idCuentaDestino: string;
  monto: number;
  descripcion?: string;
}

export interface SolicitudTarjeta {
  idCuenta: string;
  tipo: "DEBITO" | "CREDITO" | "PREPAGADA";
  limiteCredito?: number;
}

export interface SolicitudPrestamo {
  idCuenta: string;
  monto: number;
  plazoMeses: number;
}

export interface SolicitudInversion {
  idCuenta: string;
  tipo: "PLAZO_FIJO" | "FONDOS_INVERSION" | "ACCIONES" | "BONOS";
  monto: number;
  plazoMeses?: number;
}
