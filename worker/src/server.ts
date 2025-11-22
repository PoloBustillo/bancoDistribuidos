import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { authService } from "./auth/authService";
import { WorkerClient } from "./services/workerClient";
import { BancoService } from "./services/bancoService";
import { CuentasCompartidasService } from "./services/cuentasCompartidasService";
import { advisorService } from "./services/advisorService";
import prisma from "./prisma/client";
import { z } from "zod";
import { bankingEvents, EventType } from "./services/eventEmitter";
import type { BankingEvent } from "./services/eventEmitter";
import jwt from "jsonwebtoken";
import { ConfigManager } from "@banco/shared/config";
import { logger } from "@banco/shared/logger";

const app = express();
const httpServer = createServer(app);
// singleton prisma client imported from `./prisma/client`

// Configuración desde variables de entorno
let PORT = parseInt(process.env.PORT || "0"); // 0 = puerto automático
const COORDINADOR_URL = process.env.COORDINADOR_URL || "http://localhost:4000";

// Variables que se establecerán después de obtener el puerto real
let ACTUAL_PORT = PORT;
let WORKER_ID = "";
let workerClient: WorkerClient;

// Inicializar servicios (se completan después de tener workerClient)
const bancoService = new BancoService(null as any);
let cuentasCompartidasService: CuentasCompartidasService;

// ========================================
// 🔌 CONFIGURACIÓN SOCKET.IO
// ========================================
// Socket.IO para eventos en tiempo real
const JWT_SECRET =
  process.env.JWT_SECRET || "B4nc0S3cr3_2024_D1str1but3d_JWT_S3cr3t";

// Obtener orígenes CORS permitidos (incluye Vercel)
const allowedOrigins = ConfigManager.getCorsOrigins();
const localOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
];
const allSocketOrigins = [...allowedOrigins, ...localOrigins];

logger.worker(`🔌 Socket.IO CORS Origins: ${allSocketOrigins.join(", ")}`);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allSocketOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  transports: ["websocket", "polling"],
});

// Autenticación de Socket.IO
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Token requerido"));
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      usuarioId: string;
      jti: string;
    };

    // Verificar que la sesión existe y no ha expirado
    const sesion = await prisma.sesion.findUnique({
      where: { jti: decoded.jti },
    });

    if (!sesion || sesion.expiresAt < new Date()) {
      return next(new Error("Sesión inválida o expirada"));
    }

    // Guardar datos del usuario en el socket
    socket.data.usuarioId = decoded.usuarioId;
    socket.data.jti = decoded.jti;
    next();
  } catch (error) {
    next(new Error("Autenticación fallida"));
  }
});

// Manejar conexiones de Socket.IO
io.on("connection", async (socket) => {
  const usuarioId = socket.data.usuarioId;
  console.log(`🔌 Socket conectado: usuario ${usuarioId}`);

  try {
    // Unirse a room personal del usuario
    socket.join(`usuario:${usuarioId}`);

    // Obtener cuentas del usuario y unirse a sus rooms
    const usuarioCuentas = await prisma.usuarioCuenta.findMany({
      where: { usuarioId },
      select: { cuentaId: true },
    });

    usuarioCuentas.forEach((uc) => {
      socket.join(`cuenta:${uc.cuentaId}`);
    });

    console.log(
      `✅ Usuario ${usuarioId} unido a ${usuarioCuentas.length + 1} rooms`
    );

    // Evento de suscripción a cuenta específica (para cuentas nuevas)
    socket.on("subscribe-cuenta", (cuentaId: string) => {
      socket.join(`cuenta:${cuentaId}`);
      console.log(`📢 Usuario ${usuarioId} suscrito a cuenta ${cuentaId}`);
    });

    // Evento de desuscripción
    socket.on("unsubscribe-cuenta", (cuentaId: string) => {
      socket.leave(`cuenta:${cuentaId}`);
      console.log(`📤 Usuario ${usuarioId} desuscrito de cuenta ${cuentaId}`);
    });

    socket.on("disconnect", () => {
      console.log(`❌ Socket desconectado: usuario ${usuarioId}`);
    });
  } catch (error) {
    console.error("Error al configurar socket:", error);
  }
});

