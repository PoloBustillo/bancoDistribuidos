// ========================================
// 🎓 EVENT EMITTER - Sistema de Eventos
// ========================================
// Emite eventos cuando hay cambios en cuentas/tarjetas
// para notificar a los clientes conectados en tiempo real.
//
// CONCEPTOS DE SISTEMAS DISTRIBUIDOS:
// - Publish/Subscribe pattern
// - Event-driven architecture
// - Real-time synchronization
// ========================================

import { EventEmitter } from "events";

export enum EventType {
  // Eventos de cuentas
  CUENTA_ACTUALIZADA = "cuenta:actualizada",
  CUENTA_CREADA = "cuenta:creada",

  // Eventos de transacciones
  TRANSFERENCIA_RECIBIDA = "transferencia:recibida",
  TRANSFERENCIA_ENVIADA = "transferencia:enviada",
  DEPOSITO_REALIZADO = "deposito:realizado",
  RETIRO_REALIZADO = "retiro:realizado",

  // Eventos de usuarios en cuentas compartidas
  USUARIO_AGREGADO = "usuario:agregado",
  USUARIO_REMOVIDO = "usuario:removido",

  // Eventos de tarjetas
  TARJETA_CREADA = "tarjeta:creada",
  TARJETA_ESTADO_CAMBIADO = "tarjeta:estado_cambiado",

  // Eventos de sesión
  SESION_EXPIRADA = "sesion:expirada",
}

export interface BaseEvent {
  type: EventType;
  timestamp: Date;
  workerId: string;
}

export interface CuentaActualizadaEvent extends BaseEvent {
  type: EventType.CUENTA_ACTUALIZADA;
  cuentaId: string;
  saldoAnterior: number;
  saldoNuevo: number;
  usuariosAfectados: string[]; // IDs de usuarios con acceso a esta cuenta
}

export interface TransferenciaEvent extends BaseEvent {
  type: EventType.TRANSFERENCIA_RECIBIDA | EventType.TRANSFERENCIA_ENVIADA;
  cuentaId: string;
  monto: number;
  cuentaOrigenId?: string;
  cuentaDestinoId?: string;
  usuarioId: string;
}

export interface DepositoEvent extends BaseEvent {
  type: EventType.DEPOSITO_REALIZADO;
  cuentaId: string;
  monto: number;
  usuarioId: string;
}

export interface RetiroEvent extends BaseEvent {
  type: EventType.RETIRO_REALIZADO;
  cuentaId: string;
  monto: number;
  usuarioId: string;
}

export interface UsuarioCuentaEvent extends BaseEvent {
  type: EventType.USUARIO_AGREGADO | EventType.USUARIO_REMOVIDO;
  cuentaId: string;
  usuarioId: string;
  usuarioEmail: string;
  rol?: string;
}

export interface TarjetaEvent extends BaseEvent {
  type: EventType.TARJETA_CREADA | EventType.TARJETA_ESTADO_CAMBIADO;
  tarjetaId: string;
  usuarioId: string;
  cuentaId: string;
  estado?: string;
}

export type BankingEvent =
  | CuentaActualizadaEvent
  | TransferenciaEvent
  | DepositoEvent
  | RetiroEvent
  | UsuarioCuentaEvent
  | TarjetaEvent;

class BankingEventEmitter extends EventEmitter {
  private workerId: string;

  constructor(workerId: string = "worker-unknown") {
    super();
    this.workerId = workerId;
    this.setMaxListeners(100); // Aumentar límite para múltiples suscriptores
  }

  setWorkerId(workerId: string) {
    this.workerId = workerId;
  }

  // ========================================
  // 🎓 EMITIR EVENTOS DE CUENTA
  // ========================================

  emitCuentaActualizada(
    cuentaId: string,
    saldoAnterior: number,
    saldoNuevo: number,
    usuariosAfectados: string[]
  ) {
    const event: CuentaActualizadaEvent = {
      type: EventType.CUENTA_ACTUALIZADA,
      timestamp: new Date(),
      workerId: this.workerId,
      cuentaId,
      saldoAnterior,
      saldoNuevo,
      usuariosAfectados,
    };

    this.emit(EventType.CUENTA_ACTUALIZADA, event);

    // También emitir evento específico por cuenta para filtrado
    this.emit(`cuenta:${cuentaId}`, event);
  }

  // ========================================
  // 🎓 EMITIR EVENTOS DE TRANSACCIONES
  // ========================================

  emitTransferenciaEnviada(
    cuentaOrigenId: string,
    cuentaDestinoId: string,
    monto: number,
    usuarioId: string
  ) {
    const event: TransferenciaEvent = {
      type: EventType.TRANSFERENCIA_ENVIADA,
      timestamp: new Date(),
      workerId: this.workerId,
      cuentaId: cuentaOrigenId,
      cuentaOrigenId,
      cuentaDestinoId,
      monto,
      usuarioId,
    };

    this.emit(EventType.TRANSFERENCIA_ENVIADA, event);
    this.emit(`cuenta:${cuentaOrigenId}`, event);
  }

