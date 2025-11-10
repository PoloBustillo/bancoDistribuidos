// ========================================
// 🎓 SERVICIO: Cuentas Compartidas y Tarjetas
// ========================================
// Este servicio administra:
// 1. Cuentas compartidas entre múltiples usuarios
// 2. Tarjetas individuales de cada usuario
//
// CONCEPTOS DE SISTEMAS DISTRIBUIDOS:
// - Recursos compartidos (cuentas) vs individuales (tarjetas)
// - Control de acceso y permisos por rol
// - Sincronización de cambios entre múltiples usuarios
// ========================================

import prisma from "../prisma/client";
import { bankingEvents } from "./eventEmitter";
import { WorkerClient } from "./workerClient";

export class CuentasCompartidasService {
  private workerClient: WorkerClient;

  constructor(workerClient: WorkerClient) {
    this.workerClient = workerClient;
  }
  // ========================================
  // 🎓 AGREGAR USUARIO A CUENTA COMPARTIDA
  // ========================================
  // Permite que un TITULAR de una cuenta agregue a otro usuario.
  // El nuevo usuario puede tener rol: TITULAR, AUTORIZADO o CONSULTA
  //
  // Concepto: Control de acceso en recursos compartidos
  // ========================================
  async agregarUsuarioACuenta(
    cuentaId: string,
    emailNuevoUsuario: string,
    usuarioSolicitanteId: string,
    rol: "TITULAR" | "AUTORIZADO" | "CONSULTA" = "AUTORIZADO"
  ) {
    // 1. Verificar que el solicitante es TITULAR de la cuenta
    const permisoSolicitante = await prisma.usuarioCuenta.findUnique({
      where: {
        usuarioId_cuentaId: {
          usuarioId: usuarioSolicitanteId,
          cuentaId,
        },
      },
    });

    if (!permisoSolicitante || permisoSolicitante.rol !== "TITULAR") {
      throw new Error("Solo los titulares pueden agregar usuarios a la cuenta");
    }

    // 2. Buscar el nuevo usuario por email
    const nuevoUsuario = await prisma.usuario.findUnique({
      where: { email: emailNuevoUsuario },
    });

    if (!nuevoUsuario) {
      throw new Error("Usuario no encontrado");
    }

    // 3. Verificar que no esté ya agregado
    const yaExiste = await prisma.usuarioCuenta.findUnique({
      where: {
        usuarioId_cuentaId: {
          usuarioId: nuevoUsuario.id,
          cuentaId,
        },
      },
    });

    if (yaExiste) {
      throw new Error("El usuario ya tiene acceso a esta cuenta");
    }

    // 4. Agregar la relación Usuario-Cuenta
    const usuarioCuenta = await prisma.usuarioCuenta.create({
      data: {
        usuarioId: nuevoUsuario.id,
        cuentaId,
        rol,
      },
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            email: true,
          },
        },
        cuenta: {
          select: {
            id: true,
            numeroCuenta: true,
            nombre: true,
          },
        },
      },
    });

    // ========================================
    // 📡 EMITIR EVENTO EN TIEMPO REAL
    // ========================================
    bankingEvents.emitUsuarioAgregado(
      cuentaId,
      nuevoUsuario.id,
      nuevoUsuario.email,
      rol
    );

    return {
      mensaje: `Usuario ${nuevoUsuario.nombre} agregado a la cuenta con rol ${rol}`,
      usuarioCuenta,
    };
  }

  // ========================================
  // 🎓 CREAR TARJETA INDIVIDUAL
  // ========================================
  // Crea una tarjeta para un usuario específico.
  // La tarjeta es INDIVIDUAL - solo el usuario puede usarla.
  // Aunque la cuenta sea compartida, cada usuario tiene su propia tarjeta.
  //
  // Concepto: Recurso individual en sistema compartido
  // ========================================
  async crearTarjeta(
    usuarioId: string,
    cuentaId: string,
    tipoTarjeta: "DEBITO" | "CREDITO" = "DEBITO"
  ) {
    // 1. Verificar que el usuario tiene acceso a la cuenta
    const permiso = await prisma.usuarioCuenta.findUnique({
      where: {
        usuarioId_cuentaId: {
          usuarioId,
          cuentaId,
        },
      },
    });

    if (!permiso) {
      throw new Error("No tienes acceso a esta cuenta");
    }

    // 2. Generar datos de la tarjeta
    const numeroTarjeta = `${Math.floor(
      1000 + Math.random() * 9000
    )}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(
      1000 + Math.random() * 9000
    )}-${Math.floor(1000 + Math.random() * 9000)}`;

    const cvv = `${Math.floor(100 + Math.random() * 900)}`;

    const fechaExpiracion = new Date();
    fechaExpiracion.setFullYear(fechaExpiracion.getFullYear() + 3); // 3 años

    // 3. Crear tarjeta individual
    const tarjeta = await prisma.tarjeta.create({
      data: {
        numeroTarjeta,
        cvv,
        fechaExpiracion,
        usuarioId,
        cuentaId,
        tipoTarjeta,
      },
      include: {
        usuario: {
          select: {
            nombre: true,
            email: true,
          },
        },
        cuenta: {
          select: {
            numeroCuenta: true,
            nombre: true,
          },
        },
      },
    });

    // ========================================
    // 📡 EMITIR EVENTO EN TIEMPO REAL
    // ========================================
    bankingEvents.emitTarjetaCreada(tarjeta.id, usuarioId, cuentaId);

    return {
      mensaje: "Tarjeta creada exitosamente",
      tarjeta: {
        id: tarjeta.id,
        numeroTarjeta: tarjeta.numeroTarjeta,
        tipoTarjeta: tarjeta.tipoTarjeta,
        fechaExpiracion: tarjeta.fechaExpiracion,
        estado: tarjeta.estado,
        usuario: tarjeta.usuario.nombre,
        cuenta: tarjeta.cuenta.nombre,
      },
    };
  }

  // ========================================
  // 🎓 CAMBIAR ESTADO DE TARJETA (BLOQUEAR/DESBLOQUEAR)
  // ========================================
  // Solo el dueño de la tarjeta puede bloquearla/desbloquearla.
  // Bloquear una tarjeta NO afecta a las tarjetas de otros usuarios
  // de la misma cuenta compartida.
  //
  // Concepto: Operaciones individuales en recursos compartidos
  // + Lock distribuido para evitar race conditions
  // ========================================
  async cambiarEstadoTarjeta(
    tarjetaId: string,
    usuarioId: string,
    nuevoEstado: "ACTIVA" | "BLOQUEADA" | "CANCELADA"
  ) {
    // ========================================
    // 🔒 LOCK DISTRIBUIDO: Bloquear TARJETA
    // ========================================
    // Evita que dos workers cambien el estado simultáneamente
    const requestId = await this.workerClient.lockTarjeta(
      tarjetaId,
      `cambiar-estado-tarjeta-${nuevoEstado}`
    );

    try {
      // 1. Verificar que la tarjeta pertenece al usuario
      const tarjeta = await prisma.tarjeta.findUnique({
        where: { id: tarjetaId },
      });

      if (!tarjeta) {
        throw new Error("Tarjeta no encontrada");
      }

      if (tarjeta.usuarioId !== usuarioId) {
        throw new Error("Esta tarjeta no te pertenece");
      }

      // 2. Actualizar estado
      const tarjetaActualizada = await prisma.tarjeta.update({
        where: { id: tarjetaId },
        data: { estado: nuevoEstado },
      });

      // ========================================
      // 📡 EMITIR EVENTO EN TIEMPO REAL
      // ========================================
      bankingEvents.emitTarjetaEstadoCambiado(
        tarjetaId,
        usuarioId,
        tarjeta.cuentaId,
        nuevoEstado
      );

      return {
        mensaje: `Tarjeta ${nuevoEstado.toLowerCase()}`,
        tarjeta: {
          numeroTarjeta: tarjetaActualizada.numeroTarjeta,
          estado: tarjetaActualizada.estado,
        },
      };
    } finally {
      // ========================================
      // 🔓 UNLOCK: Liberar TARJETA
      // ========================================
      await this.workerClient.unlockTarjeta(requestId, tarjetaId);
    }
  } // ========================================
  // 🎓 LISTAR USUARIOS DE UNA CUENTA COMPARTIDA
  // ========================================
  // Muestra todos los usuarios que tienen acceso a una cuenta
  // y sus respectivos roles.
  //
  // Concepto: Auditoría de acceso a recursos compartidos
  // ========================================
  async listarUsuariosDeCuenta(cuentaId: string, usuarioSolicitanteId: string) {
    // Verificar que el solicitante tiene acceso
    const permiso = await prisma.usuarioCuenta.findUnique({
      where: {
        usuarioId_cuentaId: {
          usuarioId: usuarioSolicitanteId,
          cuentaId,
        },
      },
    });

    if (!permiso) {
      throw new Error("No tienes acceso a esta cuenta");
    }

    // Obtener todos los usuarios con acceso
    const usuariosCuenta = await prisma.usuarioCuenta.findMany({
      where: { cuentaId },
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

    return {
      cuenta: {
        id: cuentaId,
      },
      usuarios: usuariosCuenta.map((uc) => ({
        id: uc.usuario.id,
        nombre: uc.usuario.nombre,
        email: uc.usuario.email,
        rol: uc.rol,
        agregadoEn: uc.createdAt,
      })),
    };
  }

  // ========================================
  // 🎓 LISTAR TARJETAS DE UNA CUENTA
  // ========================================
  // Muestra todas las tarjetas asociadas a una cuenta.
  // Cada tarjeta pertenece a un usuario específico.
  //
  // Concepto: Visualización de recursos individuales en cuenta compartida
  // ========================================
  async listarTarjetasDeCuenta(cuentaId: string, usuarioSolicitanteId: string) {
    // Verificar acceso a la cuenta
    const permiso = await prisma.usuarioCuenta.findUnique({
      where: {
        usuarioId_cuentaId: {
          usuarioId: usuarioSolicitanteId,
          cuentaId,
        },
      },
    });

    if (!permiso) {
      throw new Error("No tienes acceso a esta cuenta");
    }

    // Obtener todas las tarjetas de la cuenta
    const tarjetas = await prisma.tarjeta.findMany({
      where: { cuentaId },
      include: {
        usuario: {
          select: {
            nombre: true,
            email: true,
          },
        },
      },
    });

    return {
      cuenta: {
        id: cuentaId,
      },
      tarjetas: tarjetas.map((t) => ({
        id: t.id,
        numeroTarjeta: t.numeroTarjeta,
        tipo: t.tipoTarjeta,
        estado: t.estado,
        propietario: t.usuario.nombre,
        propietarioEmail: t.usuario.email,
        expiracion: t.fechaExpiracion,
        esMia: t.usuarioId === usuarioSolicitanteId, // 🎓 Indica si la tarjeta pertenece al solicitante
      })),
    };
  }

  // ========================================
  // 🎓 REMOVER USUARIO DE CUENTA COMPARTIDA
  // ========================================
  // Solo un TITULAR puede remover usuarios.
  // No se puede remover al último titular.
  //
  // Concepto: Administración de acceso a recursos compartidos
  // ========================================
  async removerUsuarioDeCuenta(
    cuentaId: string,
    usuarioARemoverId: string,
    usuarioSolicitanteId: string
  ) {
    // 1. Verificar que el solicitante es TITULAR
    const permisoSolicitante = await prisma.usuarioCuenta.findUnique({
      where: {
        usuarioId_cuentaId: {
          usuarioId: usuarioSolicitanteId,
          cuentaId,
        },
      },
    });

    if (!permisoSolicitante || permisoSolicitante.rol !== "TITULAR") {
      throw new Error("Solo los titulares pueden remover usuarios");
    }

    // 2. Verificar que no se está removiendo al último titular
    const titulares = await prisma.usuarioCuenta.count({
      where: {
        cuentaId,
        rol: "TITULAR",
      },
    });

    const permisoARemover = await prisma.usuarioCuenta.findUnique({
      where: {
        usuarioId_cuentaId: {
          usuarioId: usuarioARemoverId,
          cuentaId,
        },
      },
    });

    if (permisoARemover?.rol === "TITULAR" && titulares <= 1) {
      throw new Error("No se puede remover al último titular de la cuenta");
    }

    // 3. Remover usuario
    const usuarioRemovido = await prisma.usuario.findUnique({
      where: { id: usuarioARemoverId },
      select: { email: true },
    });

    await prisma.usuarioCuenta.delete({
      where: {
        usuarioId_cuentaId: {
          usuarioId: usuarioARemoverId,
          cuentaId,
        },
      },
    });

    // ========================================
    // 📡 EMITIR EVENTO EN TIEMPO REAL
    // ========================================
    if (usuarioRemovido) {
      bankingEvents.emitUsuarioRemovido(
        cuentaId,
        usuarioARemoverId,
        usuarioRemovido.email
      );
    }

    return {
      mensaje: "Usuario removido de la cuenta exitosamente",
    };
  }

  // ========================================
  // 🎓 CREAR CUENTA ADICIONAL PARA USUARIO
  // ========================================
  // Permite a un usuario crear cuentas adicionales.
  // El usuario será TITULAR de la nueva cuenta.
  //
  // Concepto: Un usuario puede tener múltiples cuentas
  // (personal, ahorro, USD, etc.)
  // ========================================
  async crearCuentaAdicional(
    usuarioId: string,
    tipoCuenta: "CHEQUES" | "DEBITO" | "CREDITO",
    nombre?: string
  ) {
    // 1. Verificar que el usuario existe
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { nombre: true, email: true },
    });

    if (!usuario) {
      throw new Error("Usuario no encontrado");
    }

    // 2. Generar número de cuenta único
    const numeroCuenta = `${Math.floor(
      1000 + Math.random() * 9000
    )}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    // 3. Crear cuenta y relación en una transacción
    const resultado = await prisma.$transaction(async (tx) => {
      // Crear la cuenta
      const nuevaCuenta = await tx.cuentaBancaria.create({
        data: {
          numeroCuenta,
          nombre: nombre || `Cuenta ${tipoCuenta} - ${usuario.nombre}`,
          tipoCuenta,
          saldo: 0,
        },
      });

      // Crear relación Usuario-Cuenta (usuario es TITULAR)
      await tx.usuarioCuenta.create({
        data: {
          usuarioId,
          cuentaId: nuevaCuenta.id,
          rol: "TITULAR",
        },
      });

      // Crear tarjeta automáticamente para la nueva cuenta
      const numeroTarjeta = `${Math.floor(
        1000 + Math.random() * 9000
      )}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(
        1000 + Math.random() * 9000
      )}-${Math.floor(1000 + Math.random() * 9000)}`;

      const cvv = `${Math.floor(100 + Math.random() * 900)}`;
      const fechaExpiracion = new Date();
      fechaExpiracion.setFullYear(fechaExpiracion.getFullYear() + 3);

      const tipoTarjeta = tipoCuenta === "CREDITO" ? "CREDITO" : "DEBITO";

      const tarjeta = await tx.tarjeta.create({
        data: {
          numeroTarjeta,
          cvv,
          fechaExpiracion,
          usuarioId,
          cuentaId: nuevaCuenta.id,
          tipoTarjeta,
        },
      });

      return { cuenta: nuevaCuenta, tarjeta };
    });

    return {
      mensaje: "Cuenta adicional creada exitosamente",
      cuenta: {
        id: resultado.cuenta.id,
        numeroCuenta: resultado.cuenta.numeroCuenta,
        nombre: resultado.cuenta.nombre,
        tipoCuenta: resultado.cuenta.tipoCuenta,
        saldo: resultado.cuenta.saldo,
      },
      tarjeta: {
        numeroTarjeta: resultado.tarjeta.numeroTarjeta,
        tipo: resultado.tarjeta.tipoTarjeta,
        expiracion: resultado.tarjeta.fechaExpiracion,
      },
    };
  }
}
