/**
 * Gestor de recursos compartidos distribuidos
 * Implementa control de bloqueos y sincronización para evitar condiciones de carrera
 */

import { v4 as uuidv4 } from "uuid";
import {
  CuentaBancaria,
  Transaccion,
  TipoTransaccion,
  EstadoTransaccion,
  LogAuditoria,
  InformacionBloqueo,
  EstadoDistribuido,
  ClienteConectado,
  Tarjeta,
  TipoTarjeta,
  EstadoTarjeta,
  Prestamo,
  EstadoPrestamo,
  PagoPrestamo,
  Inversion,
  TipoInversion,
  EstadoInversion,
  Beneficiario,
  Notificacion,
  TipoNotificacion,
  PrioridadNotificacion,
  PagoProgramado,
  Frecuencia,
  LimitesCuenta,
  SolicitudTarjeta,
  SolicitudPrestamo,
  SolicitudInversion,
} from "../../shared/types";

export class GestorRecursosDistribuidos {
  private cuentas: Map<string, CuentaBancaria> = new Map();
  private transacciones: Map<string, Transaccion[]> = new Map();
  private bloqueos: Map<string, InformacionBloqueo> = new Map();
  private logAuditoria: Map<string, LogAuditoria[]> = new Map();
  private clientesConectados: Map<string, ClienteConectado> = new Map();

  // Nuevos mapas para entidades adicionales
  private tarjetas: Map<string, Tarjeta[]> = new Map();
  private prestamos: Map<string, Prestamo[]> = new Map();
  private inversiones: Map<string, Inversion[]> = new Map();
  private beneficiarios: Map<string, Beneficiario[]> = new Map();
  private notificaciones: Map<string, Notificacion[]> = new Map();
  private pagosProgramados: Map<string, PagoProgramado[]> = new Map();
  private limites: Map<string, LimitesCuenta> = new Map();

  private readonly TIEMPO_ESPERA_BLOQUEO = 5000; // 5 segundos
  private readonly TASA_INTERES_BASE = 12; // 12% anual para préstamos
  private readonly TASA_RENDIMIENTO_BASE = 8; // 8% anual para inversiones

  constructor() {
    this.inicializarCuentasPorDefecto();
    this.inicializarDatosEjemplo();
  }

  /**
   * Inicializa cuentas de ejemplo para demostración
   */
  private inicializarCuentasPorDefecto(): void {
    const cuentas: CuentaBancaria[] = [
      {
        id: "cta-001",
        numeroCuenta: "1000001",
        titularCuenta: "Juan Pérez",
        saldo: 5000,
        fechaCreacion: new Date(),
        ultimaModificacion: new Date(),
        version: 1,
      },
      {
        id: "cta-002",
        numeroCuenta: "1000002",
        titularCuenta: "María García",
        saldo: 3500,
        fechaCreacion: new Date(),
        ultimaModificacion: new Date(),
        version: 1,
      },
      {
        id: "cta-003",
        numeroCuenta: "1000003",
        titularCuenta: "Carlos López",
        saldo: 7200,
        fechaCreacion: new Date(),
        ultimaModificacion: new Date(),
        version: 1,
      },
    ];

    cuentas.forEach((cuenta) => {
      this.cuentas.set(cuenta.id, cuenta);
      this.transacciones.set(cuenta.id, []);
      this.logAuditoria.set(cuenta.id, []);
      this.tarjetas.set(cuenta.id, []);
      this.prestamos.set(cuenta.id, []);
      this.inversiones.set(cuenta.id, []);
      this.beneficiarios.set(cuenta.id, []);
      this.notificaciones.set(cuenta.id, []);
      this.pagosProgramados.set(cuenta.id, []);

      // Establecer límites por defecto
      this.limites.set(cuenta.id, {
        limiteRetiroDiario: 5000,
        limiteTransferenciaDiaria: 10000,
        limiteCompraInternacional: 3000,
        limiteCompraNacional: 8000,
        retirosDiarios: 0,
        transferenciasDiarias: 0,
        comprasInternacionalesDiarias: 0,
        comprasNacionalesDiarias: 0,
        ultimoReinicio: new Date(),
      });
    });
  }

  /**
   * Inicializa datos de ejemplo (tarjetas, préstamos, etc.)
   */
  private inicializarDatosEjemplo(): void {
    // Tarjeta de débito para Juan Pérez
    const cuenta1 = this.cuentas.get("cta-001");
    const tarjeta1: Tarjeta = {
      id: "tar-001",
      numeroTarjeta: "4532123456789012",
      idCuenta: "cta-001",
      tipo: TipoTarjeta.DEBITO,
      nombreTitular: cuenta1?.titularCuenta || "Juan Pérez",
      fechaEmision: new Date(),
      fechaExpiracion: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000), // 3 años
      cvv: "123",
      estado: EstadoTarjeta.ACTIVA,
      limiteCredito: 0,
      saldoDisponible: 0,
    };
    this.tarjetas.get("cta-001")?.push(tarjeta1);

