// ========================================
// 🎓 SERVICIO: Asesores Bancarios
// ========================================
// Este servicio maneja:
// 1. Generación de códigos de verificación (cliente)
// 2. Verificación de cliente por asesor (últimos dígitos + código)
// 3. Operaciones de solo lectura de asesores
// 4. Auditoría completa de acciones
//
// CONCEPTOS:
// - Sesiones independientes (asesores no invalidan sesiones de clientes)
// - Scope limitado (solo lectura)
// - TTL corto (10-30 min)
// - Auditoría completa
// ========================================

import prisma from "../prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

const JWT_SECRET =
  process.env.JWT_SECRET || "B4nc0S3cr3_2024_D1str1but3d_JWT_S3cr3t";
const VERIFICATION_CODE_TTL = 10 * 60 * 1000; // 10 minutos
const ADVISOR_SESSION_TTL = 30 * 60 * 1000; // 30 minutos

interface AdvisorTokenPayload {
  sub: string; // asesorId
  role: "ASESOR";
  impersonatedUser: string; // usuarioId del cliente
  scope: string[]; // ["advisor:view", "advisor:ticket"]
  jti: string;
  exp: number;
  iat: number;
}

export class AdvisorService {
  // ========================================
  // CLIENTE: Generar código de verificación
  // ========================================
  // El cliente genera un código de 6 dígitos en su app
  // para proporcionárselo verbalmente al asesor.
  // ========================================
  async generarCodigoVerificacion(usuarioId: string): Promise<{
    codigo: string;
    expiresAt: Date;
    expiresIn: number;
  }> {
    // Generar código de 6 dígitos
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash del código (nunca guardar en texto plano)
    const codeHash = await bcrypt.hash(codigo, 10);

    // Calcular fecha de expiración
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL);
    const expiresIn = Math.floor(VERIFICATION_CODE_TTL / 1000); // Convertir a segundos

    // Expirar códigos anteriores del usuario
    await prisma.verificationCode.updateMany({
      where: {
        usuarioId,
        usado: false,
        expiresAt: { gt: new Date() },
      },
      data: { usado: true },
    });

    // Crear nuevo código
    await prisma.verificationCode.create({
      data: {
        usuarioId,
        codeHash,
        expiresAt,
      },
    });