// ========================================
// 📡 PROPAGACIÓN DE EVENTOS A SOCKET.IO
// ========================================
// Escuchar eventos del EventEmitter y enviarlos a clientes Socket.IO

// Evento: Cuenta actualizada
bankingEvents.on(EventType.CUENTA_ACTUALIZADA, (event: BankingEvent) => {
  if (event.type === EventType.CUENTA_ACTUALIZADA) {
    io.to(`cuenta:${event.cuentaId}`).emit("banking-event", event);
    console.log(
      `📡 Evento emitido a cuenta ${event.cuentaId}: CUENTA_ACTUALIZADA`
    );
  }
});

// Evento: Transferencia enviada
bankingEvents.on(EventType.TRANSFERENCIA_ENVIADA, (event: BankingEvent) => {
  if (event.type === EventType.TRANSFERENCIA_ENVIADA) {
    io.to(`cuenta:${event.cuentaId}`).emit("banking-event", event);
    console.log(`📡 Evento: TRANSFERENCIA_ENVIADA - $${event.monto}`);
  }
});

// Evento: Transferencia recibida
bankingEvents.on(EventType.TRANSFERENCIA_RECIBIDA, (event: BankingEvent) => {
  if (event.type === EventType.TRANSFERENCIA_RECIBIDA) {
    io.to(`cuenta:${event.cuentaId}`).emit("banking-event", event);
    console.log(`📡 Evento: TRANSFERENCIA_RECIBIDA - $${event.monto}`);
  }
});

// Evento: Depósito realizado
bankingEvents.on(EventType.DEPOSITO_REALIZADO, (event: BankingEvent) => {
  if (event.type === EventType.DEPOSITO_REALIZADO) {
    io.to(`cuenta:${event.cuentaId}`).emit("banking-event", event);
    console.log(`📡 Evento: DEPOSITO_REALIZADO - $${event.monto}`);
  }
});

// Evento: Retiro realizado
bankingEvents.on(EventType.RETIRO_REALIZADO, (event: BankingEvent) => {
  if (event.type === EventType.RETIRO_REALIZADO) {
    io.to(`cuenta:${event.cuentaId}`).emit("banking-event", event);
    console.log(`📡 Evento: RETIRO_REALIZADO - $${event.monto}`);
  }
});

// Evento: Usuario agregado a cuenta
bankingEvents.on(EventType.USUARIO_AGREGADO, (event: BankingEvent) => {
  if (event.type === EventType.USUARIO_AGREGADO) {
    io.to(`cuenta:${event.cuentaId}`).emit("banking-event", event);
    io.to(`usuario:${event.usuarioId}`).emit("banking-event", event);
    console.log(
      `📡 Evento: USUARIO_AGREGADO - ${event.usuarioEmail} a cuenta ${event.cuentaId}`
    );
  }
});

// Evento: Usuario removido de cuenta
bankingEvents.on(EventType.USUARIO_REMOVIDO, (event: BankingEvent) => {
  if (event.type === EventType.USUARIO_REMOVIDO) {
    io.to(`cuenta:${event.cuentaId}`).emit("banking-event", event);
    io.to(`usuario:${event.usuarioId}`).emit("banking-event", event);
    console.log(
      `📡 Evento: USUARIO_REMOVIDO - ${event.usuarioEmail} de cuenta ${event.cuentaId}`
    );
  }
});

// Evento: Tarjeta creada
bankingEvents.on(EventType.TARJETA_CREADA, (event: BankingEvent) => {
  if (event.type === EventType.TARJETA_CREADA) {
    io.to(`usuario:${event.usuarioId}`).emit("banking-event", event);
    console.log(`📡 Evento: TARJETA_CREADA - usuario ${event.usuarioId}`);
  }
});

