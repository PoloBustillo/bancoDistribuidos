import { Usuario } from "@prisma/client";

// ============================================================================
// EVENTOS DEL SOCKET
// ============================================================================

export interface SocketData {
  usuario: Usuario;
  jti: string;
}

// ============================================================================
// EVENTOS CLIENTE → SERVIDOR
// ============================================================================

export interface AuthConnectPayload {
  token: string;
}

export interface AuthLogoutPayload {
  // Vacío, se usa el token del socket
}

// ============================================================================
// EVENTOS SERVIDOR → CLIENTE
// ============================================================================

export interface SessionConnectedPayload {
  message: string;
  usuario: {
    id: string;
    nombre: string;
    email: string;
  };
  sessionId: string;
}

export interface SessionKickedPayload {
  reason: string;
  message: string;
  timestamp: Date;
}

export interface CuentaSaldoUpdatedPayload {
  cuentaId: string;
  numeroCuenta: string;
  saldoAnterior: number;
  saldoNuevo: number;
  timestamp: Date;
}

export interface TransaccionNewPayload {
  transaccionId: string;
  tipo: string;
  monto: number;
  descripcion?: string;
  timestamp: Date;
}

export interface TransaccionCompletedPayload {
  transaccionId: string;
  estado: string;
  timestamp: Date;
}

// ============================================================================
// NOMBRES DE EVENTOS
// ============================================================================

export const SOCKET_EVENTS = {
  // Cliente → Servidor
  AUTH_CONNECT: "auth:connect",
  AUTH_LOGOUT: "auth:logout",

  // Servidor → Cliente
  SESSION_CONNECTED: "session:connected",
  SESSION_KICKED: "session:kicked",
  
  // Eventos de negocio
  CUENTA_SALDO_UPDATED: "cuenta:saldo_updated",
  TRANSACCION_NEW: "transaccion:new",
  TRANSACCION_COMPLETED: "transaccion:completed",
} as const;