    return { codigo, expiresAt, expiresIn };
  }

  // ========================================
  // ASESOR: Verificar cliente y obtener sesión
  // ========================================
  // El asesor proporciona:
  // - ID del asesor (pre-autenticado)
  // - Número de cuenta o tarjeta
  // - Últimos 4 dígitos
  // - Código de verificación que el cliente le dio
  // ========================================
  async verificarCliente(
    asesorId: string,
    numeroRecurso: string, // últimos 4 dígitos de cuenta o tarjeta
    ultimosDigitos: string, // mismo valor (redundante pero mantiene compatibilidad)
    codigo: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ token: string; usuario: any }> {
    // 1. Validar que el asesor existe y está activo
    const asesor = await prisma.asesor.findUnique({
      where: { id: asesorId },
    });

    if (!asesor || !asesor.activo) {
      throw new Error("Asesor no encontrado o inactivo");
    }

    // 2. Buscar el recurso (cuenta o tarjeta) por ÚLTIMOS 4 DÍGITOS
    let usuarioId: string | null = null;
    let recursoEncontrado: any = null;

    // Normalizar: si numeroRecurso es solo 4 dígitos, buscar por terminación
    // Si es más largo, buscar exacto (compatibilidad con versión anterior)
    const buscarPorUltimosDigitos = numeroRecurso.length === 4;

    if (buscarPorUltimosDigitos) {
      // 🎯 BUSCAR POR ÚLTIMOS 4 DÍGITOS (nuevo flujo amigable)

      // Intentar buscar cuenta que termine en estos dígitos
      const cuentas = await prisma.cuentaBancaria.findMany({
        where: {
          numeroCuenta: {
            endsWith: ultimosDigitos,
          },
        },
        include: { usuarioCuentas: { include: { usuario: true } } },
      });

      if (cuentas.length > 0) {
        // Si hay múltiples cuentas con los mismos últimos 4 dígitos,
        // tomar la primera (ambigüedad resuelta por el código de verificación)
        recursoEncontrado = cuentas[0];
        const titular = cuentas[0].usuarioCuentas.find(
          (uc) => uc.rol === "TITULAR"
        );
        usuarioId =
          titular?.usuarioId || cuentas[0].usuarioCuentas[0]?.usuarioId;
      }

      // Si no se encontró cuenta, intentar con tarjeta
      if (!usuarioId) {
        const tarjetas = await prisma.tarjeta.findMany({
          where: {
            numeroTarjeta: {
              endsWith: ultimosDigitos,
            },
          },
          include: { usuario: true },
        });

        if (tarjetas.length > 0) {
          recursoEncontrado = tarjetas[0];
          usuarioId = tarjetas[0].usuarioId;
        }
      }
    } else {
      // 📋 BUSCAR POR NÚMERO COMPLETO (flujo anterior, compatibilidad)

      // Intentar buscar por cuenta
      const cuenta = await prisma.cuentaBancaria.findFirst({
        where: { numeroCuenta: numeroRecurso },
        include: { usuarioCuentas: { include: { usuario: true } } },
      });

      if (cuenta) {
        recursoEncontrado = cuenta;
        const titular = cuenta.usuarioCuentas.find(
          (uc) => uc.rol === "TITULAR"
        );
        usuarioId = titular?.usuarioId || cuenta.usuarioCuentas[0]?.usuarioId;
      }

      // Si no se encontró cuenta, intentar con tarjeta
      if (!usuarioId) {
        const tarjeta = await prisma.tarjeta.findFirst({
          where: { numeroTarjeta: numeroRecurso },
          include: { usuario: true },
        });

        if (tarjeta) {
          recursoEncontrado = tarjeta;
          usuarioId = tarjeta.usuarioId;
        }
      }
    }

    if (!usuarioId || !recursoEncontrado) {
      // Registrar intento fallido
      await this.registrarAuditoria(
        asesorId,
        null,
        "VERIFY_CLIENT_FAILED",
        null,
        { razon: "Recurso no encontrado", ultimosDigitos },
        ip,
        userAgent
      );
      throw new Error(
        "No se encontró cuenta o tarjeta con esos últimos 4 dígitos"
      );
    }

    // 3. Validar últimos dígitos (doble verificación de seguridad)
    const numeroCompleto =
      "numeroCuenta" in recursoEncontrado
        ? recursoEncontrado.numeroCuenta
        : recursoEncontrado.numeroTarjeta;

    const ultimosDigitosReales = numeroCompleto.slice(-4);

    if (ultimosDigitos !== ultimosDigitosReales) {
      await this.registrarAuditoria(
        asesorId,
        usuarioId,
        "VERIFY_CLIENT_FAILED",
        null,
        { razon: "Últimos dígitos incorrectos" },
        ip,
        userAgent
      );
      throw new Error("Últimos dígitos incorrectos");
    }

    // 4. Validar código de verificación
    const codigosValidos = await prisma.verificationCode.findMany({
      where: {
        usuarioId,
        usado: false,
        expiresAt: { gt: new Date() },
      },
    });

    let codigoValido = false;
    let codigoId: string | null = null;

    for (const vc of codigosValidos) {
      const match = await bcrypt.compare(codigo, vc.codeHash);
      if (match) {
        codigoValido = true;
        codigoId = vc.id;
        break;
      }
    }

    if (!codigoValido) {
      await this.registrarAuditoria(
        asesorId,
        usuarioId,
        "VERIFY_CLIENT_FAILED",
        null,
        { razon: "Código de verificación inválido o expirado" },
        ip,
        userAgent
      );
      throw new Error("Código de verificación inválido o expirado");
    }

    // 5. Marcar código como usado
    if (codigoId) {
      await prisma.verificationCode.update({
        where: { id: codigoId },
        data: { usado: true },
      });
    }

    // 6. Crear sesión de asesor
    const jti = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = new Date(Date.now() + ADVISOR_SESSION_TTL);

    await prisma.asesorSesion.create({
      data: {
        asesorId,
        jti,
        impersonatedUsuarioId: usuarioId,
        scope: "advisor:view,advisor:ticket",
        expiresAt,
        ip,
        userAgent,
      },
    });

    // 7. Generar JWT
    const payload: AdvisorTokenPayload = {
      sub: asesorId,
      role: "ASESOR",
      impersonatedUser: usuarioId,
      scope: ["advisor:view", "advisor:ticket"],
      jti,
      iat: now,
      exp: now + ADVISOR_SESSION_TTL / 1000,
    };

    const token = jwt.sign(payload, JWT_SECRET);

    // 8. Registrar auditoría exitosa
    await this.registrarAuditoria(
      asesorId,
      usuarioId,
      "VERIFY_CLIENT_SUCCESS",
      null,
      { numeroRecurso },
      ip,
      userAgent
    );

    // 9. Obtener datos del usuario
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nombre: true,
        email: true,
        createdAt: true,
      },
    });

    return { token, usuario };
  }

  // ========================================
  // ASESOR: Validar token y obtener sesión
  // ========================================
  async validarToken(token: string): Promise<AdvisorTokenPayload> {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as AdvisorTokenPayload;

      // Verificar que la sesión sigue activa
      const sesion = await prisma.asesorSesion.findUnique({
        where: { jti: payload.jti },
      });

      if (!sesion || !sesion.activo || sesion.expiresAt < new Date()) {
        throw new Error("Sesión de asesor inválida o expirada");
      }

      return payload;
    } catch (error) {
      throw new Error("Token de asesor inválido");
    }
  }

  // ========================================
  // ASESOR: Revocar sesión
  // ========================================
  async revocarSesion(jti: string): Promise<void> {
    await prisma.asesorSesion.update({
      where: { jti },
      data: { activo: false },
    });
  }

  // ========================================
  // OPERACIONES DE SOLO LECTURA
  // ========================================

  async obtenerSaldoCuenta(
    asesorId: string,
    usuarioId: string,
    cuentaId: string,
    ip?: string,
    userAgent?: string
  ) {
    // Verificar que el usuario tiene acceso a la cuenta
    const usuarioCuenta = await prisma.usuarioCuenta.findUnique({
      where: {
        usuarioId_cuentaId: { usuarioId, cuentaId },
      },
      include: { cuenta: true },
    });

    if (!usuarioCuenta) {
      throw new Error("Usuario no tiene acceso a esta cuenta");
    }

    // Registrar auditoría
    await this.registrarAuditoria(
      asesorId,
      usuarioId,
      "VIEW_BALANCE",
      cuentaId,
      { saldo: usuarioCuenta.cuenta.saldo },
      ip,
      userAgent
    );

    return {
      cuentaId: usuarioCuenta.cuenta.id,
      numeroCuenta: usuarioCuenta.cuenta.numeroCuenta,
      nombre: usuarioCuenta.cuenta.nombre,
      saldo: usuarioCuenta.cuenta.saldo,
      tipoCuenta: usuarioCuenta.cuenta.tipoCuenta,
      estado: usuarioCuenta.cuenta.estado,
    };
  }

  async obtenerCuentasUsuario(
    asesorId: string,
    usuarioId: string,
    ip?: string,
    userAgent?: string
  ) {
    const cuentas = await prisma.usuarioCuenta.findMany({
      where: { usuarioId },
      include: { cuenta: true },
    });

    await this.registrarAuditoria(
      asesorId,
      usuarioId,
      "VIEW_ACCOUNTS",
      null,
      { count: cuentas.length },
      ip,
      userAgent
    );

    return cuentas.map((uc) => ({
      cuentaId: uc.cuenta.id,
      numeroCuenta: uc.cuenta.numeroCuenta,
      nombre: uc.cuenta.nombre,
      saldo: uc.cuenta.saldo,
      tipoCuenta: uc.cuenta.tipoCuenta,
      estado: uc.cuenta.estado,
      rol: uc.rol,
    }));
  }

  async obtenerTarjetasUsuario(
    asesorId: string,
    usuarioId: string,
    ip?: string,
    userAgent?: string
  ) {
    const tarjetas = await prisma.tarjeta.findMany({
      where: { usuarioId },
      select: {
        id: true,
        numeroTarjeta: true,
        tipoTarjeta: true,
        estado: true,
        limiteDiario: true,
        fechaExpiracion: true,
        cuenta: {
          select: {
            numeroCuenta: true,
            nombre: true,
          },
        },
      },
    });

    // Enmascarar números de tarjeta (solo últimos 4 dígitos)
    const tarjetasEnmascaradas = tarjetas.map((t) => ({
      ...t,
      numeroTarjeta: `****-****-****-${t.numeroTarjeta.slice(-4)}`,
    }));

    await this.registrarAuditoria(
      asesorId,
      usuarioId,
      "VIEW_CARDS",
      null,
      { count: tarjetas.length },
      ip,
      userAgent
    );

    return tarjetasEnmascaradas;
  }

  // ========================================
  // AUDITORÍA
  // ========================================
  private async registrarAuditoria(
    asesorId: string,
    usuarioId: string | null,
    operacion: string,
    resource: string | null,
    metadata?: any,
    ip?: string,
    userAgent?: string
  ) {
    await prisma.advisorAuditLog.create({
      data: {
        asesorId,
        usuarioId,
        operacion,
        resource,
        metadata: metadata || {},
        ip,
        userAgent,
      },
    });
  }

  // ========================================
  // ASESOR: Cambiar estado de cuenta
  // ========================================
  async cambiarEstadoCuenta(
    asesorId: string,
    usuarioId: string,
    cuentaId: string,
    nuevoEstado: "ACTIVA" | "BLOQUEADA" | "CERRADA",
    ip?: string,
    userAgent?: string
  ) {
    // Verificar que el usuario tiene acceso a la cuenta
    const usuarioCuenta = await prisma.usuarioCuenta.findUnique({
      where: {
        usuarioId_cuentaId: { usuarioId, cuentaId },
      },
      include: { cuenta: true },
    });

    if (!usuarioCuenta) {
      throw new Error("Usuario no tiene acceso a esta cuenta");
    }

    const estadoAnterior = usuarioCuenta.cuenta.estado;

    // Actualizar estado
    const cuentaActualizada = await prisma.cuentaBancaria.update({
      where: { id: cuentaId },
      data: { estado: nuevoEstado },
    });

    // Registrar auditoría
    await this.registrarAuditoria(
      asesorId,
      usuarioId,
      "CHANGE_ACCOUNT_STATUS",
      cuentaId,
      {
        estadoAnterior,
        estadoNuevo: nuevoEstado,
        numeroCuenta: cuentaActualizada.numeroCuenta,
      },
      ip,
      userAgent
    );

    return cuentaActualizada;
  }

  // ========================================
  // ASESOR: Cambiar estado de tarjeta
  // ========================================
  async cambiarEstadoTarjeta(
    asesorId: string,
    usuarioId: string,
    tarjetaId: string,
    nuevoEstado: "ACTIVA" | "BLOQUEADA" | "CANCELADA",
    ip?: string,
    userAgent?: string
  ) {
    // Verificar que la tarjeta pertenece al usuario
    const tarjeta = await prisma.tarjeta.findUnique({
      where: { id: tarjetaId },
    });

    if (!tarjeta || tarjeta.usuarioId !== usuarioId) {
      throw new Error("Tarjeta no encontrada o no pertenece al usuario");
    }

    const estadoAnterior = tarjeta.estado;

    // Actualizar estado
    const tarjetaActualizada = await prisma.tarjeta.update({
      where: { id: tarjetaId },
      data: { estado: nuevoEstado },
    });

    // Registrar auditoría
    await this.registrarAuditoria(
      asesorId,
      usuarioId,
      "CHANGE_CARD_STATUS",
      tarjetaId,
      {
        estadoAnterior,
        estadoNuevo: nuevoEstado,
        numeroTarjeta: tarjetaActualizada.numeroTarjeta.slice(-4),
      },
      ip,
      userAgent
    );

    return tarjetaActualizada;
  }

  // ========================================
  // ADMIN: Crear asesor
  // ========================================
  async crearAsesor(id: string, nombre: string, email: string, codigo: string) {
    return await prisma.asesor.create({
      data: {
        id,
        nombre,
        email,
        codigo,
      },
    });
  }
}

export const advisorService = new AdvisorService();
