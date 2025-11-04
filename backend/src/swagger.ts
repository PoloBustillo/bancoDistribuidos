/**
 * Configuración de Swagger/OpenAPI para documentación de API
 */

import swaggerJsdoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "API Sistema Bancario Distribuido",
    version: "1.0.0",
    description: `
      API REST para un sistema bancario distribuido con recursos compartidos.
      
      **Características principales:**
      - Control de concurrencia con bloqueos distribuidos
      - Transacciones atómicas
      - Gestión de tarjetas (débito/crédito)
      - Préstamos con amortización
      - Inversiones con rendimientos
      - Beneficiarios
      - Notificaciones en tiempo real
      - Pagos programados
      - Límites de operaciones
      - Auditoría completa
      
      **WebSocket:**
      El sistema también soporta conexiones WebSocket en \`ws://localhost:3001\` para actualizaciones en tiempo real.
    `,
    contact: {
      name: "Sistema Bancario Distribuido",
      email: "soporte@banco.example.com",
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: "http://localhost:3001",
      description: "Servidor de desarrollo",
    },
  ],
  tags: [
    {
      name: "Salud",
      description: "Endpoints de salud del servidor",
    },
    {
      name: "Cuentas",
      description: "Gestión de cuentas bancarias",
    },
    {
      name: "Transacciones",
      description: "Operaciones de depósito, retiro y transferencia",
    },
    {
      name: "Tarjetas",
      description: "Gestión de tarjetas de débito y crédito",
    },
    {
      name: "Préstamos",
      description: "Solicitud y pago de préstamos",
    },
    {
      name: "Inversiones",
      description: "Creación y gestión de inversiones",
    },
    {
      name: "Beneficiarios",
      description: "Gestión de beneficiarios para transferencias",
    },
    {
      name: "Notificaciones",
      description: "Sistema de notificaciones",
    },
    {
      name: "Pagos Programados",
      description: "Pagos recurrentes automáticos",
    },
    {
      name: "Límites",
      description: "Configuración de límites de operaciones",
    },
    {
      name: "Historial",
      description: "Consulta de transacciones y auditoría",
    },
    {
      name: "Administración",
      description: "Endpoints administrativos del sistema",
    },
  ],
  components: {
    schemas: {
      CuentaBancaria: {
        type: "object",
        properties: {
          id: { type: "string", example: "cta-001" },
          numeroCuenta: { type: "string", example: "1000001" },
          titularCuenta: { type: "string", example: "Juan Pérez" },
          saldo: { type: "number", example: 5000 },
          fechaCreacion: { type: "string", format: "date-time" },
          ultimaModificacion: { type: "string", format: "date-time" },
          version: { type: "number", example: 1 },
        },
      },
      Transaccion: {
        type: "object",
        properties: {
          id: { type: "string", example: "txn-123" },
          idCuenta: { type: "string", example: "cta-001" },
          tipo: {
            type: "string",
            enum: ["DEPOSITO", "RETIRO", "TRANSFERENCIA"],
          },
          monto: { type: "number", example: 1000 },
          descripcion: { type: "string", example: "Depósito en efectivo" },
          estado: { type: "string", enum: ["COMPLETADA", "PENDIENTE", "FALLIDA"] },
          marca_tiempo: { type: "string", format: "date-time" },
          idCliente: { type: "string", example: "cliente-001" },
        },
      },
      Tarjeta: {
        type: "object",
        properties: {
          id: { type: "string", example: "tar-001" },
          numeroTarjeta: { type: "string", example: "4532123456789012" },
          idCuenta: { type: "string", example: "cta-001" },
          tipo: { type: "string", enum: ["DEBITO", "CREDITO", "PREPAGADA"] },
          nombreTitular: { type: "string", example: "Juan Pérez" },
          fechaEmision: { type: "string", format: "date-time" },
          fechaExpiracion: { type: "string", format: "date-time" },
          cvv: { type: "string", example: "123" },
          estado: {
            type: "string",
            enum: ["ACTIVA", "BLOQUEADA", "VENCIDA", "CANCELADA"],
          },
          limiteCredito: { type: "number", example: 5000 },
          saldoDisponible: { type: "number", example: 5000 },
        },
      },
      Prestamo: {
        type: "object",
        properties: {
          id: { type: "string", example: "pres-001" },
          idCuenta: { type: "string", example: "cta-001" },
          monto: { type: "number", example: 10000 },
          tasaInteres: { type: "number", example: 12 },
          plazoMeses: { type: "number", example: 12 },
          cuotaMensual: { type: "number", example: 888.49 },
          saldoPendiente: { type: "number", example: 8226.02 },
          cuotasPagadas: { type: "number", example: 2 },
          fechaSolicitud: { type: "string", format: "date-time" },
          fechaAprobacion: { type: "string", format: "date-time" },
          fechaProximoPago: { type: "string", format: "date-time" },
          estado: {
            type: "string",
            enum: ["ACTIVO", "PAGADO", "VENCIDO", "CANCELADO"],
          },
          historialPagos: {
            type: "array",
            items: { $ref: "#/components/schemas/PagoPrestamo" },
          },
        },
      },
      PagoPrestamo: {
        type: "object",
        properties: {
          numeroCuota: { type: "number", example: 1 },
          monto: { type: "number", example: 888.49 },
          capital: { type: "number", example: 788.49 },
          interes: { type: "number", example: 100 },
          fecha: { type: "string", format: "date-time" },
          saldoRestante: { type: "number", example: 9211.51 },
        },
      },
      Inversion: {
        type: "object",
        properties: {
          id: { type: "string", example: "inv-001" },
          idCuenta: { type: "string", example: "cta-001" },
          tipo: {
            type: "string",
            enum: ["PLAZO_FIJO", "FONDOS_INVERSION", "ACCIONES", "BONOS"],
          },
          monto: { type: "number", example: 2000 },
          tasaRendimiento: { type: "number", example: 8 },
          fechaInicio: { type: "string", format: "date-time" },
          fechaVencimiento: { type: "string", format: "date-time" },
          rendimientoAcumulado: { type: "number", example: 13.33 },
          renovacionAutomatica: { type: "boolean", example: true },
          estado: {
            type: "string",
            enum: ["ACTIVA", "VENCIDA", "CANCELADA"],
          },
        },
      },
      Beneficiario: {
        type: "object",
        properties: {
          id: { type: "string", example: "ben-001" },
          idCuenta: { type: "string", example: "cta-002" },
          numeroCuentaDestino: { type: "string", example: "1000001" },
          nombreBeneficiario: { type: "string", example: "Juan Pérez" },
          banco: { type: "string", example: "Banco Demo" },
          alias: { type: "string", example: "Juan" },
          frecuente: { type: "boolean", example: true },
        },
      },
      Notificacion: {
        type: "object",
        properties: {
          id: { type: "string", example: "not-001" },
          idCuenta: { type: "string", example: "cta-001" },
          tipo: {
            type: "string",
            enum: [
              "DEPOSITO",
              "RETIRO",
              "TRANSFERENCIA",
              "PAGO_TARJETA",
              "ALERTA_SEGURIDAD",
              "VENCIMIENTO",
              "PROMOCION",
              "PRESTAMO",
              "INVERSION",
            ],
          },
          mensaje: { type: "string", example: "Depósito recibido de $500" },
          leida: { type: "boolean", example: false },
          fecha: { type: "string", format: "date-time" },
          prioridad: { type: "string", enum: ["ALTA", "MEDIA", "BAJA"] },
        },
      },
      PagoProgramado: {
        type: "object",
        properties: {
          id: { type: "string", example: "pago-001" },
          idCuentaOrigen: { type: "string", example: "cta-001" },
          idCuentaDestino: { type: "string", example: "cta-002" },
          monto: { type: "number", example: 500 },
          frecuencia: {
            type: "string",
            enum: ["DIARIA", "SEMANAL", "QUINCENAL", "MENSUAL", "ANUAL"],
          },
          proximoPago: { type: "string", format: "date-time" },
          descripcion: { type: "string", example: "Pago de servicios" },
          activo: { type: "boolean", example: true },
        },
      },
      LimitesCuenta: {
        type: "object",
        properties: {
          limiteRetiroDiario: { type: "number", example: 5000 },
          limiteTransferenciaDiaria: { type: "number", example: 10000 },
          limiteCompraInternacional: { type: "number", example: 3000 },
          limiteCompraNacional: { type: "number", example: 8000 },
          retirosDiarios: { type: "number", example: 0 },
          transferenciasDiarias: { type: "number", example: 0 },
          comprasInternacionalesDiarias: { type: "number", example: 0 },
          comprasNacionalesDiarias: { type: "number", example: 0 },
          ultimoReinicio: { type: "string", format: "date-time" },
        },
      },
      RespuestaAPI: {
        type: "object",
        properties: {
          exitoso: { type: "boolean", example: true },
          datos: { type: "object" },
          error: { type: "string" },
          marca_tiempo: { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        properties: {
          exitoso: { type: "boolean", example: false },
          error: { type: "string", example: "Mensaje de error" },
          marca_tiempo: { type: "string", format: "date-time" },
        },
      },
    },
  },
};

const options = {
  swaggerDefinition,
  apis: ["./src/servidorDistribuido.ts"], // Path donde están las anotaciones JSDoc
};

export const swaggerSpec = swaggerJsdoc(options);
