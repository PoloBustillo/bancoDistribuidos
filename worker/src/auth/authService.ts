// ========================================
// 🎓 AUTH SERVICE - Servicio de Autenticación
// ========================================
// Este servicio implementa autenticación con
// sesiones distribuidas sincronizadas vía base de datos.
//
// Conceptos de Sistemas Distribuidos aplicados:
// - Estado compartido: Sesiones en base de datos PostgreSQL
// - Sincronización: Invalidación de sesiones entre workers
// - Consistencia: Un usuario = Una sesión activa (configurable)
// - Seguridad distribuida: JWT + validación en BD
// ========================================

import prisma from "../prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
const JWT_SECRET =
  process.env.JWT_SECRET || "B4nc0S3cr3_2024_D1str1but3d_JWT_S3cr3t";
const JWT_EXPIRATION = "24h";

// ========================================
// 🎓 CONFIGURACIÓN DE SESIÓN ÚNICA
// ========================================
// SINGLE_SESSION controla si un usuario puede tener
// múltiples sesiones activas simultáneamente.
//
// true  → Solo 1 sesión activa (más seguro, demuestra sincronización)
// false → Múltiples sesiones permitidas (ej: móvil + web)
//
// Con SINGLE_SESSION=true, al hacer login en un worker,
// se invalidan las sesiones previas en TODOS los workers
// (gracias a la base de datos compartida).
// ========================================
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

    // ========================================
    // 🎓 CREACIÓN DE USUARIO, CUENTA Y TARJETA
    // ========================================
    // Transacción atómica que crea:
    // 1. Usuario
    // 2. Cuenta bancaria (recurso compartible)
    // 3. Relación Usuario-Cuenta (UsuarioCuenta)
    // 4. Tarjeta individual del usuario
    // ========================================
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Crear usuario
      const nuevoUsuario = await tx.usuario.create({
        data: { nombre, email, passwordHash },
      });

      // 2. Generar número de cuenta único
      const numeroCuenta = `${Math.floor(
        1000 + Math.random() * 9000
      )}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

      // 3. Crear cuenta bancaria (puede ser compartida en el futuro)
      const cuenta = await tx.cuentaBancaria.create({
        data: {
          numeroCuenta,
          nombre: `Cuenta de ${nombre}`,
          tipoCuenta: "CHEQUES",
          saldo: 0,
        },
      });

      // 🎓 4. Crear relación Usuario-Cuenta (MUCHOS-A-MUCHOS)
      // El usuario es el TITULAR de esta cuenta
      await tx.usuarioCuenta.create({
        data: {
          usuarioId: nuevoUsuario.id,
          cuentaId: cuenta.id,
          rol: "TITULAR",
        },
      });

      // 🎓 5. Crear tarjeta individual para el usuario
      // La tarjeta es INDIVIDUAL - solo este usuario puede usarla
      const numeroTarjeta = `${Math.floor(
        1000 + Math.random() * 9000
      )}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(
        1000 + Math.random() * 9000
      )}-${Math.floor(1000 + Math.random() * 9000)}`;

      const cvv = `${Math.floor(100 + Math.random() * 900)}`;

      const fechaExpiracion = new Date();
      fechaExpiracion.setFullYear(fechaExpiracion.getFullYear() + 3); // Expira en 3 años

      const tarjeta = await tx.tarjeta.create({
        data: {
          numeroTarjeta,
          cvv,
          fechaExpiracion,
          usuarioId: nuevoUsuario.id,
          cuentaId: cuenta.id,
          tipoTarjeta: "DEBITO",
        },
      });

      return { usuario: nuevoUsuario, cuenta, tarjeta };
    });

    // ========================================
    // 🎓 CREAR TOKEN JWT Y SESIÓN
    // ========================================
    // Después del registro, creamos automáticamente
    // una sesión para el nuevo usuario
    // ========================================
    const jti = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.sesion.create({
      data: {
        jti,
        usuarioId: resultado.usuario.id,
        expiresAt,
      },
    });

    const token = jwt.sign(
      {
        usuarioId: resultado.usuario.id,
        email: resultado.usuario.email,
        jti,
      } as TokenPayload,
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    return {
      token,
      usuarioId: resultado.usuario.id,
      nombre: resultado.usuario.nombre,
      email: resultado.usuario.email,
      numeroCuenta: resultado.cuenta.numeroCuenta,
      cuentaId: resultado.cuenta.id,
      tarjeta: {
        numeroTarjeta: resultado.tarjeta.numeroTarjeta,
        tipo: resultado.tarjeta.tipoTarjeta,
        expiracion: resultado.tarjeta.fechaExpiracion,
      },
    };
  }

  async login(email: string, password: string) {
    // ========================================
    // 🎓 CARGAR USUARIO CON CUENTAS Y TARJETAS
    // ========================================
    // Incluye:
    // - Cuentas compartidas (relación muchos-a-muchos)
    // - Tarjetas individuales del usuario
    // ========================================
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: {
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
        tarjetas: {
          where: { estado: "ACTIVA" }, // Solo tarjetas activas
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

    if (!usuario) {
      throw new Error("Credenciales inválidas");
    }

    const passwordValida = await bcrypt.compare(password, usuario.passwordHash);

    if (!passwordValida) {
      throw new Error("Credenciales inválidas");
    }

    // ========================================
    // 🎓 INVALIDACIÓN DE SESIONES DISTRIBUIDAS
    // ========================================
    // Si SINGLE_SESSION=true, se eliminan TODAS las sesiones
    // previas del usuario en la base de datos compartida.
    //
    // Esto garantiza que:
    // 1. Solo hay una sesión activa por usuario
    // 2. La invalidación funciona entre TODOS los workers
    // 3. Demuestra sincronización distribuida vía BD
    //
    // Conceptos aplicados:
    // - Consistencia distribuida
    // - Estado compartido (sesiones en PostgreSQL)
    // - Sincronización entre nodos (workers)
    // ========================================
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

    // ========================================
    // 🎓 CREACIÓN DE NUEVA SESIÓN
    // ========================================
    // Se crea una nueva sesión en la base de datos compartida.
    // Si SINGLE_SESSION=true, esta es la ÚNICA sesión válida.
    // Todos los workers pueden validar esta sesión consultando la BD.
    // ========================================
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

    // ========================================
    // 🎓 MAPEAR CUENTAS COMPARTIDAS
    // ========================================
    // Transforma la relación muchos-a-muchos en formato simple
    // Incluye información del rol del usuario en cada cuenta
    // ========================================
    const cuentas = usuario.usuarioCuentas.map((uc) => ({
      id: uc.cuenta.id,
      numeroCuenta: uc.cuenta.numeroCuenta,
      nombre: uc.cuenta.nombre,
      tipoCuenta: uc.cuenta.tipoCuenta,
      saldo: uc.cuenta.saldo,
      estado: uc.cuenta.estado,
      rol: uc.rol, // 🎓 ROL del usuario en esta cuenta (TITULAR, AUTORIZADO, etc.)
    }));

    return {
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
      },
      cuentas, // 🎓 Cuentas donde el usuario tiene acceso (pueden ser compartidas)
      tarjetas: usuario.tarjetas, // 🎓 Tarjetas individuales del usuario
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
