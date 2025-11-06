import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { authService } from "./auth/authService";
import { sessionManager } from "./auth/sessionManager";
import { SocketManager } from "./sockets/socketManager";
import { logger } from "./utils/logger";
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
} from "./utils/validations";
import { PrismaClient } from "@prisma/client";

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;
const prisma = new PrismaClient();

// ============== INICIALIZAR SOCKET.IO ==============
const socketManager = new SocketManager(httpServer);

// ============== RATE LIMITERS ==============

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos
  message: "Demasiados intentos de login. Intenta de nuevo en 15 minutos.",
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 registros por hora
  message: "Demasiados registros. Intenta de nuevo más tarde.",
});

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requests por minuto
});

// Middleware
app.use(cors()); // Habilitar CORS para todos los orígenes
app.use(express.json());
app.use(generalLimiter);

// Middleware para verificar JWT
interface AuthRequest extends Request {
  usuario?: any;
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
    logger.error("Error en verificación de auth", error);
    res.status(401).json({ error: "Error de autenticación" });
  }
}

// ============== RUTAS DE AUTENTICACIÓN ==============

// POST /api/auth/register - Registrar nuevo usuario
app.post(
  "/api/auth/register",
  registerLimiter,
  async (req: Request, res: Response) => {
    try {
      // Validar con Zod
      const validatedData = registerSchema.parse(req.body);

      const resultado = await authService.registrarUsuario(validatedData);

      logger.info(`Usuario registrado: ${resultado.email}`);

      res.status(201).json({
        mensaje: resultado.mensaje,
        usuario: {
          id: resultado.usuarioId,
          nombre: resultado.nombre,
          email: resultado.email,
        },
        cuenta: {
          numeroCuenta: resultado.numeroCuenta,
          saldo: 0,
        },
      });
    } catch (error: any) {
      logger.error("Error en registro", error);

      // Error de validación de Zod
      if (error.name === "ZodError") {
        return res.status(400).json({
          error: "Datos inválidos",
          detalles: error.errors,
        });
      }

      if (error.message.includes("ya existe")) {
        return res.status(409).json({ error: error.message });
      }

      res.status(500).json({ error: "Error al registrar usuario" });
    }
  }
);

// POST /api/auth/login - Iniciar sesión
app.post(
  "/api/auth/login",
  loginLimiter,
  async (req: Request, res: Response) => {
    try {
      // Validar con Zod
      const validatedData = loginSchema.parse(req.body);

      // Obtener información del dispositivo
      const deviceInfo = req.headers["user-agent"];
      const ipAddress = req.ip || req.socket.remoteAddress;

      const resultado = await authService.login(
        validatedData,
        deviceInfo,
        ipAddress
      );

      // Si había una sesión anterior activa, expulsarla
      if (resultado.socketIdAnterior) {
        await socketManager.kickPreviousSession(
          resultado.socketIdAnterior,
          "Sesión iniciada en otro dispositivo"
        );
      }

      logger.info(`Login exitoso: ${validatedData.email}`);

      res.json({
        mensaje: "Login exitoso",
        token: resultado.token,
        usuario: {
          id: resultado.usuario.id,
          nombre: resultado.usuario.nombre,
          email: resultado.usuario.email,
        },
        cuentas: resultado.cuentas.map((c) => ({
          numeroCuenta: c.numeroCuenta,
          saldo: c.saldo,
        })),
      });
    } catch (error: any) {
      logger.error("Error en login", error);

      // Error de validación de Zod
      if (error.name === "ZodError") {
        return res.status(400).json({
          error: "Datos inválidos",
          detalles: error.errors,
        });
      }

      if (error.message.includes("credenciales")) {
        return res.status(401).json({ error: error.message });
      }

      res.status(500).json({ error: "Error al iniciar sesión" });
    }
  }
);

// POST /api/auth/logout - Cerrar sesión
app.post(
  "/api/auth/logout",
  verificarAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const usuarioId = req.usuario.id;
      const jti = req.jti;

      await authService.logout(usuarioId, jti);

      res.json({ mensaje: "Sesión cerrada exitosamente" });
    } catch (error) {
      console.error("Error en logout:", error);
      res.status(500).json({ error: "Error al cerrar sesión" });
    }
  }
);

// GET /api/auth/me - Obtener información del usuario autenticado
app.get(
  "/api/auth/me",
  verificarAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const usuario = req.usuario;

      // Obtener cuentas del usuario
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();

      const cuentas = await prisma.cuentaBancaria.findMany({
        where: { usuarioId: usuario.id },
      });

      await prisma.$disconnect();

      res.json({
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
        },
        cuentas: cuentas.map((c) => ({
          numeroCuenta: c.numeroCuenta,
          titularCuenta: c.titularCuenta,
          saldo: c.saldo,
          estado: c.estado,
          fechaCreacion: c.createdAt,
        })),
      });
    } catch (error) {
      console.error("Error al obtener perfil:", error);
      res
        .status(500)
        .json({ error: "Error al obtener información del usuario" });
    }
  }
);

// POST /api/auth/change-password - Cambiar contraseña
app.post(
  "/api/auth/change-password",
  verificarAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      // Validar con Zod
      const validatedData = changePasswordSchema.parse(req.body);
      const usuarioId = req.usuario.id;

      await authService.cambiarPassword(
        usuarioId,
        validatedData.passwordActual,
        validatedData.passwordNueva
      );

      logger.info(`Password cambiado para usuario: ${req.usuario.email}`);

      res.json({
        mensaje:
          "Contraseña actualizada exitosamente. Por favor, inicie sesión nuevamente.",
      });
    } catch (error: any) {
      logger.error("Error al cambiar password", error);

      // Error de validación de Zod
      if (error.name === "ZodError") {
        return res.status(400).json({
          error: "Datos inválidos",
          detalles: error.errors,
        });
      }

      if (
        error.message.includes("incorrecta") ||
        error.message.includes("mínimo")
      ) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: "Error al cambiar contraseña" });
    }
  }
);

// GET /api/health - Verificar estado del servidor y BD
app.get("/api/health", async (req: Request, res: Response) => {
  try {
    // Verificar conexión a BD
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: "ok",
      database: "connected",
      mensaje: "Servidor bancario funcionando",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Health check failed", error);
    res.status(503).json({
      status: "error",
      database: "disconnected",
      mensaje: "Error en el servidor",
      timestamp: new Date().toISOString(),
    });
  }
});

// Iniciar servidor HTTP (con Socket.IO)
httpServer.listen(PORT, () => {
  logger.info(`🏦 Servidor bancario iniciado en puerto ${PORT}`);
  logger.info(`🔌 WebSocket habilitado en ws://localhost:${PORT}`);
  logger.info(`📍 Endpoints disponibles:`);
  logger.info(`   POST /api/auth/register - Registrar usuario`);
  logger.info(`   POST /api/auth/login - Iniciar sesión`);
  logger.info(`   POST /api/auth/logout - Cerrar sesión`);
  logger.info(`   GET  /api/auth/me - Perfil del usuario`);
  logger.info(`   POST /api/auth/change-password - Cambiar contraseña`);
  logger.info(`   GET  /api/health - Estado del servidor`);
});

// Limpiar sesiones expiradas cada hora
setInterval(async () => {
  try {
    await sessionManager.cleanExpiredSessions();
  } catch (error) {
    logger.error("Error al limpiar sesiones:", error);
  }
}, 60 * 60 * 1000);

// Exportar para tests
export { app, httpServer, socketManager };
