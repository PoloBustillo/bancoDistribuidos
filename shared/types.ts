/**
 * Tipos compartidos entre frontend y backend
 * Define la estructura de datos del sistema bancario distribuido
 */

// Estados de las transacciones
export enum EstadoTransaccion {
  PENDIENTE = "PENDIENTE",
  COMPLETADA = "COMPLETADA",
  FALLIDA = "FALLIDA",
  BLOQUEADA = "BLOQUEADA", // Bloqueo por acceso concurrente
}

// Tipos de transacciones
export enum TipoTransaccion {
  DEPOSITO = "DEPOSITO",
  RETIRO = "RETIRO",
  TRANSFERENCIA = "TRANSFERENCIA",
  CONSULTA = "CONSULTA",
}

// Cuenta bancaria
export interface CuentaBancaria {
  id: string;
  numeroCuenta: string;
  titularCuenta: string;
  saldo: number;
  fechaCreacion: Date;
  ultimaModificacion: Date;
  version: number; // Control de versión para detectar cambios concurrentes
}

// Transacción
export interface Transaccion {
  id: string;
  idCuenta: string;
  tipo: TipoTransaccion;
  monto: number;
  descripcion: string;
  estado: EstadoTransaccion;
  marca_tiempo: Date;
  idCliente: string; // Identificador del cliente que realizó la transacción
}

// Log de auditoría
export interface LogAuditoria {
  id: string;
  idCuenta: string;
  accion: string;
  detalles: Record<string, any>;
  marca_tiempo: Date;
  idCliente: string;
}

// Respuesta genérica del servidor
export interface RespuestaAPI<T> {
  exitoso: boolean;
  datos?: T;
  error?: string;
  marca_tiempo: Date;
}

// Solicitud de depósito
export interface SolicitudDeposito {
  idCuenta: string;
  monto: number;
  descripcion?: string;
}

// Solicitud de retiro
export interface SolicitudRetiro {
  idCuenta: string;
  monto: number;
  descripcion?: string;
}

// Solicitud de transferencia
export interface SolicitudTransferencia {
  idCuentaOrigen: string;
  idCuentaDestino: string;
  monto: number;
  descripcion?: string;
}

// Información del estado de la base de datos distribuida
export interface EstadoDistribuido {
  cuentas: Map<string, CuentaBancaria>;
  transacciones: Map<string, Transaccion[]>;
  bloqueos: Map<string, InformacionBloqueo>; // Control de recursos compartidos
}

// Información de bloqueo para recursos compartidos
export interface InformacionBloqueo {
  idCuenta: string;
  idCliente: string;
  marca_tiempo: Date;
  expiraEn: Date;
}

// Estado de sincronización
export interface EstadoSincronizacion {
  ultimaSincronizacion: Date;
  transacionesPendientes: Transaccion[];
  cuentasConConflicto: string[];
}

// Cliente conectado
export interface ClienteConectado {
  idCliente: string;
  idSocket: string;
  nombreCliente: string;
  fechaConexion: Date;
  activo: boolean;
}

// ============== TARJETAS ==============

export enum TipoTarjeta {
  DEBITO = "DEBITO",
  CREDITO = "CREDITO",
  PREPAGADA = "PREPAGADA",
}

export enum EstadoTarjeta {
  ACTIVA = "ACTIVA",
  BLOQUEADA = "BLOQUEADA",
  VENCIDA = "VENCIDA",
  CANCELADA = "CANCELADA",
}

export interface Tarjeta {
  id: string;
  numeroTarjeta: string;
  idCuenta: string;
  tipo: TipoTarjeta;
  nombreTitular: string;
  fechaExpiracion: Date;
  cvv: string;
  limiteCredito?: number;
  saldoDisponible?: number;
  estado: EstadoTarjeta;
  fechaEmision: Date;
}

// ============== PRÉSTAMOS ==============

export enum EstadoPrestamo {
  ACTIVO = "ACTIVO",
  PAGADO = "PAGADO",
  VENCIDO = "VENCIDO",
  CANCELADO = "CANCELADO",
}