// Evento: Estado de tarjeta cambiado
bankingEvents.on(EventType.TARJETA_ESTADO_CAMBIADO, (event: BankingEvent) => {
  if (event.type === EventType.TARJETA_ESTADO_CAMBIADO) {
    io.to(`usuario:${event.usuarioId}`).emit("banking-event", event);
    console.log(
      `📡 Evento: TARJETA_ESTADO_CAMBIADO - ${event.estado} para usuario ${event.usuarioId}`
    );
  }
});

// ========================================
// 🌐 CONFIGURACIÓN CORS
// ========================================
// Permitir peticiones desde el frontend (Next.js)
app.use(
  cors({
    origin: function (origin, callback) {
      // Obtener orígenes permitidos desde config compartido
      const allowedOrigins = ConfigManager.getCorsOrigins();

      // Agregar orígenes adicionales locales
      const localOrigins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
      ];

      const allAllowed = [...allowedOrigins, ...localOrigins];

      // Si no hay origin (peticiones server-to-server o Postman) o está en la lista, permitir
      if (!origin || allAllowed.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`🚫 CORS blocked: ${origin}`, {
          origin,
          allowed: allAllowed,
        });
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// Schemas de validación
const registerSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Middleware de autenticación
interface AuthRequest extends Request {
  usuario?: {
    id: string;
    email: string;
    role?: string;
    asesorId?: string;
    scope?: string[];
  };
  jti?: string;
}

async function verificarAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token no proporcionado" });
    }

    const token = authHeader.substring(7);
    const resultado = await authService.verificarToken(token);

    if (!resultado.valido) {
      return res
        .status(401)
        .json({ error: "Token inválido o sesión expirada" });
    }

    req.usuario = resultado.usuario;
    req.jti = resultado.jti;
    next();
  } catch (error) {
    res.status(401).json({ error: "Error de autenticación" });
  }
}

// ============== RUTAS DE AUTENTICACIÓN ==============

app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);
    const resultado = await authService.registrarUsuario(
      data.nombre,
      data.email,
      data.password
    );

    console.log(`✅ Usuario registrado: ${data.email}`);

    res.status(201).json({
      mensaje: "Usuario registrado exitosamente",
      ...resultado,
    });
  } catch (error: any) {
    console.error("Error en registro:", error.message);
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);
    const resultado = await authService.login(data.email, data.password);

    console.log(`✅ Login exitoso: ${data.email}`);

    res.json({
      mensaje: "Login exitoso",
      ...resultado,
    });
  } catch (error: any) {
    console.error("Error en login:", error.message);
    res.status(401).json({ error: error.message });
  }
});