  emitTransferenciaRecibida(
    cuentaDestinoId: string,
    cuentaOrigenId: string,
    monto: number,
    usuarioId: string
  ) {
    const event: TransferenciaEvent = {
      type: EventType.TRANSFERENCIA_RECIBIDA,
      timestamp: new Date(),
      workerId: this.workerId,
      cuentaId: cuentaDestinoId,
      cuentaOrigenId,
      cuentaDestinoId,
      monto,
      usuarioId,
    };

    this.emit(EventType.TRANSFERENCIA_RECIBIDA, event);
    this.emit(`cuenta:${cuentaDestinoId}`, event);
  }

  emitDeposito(cuentaId: string, monto: number, usuarioId: string) {
    const event: DepositoEvent = {
      type: EventType.DEPOSITO_REALIZADO,
      timestamp: new Date(),
      workerId: this.workerId,
      cuentaId,
      monto,
      usuarioId,
    };

    this.emit(EventType.DEPOSITO_REALIZADO, event);
    this.emit(`cuenta:${cuentaId}`, event);
  }

  emitRetiro(cuentaId: string, monto: number, usuarioId: string) {
    const event: RetiroEvent = {
      type: EventType.RETIRO_REALIZADO,
      timestamp: new Date(),
      workerId: this.workerId,
      cuentaId,
      monto,
      usuarioId,
    };

    this.emit(EventType.RETIRO_REALIZADO, event);
    this.emit(`cuenta:${cuentaId}`, event);
  }

  // ========================================
  // 🎓 EMITIR EVENTOS DE CUENTAS COMPARTIDAS
  // ========================================

  emitUsuarioAgregado(
    cuentaId: string,
    usuarioId: string,
    usuarioEmail: string,
    rol: string
  ) {
    const event: UsuarioCuentaEvent = {
      type: EventType.USUARIO_AGREGADO,
      timestamp: new Date(),
      workerId: this.workerId,
      cuentaId,
      usuarioId,
      usuarioEmail,
      rol,
    };

    this.emit(EventType.USUARIO_AGREGADO, event);
    this.emit(`cuenta:${cuentaId}`, event);
    this.emit(`usuario:${usuarioId}`, event);
  }

  emitUsuarioRemovido(
    cuentaId: string,
    usuarioId: string,
    usuarioEmail: string
  ) {
    const event: UsuarioCuentaEvent = {
      type: EventType.USUARIO_REMOVIDO,
      timestamp: new Date(),
      workerId: this.workerId,
      cuentaId,
      usuarioId,
      usuarioEmail,
    };

    this.emit(EventType.USUARIO_REMOVIDO, event);
    this.emit(`cuenta:${cuentaId}`, event);
    this.emit(`usuario:${usuarioId}`, event);
  }

  // ========================================
  // 🎓 EMITIR EVENTOS DE TARJETAS
  // ========================================

  emitTarjetaCreada(tarjetaId: string, usuarioId: string, cuentaId: string) {
    const event: TarjetaEvent = {
      type: EventType.TARJETA_CREADA,
      timestamp: new Date(),
      workerId: this.workerId,
      tarjetaId,
      usuarioId,
      cuentaId,
    };

    this.emit(EventType.TARJETA_CREADA, event);
    this.emit(`usuario:${usuarioId}`, event);
  }

  emitTarjetaEstadoCambiado(
    tarjetaId: string,
    usuarioId: string,
    cuentaId: string,
    estado: string
  ) {
    const event: TarjetaEvent = {
      type: EventType.TARJETA_ESTADO_CAMBIADO,
      timestamp: new Date(),
      workerId: this.workerId,
      tarjetaId,
      usuarioId,
      cuentaId,
      estado,
    };

    this.emit(EventType.TARJETA_ESTADO_CAMBIADO, event);
    this.emit(`usuario:${usuarioId}`, event);
  }

  // ========================================
  // 🎓 SUSCRIPCIONES
  // ========================================

  // Suscribirse a eventos de una cuenta específica
  onCuentaEvent(cuentaId: string, callback: (event: BankingEvent) => void) {
    this.on(`cuenta:${cuentaId}`, callback);
    return () => this.off(`cuenta:${cuentaId}`, callback);
  }

  // Suscribirse a eventos de un usuario específico
  onUsuarioEvent(usuarioId: string, callback: (event: BankingEvent) => void) {
    this.on(`usuario:${usuarioId}`, callback);
    return () => this.off(`usuario:${usuarioId}`, callback);
  }

  // Suscribirse a todos los eventos de transacciones
  onTransaccionEvent(callback: (event: BankingEvent) => void) {
    const types = [
      EventType.TRANSFERENCIA_RECIBIDA,
      EventType.TRANSFERENCIA_ENVIADA,
      EventType.DEPOSITO_REALIZADO,
      EventType.RETIRO_REALIZADO,
    ];

    types.forEach((type) => this.on(type, callback));

    return () => {
      types.forEach((type) => this.off(type, callback));
    };
  }
}

// Singleton instance
export const bankingEvents = new BankingEventEmitter();
