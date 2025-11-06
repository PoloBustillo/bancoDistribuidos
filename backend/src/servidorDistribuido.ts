import express, { Request, Response } from "express";
import cors from "cors";
import { Server as ServidorHTTP } from "http";
import { Server as ServidorSocket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger";
import { gestorRecursos } from "./gestorRecursosDistribuidos";
import {
  RespuestaAPI,
  SolicitudDeposito,
  SolicitudRetiro,
  SolicitudTransferencia,
  SolicitudTarjeta,
  SolicitudPrestamo,
  SolicitudInversion,
  Frecuencia,
} from "../../shared/types";

const aplicacion = express();
const puerto = process.env.PUERTO || 3001;

// Crear servidor HTTP
const servidorHTTP = new ServidorHTTP(aplicacion);

// Configurar Socket.IO
const io = new ServidorSocket(servidorHTTP, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Generar ID único para cada sesión del servidor
const idSesionServidor = uuidv4();
// Colores ANSI simples (sin dependencia externa)
const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  blue: "\u001b[34m",
  magenta: "\u001b[35m",
  cyan: "\u001b[36m",
};

function logInfo(msg: string) {
  console.log(`${ANSI.cyan}[INFO]${ANSI.reset} ${msg}`);
}

function logSuccess(msg: string) {
  console.log(`${ANSI.green}${ANSI.bold}[OK]${ANSI.reset} ${msg}`);
}

function logWarn(msg: string) {
  console.log(`${ANSI.yellow}[WARN]${ANSI.reset} ${msg}`);
}

function logError(msg: string) {
  console.log(`${ANSI.red}[ERROR]${ANSI.reset} ${msg}`);
}

logInfo(`ID de sesión del servidor: ${idSesionServidor}`);

// Middleware
aplicacion.use(cors());
aplicacion.use(express.json());

// Logger simple para peticiones HTTP (muestra método, ruta, código y tiempo)
aplicacion.use((req: Request, res: Response, next) => {
  const inicio = Date.now();
  res.on("finish", () => {
    const duracion = Date.now() - inicio;
    const estado = res.statusCode;
    const color =
      estado >= 500 ? ANSI.red : estado >= 400 ? ANSI.yellow : ANSI.green;
    console.log(
      `${ANSI.dim}${req.ip}${ANSI.reset} ${color}${req.method}${ANSI.reset} ${ANSI.bold}${req.originalUrl}${ANSI.reset} -> ${color}${estado}${ANSI.reset} ${ANSI.dim}${duracion}ms${ANSI.reset}`
    );
  });
  next();
});

// Configurar Swagger UI
aplicacion.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "API Banco Distribuido",
  })
);

