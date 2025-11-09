import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import { authService } from "./auth/authService";
import { WorkerClient } from "./services/workerClient";
import { BancoService } from "./services/bancoService";
import { CuentasCompartidasService } from "./services/cuentasCompartidasService";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const app = express();
const prisma = new PrismaClient();

// Configuración desde variables de entorno
let PORT = parseInt(process.env.PORT || "0"); // 0 = puerto automático
const COORDINADOR_URL = process.env.COORDINADOR_URL || "http://localhost:4000";

// Variables que se establecerán después de obtener el puerto real
let ACTUAL_PORT = PORT;
let WORKER_ID = "";
let workerClient: WorkerClient;

// Inicializar servicios
const bancoService = new BancoService(null as any);
const cuentasCompartidasService = new CuentasCompartidasService();

// ========================================
// 🌐 CONFIGURACIÓN CORS
// ========================================
// Permitir peticiones desde el frontend (Next.js)
app.use(
  cors({
    origin: [
      "http://localhost:3000", // Next.js dev
      "http://localhost:3001", // Worker 1
      "http://localhost:3002", // Worker 2
      "http://localhost:3003", // Worker 3
    ],
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
          // 🎓 Cargar tarjetas individuales
          tarjetas: {
            where: { estado: "ACTIVA" },
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
  // Primero iniciar el servidor para obtener el puerto real
  const server = app.listen(PORT, async () => {
    // Obtener el puerto real asignado
    const address = server.address();
    ACTUAL_PORT =
      typeof address === "object" && address !== null ? address.port : PORT;

    // Ahora sí crear WORKER_ID y workerClient con el puerto real
    WORKER_ID = process.env.WORKER_ID || `worker-${ACTUAL_PORT}`;
    workerClient = new WorkerClient(WORKER_ID, ACTUAL_PORT, COORDINADOR_URL);

    // Actualizar el workerClient en bancoService
    (bancoService as any).workerClient = workerClient;

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