    // Tarjeta de crédito para María García
    const cuenta2 = this.cuentas.get("cta-002");
    const tarjeta2: Tarjeta = {
      id: "tar-002",
      numeroTarjeta: "5425123456789013",
      idCuenta: "cta-002",
      tipo: TipoTarjeta.CREDITO,
      nombreTitular: cuenta2?.titularCuenta || "María García",
      fechaEmision: new Date(),
      fechaExpiracion: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000),
      cvv: "456",
      estado: EstadoTarjeta.ACTIVA,
      limiteCredito: 5000,
      saldoDisponible: 5000,
    };
    this.tarjetas.get("cta-002")?.push(tarjeta2);

    // Préstamo activo para Carlos López
    const prestamo1: Prestamo = {
      id: "pres-001",
      idCuenta: "cta-003",
      monto: 10000,
      tasaInteres: this.TASA_INTERES_BASE,
      plazoMeses: 12,
      cuotaMensual: 888.49,
      fechaSolicitud: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // hace 2 meses
      fechaAprobacion: new Date(Date.now() - 58 * 24 * 60 * 60 * 1000),
      fechaProximoPago: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
      estado: EstadoPrestamo.ACTIVO,
      saldoPendiente: 8226.02,
      cuotasPagadas: 2,
      historialPagos: [
        {
          numeroCuota: 1,
          monto: 888.49,
          capital: 788.49,
          interes: 100,
          fecha: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          saldoRestante: 9211.51,
        },
        {
          numeroCuota: 2,
          monto: 888.49,
          capital: 796.38,
          interes: 92.11,
          fecha: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          saldoRestante: 8226.02,
        },
      ],
    };
    this.prestamos.get("cta-003")?.push(prestamo1);

    // Inversión para Juan Pérez
    const inversion1: Inversion = {
      id: "inv-001",
      idCuenta: "cta-001",
      tipo: TipoInversion.PLAZO_FIJO,
      monto: 2000,
      tasaRendimiento: this.TASA_RENDIMIENTO_BASE,
      fechaInicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // hace 1 mes
      fechaVencimiento: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000), // en 11 meses
      estado: EstadoInversion.ACTIVA,
      rendimientoAcumulado: 13.33,
      renovacionAutomatica: true,
    };
    this.inversiones.get("cta-001")?.push(inversion1);

    // Beneficiarios para María García
    const beneficiarios: Beneficiario[] = [
      {
        id: "ben-001",
        idCuenta: "cta-002",
        numeroCuentaDestino: "1000001",
        nombreBeneficiario: "Juan Pérez",
        banco: "Banco Demo",
        alias: "Juan",
        frecuente: true,
      },
      {
        id: "ben-002",
        idCuenta: "cta-002",
        numeroCuentaDestino: "5000123456",
        nombreBeneficiario: "Servicios Públicos",
        banco: "Banco Servicios",
        alias: "Luz y Agua",
        frecuente: true,
      },
    ];
    this.beneficiarios.set("cta-002", beneficiarios);

    // Notificaciones de ejemplo
    this.crearNotificacion(
      "cta-001",
      TipoNotificacion.DEPOSITO,
      "Depósito recibido de $500",
      PrioridadNotificacion.BAJA
    );
    this.crearNotificacion(
      "cta-003",
      TipoNotificacion.PRESTAMO,
      "Próximo pago de préstamo en 28 días",
      PrioridadNotificacion.MEDIA
    );
  }

  /**
   * Obtiene una cuenta por ID
   */
  obtenerCuenta(idCuenta: string): CuentaBancaria | null {
    return this.cuentas.get(idCuenta) || null;
  }

  /**
   * Obtiene todas las cuentas
   */
  obtenerTodasLasCuentas(): CuentaBancaria[] {
    return Array.from(this.cuentas.values());
  }

  /**
   * Registra un cliente conectado
   */
  registrarClienteConectado(
    idCliente: string,
    idSocket: string,
    nombreCliente: string
  ): ClienteConectado {
    const cliente: ClienteConectado = {
      idCliente,
      idSocket,
      nombreCliente,
      fechaConexion: new Date(),
      activo: true,
    };
    this.clientesConectados.set(idCliente, cliente);
    return cliente;
  }

  /**
   * Obtiene clientes conectados
   */
  obtenerClientesConectados(): ClienteConectado[] {
    return Array.from(this.clientesConectados.values()).filter((c) => c.activo);
  }

  /**
   * Desconecta un cliente
   */
  desconectarCliente(idCliente: string): void {
    const cliente = this.clientesConectados.get(idCliente);
    if (cliente) {
      cliente.activo = false;
    }
  }

  /**
   * Intenta adquirir un bloqueo sobre una cuenta
   * Implementa mecanismo de exclusión mutua
   */
  async adquirirBloqueo(idCuenta: string, idCliente: string): Promise<boolean> {
    // Verificar si la cuenta existe
    if (!this.cuentas.has(idCuenta)) {
      throw new Error(`Cuenta no encontrada: ${idCuenta}`);
    }

    const bloqueoExistente = this.bloqueos.get(idCuenta);
    const ahora = new Date();

    // Si ya hay un bloqueo, verificar si ha expirado
    if (bloqueoExistente) {
      if (ahora < bloqueoExistente.expiraEn) {
        // El bloqueo aún es válido
        if (bloqueoExistente.idCliente !== idCliente) {
          return false; // No se puede adquirir el bloqueo
        }
      } else {
        // El bloqueo ha expirado, eliminarlo
        this.bloqueos.delete(idCuenta);
      }
    }

    // Adquirir el bloqueo
    const infoBloqueo: InformacionBloqueo = {
      idCuenta,
      idCliente,
      marca_tiempo: ahora,
      expiraEn: new Date(ahora.getTime() + this.TIEMPO_ESPERA_BLOQUEO),
    };

    this.bloqueos.set(idCuenta, infoBloqueo);
    return true;
  }

  /**
   * Libera un bloqueo sobre una cuenta
   */
  liberarBloqueo(idCuenta: string, idCliente: string): boolean {
    const bloqueo = this.bloqueos.get(idCuenta);

    if (!bloqueo) {
      return false;
    }

    if (bloqueo.idCliente !== idCliente) {
      throw new Error(
        `No tienes permiso para liberar el bloqueo de esta cuenta`
      );
    }

    this.bloqueos.delete(idCuenta);
    return true;
  }

  /**
   * Realiza un depósito en una cuenta
   */
  async depositar(
    idCuenta: string,
    monto: number,
    descripcion: string,
    idCliente: string
  ): Promise<Transaccion> {
    // Adquirir bloqueo
    const bloqueoAdquirido = await this.adquirirBloqueo(idCuenta, idCliente);
    if (!bloqueoAdquirido) {
      throw new Error(
        "No se puede adquirir el bloqueo sobre la cuenta. Intenta más tarde."
      );
    }

    try {
      const cuenta = this.cuentas.get(idCuenta);
      if (!cuenta) {
        throw new Error(`Cuenta no encontrada: ${idCuenta}`);
      }

      if (monto <= 0) {
        throw new Error("El monto debe ser mayor a 0");
      }

      // Realizar la operación
      cuenta.saldo += monto;
      cuenta.version++;
      cuenta.ultimaModificacion = new Date();

      // Registrar transacción
      const transaccion: Transaccion = {
        id: uuidv4(),
        idCuenta,
        tipo: TipoTransaccion.DEPOSITO,
        monto,
        descripcion: descripcion || "Depósito",
        estado: EstadoTransaccion.COMPLETADA,
        marca_tiempo: new Date(),
        idCliente,
      };

      const transaccionesDesCuenta = this.transacciones.get(idCuenta) || [];
      transaccionesDesCuenta.push(transaccion);
      this.transacciones.set(idCuenta, transaccionesDesCuenta);

      // Registrar en auditoría
      this.registrarAuditoria(idCuenta, `DEPOSITO: +$${monto}`, {
        monto,
        idCliente,
      });

      return transaccion;
    } finally {
      this.liberarBloqueo(idCuenta, idCliente);
    }
  }

  /**
   * Realiza un retiro de una cuenta
   */
  async retirar(
    idCuenta: string,
    monto: number,
    descripcion: string,
    idCliente: string
  ): Promise<Transaccion> {
    const bloqueoAdquirido = await this.adquirirBloqueo(idCuenta, idCliente);
    if (!bloqueoAdquirido) {
      throw new Error(
        "No se puede adquirir el bloqueo sobre la cuenta. Intenta más tarde."
      );
    }

    try {
      const cuenta = this.cuentas.get(idCuenta);
      if (!cuenta) {
        throw new Error(`Cuenta no encontrada: ${idCuenta}`);
      }

      if (monto <= 0) {
        throw new Error("El monto debe ser mayor a 0");
      }

      if (cuenta.saldo < monto) {
        throw new Error("Fondos insuficientes");
      }

      cuenta.saldo -= monto;
      cuenta.version++;
      cuenta.ultimaModificacion = new Date();

      const transaccion: Transaccion = {
        id: uuidv4(),
        idCuenta,
        tipo: TipoTransaccion.RETIRO,
        monto,
        descripcion: descripcion || "Retiro",
        estado: EstadoTransaccion.COMPLETADA,
        marca_tiempo: new Date(),
        idCliente,
      };

      const transaccionesDesCuenta = this.transacciones.get(idCuenta) || [];
      transaccionesDesCuenta.push(transaccion);
      this.transacciones.set(idCuenta, transaccionesDesCuenta);

      this.registrarAuditoria(idCuenta, `RETIRO: -$${monto}`, {
        monto,
        idCliente,
      });

      return transaccion;
    } finally {
      this.liberarBloqueo(idCuenta, idCliente);
    }
  }

  /**
   * Realiza una transferencia entre cuentas
   * Implementa transacción atómica para dos recursos
   */
  async transferir(
    idCuentaOrigen: string,
    idCuentaDestino: string,
    monto: number,
    descripcion: string,
    idCliente: string
  ): Promise<{ origen: Transaccion; destino: Transaccion }> {
    // Adquirir bloqueos en ambas cuentas (siempre en el mismo orden para evitar deadlock)
    const primeraId = [idCuentaOrigen, idCuentaDestino].sort()[0];
    const segundaId = [idCuentaOrigen, idCuentaDestino].sort()[1];

    const bloqueo1 = await this.adquirirBloqueo(primeraId, idCliente);
    if (!bloqueo1) {
      throw new Error(
        "No se puede adquirir el bloqueo sobre la primera cuenta"
      );
    }

    try {
      const bloqueo2 = await this.adquirirBloqueo(segundaId, idCliente);
      if (!bloqueo2) {
        throw new Error(
          "No se puede adquirir el bloqueo sobre la segunda cuenta"
        );
      }

      try {
        const cuentaOrigen = this.cuentas.get(idCuentaOrigen);
        const cuentaDestino = this.cuentas.get(idCuentaDestino);

        if (!cuentaOrigen || !cuentaDestino) {
          throw new Error("Una o ambas cuentas no existen");
        }

        if (monto <= 0) {
          throw new Error("El monto debe ser mayor a 0");
        }

        if (cuentaOrigen.saldo < monto) {
          throw new Error("Fondos insuficientes en la cuenta origen");
        }

        // Realizar la transferencia atómica
        cuentaOrigen.saldo -= monto;
        cuentaOrigen.version++;
        cuentaOrigen.ultimaModificacion = new Date();

        cuentaDestino.saldo += monto;
        cuentaDestino.version++;
        cuentaDestino.ultimaModificacion = new Date();

        // Registrar transacciones
        const transaccionOrigen: Transaccion = {
          id: uuidv4(),
          idCuenta: idCuentaOrigen,
          tipo: TipoTransaccion.TRANSFERENCIA,
          monto,
          descripcion: descripcion || "Transferencia enviada",
          estado: EstadoTransaccion.COMPLETADA,
          marca_tiempo: new Date(),
          idCliente,
        };

        const transaccionDestino: Transaccion = {
          id: uuidv4(),
          idCuenta: idCuentaDestino,
          tipo: TipoTransaccion.TRANSFERENCIA,
          monto,
          descripcion: descripcion || "Transferencia recibida",
          estado: EstadoTransaccion.COMPLETADA,
          marca_tiempo: new Date(),
          idCliente,
        };

        const transaccionesOrigen =
          this.transacciones.get(idCuentaOrigen) || [];
        transaccionesOrigen.push(transaccionOrigen);
        this.transacciones.set(idCuentaOrigen, transaccionesOrigen);

        const transaccionesDestino =
          this.transacciones.get(idCuentaDestino) || [];
        transaccionesDestino.push(transaccionDestino);
        this.transacciones.set(idCuentaDestino, transaccionesDestino);

        this.registrarAuditoria(
          idCuentaOrigen,
          `TRANSFERENCIA SALIDA: -$${monto} a ${idCuentaDestino}`,
          { monto, idCuentaDestino, idCliente }
        );
        this.registrarAuditoria(
          idCuentaDestino,
          `TRANSFERENCIA ENTRADA: +$${monto} desde ${idCuentaOrigen}`,
          { monto, idCuentaOrigen, idCliente }
        );

        return { origen: transaccionOrigen, destino: transaccionDestino };
      } finally {
        this.liberarBloqueo(segundaId, idCliente);
      }
    } finally {
      this.liberarBloqueo(primeraId, idCliente);
    }
  }

  /**
   * Obtiene el historial de transacciones de una cuenta
   */
  obtenerHistorialTransacciones(idCuenta: string): Transaccion[] {
    return this.transacciones.get(idCuenta) || [];
  }

  /**
   * Registra un evento en el log de auditoría
   */
  private registrarAuditoria(
    idCuenta: string,
    accion: string,
    detalles: Record<string, any>
  ): void {
    const registro: LogAuditoria = {
      id: uuidv4(),
      idCuenta,
      accion,
      detalles,
      marca_tiempo: new Date(),
      idCliente: detalles.idCliente || "sistema",
    };

    const logs = this.logAuditoria.get(idCuenta) || [];
    logs.push(registro);
    this.logAuditoria.set(idCuenta, logs);
  }

  /**
   * Obtiene el log de auditoría de una cuenta
   */
  obtenerLogAuditoria(idCuenta: string): LogAuditoria[] {
    return this.logAuditoria.get(idCuenta) || [];
  }

  /**
   * Obtiene información sobre bloqueos activos
   */
  obtenerBloqueoActivos(): InformacionBloqueo[] {
    const ahora = new Date();
    const bloqueoActivos = Array.from(this.bloqueos.values()).filter(
      (bloqueo) => bloqueo.expiraEn > ahora
    );

    // Limpiar bloqueos expirados
    Array.from(this.bloqueos.entries()).forEach(([idCuenta, bloqueo]) => {
      if (bloqueo.expiraEn <= ahora) {
        this.bloqueos.delete(idCuenta);
      }
    });

    return bloqueoActivos;
  }

  /**
   * Obtiene el estado actual del sistema distribuido
   */
  obtenerEstadoDistribuido(): EstadoDistribuido {
    return {
      cuentas: new Map(this.cuentas),
      transacciones: new Map(this.transacciones),
      bloqueos: new Map(this.bloqueos),
    };
  }

  // ==================== MÉTODOS PARA TARJETAS ====================

  /**
   * Crea una nueva tarjeta para una cuenta
   */
  async crearTarjeta(solicitud: SolicitudTarjeta): Promise<Tarjeta> {
    const cuenta = this.obtenerCuenta(solicitud.idCuenta);
    if (!cuenta) {
      throw new Error("Cuenta no encontrada");
    }

    // Generar número de tarjeta (simulado)
    const numeroTarjeta = this.generarNumeroTarjeta();
    const cvv = Math.floor(100 + Math.random() * 900).toString();

    const tarjeta: Tarjeta = {
      id: uuidv4(),
      numeroTarjeta,
      idCuenta: solicitud.idCuenta,
      tipo: solicitud.tipo,
      nombreTitular: cuenta.titularCuenta,
      fechaEmision: new Date(),
      fechaExpiracion: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000),
      cvv,
      estado: EstadoTarjeta.ACTIVA,
      limiteCredito: solicitud.limiteCredito || 0,
      saldoDisponible: solicitud.limiteCredito || 0,
    };

    const tarjetas = this.tarjetas.get(solicitud.idCuenta) || [];
    tarjetas.push(tarjeta);
    this.tarjetas.set(solicitud.idCuenta, tarjetas);

    this.crearNotificacion(
      solicitud.idCuenta,
      TipoNotificacion.PAGO_TARJETA,
      `Nueva tarjeta ${
        solicitud.tipo
      } creada terminada en ${numeroTarjeta.slice(-4)}`,
      PrioridadNotificacion.MEDIA
    );

    return tarjeta;
  }

  /**
   * Genera un número de tarjeta simulado
   */
  private generarNumeroTarjeta(): string {
    const bin = "4532"; // BIN simulado para tarjetas Visa
    let numero = bin;
    for (let i = 0; i < 12; i++) {
      numero += Math.floor(Math.random() * 10);
    }
    return numero;
  }

  /**
   * Obtiene todas las tarjetas de una cuenta
   */
  obtenerTarjetas(idCuenta: string): Tarjeta[] {
    return this.tarjetas.get(idCuenta) || [];
  }

  /**
   * Bloquea una tarjeta
   */
  bloquearTarjeta(idTarjeta: string, idCuenta: string): boolean {
    const tarjetas = this.tarjetas.get(idCuenta);
    if (!tarjetas) return false;

    const tarjeta = tarjetas.find((t) => t.id === idTarjeta);
    if (!tarjeta) return false;

    tarjeta.estado = EstadoTarjeta.BLOQUEADA;
    this.crearNotificacion(
      idCuenta,
      TipoNotificacion.ALERTA_SEGURIDAD,
      `Tarjeta terminada en ${tarjeta.numeroTarjeta.slice(
        -4
      )} ha sido bloqueada`,
      PrioridadNotificacion.ALTA
    );

    return true;
  }

  /**
   * Desbloquea una tarjeta
   */
  desbloquearTarjeta(idTarjeta: string, idCuenta: string): boolean {
    const tarjetas = this.tarjetas.get(idCuenta);
    if (!tarjetas) return false;

    const tarjeta = tarjetas.find((t) => t.id === idTarjeta);
    if (!tarjeta) return false;

    tarjeta.estado = EstadoTarjeta.ACTIVA;
    this.crearNotificacion(
      idCuenta,
      TipoNotificacion.PAGO_TARJETA,
      `Tarjeta terminada en ${tarjeta.numeroTarjeta.slice(
        -4
      )} ha sido desbloqueada`,
      PrioridadNotificacion.MEDIA
    );

    return true;
  }

  // ==================== MÉTODOS PARA PRÉSTAMOS ====================

  /**
   * Solicita un préstamo para una cuenta
   */
  async solicitarPrestamo(solicitud: SolicitudPrestamo): Promise<Prestamo> {
    const cuenta = this.obtenerCuenta(solicitud.idCuenta);
    if (!cuenta) {
      throw new Error("Cuenta no encontrada");
    }

    // Validar solvencia (simplificado: saldo >= 10% del monto)
    if (cuenta.saldo < solicitud.monto * 0.1) {
      throw new Error("Saldo insuficiente para aprobar el préstamo");
    }

    // Calcular cuota mensual usando fórmula de amortización
    const tasaMensual = this.TASA_INTERES_BASE / 12 / 100;
    const cuotaMensual =
      (solicitud.monto *
        tasaMensual *
        Math.pow(1 + tasaMensual, solicitud.plazoMeses)) /
      (Math.pow(1 + tasaMensual, solicitud.plazoMeses) - 1);

    const prestamo: Prestamo = {
      id: uuidv4(),
      idCuenta: solicitud.idCuenta,
      monto: solicitud.monto,
      tasaInteres: this.TASA_INTERES_BASE,
      plazoMeses: solicitud.plazoMeses,
      cuotaMensual: Math.round(cuotaMensual * 100) / 100,
      saldoPendiente: solicitud.monto,
      cuotasPagadas: 0,
      fechaSolicitud: new Date(),
      fechaAprobacion: new Date(),
      fechaProximoPago: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      estado: EstadoPrestamo.ACTIVO,
      historialPagos: [],
    };

    const prestamos = this.prestamos.get(solicitud.idCuenta) || [];
    prestamos.push(prestamo);
    this.prestamos.set(solicitud.idCuenta, prestamos);

    // Depositar el monto del préstamo en la cuenta
    await this.depositar(
      solicitud.idCuenta,
      solicitud.monto,
      "sistema",
      "Desembolso de préstamo"
    );

    this.crearNotificacion(
      solicitud.idCuenta,
      TipoNotificacion.PRESTAMO,
      `Préstamo de $${solicitud.monto} aprobado. Cuota mensual: $${prestamo.cuotaMensual}`,
      PrioridadNotificacion.ALTA
    );

    return prestamo;
  }

  /**
   * Realiza un pago de cuota de préstamo
   */
  async pagarCuotaPrestamo(
    idPrestamo: string,
    idCuenta: string
  ): Promise<PagoPrestamo> {
    const prestamos = this.prestamos.get(idCuenta);
    if (!prestamos) {
      throw new Error("No se encontraron préstamos para esta cuenta");
    }

    const prestamo = prestamos.find((p) => p.id === idPrestamo);
    if (!prestamo) {
      throw new Error("Préstamo no encontrado");
    }

    if (prestamo.estado !== EstadoPrestamo.ACTIVO) {
      throw new Error("El préstamo no está activo");
    }

    const cuenta = this.obtenerCuenta(idCuenta);
    if (!cuenta || cuenta.saldo < prestamo.cuotaMensual) {
      throw new Error("Saldo insuficiente para pagar la cuota");
    }

    // Calcular distribución de capital e interés
    const interes = prestamo.saldoPendiente * (prestamo.tasaInteres / 12 / 100);
    const capital = prestamo.cuotaMensual - interes;
    const nuevoSaldo = prestamo.saldoPendiente - capital;

    const pago: PagoPrestamo = {
      numeroCuota: prestamo.cuotasPagadas + 1,
      monto: prestamo.cuotaMensual,
      capital: Math.round(capital * 100) / 100,
      interes: Math.round(interes * 100) / 100,
      fecha: new Date(),
      saldoRestante: Math.max(0, Math.round(nuevoSaldo * 100) / 100),
    };

    prestamo.historialPagos.push(pago);
    prestamo.cuotasPagadas++;
    prestamo.saldoPendiente = pago.saldoRestante;

    // Actualizar estado si es el último pago
    if (
      prestamo.cuotasPagadas >= prestamo.plazoMeses ||
      prestamo.saldoPendiente <= 0
    ) {
      prestamo.estado = EstadoPrestamo.PAGADO;
      this.crearNotificacion(
        idCuenta,
        TipoNotificacion.PRESTAMO,
        `¡Felicidades! Has completado el pago de tu préstamo`,
        PrioridadNotificacion.ALTA
      );
    } else {
      prestamo.fechaProximoPago = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      );
    }

    // Realizar el retiro de la cuenta
    await this.retirar(
      idCuenta,
      prestamo.cuotaMensual,
      "sistema",
      `Pago cuota préstamo #${pago.numeroCuota}`
    );

    return pago;
  }

  /**
   * Obtiene todos los préstamos de una cuenta
   */
  obtenerPrestamos(idCuenta: string): Prestamo[] {
    return this.prestamos.get(idCuenta) || [];
  }

  // ==================== MÉTODOS PARA INVERSIONES ====================

  /**
   * Crea una nueva inversión
   */
  async crearInversion(solicitud: SolicitudInversion): Promise<Inversion> {
    const cuenta = this.obtenerCuenta(solicitud.idCuenta);
    if (!cuenta) {
      throw new Error("Cuenta no encontrada");
    }

    if (cuenta.saldo < solicitud.monto) {
      throw new Error("Saldo insuficiente para crear la inversión");
    }

    // Calcular fecha de vencimiento según plazo
    let fechaVencimiento: Date | undefined;
    if (solicitud.plazoMeses) {
      fechaVencimiento = new Date(
        Date.now() + solicitud.plazoMeses * 30 * 24 * 60 * 60 * 1000
      );
    }

    const inversion: Inversion = {
      id: uuidv4(),
      idCuenta: solicitud.idCuenta,
      tipo: solicitud.tipo,
      monto: solicitud.monto,
      tasaRendimiento: this.TASA_RENDIMIENTO_BASE,
      fechaInicio: new Date(),
      fechaVencimiento,
      rendimientoAcumulado: 0,
      renovacionAutomatica: false,
      estado: EstadoInversion.ACTIVA,
    };

    const inversiones = this.inversiones.get(solicitud.idCuenta) || [];
    inversiones.push(inversion);
    this.inversiones.set(solicitud.idCuenta, inversiones);

    // Retirar el monto de la cuenta
    await this.retirar(
      solicitud.idCuenta,
      solicitud.monto,
      "sistema",
      "Inversión creada"
    );

    this.crearNotificacion(
      solicitud.idCuenta,
      TipoNotificacion.INVERSION,
      `Inversión de $${solicitud.monto} en ${solicitud.tipo} creada exitosamente`,
      PrioridadNotificacion.MEDIA
    );

    return inversion;
  }

  /**
   * Obtiene todas las inversiones de una cuenta
   */
  obtenerInversiones(idCuenta: string): Inversion[] {
    return this.inversiones.get(idCuenta) || [];
  }

  /**
   * Cancela una inversión y devuelve el monto más rendimientos a la cuenta
   */
  async cancelarInversion(
    idInversion: string,
    idCuenta: string
  ): Promise<void> {
    const inversiones = this.inversiones.get(idCuenta);
    if (!inversiones) {
      throw new Error("No se encontraron inversiones para esta cuenta");
    }

    const inversion = inversiones.find((i) => i.id === idInversion);
    if (!inversion) {
      throw new Error("Inversión no encontrada");
    }

    if (inversion.estado !== EstadoInversion.ACTIVA) {
      throw new Error("La inversión no está activa");
    }

    // Calcular rendimiento acumulado hasta la fecha
    const diasTranscurridos = Math.floor(
      (Date.now() - inversion.fechaInicio.getTime()) / (1000 * 60 * 60 * 24)
    );
    const rendimiento =
      (inversion.monto * inversion.tasaRendimiento * diasTranscurridos) /
      (365 * 100);
    inversion.rendimientoAcumulado = Math.round(rendimiento * 100) / 100;

    const montoTotal = inversion.monto + inversion.rendimientoAcumulado;

    inversion.estado = EstadoInversion.CANCELADA;

    // Depositar monto + rendimiento en la cuenta
    await this.depositar(
      idCuenta,
      montoTotal,
      "sistema",
      "Cancelación de inversión"
    );

    this.crearNotificacion(
      idCuenta,
      TipoNotificacion.INVERSION,
      `Inversión cancelada. Monto recuperado: $${montoTotal} (incluye $${inversion.rendimientoAcumulado} de rendimiento)`,
      PrioridadNotificacion.MEDIA
    );
  }

  // ==================== MÉTODOS PARA BENEFICIARIOS ====================

  /**
   * Agrega un nuevo beneficiario
   */
  agregarBeneficiario(
    idCuenta: string,
    numeroCuentaDestino: string,
    nombreBeneficiario: string,
    banco: string,
    alias: string
  ): Beneficiario {
    const beneficiario: Beneficiario = {
      id: uuidv4(),
      idCuenta,
      numeroCuentaDestino,
      nombreBeneficiario,
      banco,
      alias,
      frecuente: false,
    };

    const beneficiarios = this.beneficiarios.get(idCuenta) || [];
    beneficiarios.push(beneficiario);
    this.beneficiarios.set(idCuenta, beneficiarios);

    return beneficiario;
  }

  /**
   * Obtiene todos los beneficiarios de una cuenta
   */
  obtenerBeneficiarios(idCuenta: string): Beneficiario[] {
    return this.beneficiarios.get(idCuenta) || [];
  }

  /**
   * Elimina un beneficiario
   */
  eliminarBeneficiario(idBeneficiario: string, idCuenta: string): boolean {
    const beneficiarios = this.beneficiarios.get(idCuenta);
    if (!beneficiarios) return false;

    const index = beneficiarios.findIndex((b) => b.id === idBeneficiario);
    if (index === -1) return false;

    beneficiarios.splice(index, 1);
    return true;
  }

  /**
   * Marca un beneficiario como frecuente
   */
  marcarBeneficiarioFrecuente(
    idBeneficiario: string,
    idCuenta: string
  ): boolean {
    const beneficiarios = this.beneficiarios.get(idCuenta);
    if (!beneficiarios) return false;

    const beneficiario = beneficiarios.find((b) => b.id === idBeneficiario);
    if (!beneficiario) return false;

    beneficiario.frecuente = true;
    return true;
  }

  // ==================== MÉTODOS PARA NOTIFICACIONES ====================

  /**
   * Crea una nueva notificación
   */
  crearNotificacion(
    idCuenta: string,
    tipo: TipoNotificacion,
    mensaje: string,
    prioridad: PrioridadNotificacion
  ): Notificacion {
    const notificacion: Notificacion = {
      id: uuidv4(),
      idCuenta,
      tipo,
      mensaje,
      leida: false,
      fecha: new Date(),
      prioridad,
    };

    const notificaciones = this.notificaciones.get(idCuenta) || [];
    notificaciones.push(notificacion);
    this.notificaciones.set(idCuenta, notificaciones);

    return notificacion;
  }

  /**
   * Obtiene todas las notificaciones de una cuenta
   */
  obtenerNotificaciones(
    idCuenta: string,
    soloNoLeidas: boolean = false
  ): Notificacion[] {
    const notificaciones = this.notificaciones.get(idCuenta) || [];
    if (soloNoLeidas) {
      return notificaciones.filter((n) => !n.leida);
    }
    return notificaciones;
  }

  /**
   * Marca una notificación como leída
   */
  marcarNotificacionLeida(idNotificacion: string, idCuenta: string): boolean {
    const notificaciones = this.notificaciones.get(idCuenta);
    if (!notificaciones) return false;

    const notificacion = notificaciones.find((n) => n.id === idNotificacion);
    if (!notificacion) return false;

    notificacion.leida = true;
    return true;
  }

  /**
   * Marca todas las notificaciones como leídas
   */
  marcarTodasNotificacionesLeidas(idCuenta: string): number {
    const notificaciones = this.notificaciones.get(idCuenta);
    if (!notificaciones) return 0;

    let contador = 0;
    notificaciones.forEach((n) => {
      if (!n.leida) {
        n.leida = true;
        contador++;
      }
    });

    return contador;
  }

  // ==================== MÉTODOS PARA PAGOS PROGRAMADOS ====================

  /**
   * Crea un pago programado
   */
  crearPagoProgramado(
    idCuentaOrigen: string,
    idCuentaDestino: string,
    monto: number,
    frecuencia: Frecuencia,
    descripcion: string
  ): PagoProgramado {
    const pagoProgramado: PagoProgramado = {
      id: uuidv4(),
      idCuentaOrigen,
      idCuentaDestino,
      monto,
      frecuencia,
      proximoPago: this.calcularProximoPago(frecuencia),
      descripcion,
      activo: true,
    };

    const pagos = this.pagosProgramados.get(idCuentaOrigen) || [];
    pagos.push(pagoProgramado);
    this.pagosProgramados.set(idCuentaOrigen, pagos);

    this.crearNotificacion(
      idCuentaOrigen,
      TipoNotificacion.TRANSFERENCIA,
      `Pago programado creado: ${descripcion} - $${monto} ${frecuencia}`,
      PrioridadNotificacion.BAJA
    );

    return pagoProgramado;
  }

  /**
   * Calcula la fecha del próximo pago según la frecuencia
   */
  private calcularProximoPago(frecuencia: Frecuencia): Date {
    const ahora = new Date();
    switch (frecuencia) {
      case Frecuencia.DIARIA:
        return new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
      case Frecuencia.SEMANAL:
        return new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
      case Frecuencia.QUINCENAL:
        return new Date(ahora.getTime() + 15 * 24 * 60 * 60 * 1000);
      case Frecuencia.MENSUAL:
        return new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000);
      case Frecuencia.ANUAL:
        return new Date(ahora.getTime() + 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Obtiene todos los pagos programados de una cuenta
   */
  obtenerPagosProgramados(idCuenta: string): PagoProgramado[] {
    return this.pagosProgramados.get(idCuenta) || [];
  }

  /**
   * Ejecuta un pago programado manualmente
   */
  async ejecutarPagoProgramado(
    idPago: string,
    idCuenta: string
  ): Promise<void> {
    const pagos = this.pagosProgramados.get(idCuenta);
    if (!pagos) {
      throw new Error("No se encontraron pagos programados para esta cuenta");
    }

    const pago = pagos.find((p) => p.id === idPago);
    if (!pago) {
      throw new Error("Pago programado no encontrado");
    }

    if (!pago.activo) {
      throw new Error("El pago programado no está activo");
    }

    // Ejecutar transferencia
    await this.transferir(
      pago.idCuentaOrigen,
      pago.idCuentaDestino,
      pago.monto,
      "sistema",
      `Pago programado: ${pago.descripcion}`
    );

    // Actualizar próxima fecha de pago
    pago.proximoPago = this.calcularProximoPago(pago.frecuencia);
  }

  /**
   * Cancela (desactiva) un pago programado
   */
  cancelarPagoProgramado(idPago: string, idCuenta: string): boolean {
    const pagos = this.pagosProgramados.get(idCuenta);
    if (!pagos) return false;

    const pago = pagos.find((p) => p.id === idPago);
    if (!pago) return false;

    pago.activo = false;
    this.crearNotificacion(
      idCuenta,
      TipoNotificacion.TRANSFERENCIA,
      `Pago programado cancelado: ${pago.descripcion}`,
      PrioridadNotificacion.BAJA
    );

    return true;
  }

  // ==================== MÉTODOS PARA LÍMITES ====================

  /**
   * Configura los límites de una cuenta
   */
  configurarLimites(
    idCuenta: string,
    limites: Partial<LimitesCuenta>
  ): LimitesCuenta {
    const limitesActuales = this.limites.get(idCuenta) || {
      limiteRetiroDiario: 5000,
      limiteTransferenciaDiaria: 10000,
      limiteCompraInternacional: 3000,
      limiteCompraNacional: 8000,
      retirosDiarios: 0,
      transferenciasDiarias: 0,
      comprasInternacionalesDiarias: 0,
      comprasNacionalesDiarias: 0,
      ultimoReinicio: new Date(),
    };

    const nuevosLimites: LimitesCuenta = {
      ...limitesActuales,
      ...limites,
    };

    this.limites.set(idCuenta, nuevosLimites);
    return nuevosLimites;
  }

  /**
   * Obtiene los límites de una cuenta
   */
  obtenerLimites(idCuenta: string): LimitesCuenta | null {
    return this.limites.get(idCuenta) || null;
  }

  /**
   * Verifica si una operación está dentro de los límites
   */
  verificarLimite(
    idCuenta: string,
    tipo: "retiro" | "transferencia",
    monto: number
  ): boolean {
    const limites = this.limites.get(idCuenta);
    if (!limites) return true; // Si no hay límites configurados, permitir

    // Reiniciar contadores si ha pasado un día
    const ahora = new Date();
    const ultimoReinicio = limites.ultimoReinicio;
    if (
      ahora.getDate() !== ultimoReinicio.getDate() ||
      ahora.getMonth() !== ultimoReinicio.getMonth()
    ) {
      limites.retirosDiarios = 0;
      limites.transferenciasDiarias = 0;
      limites.comprasInternacionalesDiarias = 0;
      limites.comprasNacionalesDiarias = 0;
      limites.ultimoReinicio = ahora;
    }

    if (tipo === "retiro") {
      return limites.retirosDiarios + monto <= limites.limiteRetiroDiario;
    } else if (tipo === "transferencia") {
      return (
        limites.transferenciasDiarias + monto <=
        limites.limiteTransferenciaDiaria
      );
    }

    return true;
  }

  /**
   * Registra una operación en los límites
   */
  registrarOperacionEnLimites(
    idCuenta: string,
    tipo: "retiro" | "transferencia",
    monto: number
  ): void {
    const limites = this.limites.get(idCuenta);
    if (!limites) return;

    if (tipo === "retiro") {
      limites.retirosDiarios += monto;
    } else if (tipo === "transferencia") {
      limites.transferenciasDiarias += monto;
    }
  }
}

// Exportar una instancia singleton
export const gestorRecursos = new GestorRecursosDistribuidos();