// Ruta para obtener el spec JSON de Swagger
aplicacion.get("/api-docs.json", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

/**
 * @swagger
 * /salud:
 *   get:
 *     summary: Verifica el estado del servidor
 *     tags: [Salud]
 *     responses:
 *       200:
 *         description: Servidor activo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exitoso:
 *                   type: boolean
 *                   example: true
 *                 datos:
 *                   type: object
 *                   properties:
 *                     estado:
 *                       type: string
 *                       example: ACTIVO
 *                     idSesion:
 *                       type: string
 *                 marca_tiempo:
 *                   type: string
 *                   format: date-time
 */
aplicacion.get("/salud", (req: Request, res: Response) => {
  res.json({
    exitoso: true,
    datos: { estado: "ACTIVO", idSesion: idSesionServidor },
    marca_tiempo: new Date(),
  });
});

// ============== RUTAS REST DE CUENTAS ==============

/**
 * @swagger
 * /api/cuentas:
 *   get:
 *     summary: Obtiene todas las cuentas bancarias
 *     tags: [Cuentas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de cuentas
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/RespuestaAPI'
 *                 - type: object
 *                   properties:
 *                     datos:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CuentaBancaria'
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
aplicacion.get("/api/cuentas", (req: Request, res: Response) => {
  try {
    const cuentas = gestorRecursos.obtenerTodasLasCuentas();
    const respuesta: RespuestaAPI<typeof cuentas> = {
      exitoso: true,
      datos: cuentas,
      marca_tiempo: new Date(),
    };
    res.json(respuesta);
  } catch (error) {
    res.status(500).json({
      exitoso: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      marca_tiempo: new Date(),
    });
  }
});

/**
 * @swagger
 * /api/cuentas/{idCuenta}:
 *   get:
 *     summary: Obtiene una cuenta específica por ID
 *     tags: [Cuentas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idCuenta
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la cuenta
 *     responses:
 *       200:
 *         description: Cuenta encontrada
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/RespuestaAPI'
 *                 - type: object
 *                   properties:
 *                     datos:
 *                       $ref: '#/components/schemas/CuentaBancaria'
 *       404:
 *         description: Cuenta no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
aplicacion.get("/api/cuentas/:idCuenta", (req: Request, res: Response) => {
  try {
    const { idCuenta } = req.params;
    const cuenta = gestorRecursos.obtenerCuenta(idCuenta);

    if (!cuenta) {
      return res.status(404).json({
        exitoso: false,
        error: "Cuenta no encontrada",
        marca_tiempo: new Date(),
      });
    }

    res.json({
      exitoso: true,
      datos: cuenta,
      marca_tiempo: new Date(),
    });
  } catch (error) {
    res.status(500).json({
      exitoso: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      marca_tiempo: new Date(),
    });
  }
});

// ============== RUTAS REST DE OPERACIONES ==============

/**
 * @swagger
 * /api/transacciones/depositar:
 *   post:
 *     summary: Realiza un depósito en una cuenta
 *     tags: [Transacciones]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idCuenta
 *               - monto
 *             properties:
 *               idCuenta:
 *                 type: string
 *                 example: cta-001
 *               monto:
 *                 type: number
 *                 example: 1000
 *               descripcion:
 *                 type: string
 *                 example: Depósito en efectivo
 *     responses:
 *       200:
 *         description: Depósito exitoso
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/RespuestaAPI'
 *                 - type: object
 *                   properties:
 *                     datos:
 *                       type: object
 *                       properties:
 *                         transaccion:
 *                           $ref: '#/components/schemas/Transaccion'
 *                         cuenta:
 *                           $ref: '#/components/schemas/CuentaBancaria'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
aplicacion.post(
  "/api/transacciones/depositar",
  async (req: Request, res: Response) => {
    try {
      const { idCuenta, monto, descripcion } = req.body as SolicitudDeposito;
      const idCliente = uuidv4();

      if (!idCuenta || !monto) {
        return res.status(400).json({
          exitoso: false,
          error: "idCuenta y monto son requeridos",
          marca_tiempo: new Date(),
        });
      }

      const transaccion = await gestorRecursos.depositar(
        idCuenta,
        monto,
        descripcion || "",
        idCliente
      );

      const cuenta = gestorRecursos.obtenerCuenta(idCuenta);

      // Notificar a todos los clientes conectados
      io.emit("transaccionCompletada", {
        transaccion,
        cuenta,
        tipo: "DEPOSITO",
      });

      res.json({
        exitoso: true,
        datos: { transaccion, cuenta },
        marca_tiempo: new Date(),
      });
    } catch (error) {
      res.status(400).json({
        exitoso: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        marca_tiempo: new Date(),
      });
    }
  }
);

/**
 * @swagger
 * /api/transacciones/retirar:
 *   post:
 *     summary: Realiza un retiro de una cuenta
 *     tags: [Transacciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idCuenta
 *               - monto
 *             properties:
 *               idCuenta:
 *                 type: string
 *                 example: cta-001
 *               monto:
 *                 type: number
 *                 example: 200
 *               descripcion:
 *                 type: string
 *                 example: Retiro en cajero
 *     responses:
 *       200:
 *         description: Retiro exitoso
 *       400:
 *         description: Datos inválidos o saldo insuficiente
 */
aplicacion.post(
  "/api/transacciones/retirar",
  async (req: Request, res: Response) => {
    try {
      const { idCuenta, monto, descripcion } = req.body as SolicitudRetiro;
      const idCliente = uuidv4();

      if (!idCuenta || !monto) {
        return res.status(400).json({
          exitoso: false,
          error: "idCuenta y monto son requeridos",
          marca_tiempo: new Date(),
        });
      }

      const transaccion = await gestorRecursos.retirar(
        idCuenta,
        monto,
        descripcion || "",
        idCliente
      );

      const cuenta = gestorRecursos.obtenerCuenta(idCuenta);

      // Notificar a todos los clientes conectados
      io.emit("transaccionCompletada", {
        transaccion,
        cuenta,
        tipo: "RETIRO",
      });

      res.json({
        exitoso: true,
        datos: { transaccion, cuenta },
        marca_tiempo: new Date(),
      });
    } catch (error) {
      res.status(400).json({
        exitoso: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        marca_tiempo: new Date(),
      });
    }
  }
);

/**
 * @swagger
 * /api/transacciones/transferir:
 *   post:
 *     summary: Realiza una transferencia entre cuentas
 *     tags: [Transacciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idCuentaOrigen
 *               - idCuentaDestino
 *               - monto
 *             properties:
 *               idCuentaOrigen:
 *                 type: string
 *                 example: cta-001
 *               idCuentaDestino:
 *                 type: string
 *                 example: cta-002
 *               monto:
 *                 type: number
 *                 example: 150
 *               descripcion:
 *                 type: string
 *                 example: Pago a proveedor
 *     responses:
 *       200:
 *         description: Transferencia completada
 *       400:
 *         description: Error en la solicitud (saldo insuficiente, datos inválidos)
 */
aplicacion.post(
  "/api/transacciones/transferir",
  async (req: Request, res: Response) => {
    try {
      const { idCuentaOrigen, idCuentaDestino, monto, descripcion } =
        req.body as SolicitudTransferencia;
      const idCliente = uuidv4();

      if (!idCuentaOrigen || !idCuentaDestino || !monto) {
        return res.status(400).json({
          exitoso: false,
          error: "idCuentaOrigen, idCuentaDestino y monto son requeridos",
          marca_tiempo: new Date(),
        });
      }

      const resultado = await gestorRecursos.transferir(
        idCuentaOrigen,
        idCuentaDestino,
        monto,
        descripcion || "",
        idCliente
      );

      const cuentaOrigen = gestorRecursos.obtenerCuenta(idCuentaOrigen);
      const cuentaDestino = gestorRecursos.obtenerCuenta(idCuentaDestino);

      // Notificar a todos los clientes conectados
      io.emit("transaccionCompletada", {
        resultado,
        cuentaOrigen,
        cuentaDestino,
        tipo: "TRANSFERENCIA",
      });

      res.json({
        exitoso: true,
        datos: { resultado, cuentaOrigen, cuentaDestino },
        marca_tiempo: new Date(),
      });
    } catch (error) {
      res.status(400).json({
        exitoso: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        marca_tiempo: new Date(),
      });
    }
  }
);

// ============== RUTAS REST DE HISTORIAL ==============

/**
 * @swagger
 * /api/transacciones/{idCuenta}:
 *   get:
 *     summary: Obtiene el historial de transacciones de una cuenta
 *     tags: [Historial]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idCuenta
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la cuenta
 *     responses:
 *       200:
 *         description: Historial de transacciones
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/RespuestaAPI'
 *                 - type: object
 *                   properties:
 *                     datos:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Transaccion'
 *       404:
 *         description: Cuenta no encontrada
 */
aplicacion.get(
  "/api/transacciones/:idCuenta",
  (req: Request, res: Response) => {
    try {
      const { idCuenta } = req.params;
      const transacciones =
        gestorRecursos.obtenerHistorialTransacciones(idCuenta);

      res.json({
        exitoso: true,
        datos: transacciones,
        marca_tiempo: new Date(),
      });
    } catch (error) {
      res.status(500).json({
        exitoso: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        marca_tiempo: new Date(),
      });
    }
  }
);

/**
 * @swagger
 * /api/auditoria/{idCuenta}:
 *   get:
 *     summary: Obtiene el log de auditoría de una cuenta
 *     tags: [Historial]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idCuenta
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la cuenta
 *     responses:
 *       200:
 *         description: Log de auditoría
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/RespuestaAPI'
 *                 - type: object
 *                   properties:
 *                     datos:
 *                       type: array
 *                       items:
 *                         type: object
 *       404:
 *         description: Cuenta no encontrada
 */
aplicacion.get("/api/auditoria/:idCuenta", (req: Request, res: Response) => {
  try {
    const { idCuenta } = req.params;
    const logAuditoria = gestorRecursos.obtenerLogAuditoria(idCuenta);

    res.json({
      exitoso: true,
      datos: logAuditoria,
      marca_tiempo: new Date(),
    });
  } catch (error) {
    res.status(500).json({
      exitoso: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      marca_tiempo: new Date(),
    });
  }
});

// ============== RUTAS DE TARJETAS ==============

/**
 * @swagger
 * /api/tarjetas:
 *   post:
 *     tags:
 *       - Tarjetas
 *     summary: Crear una nueva tarjeta
 *     description: Crea una nueva tarjeta de débito, crédito o prepagada para una cuenta
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idCuenta
 *               - tipo
 *             properties:
 *               idCuenta:
 *                 type: string
 *                 example: "cta-001"
 *               tipo:
 *                 type: string
 *                 enum: [DEBITO, CREDITO, PREPAGADA]
 *                 example: "DEBITO"
 *               limiteCredito:
 *                 type: number
 *                 example: 5000
 *                 description: Solo para tarjetas de crédito
 *     responses:
 *       200:
 *         description: Tarjeta creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespuestaAPI'
 *       400:
 *         description: Error en la solicitud
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
aplicacion.post("/api/tarjetas", async (req: Request, res: Response) => {
  try {
    const solicitud: SolicitudTarjeta = req.body;
    const tarjeta = await gestorRecursos.crearTarjeta(solicitud);

    res.json({
      exitoso: true,
      datos: tarjeta,
      marca_tiempo: new Date(),
    });
  } catch (error) {
    res.status(400).json({
      exitoso: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      marca_tiempo: new Date(),
    });
  }
});

/**
 * @swagger
 * /api/tarjetas/{idCuenta}:
 *   get:
 *     tags:
 *       - Tarjetas
 *     summary: Obtener tarjetas de una cuenta
 *     description: Obtiene todas las tarjetas asociadas a una cuenta bancaria
 *     parameters:
 *       - in: path
 *         name: idCuenta
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la cuenta bancaria
 *         example: "cta-001"
 *     responses:
 *       200:
 *         description: Lista de tarjetas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exitoso:
 *                   type: boolean
 *                 datos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tarjeta'
 *       500:
 *         description: Error del servidor
 */
aplicacion.get("/api/tarjetas/:idCuenta", (req: Request, res: Response) => {
  try {
    const { idCuenta } = req.params;
    const tarjetas = gestorRecursos.obtenerTarjetas(idCuenta);

    res.json({
      exitoso: true,
      datos: tarjetas,
      marca_tiempo: new Date(),
    });
  } catch (error) {
    res.status(500).json({
      exitoso: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      marca_tiempo: new Date(),
    });
  }
});

/**
 * @swagger
 * /api/tarjetas/{idTarjeta}/bloquear:
 *   put:
 *     tags:
 *       - Tarjetas
 *     summary: Bloquear una tarjeta
 *     description: Bloquea una tarjeta por seguridad (robo, pérdida, etc.)
 *     parameters:
 *       - in: path
 *         name: idTarjeta
 *         required: true
 *         schema:
 *           type: string
 *         example: "tar-001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idCuenta
 *             properties:
 *               idCuenta:
 *                 type: string
 *                 example: "cta-001"
 *     responses:
 *       200:
 *         description: Tarjeta bloqueada exitosamente
 *       404:
 *         description: Tarjeta no encontrada
 */
aplicacion.put(
  "/api/tarjetas/:idTarjeta/bloquear",
  (req: Request, res: Response) => {
    try {
      const { idTarjeta } = req.params;
      const { idCuenta } = req.body;
      const resultado = gestorRecursos.bloquearTarjeta(idTarjeta, idCuenta);

      if (!resultado) {
        return res.status(404).json({
          exitoso: false,
          error: "Tarjeta no encontrada",
          marca_tiempo: new Date(),
        });
      }

      res.json({
        exitoso: true,
        datos: { mensaje: "Tarjeta bloqueada exitosamente" },
        marca_tiempo: new Date(),
      });
    } catch (error) {
      res.status(500).json({
        exitoso: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        marca_tiempo: new Date(),
      });
    }
  }
);

/**
 * @swagger
 * /api/tarjetas/{idTarjeta}/desbloquear:
 *   put:
 *     tags:
 *       - Tarjetas
 *     summary: Desbloquear una tarjeta
 *     description: Desbloquea una tarjeta previamente bloqueada
 *     parameters:
 *       - in: path
 *         name: idTarjeta
 *         required: true
 *         schema:
 *           type: string
 *         example: "tar-001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idCuenta
 *             properties:
 *               idCuenta:
 *                 type: string
 *                 example: "cta-001"
 *     responses:
 *       200:
 *         description: Tarjeta desbloqueada exitosamente
 *       404:
 *         description: Tarjeta no encontrada
 */
aplicacion.put(
  "/api/tarjetas/:idTarjeta/desbloquear",
  (req: Request, res: Response) => {
    try {
      const { idTarjeta } = req.params;
      const { idCuenta } = req.body;
      const resultado = gestorRecursos.desbloquearTarjeta(idTarjeta, idCuenta);

      if (!resultado) {
        return res.status(404).json({
          exitoso: false,
          error: "Tarjeta no encontrada",
          marca_tiempo: new Date(),
        });
      }

      res.json({
        exitoso: true,
        datos: { mensaje: "Tarjeta desbloqueada exitosamente" },
        marca_tiempo: new Date(),
      });
    } catch (error) {
      res.status(500).json({
        exitoso: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        marca_tiempo: new Date(),
      });
    }
  }
);

// ============== RUTAS DE PRÉSTAMOS ==============

/**
 * @swagger
 * /api/prestamos:
 *   post:
 *     tags:
 *       - Préstamos
 *     summary: Solicitar un nuevo préstamo
 *     description: Solicita un préstamo con cálculo automático de cuota mensual
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idCuenta
 *               - monto
 *               - plazoMeses
 *             properties:
 *               idCuenta:
 *                 type: string
 *                 example: "cta-001"
 *               monto:
 *                 type: number
 *                 example: 10000
 *                 description: Monto del préstamo
 *               plazoMeses:
 *                 type: number
 *                 example: 12
 *                 description: Plazo en meses
 *     responses:
 *       200:
 *         description: Préstamo aprobado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exitoso:
 *                   type: boolean
 *                 datos:
 *                   $ref: '#/components/schemas/Prestamo'
 *       400:
 *         description: Saldo insuficiente o error en la solicitud
 */
aplicacion.post("/api/prestamos", async (req: Request, res: Response) => {
  try {
    const solicitud: SolicitudPrestamo = req.body;
    const prestamo = await gestorRecursos.solicitarPrestamo(solicitud);

    io.emit("prestamoCreado", { prestamo, idCuenta: solicitud.idCuenta });

    res.json({
      exitoso: true,
      datos: prestamo,
      marca_tiempo: new Date(),
    });
  } catch (error) {
    res.status(400).json({
      exitoso: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      marca_tiempo: new Date(),
    });
  }
});

/**
 * @swagger
 * /api/prestamos/{idCuenta}:
 *   get:
 *     tags:
 *       - Préstamos
 *     summary: Obtener préstamos de una cuenta
 *     description: Obtiene todos los préstamos (activos, pagados, vencidos) de una cuenta
 *     parameters:
 *       - in: path
 *         name: idCuenta
 *         required: true
 *         schema:
 *           type: string
 *         example: "cta-003"
 *     responses:
 *       200:
 *         description: Lista de préstamos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exitoso:
 *                   type: boolean
 *                 datos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Prestamo'
 */
aplicacion.get("/api/prestamos/:idCuenta", (req: Request, res: Response) => {
  try {
    const { idCuenta } = req.params;
    const prestamos = gestorRecursos.obtenerPrestamos(idCuenta);

    res.json({
      exitoso: true,
      datos: prestamos,
      marca_tiempo: new Date(),
    });
  } catch (error) {
    res.status(500).json({
      exitoso: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      marca_tiempo: new Date(),
    });
  }
});

/**
 * @swagger
 * /api/prestamos/{idPrestamo}/pagar:
 *   post:
 *     tags:
 *       - Préstamos
 *     summary: Pagar cuota de préstamo
 *     description: Realiza el pago de una cuota mensual del préstamo
 *     parameters:
 *       - in: path
 *         name: idPrestamo
 *         required: true
 *         schema:
 *           type: string
 *         example: "pres-001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idCuenta
 *             properties:
 *               idCuenta:
 *                 type: string
 *                 example: "cta-003"
 *     responses:
 *       200:
 *         description: Cuota pagada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exitoso:
 *                   type: boolean
 *                 datos:
 *                   $ref: '#/components/schemas/PagoPrestamo'
 *       400:
 *         description: Saldo insuficiente o préstamo no activo
 */
aplicacion.post(
  "/api/prestamos/:idPrestamo/pagar",
  async (req: Request, res: Response) => {
    try {
      const { idPrestamo } = req.params;
      const { idCuenta } = req.body;
      const pago = await gestorRecursos.pagarCuotaPrestamo(
        idPrestamo,
        idCuenta
      );

      io.emit("cuotaPagada", { pago, idPrestamo, idCuenta });

      res.json({
        exitoso: true,
        datos: pago,
        marca_tiempo: new Date(),
      });
    } catch (error) {
      res.status(400).json({
        exitoso: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        marca_tiempo: new Date(),
      });
    }
  }
);

// ============== RUTAS DE INVERSIONES ==============

/**
 * @swagger
 * /api/inversiones:
 *   post:
 *     tags:
 *       - Inversiones
 *     summary: Crear una nueva inversión
 *     description: Crea una inversión (plazo fijo, fondos, acciones, bonos)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idCuenta
 *               - tipo
 *               - monto
 *             properties:
 *               idCuenta:
 *                 type: string
 *                 example: "cta-001"
 *               tipo:
 *                 type: string
 *                 enum: [PLAZO_FIJO, FONDOS_INVERSION, ACCIONES, BONOS]
 *                 example: "PLAZO_FIJO"
 *               monto:
 *                 type: number
 *                 example: 2000
 *               plazoMeses:
 *                 type: number
 *                 example: 12
 *                 description: Plazo en meses (opcional)
 *     responses:
 *       200:
 *         description: Inversión creada exitosamente
 *       400:
 *         description: Saldo insuficiente
 */
aplicacion.post("/api/inversiones", async (req: Request, res: Response) => {
  try {
    const solicitud: SolicitudInversion = req.body;
    const inversion = await gestorRecursos.crearInversion(solicitud);

    io.emit("inversionCreada", { inversion, idCuenta: solicitud.idCuenta });

    res.json({
      exitoso: true,
      datos: inversion,
      marca_tiempo: new Date(),
    });
  } catch (error) {
    res.status(400).json({
      exitoso: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      marca_tiempo: new Date(),
    });
  }
});

/**
 * @swagger
 * /api/inversiones/{idCuenta}:
 *   get:
 *     tags:
 *       - Inversiones
 *     summary: Obtener inversiones de una cuenta
 *     parameters:
 *       - in: path
 *         name: idCuenta
 *         required: true
 *         schema:
 *           type: string
 *         example: "cta-001"
 *     responses:
 *       200:
 *         description: Lista de inversiones
 */
aplicacion.get("/api/inversiones/:idCuenta", (req: Request, res: Response) => {
  try {
    const { idCuenta } = req.params;
    const inversiones = gestorRecursos.obtenerInversiones(idCuenta);

    res.json({
      exitoso: true,
      datos: inversiones,
      marca_tiempo: new Date(),
    });
  } catch (error) {
    res.status(500).json({
      exitoso: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      marca_tiempo: new Date(),
    });
  }
});

/**
 * @swagger
 * /api/inversiones/{idInversion}:
 *   delete:
 *     tags:
 *       - Inversiones
 *     summary: Cancelar una inversión
 *     description: Cancela una inversión y devuelve el monto con rendimientos
 *     parameters:
 *       - in: path
 *         name: idInversion
 *         required: true
 *         schema:
 *           type: string
 *         example: "inv-001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idCuenta:
 *                 type: string
 *                 example: "cta-001"
 *     responses:
 *       200:
 *         description: Inversión cancelada exitosamente
 */
aplicacion.delete(
  "/api/inversiones/:idInversion",
  async (req: Request, res: Response) => {
    try {
      const { idInversion } = req.params;
      const { idCuenta } = req.body;
      await gestorRecursos.cancelarInversion(idInversion, idCuenta);

      io.emit("inversionCancelada", { idInversion, idCuenta });

      res.json({
        exitoso: true,
        datos: { mensaje: "Inversión cancelada exitosamente" },
        marca_tiempo: new Date(),
      });
    } catch (error) {
      res.status(400).json({
        exitoso: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        marca_tiempo: new Date(),
      });
    }
  }
);

// ============== RUTAS DE BENEFICIARIOS ==============

/**
 * @swagger
 * /api/beneficiarios:
 *   post:
 *     tags:
 *       - Beneficiarios
 *     summary: Agregar un nuevo beneficiario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idCuenta
 *               - numeroCuentaDestino
 *               - nombreBeneficiario
 *               - banco
 *               - alias
 *             properties:
 *               idCuenta:
 *                 type: string
 *                 example: "cta-002"
 *               numeroCuentaDestino:
 *                 type: string
 *                 example: "1000001"
 *               nombreBeneficiario:
 *                 type: string
 *                 example: "Juan Pérez"
 *               banco:
 *                 type: string
 *                 example: "Banco Demo"
 *               alias:
 *                 type: string
 *                 example: "Juan"
 *     responses:
 *       200:
 *         description: Beneficiario agregado exitosamente
 */
aplicacion.post("/api/beneficiarios", (req: Request, res: Response) => {
  try {
    const { idCuenta, numeroCuentaDestino, nombreBeneficiario, banco, alias } =
      req.body;
    const beneficiario = gestorRecursos.agregarBeneficiario(
      idCuenta,
      numeroCuentaDestino,
      nombreBeneficiario,
      banco,
      alias
    );

    res.json({
      exitoso: true,
      datos: beneficiario,
      marca_tiempo: new Date(),
    });
  } catch (error) {
    res.status(400).json({
      exitoso: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      marca_tiempo: new Date(),
    });
  }
});

/**
 * @swagger
 * /api/beneficiarios/{idCuenta}:
 *   get:
 *     summary: Obtiene los beneficiarios de una cuenta
 *     tags: [Beneficiarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idCuenta
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la cuenta de origen
 *     responses:
 *       200:
 *         description: Lista de beneficiarios
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/RespuestaAPI'
 *                 - type: object
 *                   properties:
 *                     datos:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Beneficiario'
 *       500:
 *         description: Error del servidor
 */
aplicacion.get(
  "/api/beneficiarios/:idCuenta",
  (req: Request, res: Response) => {
    try {
      const { idCuenta } = req.params;
      const beneficiarios = gestorRecursos.obtenerBeneficiarios(idCuenta);

      res.json({
        exitoso: true,
        datos: beneficiarios,
        marca_tiempo: new Date(),
      });
    } catch (error) {
      res.status(500).json({
        exitoso: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        marca_tiempo: new Date(),
      });
    }
  }
);

/**
 * @swagger
 * /api/beneficiarios/{idBeneficiario}:
 *   delete:
 *     summary: Elimina un beneficiario
 *     tags: [Beneficiarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idBeneficiario
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del beneficiario a eliminar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idCuenta:
 *                 type: string
 *                 example: "cta-001"
 *     responses:
 *       200:
 *         description: Beneficiario eliminado exitosamente
 *       404:
 *         description: Beneficiario no encontrado
 */
aplicacion.delete(
  "/api/beneficiarios/:idBeneficiario",
  (req: Request, res: Response) => {
    try {
      const { idBeneficiario } = req.params;
      const { idCuenta } = req.body;
      const resultado = gestorRecursos.eliminarBeneficiario(
        idBeneficiario,
        idCuenta
      );

      if (!resultado) {
        return res.status(404).json({
          exitoso: false,
          error: "Beneficiario no encontrado",
          marca_tiempo: new Date(),
        });
      }

      res.json({
        exitoso: true,
        datos: { mensaje: "Beneficiario eliminado exitosamente" },
        marca_tiempo: new Date(),
      });
    } catch (error) {
      res.status(500).json({
        exitoso: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        marca_tiempo: new Date(),
      });
    }
  }
);

// ============== RUTAS DE NOTIFICACIONES ==============

/**
 * @swagger
 * /api/notificaciones/{idCuenta}:
 *   get:
 *     tags:
 *       - Notificaciones
 *     summary: Obtener notificaciones de una cuenta
 *     parameters:
 *       - in: path
 *         name: idCuenta
 *         required: true
 *         schema:
 *           type: string
 *         example: "cta-001"
 *       - in: query
 *         name: soloNoLeidas
 *         schema:
 *           type: boolean
 *         description: Filtrar solo notificaciones no leídas
 *         example: true
 *     responses:
 *       200:
 *         description: Lista de notificaciones
 */
aplicacion.get(
  "/api/notificaciones/:idCuenta",
  (req: Request, res: Response) => {
    try {
      const { idCuenta } = req.params;
      const soloNoLeidas = req.query.soloNoLeidas === "true";
      const notificaciones = gestorRecursos.obtenerNotificaciones(
        idCuenta,
        soloNoLeidas
      );

      res.json({
        exitoso: true,
        datos: notificaciones,
        marca_tiempo: new Date(),
      });
    } catch (error) {
      res.status(500).json({
        exitoso: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        marca_tiempo: new Date(),
      });
    }
  }
);

/**
 * @swagger
 * /api/notificaciones/{idNotificacion}/marcar-leida:
 *   put:
 *     tags:
 *       - Notificaciones
 *     summary: Marcar notificación como leída
 *     parameters:
 *       - in: path
 *         name: idNotificacion
 *         required: true
 *         schema:
 *           type: string
 *         example: "not-001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idCuenta:
 *                 type: string
 *                 example: "cta-001"
 *     responses:
 *       200:
 *         description: Notificación marcada como leída
 *       404:
 *         description: Notificación no encontrada
 */
aplicacion.put(
  "/api/notificaciones/:idNotificacion/marcar-leida",
  (req: Request, res: Response) => {
    try {
      const { idNotificacion } = req.params;
      const { idCuenta } = req.body;
      const resultado = gestorRecursos.marcarNotificacionLeida(
        idNotificacion,
        idCuenta
      );

      if (!resultado) {
        return res.status(404).json({
          exitoso: false,
          error: "Notificación no encontrada",
          marca_tiempo: new Date(),
        });
      }

      res.json({
        exitoso: true,
        datos: { mensaje: "Notificación marcada como leída" },
        marca_tiempo: new Date(),
      });
    } catch (error) {
      res.status(500).json({
        exitoso: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        marca_tiempo: new Date(),
      });
    }
  }
);

/**
 * @swagger
 * /api/notificaciones/{idCuenta}/marcar-todas-leidas:
 *   put:
 *     tags:
 *       - Notificaciones
 *     summary: Marcar todas las notificaciones como leídas
 *     parameters:
 *       - in: path
 *         name: idCuenta
 *         required: true
 *         schema:
 *           type: string
 *         example: "cta-001"
 *     responses:
 *       200:
 *         description: Todas las notificaciones marcadas como leídas
 */
aplicacion.put(
  "/api/notificaciones/:idCuenta/marcar-todas-leidas",
  (req: Request, res: Response) => {
    try {
      const { idCuenta } = req.params;
      const cantidad = gestorRecursos.marcarTodasNotificacionesLeidas(idCuenta);

      res.json({
        exitoso: true,
        datos: { mensaje: `${cantidad} notificaciones marcadas como leídas` },
        marca_tiempo: new Date(),
      });
    } catch (error) {
      res.status(500).json({
        exitoso: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        marca_tiempo: new Date(),
      });
    }
  }
);

// ============== RUTAS DE PAGOS PROGRAMADOS ==============

/**
 * @swagger
 * /api/pagos-programados:
 *   post:
 *     tags:
 *       - Pagos Programados
 *     summary: Crear un pago programado
 *     description: Crea un pago recurrente automático
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idCuentaOrigen
 *               - idCuentaDestino
 *               - monto
 *               - frecuencia
 *               - descripcion
 *             properties:
 *               idCuentaOrigen:
 *                 type: string
 *                 example: "cta-001"
 *               idCuentaDestino:
 *                 type: string
 *                 example: "cta-002"
 *               monto:
 *                 type: number
 *                 example: 500
 *               frecuencia:
 *                 type: string
 *                 enum: [DIARIA, SEMANAL, QUINCENAL, MENSUAL, ANUAL]
 *                 example: "MENSUAL"
 *               descripcion:
 *                 type: string
 *                 example: "Ahorro mensual"
 *     responses:
 *       200:
 *         description: Pago programado creado exitosamente
 */
aplicacion.post("/api/pagos-programados", (req: Request, res: Response) => {
  try {
    const { idCuentaOrigen, idCuentaDestino, monto, frecuencia, descripcion } =
      req.body;
    const pago = gestorRecursos.crearPagoProgramado(
      idCuentaOrigen,
      idCuentaDestino,
      monto,
      frecuencia as Frecuencia,
      descripcion
    );

    res.json({
      exitoso: true,
      datos: pago,
      marca_tiempo: new Date(),
    });
  } catch (error) {
    res.status(400).json({
      exitoso: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      marca_tiempo: new Date(),
    });
  }
});

/**
 * @swagger
 * /api/pagos-programados/{idCuenta}:
 *   get:
 *     tags:
 *       - Pagos Programados
 *     summary: Obtener pagos programados de una cuenta
 *     parameters:
 *       - in: path
 *         name: idCuenta
 *         required: true
 *         schema:
 *           type: string
 *         example: "cta-001"
 *     responses:
 *       200:
 *         description: Lista de pagos programados
 */
aplicacion.get(
  "/api/pagos-programados/:idCuenta",
  (req: Request, res: Response) => {
    try {
      const { idCuenta } = req.params;
      const pagos = gestorRecursos.obtenerPagosProgramados(idCuenta);

      res.json({
        exitoso: true,
        datos: pagos,
        marca_tiempo: new Date(),
      });
    } catch (error) {
      res.status(500).json({
        exitoso: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        marca_tiempo: new Date(),
      });
    }
  }
);

/**
 * POST /api/pagos-programados/:idPago/ejecutar
 * Ejecuta un pago programado manualmente
 */
aplicacion.post(
  "/api/pagos-programados/:idPago/ejecutar",
  async (req: Request, res: Response) => {
    try {
      const { idPago } = req.params;
      const { idCuenta } = req.body;
      await gestorRecursos.ejecutarPagoProgramado(idPago, idCuenta);

      io.emit("pagoEjecutado", { idPago, idCuenta });

      res.json({
        exitoso: true,
        datos: { mensaje: "Pago programado ejecutado exitosamente" },
        marca_tiempo: new Date(),
      });
    } catch (error) {
      res.status(400).json({
        exitoso: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        marca_tiempo: new Date(),
      });
    }
  }
);

/**
 * DELETE /api/pagos-programados/:idPago
 * Cancela un pago programado
 */
aplicacion.delete(
  "/api/pagos-programados/:idPago",
  (req: Request, res: Response) => {
    try {
      const { idPago } = req.params;
      const { idCuenta } = req.body;
      const resultado = gestorRecursos.cancelarPagoProgramado(idPago, idCuenta);

      if (!resultado) {
        return res.status(404).json({
          exitoso: false,
          error: "Pago programado no encontrado",
          marca_tiempo: new Date(),
        });
      }

      res.json({
        exitoso: true,
        datos: { mensaje: "Pago programado cancelado exitosamente" },
        marca_tiempo: new Date(),
      });
    } catch (error) {
      res.status(500).json({
        exitoso: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        marca_tiempo: new Date(),
      });
    }
  }
);

// ============== RUTAS DE LÍMITES ==============

/**
 * @swagger
 * /api/limites/{idCuenta}:
 *   get:
 *     tags:
 *       - Límites
 *     summary: Obtener límites de una cuenta
 *     description: Obtiene los límites de operaciones y el uso actual
 *     parameters:
 *       - in: path
 *         name: idCuenta
 *         required: true
 *         schema:
 *           type: string
 *         example: "cta-001"
 *     responses:
 *       200:
 *         description: Límites de la cuenta
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exitoso:
 *                   type: boolean
 *                 datos:
 *                   $ref: '#/components/schemas/LimitesCuenta'
 *       404:
 *         description: Límites no encontrados
 */
aplicacion.get("/api/limites/:idCuenta", (req: Request, res: Response) => {
  try {
    const { idCuenta } = req.params;
    const limites = gestorRecursos.obtenerLimites(idCuenta);

    if (!limites) {
      return res.status(404).json({
        exitoso: false,
        error: "Límites no encontrados",
        marca_tiempo: new Date(),
      });
    }

    res.json({
      exitoso: true,
      datos: limites,
      marca_tiempo: new Date(),
    });
  } catch (error) {
    res.status(500).json({
      exitoso: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      marca_tiempo: new Date(),
    });
  }
});

/**
 * @swagger
 * /api/limites/{idCuenta}:
 *   put:
 *     tags:
 *       - Límites
 *     summary: Configurar límites de una cuenta
 *     description: Establece o actualiza los límites de operaciones
 *     parameters:
 *       - in: path
 *         name: idCuenta
 *         required: true
 *         schema:
 *           type: string
 *         example: "cta-001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               limiteRetiroDiario:
 *                 type: number
 *                 example: 5000
 *               limiteTransferenciaDiaria:
 *                 type: number
 *                 example: 10000
 *               limiteCompraInternacional:
 *                 type: number
 *                 example: 3000
 *               limiteCompraNacional:
 *                 type: number
 *                 example: 8000
 *     responses:
 *       200:
 *         description: Límites actualizados exitosamente
 */
aplicacion.put("/api/limites/:idCuenta", (req: Request, res: Response) => {
  try {
    const { idCuenta } = req.params;
    const limites = gestorRecursos.configurarLimites(idCuenta, req.body);

    res.json({
      exitoso: true,
      datos: limites,
      marca_tiempo: new Date(),
    });
  } catch (error) {
    res.status(400).json({
      exitoso: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      marca_tiempo: new Date(),
    });
  }
});

// ============== RUTAS ADMINISTRATIVAS ==============

/**
 * @swagger
 * /api/admin/bloqueos:
 *   get:
 *     summary: Obtiene información sobre bloqueos activos
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bloqueos activos
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/RespuestaAPI'
 *                 - type: object
 *                   properties:
 *                     datos:
 *                       type: object
 *                       properties:
 *                         bloqueoActivos:
 *                           type: array
 *                         totalBloqueos:
 *                           type: integer
 */
aplicacion.get("/api/admin/bloqueos", (req: Request, res: Response) => {
  try {
    const bloqueos = gestorRecursos.obtenerBloqueoActivos();

    res.json({
      exitoso: true,
      datos: {
        bloqueoActivos: bloqueos,
        totalBloqueos: bloqueos.length,
        marca_tiempo: new Date(),
      },
      marca_tiempo: new Date(),
    });
  } catch (error) {
    res.status(500).json({
      exitoso: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      marca_tiempo: new Date(),
    });
  }
});

/**
 * @swagger
 * /api/admin/estado:
 *   get:
 *     summary: Obtiene el estado completo del sistema distribuido
 *     tags: [Administración]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estado del sistema
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/RespuestaAPI'
 *                 - type: object
 *                   properties:
 *                     datos:
 *                       type: object
 */
aplicacion.get("/api/admin/estado", async (req: Request, res: Response) => {
  try {
    const estado = await gestorRecursos.obtenerEstadoDistribuido();
    const clientesConectados = gestorRecursos.obtenerClientesConectados();

    const respuesta = {
      exitoso: true,
      datos: {
        totalCuentas: estado.cuentas.size,
        cuentas: Array.from(estado.cuentas.values()),
        totalTransacciones: Array.from(estado.transacciones.values()).reduce(
          (suma, trans) => suma + trans.length,
          0
        ),
        bloqueoActivos: gestorRecursos.obtenerBloqueoActivos(),
        clientesConectados: clientesConectados.length,
        detallesClientes: clientesConectados,
      },
      marca_tiempo: new Date(),
    };

    res.json(respuesta);
  } catch (error) {
    res.status(500).json({
      exitoso: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      marca_tiempo: new Date(),
    });
  }
});

// ============== SOCKET.IO - COMUNICACIÓN EN TIEMPO REAL ==============

io.on("conexion", (socket) => {
  const idCliente = uuidv4();
  console.log(
    `\n🔌 Nuevo cliente conectado: ${idCliente} (Socket: ${socket.id})`
  );

  // Registrar cliente conectado
  gestorRecursos.registrarClienteConectado(
    idCliente,
    socket.id,
    `Cliente-${idCliente.slice(0, 8)}`
  );

  // Notificar a todos que hay un nuevo cliente
  io.emit("clienteConectado", {
    idCliente,
    totalClientes: gestorRecursos.obtenerClientesConectados().length,
    marca_tiempo: new Date(),
  });

  // Evento: Depositar por WebSocket
  socket.on("depositar", async (datos: any, respuesta: any) => {
    try {
      const { idCuenta, monto, descripcion } = datos;
      const transaccion = await gestorRecursos.depositar(
        idCuenta,
        monto,
        descripcion || "",
        idCliente
      );
      const cuenta = gestorRecursos.obtenerCuenta(idCuenta);

      // Notificar a todos
      io.emit("transaccionCompletada", {
        transaccion,
        cuenta,
        tipo: "DEPOSITO",
        idClienteOrigen: idCliente,
      });

      respuesta({ exitoso: true, transaccion, cuenta });
    } catch (error) {
      respuesta({
        exitoso: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  });

  // Evento: Retirar por WebSocket
  socket.on("retirar", async (datos: any, respuesta: any) => {
    try {
      const { idCuenta, monto, descripcion } = datos;
      const transaccion = await gestorRecursos.retirar(
        idCuenta,
        monto,
        descripcion || "",
        idCliente
      );
      const cuenta = gestorRecursos.obtenerCuenta(idCuenta);

      io.emit("transaccionCompletada", {
        transaccion,
        cuenta,
        tipo: "RETIRO",
        idClienteOrigen: idCliente,
      });

      respuesta({ exitoso: true, transaccion, cuenta });
    } catch (error) {
      respuesta({
        exitoso: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  });

  // Evento: Transferir por WebSocket
  socket.on("transferir", async (datos: any, respuesta: any) => {
    try {
      const { idCuentaOrigen, idCuentaDestino, monto, descripcion } = datos;
      const resultado = await gestorRecursos.transferir(
        idCuentaOrigen,
        idCuentaDestino,
        monto,
        descripcion || "",
        idCliente
      );
      const cuentaOrigen = gestorRecursos.obtenerCuenta(idCuentaOrigen);
      const cuentaDestino = gestorRecursos.obtenerCuenta(idCuentaDestino);

      io.emit("transaccionCompletada", {
        resultado,
        cuentaOrigen,
        cuentaDestino,
        tipo: "TRANSFERENCIA",
        idClienteOrigen: idCliente,
      });

      respuesta({ exitoso: true, resultado, cuentaOrigen, cuentaDestino });
    } catch (error) {
      respuesta({
        exitoso: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  });

  // Evento: Solicitar estado actual
  socket.on("solicitarEstado", async (respuesta: any) => {
    const estado = await gestorRecursos.obtenerEstadoDistribuido();
    respuesta({
      cuentas: Array.from(estado.cuentas.values()),
      transaccionesTotales: Array.from(estado.transacciones.values()).reduce(
        (suma, trans) => suma + trans.length,
        0
      ),
      bloqueos: gestorRecursos.obtenerBloqueoActivos(),
      clientesConectados: gestorRecursos.obtenerClientesConectados().length,
    });
  });

  // Evento: Desconexión
  socket.on("desconectar", () => {
    gestorRecursos.desconectarCliente(idCliente);
    console.log(`\n🔌 Cliente desconectado: ${idCliente}`);
    io.emit("clienteDesconectado", {
      idCliente,
      totalClientes: gestorRecursos.obtenerClientesConectados().length,
    });
  });
});

// Iniciar servidor
servidorHTTP.listen(puerto, () => {
  const baseUrl = `http://localhost:${puerto}`;
  const swaggerUrl = `${baseUrl}/api-docs`;
  const swaggerJsonUrl = `${baseUrl}/api-docs.json`;

  // Contar rutas registradas en Express
  const rutas =
    (aplicacion as any)._router && (aplicacion as any)._router.stack
      ? (aplicacion as any)._router.stack.filter((s: any) => s.route).length
      : 0;

  logSuccess(`\n🏦 SERVIDOR BANCARIO DISTRIBUIDO INICIADO`);
  logInfo(`Puerto: ${puerto}`);
  logInfo(`HTTP: ${baseUrl}`);
  logInfo(`WebSocket: ws://localhost:${puerto}`);
  logInfo(`Salud: ${baseUrl}/salud`);
  logInfo(`Swagger UI: ${swaggerUrl}`);
  logInfo(`Swagger JSON: ${swaggerJsonUrl}`);
  logInfo(`Rutas registradas: ${rutas}`);
  try {
    const tags = Array.isArray((swaggerSpec as any).tags)
      ? (swaggerSpec as any).tags.length
      : 0;
    logInfo(`Documentación Swagger - tags: ${tags}`);
  } catch (e) {
    logWarn("No se pudo leer metadata de Swagger");
  }

  console.log(ANSI.reset);
});
