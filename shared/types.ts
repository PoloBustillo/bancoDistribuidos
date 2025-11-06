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