app.post(
  "/api/auth/logout",
  verificarAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      await authService.logout(req.usuario!.id, req.jti);

      console.log(`✅ Logout: ${req.usuario!.email}`);

      res.json({ mensaje: "Sesión cerrada exitosamente" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

app.get(
  "/api/auth/me",
  verificarAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const usuario = await prisma.usuario.findUnique({
        where: { id: req.usuario!.id },
        include: {
          // 🎓 Cargar cuentas compartidas
          usuarioCuentas: {
            include: {
              cuenta: {
                select: {
                  id: true,
                  numeroCuenta: true,
                  nombre: true,
                  tipoCuenta: true,
                  saldo: true,
                  estado: true,
                },
              },
            },
          },
          // 🎓 Cargar tarjetas individuales (todas, no solo activas)
          tarjetas: {
            select: {
              id: true,
              numeroTarjeta: true,
              tipoTarjeta: true,
              estado: true,
              fechaExpiracion: true,
            },
          },
        },
      });

      // Mapear cuentas compartidas
      const cuentas = usuario!.usuarioCuentas.map((uc) => ({
        id: uc.cuenta.id,
        numeroCuenta: uc.cuenta.numeroCuenta,
        nombre: uc.cuenta.nombre,
        tipoCuenta: uc.cuenta.tipoCuenta,
        saldo: uc.cuenta.saldo,
        estado: uc.cuenta.estado,
        rol: uc.rol, // 🎓 Rol del usuario en esta cuenta
      }));

      res.json({
        usuario: {
          id: usuario!.id,
          nombre: usuario!.nombre,
          email: usuario!.email,
        },
        cuentas, // 🎓 Cuentas (pueden ser compartidas)
        tarjetas: usuario!.tarjetas, // 🎓 Tarjetas individuales
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ============== RUTAS DE BANCO (CON LOCKS DISTRIBUIDOS) ==============

// Schemas de validación
const transferenciaSchema = z.object({
  cuentaOrigenId: z.string().uuid(),
  cuentaDestinoId: z.string().uuid(), // Validar como UUID (ya resuelto en el endpoint)
  monto: z.number().positive(),
});

const depositoRetiroSchema = z.object({
  cuentaId: z.string().uuid(),
  monto: z.number().positive(),
});

// POST /api/banco/transferir - Transferencia entre cuentas
app.post(
  "/api/banco/transferir",
  verificarAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      // Schema temporal para validación inicial (acepta string para cuentaDestinoId)
      const transferenciaInputSchema = z.object({
        cuentaOrigenId: z.string().uuid(),
        cuentaDestinoId: z.string().min(1, "Cuenta destino es requerida"),
        monto: z.number().positive("El monto debe ser positivo"),
      });

      // Validar estructura básica
      const input = transferenciaInputSchema.parse(req.body);

      // Resolver cuentaDestinoId si es número de cuenta
      let cuentaDestinoId = input.cuentaDestinoId;

      // Verificar si es UUID (formato: 8-4-4-4-12 caracteres hexadecimales)
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidRegex.test(cuentaDestinoId)) {
        // No es UUID, buscar cuenta por número
        const numeroLimpio = cuentaDestinoId.replace(/[-\s]/g, "");

        const cuentaDestino = await prisma.cuentaBancaria.findFirst({
          where: {
            numeroCuenta: {
              in: [numeroLimpio, cuentaDestinoId],
            },
          },
          select: { id: true },
        });

        if (!cuentaDestino) {
          return res.status(400).json({
            error: `No se encontró una cuenta con el número: ${cuentaDestinoId}`,
          });
        }

        // Reemplazar con el UUID encontrado
        cuentaDestinoId = cuentaDestino.id;
        console.log(
          `✅ Cuenta destino encontrada: ${numeroLimpio} → ${cuentaDestinoId}`
        );
      }

      // Transferir (ahora cuentaDestinoId es UUID)
      const enableDemo = req.query.demo === "true";
      const resultado = await bancoService.transferir(
        input.cuentaOrigenId,
        cuentaDestinoId,
        input.monto,
        req.usuario!.id,
        enableDemo
      );

      res.json(resultado);
    } catch (error: any) {
      console.error("Error en transferencia:", error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// POST /api/banco/depositar - Depósito en cuenta
app.post(
  "/api/banco/depositar",
  verificarAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const data = depositoRetiroSchema.parse(req.body);
      const enableDemo = req.query.demo === "true";
      const resultado = await bancoService.depositar(
        data.cuentaId,
        data.monto,
        req.usuario!.id,
        enableDemo
      );

      res.json(resultado);
    } catch (error: any) {
      console.error("Error en depósito:", error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// POST /api/banco/retirar - Retiro de cuenta
app.post(
  "/api/banco/retirar",
  verificarAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const data = depositoRetiroSchema.parse(req.body);
      const enableDemo = req.query.demo === "true";
      const resultado = await bancoService.retirar(
        data.cuentaId,
        data.monto,
        req.usuario!.id,
        enableDemo
      );

      res.json(resultado);
    } catch (error: any) {
      console.error("Error en retiro:", error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// GET /api/banco/saldo/:cuentaId - Consultar saldo
app.get(
  "/api/banco/saldo/:cuentaId",
  verificarAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { cuentaId } = req.params;
      const resultado = await bancoService.consultarSaldo(
        cuentaId,
        req.usuario!.id
      );

      res.json(resultado);
    } catch (error: any) {
      console.error("Error al consultar saldo:", error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// ========================================
// 🎓 RUTAS: CUENTAS COMPARTIDAS Y TARJETAS
// ========================================

// Schemas de validación para cuentas compartidas
const agregarUsuarioSchema = z.object({
  emailUsuario: z.string().email(),
  rol: z.enum(["TITULAR", "AUTORIZADO", "CONSULTA"]).optional(),
});

const removerUsuarioSchema = z.object({
  usuarioId: z.string().uuid(),
});

const crearTarjetaSchema = z.object({
  tipoTarjeta: z.enum(["DEBITO", "CREDITO"]).optional(),
});

const cambiarEstadoTarjetaSchema = z.object({
  estado: z.enum(["ACTIVA", "BLOQUEADA", "CANCELADA"]),
});

// POST /api/cuentas-compartidas/:cuentaId/agregar-usuario
app.post(
  "/api/cuentas-compartidas/:cuentaId/agregar-usuario",
  verificarAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { cuentaId } = req.params;
      const data = agregarUsuarioSchema.parse(req.body);

      const resultado = await cuentasCompartidasService.agregarUsuarioACuenta(
        cuentaId,
        data.emailUsuario,
        req.usuario!.id,
        data.rol
      );

      console.log(`✅ Usuario agregado a cuenta compartida: ${cuentaId}`);
      res.status(200).json(resultado);
    } catch (error: any) {
      console.error("Error al agregar usuario:", error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// GET /api/cuentas-compartidas/:cuentaId/usuarios
app.get(
  "/api/cuentas-compartidas/:cuentaId/usuarios",
  verificarAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { cuentaId } = req.params;
      const usuarios = await cuentasCompartidasService.listarUsuariosDeCuenta(
        cuentaId,
        req.usuario!.id
      );

      res.status(200).json(usuarios);
    } catch (error: any) {
      console.error("Error al listar usuarios:", error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// DELETE /api/cuentas-compartidas/:cuentaId/remover-usuario
app.delete(
  "/api/cuentas-compartidas/:cuentaId/remover-usuario",
  verificarAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { cuentaId } = req.params;
      const data = removerUsuarioSchema.parse(req.body);

      const resultado = await cuentasCompartidasService.removerUsuarioDeCuenta(
        cuentaId,
        data.usuarioId,
        req.usuario!.id
      );

      console.log(`✅ Usuario removido de cuenta compartida: ${cuentaId}`);
      res.status(200).json(resultado);
    } catch (error: any) {
      console.error("Error al remover usuario:", error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// POST /api/cuentas-compartidas/:cuentaId/tarjetas
app.post(
  "/api/cuentas-compartidas/:cuentaId/tarjetas",
  verificarAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { cuentaId } = req.params;
      const data = crearTarjetaSchema.parse(req.body);

      const tarjeta = await cuentasCompartidasService.crearTarjeta(
        req.usuario!.id,
        cuentaId,
        data.tipoTarjeta
      );

      console.log(`✅ Tarjeta individual creada para cuenta: ${cuentaId}`);
      res.status(201).json(tarjeta);
    } catch (error: any) {
      console.error("Error al crear tarjeta:", error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// GET /api/cuentas-compartidas/:cuentaId/tarjetas
app.get(
  "/api/cuentas-compartidas/:cuentaId/tarjetas",
  verificarAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { cuentaId } = req.params;
      const tarjetas = await cuentasCompartidasService.listarTarjetasDeCuenta(
        cuentaId,
        req.usuario!.id
      );

      res.status(200).json(tarjetas);
    } catch (error: any) {
      console.error("Error al listar tarjetas:", error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// PATCH /api/tarjetas/:tarjetaId/estado
app.patch(
  "/api/tarjetas/:tarjetaId/estado",
  verificarAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { tarjetaId } = req.params;
      const data = cambiarEstadoTarjetaSchema.parse(req.body);

      const resultado = await cuentasCompartidasService.cambiarEstadoTarjeta(
        tarjetaId,
        req.usuario!.id,
        data.estado
      );

      console.log(`✅ Estado de tarjeta actualizado: ${tarjetaId}`);
      res.status(200).json(resultado);
    } catch (error: any) {
      console.error("Error al cambiar estado de tarjeta:", error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// ============== CUENTAS ADICIONALES ==============

// POST /api/cuentas/crear
// Crear una cuenta adicional para el usuario autenticado
app.post(
  "/api/cuentas/crear",
  verificarAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const crearCuentaSchema = z.object({
        tipoCuenta: z.enum(["CHEQUES", "DEBITO", "CREDITO"]),
        nombre: z.string().optional(),
      });

      const data = crearCuentaSchema.parse(req.body);

      const resultado = await cuentasCompartidasService.crearCuentaAdicional(
        req.usuario!.id,
        data.tipoCuenta,
        data.nombre
      );

      console.log(
        `✅ Cuenta adicional creada para usuario: ${req.usuario!.email}`
      );
      res.status(201).json(resultado);
    } catch (error: any) {
      console.error("Error al crear cuenta adicional:", error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// ========================================
// 🎓 RUTAS: SISTEMA DE ASESORES
// ========================================

// POST /api/client/verification-code - Cliente genera código para asesor
app.post(
  "/api/client/verification-code",
  verificarAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const resultado = await advisorService.generarCodigoVerificacion(
        req.usuario!.id
      );

      res.json({
        message:
          "Código generado exitosamente. Proporcione este código al asesor.",
        codigo: resultado.codigo,
        expiresAt: resultado.expiresAt,
        expiresIn: resultado.expiresIn, // Segundos restantes
      });
    } catch (error: any) {
      console.error("Error al generar código:", error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// POST /api/advisor/verify-client - Asesor verifica cliente
app.post("/api/advisor/verify-client", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      asesorId: z.string().min(1), // Acepta cualquier string (UUID o ID corto)
      numeroRecurso: z.string(), // número de cuenta o tarjeta
      ultimosDigitos: z.string().length(4),
      codigo: z.string().length(6),
    });

    const data = schema.parse(req.body);
    const ip = req.ip;
    const userAgent = req.get("user-agent");

    const resultado = await advisorService.verificarCliente(
      data.asesorId,
      data.numeroRecurso,
      data.ultimosDigitos,
      data.codigo,
      ip,
      userAgent
    );

    res.json(resultado);
  } catch (error: any) {
    console.error("Error al verificar cliente:", error.message);
    res.status(400).json({ error: error.message });
  }
});

// Middleware para validar token de asesor
const verificarAsesor = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Token de asesor requerido" });
    }

    const payload = await advisorService.validarToken(token);
    req.usuario = {
      id: payload.impersonatedUser,
      email: "",
      role: "ASESOR",
      asesorId: payload.sub,
      scope: payload.scope,
    };

    next();
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
};

// GET /api/advisor/client/:usuarioId/accounts - Ver cuentas del cliente
app.get(
  "/api/advisor/client/:usuarioId/accounts",
  verificarAsesor,
  async (req: AuthRequest, res: Response) => {
    try {
      const { usuarioId } = req.params;

      // Verificar que el asesor tiene acceso a este usuario
      if (req.usuario!.id !== usuarioId) {
        return res.status(403).json({
          error: "No tiene acceso a este cliente",
        });
      }

      const cuentas = await advisorService.obtenerCuentasUsuario(
        req.usuario!.asesorId!,
        usuarioId,
        req.ip,
        req.get("user-agent")
      );

      res.json(cuentas);
    } catch (error: any) {
      console.error("Error al obtener cuentas:", error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// GET /api/advisor/client/:usuarioId/cards - Ver tarjetas del cliente
app.get(
  "/api/advisor/client/:usuarioId/cards",
  verificarAsesor,
  async (req: AuthRequest, res: Response) => {
    try {
      const { usuarioId } = req.params;

      if (req.usuario!.id !== usuarioId) {
        return res.status(403).json({
          error: "No tiene acceso a este cliente",
        });
      }

      const tarjetas = await advisorService.obtenerTarjetasUsuario(
        req.usuario!.asesorId!,
        usuarioId,
        req.ip,
        req.get("user-agent")
      );

      res.json(tarjetas);
    } catch (error: any) {
      console.error("Error al obtener tarjetas:", error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// GET /api/advisor/client/:usuarioId/account/:cuentaId/balance - Ver saldo
app.get(
  "/api/advisor/client/:usuarioId/account/:cuentaId/balance",
  verificarAsesor,
  async (req: AuthRequest, res: Response) => {
    try {
      const { usuarioId, cuentaId } = req.params;

      if (req.usuario!.id !== usuarioId) {
        return res.status(403).json({
          error: "No tiene acceso a este cliente",
        });
      }

      const saldo = await advisorService.obtenerSaldoCuenta(
        req.usuario!.asesorId!,
        usuarioId,
        cuentaId,
        req.ip,
        req.get("user-agent")
      );

      res.json(saldo);
    } catch (error: any) {
      console.error("Error al obtener saldo:", error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// POST /api/advisor/logout - Cerrar sesión de asesor
app.post(
  "/api/advisor/logout",
  verificarAsesor,
  async (req: AuthRequest, res: Response) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (token) {
        const payload = await advisorService.validarToken(token);
        await advisorService.revocarSesion(payload.jti);
      }

      res.json({ message: "Sesión cerrada exitosamente" });
    } catch (error: any) {
      console.error("Error al cerrar sesión:", error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// PATCH /api/advisor/client/:usuarioId/account/:cuentaId/status - Cambiar estado de cuenta
app.patch(
  "/api/advisor/client/:usuarioId/account/:cuentaId/status",
  verificarAsesor,
  async (req: AuthRequest, res: Response) => {
    try {
      const { usuarioId, cuentaId } = req.params;
      const schema = z.object({
        estado: z.enum(["ACTIVA", "BLOQUEADA", "CERRADA"]),
      });

      const { estado } = schema.parse(req.body);

      if (req.usuario!.id !== usuarioId) {
        return res.status(403).json({
          error: "No tiene acceso a este cliente",
        });
      }

      const cuentaActualizada = await advisorService.cambiarEstadoCuenta(
        req.usuario!.asesorId!,
        usuarioId,
        cuentaId,
        estado,
        req.ip,
        req.get("user-agent")
      );

      res.json({
        message: `Estado de cuenta actualizado a ${estado}`,
        cuenta: cuentaActualizada,
      });
    } catch (error: any) {
      console.error("Error al cambiar estado de cuenta:", error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// PATCH /api/advisor/client/:usuarioId/card/:tarjetaId/status - Cambiar estado de tarjeta
app.patch(
  "/api/advisor/client/:usuarioId/card/:tarjetaId/status",
  verificarAsesor,
  async (req: AuthRequest, res: Response) => {
    try {
      const { usuarioId, tarjetaId } = req.params;
      const schema = z.object({
        estado: z.enum(["ACTIVA", "BLOQUEADA", "CANCELADA"]),
      });

      const { estado } = schema.parse(req.body);

      if (req.usuario!.id !== usuarioId) {
        return res.status(403).json({
          error: "No tiene acceso a este cliente",
        });
      }

      const tarjetaActualizada = await advisorService.cambiarEstadoTarjeta(
        req.usuario!.asesorId!,
        usuarioId,
        tarjetaId,
        estado,
        req.ip,
        req.get("user-agent")
      );

      res.json({
        message: `Estado de tarjeta actualizado a ${estado}`,
        tarjeta: tarjetaActualizada,
      });
    } catch (error: any) {
      console.error("Error al cambiar estado de tarjeta:", error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

// ============== SALUD DEL SERVIDOR ==============

app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    workerId: WORKER_ID || "initializing",
    puerto: ACTUAL_PORT,
    coordinador: {
      url: COORDINADOR_URL,
      conectado: workerClient?.estaConectado() ?? false,
    },
    timestamp: new Date().toISOString(),
  });
});

// Iniciar servidor
async function iniciar() {
  // Configurar el workerId en el EventEmitter
  bankingEvents.setWorkerId(WORKER_ID || "worker-unknown");

  // Primero iniciar el servidor HTTP para obtener el puerto real
  // Escuchar en 0.0.0.0 para permitir conexiones externas
  const HOST = process.env.HOST || "0.0.0.0";
  const server = httpServer.listen(ACTUAL_PORT, HOST, async () => {
    // Obtener el puerto real asignado
    const address = server.address();
    ACTUAL_PORT =
      typeof address === "object" && address !== null ? address.port : PORT;

    // Ahora sí crear WORKER_ID y workerClient con el puerto real
    WORKER_ID = process.env.WORKER_ID || `worker-${ACTUAL_PORT}`;
    workerClient = new WorkerClient(WORKER_ID, ACTUAL_PORT, COORDINADOR_URL);

    // Actualizar el workerId en el EventEmitter
    bankingEvents.setWorkerId(WORKER_ID);

    // Actualizar el workerClient en bancoService
    (bancoService as any).workerClient = workerClient;

    // Inicializar cuentasCompartidasService con workerClient
    cuentasCompartidasService = new CuentasCompartidasService(workerClient);

    // Intentar conectar al coordinador
    try {
      console.log(`🔌 Intentando conectar al coordinador...`);
      await workerClient.conectar();
      console.log(`✅ Conectado al coordinador central`);
    } catch (error) {
      console.log(
        `⚠️ No se pudo conectar al coordinador, continuando sin locks distribuidos`
      );
    }

    // Mostrar información del servidor
    console.log(`\n🏦 Worker ${WORKER_ID} iniciado`);
    console.log(`📍 Puerto: ${ACTUAL_PORT}`);
    console.log(`🔌 Coordinador: ${COORDINADOR_URL}`);
    console.log(
      `🔐 Locks distribuidos: ${
        workerClient.estaConectado() ? "✅ ACTIVO" : "❌ DESACTIVADO"
      }`
    );
    console.log(`⚡ Socket.IO: ✅ ACTIVO (eventos en tiempo real)`);
    console.log(`\n📋 Endpoints de Autenticación:`);
    console.log(`   POST /api/auth/register - Registrar usuario`);
    console.log(`   POST /api/auth/login - Iniciar sesión`);
    console.log(`   POST /api/auth/logout - Cerrar sesión`);
    console.log(`   GET  /api/auth/me - Perfil del usuario`);
    console.log(`\n💰 Endpoints Bancarios (con locks distribuidos):`);
    console.log(`   POST /api/banco/transferir - Transferencia entre cuentas`);
    console.log(`   POST /api/banco/depositar - Depósito en cuenta`);
    console.log(`   POST /api/banco/retirar - Retiro de cuenta`);
    console.log(`   POST /api/banco/consultar-saldo - Consultar saldo`);
    console.log(`\n🔔 Eventos en Tiempo Real (Socket.IO):`);
    console.log(`   📡 CUENTA_ACTUALIZADA - Cambios en saldo`);
    console.log(`   💸 TRANSFERENCIA_RECIBIDA - Dinero recibido`);
    console.log(`   💳 DEPOSITO_REALIZADO - Depósito en cuenta`);
    console.log(`   🎯 USUARIO_AGREGADO - Nuevo acceso a cuenta`);
    console.log(`\n🔧 Utilidades:`);
    console.log(`   GET  /api/health - Estado del servidor\n`);
  });
}

// Limpiar sesiones expiradas cada hora
setInterval(async () => {
  try {
    await prisma.sesion.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  } catch (error) {
    console.error("Error al limpiar sesiones:", error);
  }
}, 60 * 60 * 1000);

// Manejar cierre graceful
process.on("SIGINT", () => {
  console.log("\n👋 Cerrando worker...");
  workerClient.desconectar();
  process.exit(0);
});

iniciar();

export { app, workerClient };