export interface PagoPrestamo {
  numeroCuota: number;
  monto: number;
  fecha: Date;
  capital: number;
  interes: number;
  saldoRestante: number;
}

export interface Prestamo {
  id: string;
  idCuenta: string;
  monto: number;
  tasaInteres: number;
  plazoMeses: number;
  cuotaMensual: number;
  saldoPendiente: number;
  cuotasPagadas: number;
  fechaSolicitud: Date;
  fechaAprobacion?: Date;
  fechaProximoPago: Date;
  estado: EstadoPrestamo;
  historialPagos: PagoPrestamo[];
}

// ============== INVERSIONES ==============

export enum TipoInversion {
  PLAZO_FIJO = "PLAZO_FIJO",
  FONDOS_INVERSION = "FONDOS_INVERSION",
  ACCIONES = "ACCIONES",
  BONOS = "BONOS",
}

export enum EstadoInversion {
  ACTIVA = "ACTIVA",
  VENCIDA = "VENCIDA",
  CANCELADA = "CANCELADA",
}

export interface Inversion {
  id: string;
  idCuenta: string;
  tipo: TipoInversion;
  monto: number;
  tasaRendimiento: number;
  fechaInicio: Date;
  fechaVencimiento?: Date;
  rendimientoAcumulado: number;
  renovacionAutomatica?: boolean;
  estado: EstadoInversion;
}

// ============== BENEFICIARIOS ==============

export interface Beneficiario {
  id: string;
  idCuenta: string;
  numeroCuentaDestino: string;
  nombreBeneficiario: string;
  banco: string;
  alias: string;
  frecuente: boolean;
}

// ============== NOTIFICACIONES ==============

export enum TipoNotificacion {
  DEPOSITO = "DEPOSITO",
  RETIRO = "RETIRO",
  TRANSFERENCIA = "TRANSFERENCIA",
  PAGO_TARJETA = "PAGO_TARJETA",
  ALERTA_SEGURIDAD = "ALERTA_SEGURIDAD",
  VENCIMIENTO = "VENCIMIENTO",
  PROMOCION = "PROMOCION",
  PRESTAMO = "PRESTAMO",
  INVERSION = "INVERSION",
}

export enum PrioridadNotificacion {
  ALTA = "ALTA",
  MEDIA = "MEDIA",
  BAJA = "BAJA",
}

export interface Notificacion {
  id: string;
  idCuenta: string;
  tipo: TipoNotificacion;
  mensaje: string;
  leida: boolean;
  fecha: Date;
  prioridad: PrioridadNotificacion;
}

// ============== PAGOS PROGRAMADOS ==============

export enum Frecuencia {
  DIARIA = "DIARIA",
  SEMANAL = "SEMANAL",
  QUINCENAL = "QUINCENAL",
  MENSUAL = "MENSUAL",
  ANUAL = "ANUAL",
}

export interface PagoProgramado {
  id: string;
  idCuentaOrigen: string;
  idCuentaDestino: string;
  monto: number;
  frecuencia: Frecuencia;
  proximoPago: Date;
  descripcion: string;
  activo: boolean;
}

// ============== LÍMITES Y RESTRICCIONES ==============

export interface LimitesCuenta {
  limiteRetiroDiario: number;
  limiteTransferenciaDiaria: number;
  limiteCompraInternacional: number;
  limiteCompraNacional: number;
  retirosDiarios: number;
  transferenciasDiarias: number;
  comprasInternacionalesDiarias: number;
  comprasNacionalesDiarias: number;
  ultimoReinicio: Date;
}

// ============== SOLICITUDES ==============

export interface SolicitudTarjeta {
  idCuenta: string;
  tipo: TipoTarjeta;
  limiteCredito?: number;
}

export interface SolicitudPrestamo {
  idCuenta: string;
  monto: number;
  plazoMeses: number;
}

export interface SolicitudInversion {
  idCuenta: string;
  tipo: TipoInversion;
  monto: number;
  plazoMeses?: number;
}
