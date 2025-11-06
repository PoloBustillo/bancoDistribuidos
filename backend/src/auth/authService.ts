import { PrismaClient, EstadoCuenta } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();
const JWT_SECRET =
  process.env.JWT_SECRET || "tu-secreto-super-seguro-cambialo-en-produccion";
const JWT_EXPIRATION = "24h";

interface TokenPayload {
  usuarioId: string;
  email: string;
  jti: string;
}

interface RegistroData {
  nombre: string;
  email: string;
  password: string;
}

interface LoginData {
  email: string;
  password: string;
}

export class AuthService {
  /**
   * Registrar un nuevo usuario en el sistema bancario
   */
  async registrarUsuario(data: RegistroData) {
    const { nombre, email, password } = data;

    // Validar que el email no exista
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email },
    });

    if (usuarioExistente) {
      throw new Error("El email ya está registrado");
    }

    // Validar fortaleza de contraseña (mínimo 8 caracteres)
    if (password.length < 8) {
      throw new Error("La contraseña debe tener al menos 8 caracteres");
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear usuario y cuenta bancaria asociada en una transacción
    const resultado = await prisma.$transaction(async (tx) => {
      // Crear usuario
      const nuevoUsuario = await tx.usuario.create({
        data: {
          nombre,
          email,
          passwordHash,
        },
      });

      // Generar número de cuenta único (formato: XXXX-XXXX-XXXX)
      const numeroCuenta = `${Math.floor(
        1000 + Math.random() * 9000
      )}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

      // Crear cuenta bancaria inicial
      const cuenta = await tx.cuentaBancaria.create({
        data: {
          numeroCuenta,
          titularCuenta: nombre,
          saldo: 0, // Cuenta inicia en $0
          estado: EstadoCuenta.ACTIVA,
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
      mensaje: "Usuario registrado exitosamente. Cuenta bancaria creada.",
    };
  }

  /**
   * Iniciar sesión y generar token JWT
   */
  async login(data: LoginData) {
    const { email, password } = data;

    // Buscar usuario por email
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

    // Verificar contraseña
    const passwordValida = await bcrypt.compare(password, usuario.passwordHash);

    if (!passwordValida) {
      throw new Error("Credenciales inválidas");
    }

    // Generar JTI (JWT ID) único para esta sesión
    const jti = uuidv4();

    // Crear sesión en BD (expira en 24 horas)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.sesion.create({
      data: {
        jti,
        usuarioId: usuario.id,
        expiresAt,
      },
    });

    // Generar token JWT
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
      mensaje: "Login exitoso",
    };
  }

  /**
   * Cerrar sesión (invalidar token)
   */
  async logout(usuarioId: string, jti?: string) {
    // Si se proporciona JTI, eliminar solo esa sesión
    if (jti) {
      await prisma.sesion.deleteMany({
        where: {
          usuarioId,
          jti,
        },
      });
    } else {
      // Si no, eliminar todas las sesiones del usuario
      await prisma.sesion.deleteMany({
        where: { usuarioId },
      });
    }

    return { mensaje: "Sesión cerrada exitosamente" };
  }

  /**
   * Verificar y validar token JWT
   */
  async verificarToken(token: string) {
    try {
      // Decodificar token
      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;

      // Verificar que la sesión existe y no ha expirado
      const sesion = await prisma.sesion.findUnique({
        where: { jti: decoded.jti },
        include: {
          usuario: {
            select: {
              id: true,
              nombre: true,
              email: true,
            },
          },
        },
      });

      if (!sesion) {
        throw new Error("Sesión inválida o expirada");
      }

      // Verificar que no ha expirado
      if (sesion.expiresAt < new Date()) {
        // Eliminar sesión expirada
        await prisma.sesion.delete({
          where: { jti: decoded.jti },
        });
        throw new Error("Sesión expirada");
      }

      return {
        valido: true,
        usuario: sesion.usuario,
        jti: decoded.jti,
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("Token inválido");
      }
      throw error;
    }
  }

  /**
   * Cambiar contraseña
   */
  async cambiarPassword(
    usuarioId: string,
    passwordActual: string,
    passwordNueva: string
  ) {
    // Validar fortaleza de nueva contraseña
    if (passwordNueva.length < 8) {
      throw new Error("La nueva contraseña debe tener al menos 8 caracteres");
    }

    // Obtener usuario
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
    });

    if (!usuario) {
      throw new Error("Usuario no encontrado");
    }

    // Verificar contraseña actual
    const passwordValida = await bcrypt.compare(
      passwordActual,
      usuario.passwordHash
    );

    if (!passwordValida) {
      throw new Error("Contraseña actual incorrecta");
    }

    // Hash de la nueva contraseña
    const nuevoPasswordHash = await bcrypt.hash(passwordNueva, 10);

    // Actualizar contraseña
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { passwordHash: nuevoPasswordHash },
    });

    // Invalidar todas las sesiones existentes (por seguridad)
    await prisma.sesion.deleteMany({
      where: { usuarioId },
    });

    return {
      mensaje:
        "Contraseña actualizada exitosamente. Por favor inicia sesión nuevamente.",
    };
  }

  /**
   * Limpiar sesiones expiradas (tarea de mantenimiento)
   */
  async limpiarSesionesExpiradas() {
    const resultado = await prisma.sesion.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return { sesionesEliminadas: resultado.count };
  }
}

export const authService = new AuthService();
