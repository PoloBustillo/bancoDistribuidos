import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();
const JWT_SECRET =
  process.env.JWT_SECRET || "B4nc0S3cur3_2024_D1str1but3d_JWT_S3cr3t";
const JWT_EXPIRATION = "24h";

// 🔐 Configuración de sesiones
// SINGLE_SESSION: true = Solo 1 sesión activa por usuario (más seguro)
// SINGLE_SESSION: false = Múltiples sesiones permitidas (ej: móvil + web)
const SINGLE_SESSION = process.env.SINGLE_SESSION !== "false"; // Por defecto: true

interface TokenPayload {
  usuarioId: string;
  email: string;
  jti: string;
}

export class AuthService {
  async registrarUsuario(nombre: string, email: string, password: string) {
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email },
    });

    if (usuarioExistente) {
      throw new Error("El email ya está registrado");
    }

    if (password.length < 8) {
      throw new Error("La contraseña debe tener al menos 8 caracteres");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const resultado = await prisma.$transaction(async (tx) => {
      const nuevoUsuario = await tx.usuario.create({
        data: { nombre, email, passwordHash },
      });

      const numeroCuenta = `${Math.floor(
        1000 + Math.random() * 9000
      )}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

      const cuenta = await tx.cuentaBancaria.create({
        data: {
          numeroCuenta,
          titularCuenta: nombre,
          saldo: 0,
          usuarioId: nuevoUsuario.id,
        },
      });

      return { usuario: nuevoUsuario, cuenta };
    });

    return {
      usuarioId: resultado.usuario.id,
      nombre: resultado.usuario.nombre,
      email: resultado.usuario.email,
      numeroCuenta: resultado.cuenta.numeroCuenta,
    };
  }

  async login(email: string, password: string) {
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: {
        cuentas: {
          select: {
            id: true,
            numeroCuenta: true,
            saldo: true,
          },
        },
      },
    });

    if (!usuario) {
      throw new Error("Credenciales inválidas");
    }

    const passwordValida = await bcrypt.compare(password, usuario.passwordHash);

    if (!passwordValida) {
      throw new Error("Credenciales inválidas");
    }

    // 🔐 INVALIDAR SESIONES ANTERIORES (si está configurado)
    // Esto asegura que si el usuario hace login en otro worker,
    // sus sesiones anteriores se invalidan automáticamente
    if (SINGLE_SESSION) {
      const sesionesPrevias = await prisma.sesion.count({
        where: { usuarioId: usuario.id },
      });

      if (sesionesPrevias > 0) {
        await prisma.sesion.deleteMany({
          where: { usuarioId: usuario.id },
        });
        console.log(
          `🔒 Sesiones previas invalidadas para usuario ${usuario.email} (${sesionesPrevias})`
        );
      }
    }

    const jti = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Crear nueva sesión (única válida si SINGLE_SESSION=true)
    await prisma.sesion.create({
      data: {
        usuarioId: usuario.id,
        jti,
        expiresAt,
      },
    });

    const token = jwt.sign(
      {
        usuarioId: usuario.id,
        email: usuario.email,
        jti,
      } as TokenPayload,
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    return {
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
      },
      cuentas: usuario.cuentas,
    };
  }

  async logout(usuarioId: string, jti?: string) {
    if (jti) {
      await prisma.sesion.deleteMany({
        where: { usuarioId, jti },
      });
    } else {
      await prisma.sesion.deleteMany({
        where: { usuarioId },
      });
    }
  }

  async verificarToken(token: string) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;

      const sesion = await prisma.sesion.findUnique({
        where: { jti: decoded.jti },
        include: { usuario: true },
      });

      if (!sesion || sesion.expiresAt < new Date()) {
        return { valido: false };
      }

      return {
        valido: true,
        usuario: sesion.usuario,
        jti: decoded.jti,
      };
    } catch (error) {
      return { valido: false };
    }
  }
}

export const authService = new AuthService();
