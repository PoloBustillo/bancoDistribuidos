import express, { Request, Response } from "express";
import cors from "cors";
import { Server as ServidorHTTP } from "http";
import { Server as ServidorSocket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
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
console.log(`[SERVIDOR] ID de sesión del servidor: ${idSesionServidor}`);

// Middleware
aplicacion.use(cors());
aplicacion.use(express.json());

// Rutas de salud
aplicacion.get("/salud", (req: Request, res: Response) => {
  res.json({
    exitoso: true,
    datos: { estado: "ACTIVO", idSesion: idSesionServidor },
    marca_tiempo: new Date(),
  });
});

// ============== RUTAS REST DE CUENTAS ==============

/**
 * GET /api/cuentas
 * Obtiene todas las cuentas
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
 * GET /api/cuentas/:idCuenta
 * Obtiene una cuenta específica
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
 * POST /api/transacciones/depositar
 * Realiza un depósito
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
 * POST /api/transacciones/retirar
 * Realiza un retiro
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
 * POST /api/transacciones/transferir
 * Realiza una transferencia
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
 * GET /api/transacciones/:idCuenta
 * Obtiene el historial de transacciones de una cuenta
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
 * GET /api/auditoria/:idCuenta
 * Obtiene el log de auditoría de una cuenta
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
 * POST /api/tarjetas
 * Crea una nueva tarjeta
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
 * GET /api/tarjetas/:idCuenta
 * Obtiene las tarjetas de una cuenta
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
 * PUT /api/tarjetas/:idTarjeta/bloquear
 * Bloquea una tarjeta
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
 * PUT /api/tarjetas/:idTarjeta/desbloquear
 * Desbloquea una tarjeta
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
 * POST /api/prestamos
 * Solicita un nuevo préstamo
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
 * GET /api/prestamos/:idCuenta
 * Obtiene los préstamos de una cuenta
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
 * POST /api/prestamos/:idPrestamo/pagar
 * Paga una cuota de un préstamo
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
 * POST /api/inversiones
 * Crea una nueva inversión
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
 * GET /api/inversiones/:idCuenta
 * Obtiene las inversiones de una cuenta
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
 * DELETE /api/inversiones/:idInversion
 * Cancela una inversión
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
 * POST /api/beneficiarios
 * Agrega un nuevo beneficiario
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
 * GET /api/beneficiarios/:idCuenta
 * Obtiene los beneficiarios de una cuenta
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
 * DELETE /api/beneficiarios/:idBeneficiario
 * Elimina un beneficiario
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
 * GET /api/notificaciones/:idCuenta
 * Obtiene las notificaciones de una cuenta
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
 * PUT /api/notificaciones/:idNotificacion/marcar-leida
 * Marca una notificación como leída
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
 * PUT /api/notificaciones/:idCuenta/marcar-todas-leidas
 * Marca todas las notificaciones como leídas
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
 * POST /api/pagos-programados
 * Crea un nuevo pago programado
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
 * GET /api/pagos-programados/:idCuenta
 * Obtiene los pagos programados de una cuenta
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
 * GET /api/limites/:idCuenta
 * Obtiene los límites de una cuenta
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
 * PUT /api/limites/:idCuenta
 * Configura los límites de una cuenta
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
 * GET /api/admin/bloqueos
 * Obtiene información sobre bloqueos activos
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
 * GET /api/admin/estado
 * Obtiene el estado completo del sistema distribuido
 */
aplicacion.get("/api/admin/estado", (req: Request, res: Response) => {
  try {
    const estado = gestorRecursos.obtenerEstadoDistribuido();
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
  socket.on("solicitarEstado", (respuesta: any) => {
    const estado = gestorRecursos.obtenerEstadoDistribuido();
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
  console.log(`\n🏦 SERVIDOR BANCARIO DISTRIBUIDO INICIADO`);
  console.log(`   Puerto: ${puerto}`);
  console.log(`   URL HTTP: http://localhost:${puerto}`);
  console.log(`   WebSocket: ws://localhost:${puerto}`);
  console.log(`   Verificación: http://localhost:${puerto}/salud\n`);
});
