import express from "express";
import type { Request, Response, NextFunction } from "express";
import { authService } from "./auth/authService";
import { WorkerClient } from "./services/workerClient";
import { BancoService } from "./services/bancoService";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const app = express();
const prisma = new PrismaClient();

// Configuración desde variables de entorno
const PORT = parseInt(process.env.PORT || "3001");
const WORKER_ID = process.env.WORKER_ID || `worker-${PORT}`;
const COORDINADOR_URL = process.env.COORDINADOR_URL || "http://localhost:4000";

// Inicializar cliente del coordinador
const workerClient = new WorkerClient(WORKER_ID, PORT, COORDINADOR_URL);

// Inicializar servicio bancario
const bancoService = new BancoService(workerClient);

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
          cuentas: {
            select: {
              id: true,
              numeroCuenta: true,
              saldo: true,
              estado: true,
            },
          },
        },
      });

      res.json({
        usuario: {
          id: usuario!.id,
          nombre: usuario!.nombre,
          email: usuario!.email,
        },
        cuentas: usuario!.cuentas,
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
  cuentaDestinoId: z.string().uuid(),
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
      const data = transferenciaSchema.parse(req.body);
      const resultado = await bancoService.transferir(
        data.cuentaOrigenId,
        data.cuentaDestinoId,
        data.monto,
        req.usuario!.id
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
      const resultado = await bancoService.depositar(
        data.cuentaId,
        data.monto,
        req.usuario!.id
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
      const resultado = await bancoService.retirar(
        data.cuentaId,
        data.monto,
        req.usuario!.id
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

// ============== SALUD DEL SERVIDOR ==============

app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    workerId: WORKER_ID,
    puerto: PORT,
    coordinador: {
      url: COORDINADOR_URL,
      conectado: workerClient.estaConectado(),
    },
    timestamp: new Date().toISOString(),
  });
});

// Iniciar servidor
async function iniciar() {
  try {
    // Conectar al coordinador
    console.log(`🔌 Intentando conectar al coordinador...`);
    await workerClient.conectar();
    console.log(`✅ Conectado al coordinador central`);
  } catch (error) {
    console.log(
      `⚠️ No se pudo conectar al coordinador, continuando sin locks distribuidos`
    );
  }

  app.listen(PORT, () => {
    console.log(`\n🏦 Worker ${WORKER_ID} iniciado`);
    console.log(`📍 Puerto: ${PORT}`);
    console.log(`🔌 Coordinador: ${COORDINADOR_URL}`);
    console.log(
      `🔐 Locks distribuidos: ${
        workerClient.estaConectado() ? "✅ ACTIVO" : "❌ DESACTIVADO"
      }`
    );
    console.log(`\n📋 Endpoints de Autenticación:`);
    console.log(`   POST /api/auth/register - Registrar usuario`);
    console.log(`   POST /api/auth/login - Iniciar sesión`);
    console.log(`   POST /api/auth/logout - Cerrar sesión`);
    console.log(`   GET  /api/auth/me - Perfil del usuario`);
    console.log(`\n💰 Endpoints Bancarios (con locks distribuidos):`);
    console.log(`   POST /api/banco/transferir - Transferencia entre cuentas`);
    console.log(`   POST /api/banco/depositar - Depósito en cuenta`);
    console.log(`   POST /api/banco/retirar - Retiro de cuenta`);
    console.log(`   GET  /api/banco/saldo/:cuentaId - Consultar saldo`);
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
