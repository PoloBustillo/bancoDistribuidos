import prisma from "../prisma/client";
import { WorkerClient } from "./workerClient";
import { Prioridad } from "../../../shared/types";
import { bankingEvents } from "./eventEmitter";

export class BancoService {
  constructor(private workerClient: WorkerClient) {}

  /**
   * Transferencia entre cuentas usando locks distribuidos
   *
   * 🎓 CONCEPTOS DE SISTEMAS DISTRIBUIDOS APLICADOS:
   * - Locks distribuidos (exclusión mutua)
   * - Prevención de deadlocks (ordenamiento de recursos)
   * - Sección crítica (zona protegida por locks)
   * - Atomicidad (transacción todo-o-nada)
   */
  async transferir(
    cuentaOrigenId: string,
    cuentaDestinoId: string,
    monto: number,
    usuarioId: string
  ) {
    if (monto <= 0) {
      throw new Error("El monto debe ser mayor a 0");
    }

    // ========================================
    // 🎓 PREVENCIÓN DE DEADLOCKS
    // ========================================
    // Si Worker 1 transfiere A→B y Worker 2 transfiere B→A simultáneamente,
    // sin ordenamiento habría deadlock:
    //   Worker 1: lock(A) → espera lock(B)
    //   Worker 2: lock(B) → espera lock(A)  ← DEADLOCK
    //
    // SOLUCIÓN: Ordenar IDs alfabéticamente garantiza que ambos workers
    // soliciten locks en el MISMO orden: lock(A) → lock(B)
    // ========================================
    const cuentaIds = [cuentaOrigenId, cuentaDestinoId].sort();
    let lockId: string | null = null;

    try {
      // ========================================
      // 🎓 SOLICITUD DE LOCKS DISTRIBUIDOS
      // ========================================
      // El worker solicita al COORDINADOR CENTRAL que le otorgue
      // acceso exclusivo a estos recursos (cuentas bancarias).
      //
      // - Si está disponible → LOCK_GRANTED (exclusión mutua garantizada)
      // - Si está ocupado → LOCK_DENIED, entra en COLA DE PRIORIDAD
      // ========================================
      console.log(`🔒 Solicitando lock para cuentas: ${cuentaIds.join(", ")}`);
      lockId = await this.workerClient.lockCuentas(
        cuentaIds,
        `transferencia de $${monto}`,
        Prioridad.NORMAL // 🎓 COLA DE PRIORIDAD: orden de procesamiento
      );
      console.log(`✅ Lock obtenido: ${lockId}`);

      // ========================================
      // 🎓 INICIO DE SECCIÓN CRÍTICA
      // ========================================
      // A partir de aquí, este worker tiene acceso EXCLUSIVO a estas cuentas.
      // Ningún otro worker puede modificarlas hasta que se libere el lock.
      // Esto previene RACE CONDITIONS y garantiza CONSISTENCIA.
      // ========================================

      // 2. Verificar cuentas existen y cargar permisos del usuario
      const [origen, destino, permisoOrigen] = await Promise.all([
        prisma.cuentaBancaria.findUnique({ where: { id: cuentaOrigenId } }),
        prisma.cuentaBancaria.findUnique({ where: { id: cuentaDestinoId } }),
        // 🎓 Verificar si el usuario tiene acceso a la cuenta origen
        prisma.usuarioCuenta.findUnique({
          where: {
            usuarioId_cuentaId: {
              usuarioId,
              cuentaId: cuentaOrigenId,
            },
          },
        }),
      ]);

      if (!origen || !destino) {
        throw new Error("Una o ambas cuentas no existen");
      }

      // ========================================
      // 🎓 VERIFICACIÓN DE PERMISOS (Cuentas Compartidas)
      // ========================================
      // Como las cuentas pueden ser compartidas entre múltiples usuarios,
      // verificamos que el usuario tenga permiso para operar en la cuenta origen.
      // Solo usuarios con rol TITULAR o AUTORIZADO pueden transferir.
      // ========================================
      if (!permisoOrigen) {
        throw new Error("No tienes acceso a la cuenta origen");
      }

      if (permisoOrigen.rol === "CONSULTA") {
        throw new Error(
          "Tu rol solo permite consultar. No puedes realizar transferencias"
        );
      }

      // 4. Verificar saldo suficiente
      if (origen.saldo < monto) {
        throw new Error(`Saldo insuficiente. Disponible: $${origen.saldo}`);
      }

      // 5. Verificar estado de cuentas
      if (origen.estado !== "ACTIVA" || destino.estado !== "ACTIVA") {
        throw new Error("Una o ambas cuentas no están activas");
      }

      // ========================================
      // 🎓 OPERACIÓN ATÓMICA (ACID)
      // ========================================
      // La transacción garantiza ATOMICIDAD:
      // - TODO se ejecuta, o NADA se ejecuta
      // - Si falla acreditar → se revierte debitar
      // - Mantiene CONSISTENCIA de datos
      // ========================================
      const resultado = await prisma.$transaction(async (tx) => {
        // Debitar de origen
        const nuevaOrigen = await tx.cuentaBancaria.update({
          where: { id: cuentaOrigenId },
          data: { saldo: { decrement: monto } },
        });

        // Acreditar a destino
        const nuevaDestino = await tx.cuentaBancaria.update({
          where: { id: cuentaDestinoId },
          data: { saldo: { increment: monto } },
        });

        return {
          origen: {
            id: nuevaOrigen.id,
            numeroCuenta: nuevaOrigen.numeroCuenta,
            saldoAnterior: origen.saldo,
            saldoNuevo: nuevaOrigen.saldo,
          },
          destino: {
            id: nuevaDestino.id,
            numeroCuenta: nuevaDestino.numeroCuenta,
            saldoAnterior: destino.saldo,
            saldoNuevo: nuevaDestino.saldo,
          },
        };
      });

      console.log(`✅ Transferencia completada: $${monto}`);

      // ========================================
      // 📡 EMITIR EVENTOS EN TIEMPO REAL
      // ========================================
      // Obtener usuarios con acceso a cada cuenta para notificarlos
      const usuariosOrigen = await prisma.usuarioCuenta.findMany({
        where: { cuentaId: cuentaOrigenId },
        select: { usuarioId: true },
      });

      const usuariosDestino = await prisma.usuarioCuenta.findMany({
        where: { cuentaId: cuentaDestinoId },
        select: { usuarioId: true },
      });

      // Emitir evento de transferencia enviada
      bankingEvents.emitTransferenciaEnviada(
        cuentaOrigenId,
        cuentaDestinoId,
        monto,
        usuarioId
      );

      // Emitir evento de transferencia recibida
      bankingEvents.emitTransferenciaRecibida(
        cuentaDestinoId,
        cuentaOrigenId,
        monto,
        usuarioId
      );

      // Emitir actualización de saldo para cuenta origen
      bankingEvents.emitCuentaActualizada(
        cuentaOrigenId,
        resultado.origen.saldoAnterior,
        resultado.origen.saldoNuevo,
        usuariosOrigen.map((u) => u.usuarioId)
      );

      // Emitir actualización de saldo para cuenta destino
      bankingEvents.emitCuentaActualizada(
        cuentaDestinoId,
        resultado.destino.saldoAnterior,
        resultado.destino.saldoNuevo,
        usuariosDestino.map((u) => u.usuarioId)
      );

      // ========================================
      // 🎓 FIN DE SECCIÓN CRÍTICA
      // ========================================
      // La operación se completó exitosamente.
      // El lock se liberará en el bloque finally.
      // ========================================

      return {
        mensaje: "Transferencia realizada exitosamente",
        monto,
        ...resultado,
      };
    } finally {
      // ========================================
      // 🎓 LIBERACIÓN DE LOCKS (SIEMPRE)
      // ========================================
      // El bloque finally garantiza que los locks se liberen
      // INCLUSO SI HAY ERROR, evitando:
      // - Deadlocks permanentes
      // - Recursos bloqueados indefinidamente
      // - Inanición de otros workers
      // ========================================
      if (lockId) {
        console.log(`🔓 Liberando lock: ${lockId}`);
        await this.workerClient.unlockCuentas(lockId, cuentaIds);
      }
    }
  }

  /**
   * Depósito en cuenta usando locks distribuidos
   *
   * 🎓 CONCEPTOS APLICADOS:
   * - Lock de recurso único (exclusión mutua)
   * - Sección crítica para modificación de saldo
   * - Operación atómica (ACID)
   */
  async depositar(cuentaId: string, monto: number, usuarioId: string) {
    if (monto <= 0) {
      throw new Error("El monto debe ser mayor a 0");
    }

    let lockId: string | null = null;

    try {
      // ========================================
      // 🎓 SOLICITUD DE LOCK (Recurso único)
      // ========================================
      // A diferencia de transferencia (2 recursos),
      // el depósito solo necesita bloquear 1 cuenta
      // ========================================
      console.log(`🔒 Solicitando lock para cuenta: ${cuentaId}`);
      lockId = await this.workerClient.lockCuenta(
        cuentaId,
        `depósito de $${monto}`,
        Prioridad.NORMAL
      );
      console.log(`✅ Lock obtenido: ${lockId}`);

      // 2. Verificar cuenta y permisos del usuario
      const [cuenta, permiso] = await Promise.all([
        prisma.cuentaBancaria.findUnique({ where: { id: cuentaId } }),
        // 🎓 Verificar permisos en cuenta compartida
        prisma.usuarioCuenta.findUnique({
          where: {
            usuarioId_cuentaId: {
              usuarioId,
              cuentaId,
            },
          },
        }),
      ]);

      if (!cuenta) {
        throw new Error("Cuenta no encontrada");
      }

      // 🎓 Verificar que el usuario tiene acceso a la cuenta
      if (!permiso) {
        throw new Error("No tienes acceso a esta cuenta");
      }

      if (permiso.rol === "CONSULTA") {
        throw new Error("Tu rol solo permite consultar. No puedes depositar");
      }

      if (cuenta.estado !== "ACTIVA") {
        throw new Error("La cuenta no está activa");
      }

      // ========================================
      // 🎓 SECCIÓN CRÍTICA
      // ========================================
      // El lock garantiza que solo este worker puede
      // modificar el saldo de esta cuenta en este momento.
      // Previene race conditions como:
      // - Dos depósitos simultáneos perdiendo un valor
      // - Lectura de saldo inconsistente
      // ========================================
      const cuentaActualizada = await prisma.cuentaBancaria.update({
        where: { id: cuentaId },
        data: { saldo: { increment: monto } }, // Operación atómica
      });

      console.log(`✅ Depósito completado: $${monto}`);

      // ========================================
      // 📡 EMITIR EVENTOS EN TIEMPO REAL
      // ========================================
      const usuariosCuenta = await prisma.usuarioCuenta.findMany({
        where: { cuentaId },
        select: { usuarioId: true },
      });

      // Emitir evento de depósito
      bankingEvents.emitDeposito(cuentaId, monto, usuarioId);

      // Emitir actualización de saldo
      bankingEvents.emitCuentaActualizada(
        cuentaId,
        cuenta.saldo,
        cuentaActualizada.saldo,
        usuariosCuenta.map((u) => u.usuarioId)
      );

      return {
        mensaje: "Depósito realizado exitosamente",
        monto,
        cuenta: {
          id: cuentaActualizada.id,
          numeroCuenta: cuentaActualizada.numeroCuenta,
          saldoAnterior: cuenta.saldo,
          saldoNuevo: cuentaActualizada.saldo,
        },
      };
    } finally {
      // 🎓 LIBERACIÓN (SIEMPRE)
      if (lockId) {
        console.log(`🔓 Liberando lock: ${lockId}`);
        await this.workerClient.unlockCuentas(lockId, [cuentaId]);
      }
    }
  }

  /**
   * Retiro de cuenta usando locks distribuidos
   *
   * 🎓 CONCEPTOS APLICADOS:
   * - Lock de recurso único (exclusión mutua)
   * - Sección crítica con validación de saldo
   * - Prevención de saldo negativo
   */
  async retirar(cuentaId: string, monto: number, usuarioId: string) {
    if (monto <= 0) {
      throw new Error("El monto debe ser mayor a 0");
    }

    let lockId: string | null = null;

    try {
      // ========================================
      // 🎓 SOLICITUD DE LOCK (Exclusión mutua)
      // ========================================
      console.log(`🔒 Solicitando lock para cuenta: ${cuentaId}`);
      lockId = await this.workerClient.lockCuenta(
        cuentaId,
        `retiro de $${monto}`,
        Prioridad.NORMAL
      );
      console.log(`✅ Lock obtenido: ${lockId}`);

      // 2. Verificar cuenta y permisos
      const [cuenta, permiso] = await Promise.all([
        prisma.cuentaBancaria.findUnique({ where: { id: cuentaId } }),
        // 🎓 Verificar permisos en cuenta compartida
        prisma.usuarioCuenta.findUnique({
          where: {
            usuarioId_cuentaId: {
              usuarioId,
              cuentaId,
            },
          },
        }),
      ]);

      if (!cuenta) {
        throw new Error("Cuenta no encontrada");
      }

      // 🎓 Verificar acceso y permisos
      if (!permiso) {
        throw new Error("No tienes acceso a esta cuenta");
      }

      if (permiso.rol === "CONSULTA") {
        throw new Error("Tu rol solo permite consultar. No puedes retirar");
      }

      if (cuenta.estado !== "ACTIVA") {
        throw new Error("La cuenta no está activa");
      }

      // ========================================
      // 🎓 VALIDACIÓN EN SECCIÓN CRÍTICA
      // ========================================
      // El lock asegura que el saldo no cambie entre
      // la lectura (línea anterior) y el retiro (línea siguiente).
      // Sin lock, otro worker podría retirar dinero entre
      // estas dos operaciones, causando saldo negativo.
      // ========================================
      if (cuenta.saldo < monto) {
        throw new Error(`Saldo insuficiente. Disponible: $${cuenta.saldo}`);
      }

      // 🎓 OPERACIÓN ATÓMICA
      const cuentaActualizada = await prisma.cuentaBancaria.update({
        where: { id: cuentaId },
        data: { saldo: { decrement: monto } }, // Decremento atómico
      });

      console.log(`✅ Retiro completado: $${monto}`);

      // ========================================
      // 📡 EMITIR EVENTOS EN TIEMPO REAL
      // ========================================
      const usuariosCuenta = await prisma.usuarioCuenta.findMany({
        where: { cuentaId },
        select: { usuarioId: true },
      });

      // Emitir evento de retiro
      bankingEvents.emitRetiro(cuentaId, monto, usuarioId);

      // Emitir actualización de saldo
      bankingEvents.emitCuentaActualizada(
        cuentaId,
        cuenta.saldo,
        cuentaActualizada.saldo,
        usuariosCuenta.map((u) => u.usuarioId)
      );

      return {
        mensaje: "Retiro realizado exitosamente",
        monto,
        cuenta: {
          id: cuentaActualizada.id,
          numeroCuenta: cuentaActualizada.numeroCuenta,
          saldoAnterior: cuenta.saldo,
          saldoNuevo: cuentaActualizada.saldo,
        },
      };
    } finally {
      // 🎓 LIBERACIÓN (SIEMPRE)
      if (lockId) {
        console.log(`🔓 Liberando lock: ${lockId}`);
        await this.workerClient.unlockCuentas(lockId, [cuentaId]);
      }
    }
  }

  /**
   * Consultar saldo (NO requiere lock)
   *
   * 🎓 OPERACIÓN DE SOLO LECTURA
   * Las consultas de saldo NO necesitan lock porque:
   * - Solo leen datos, no modifican
   * - PostgreSQL garantiza lecturas consistentes
   * - Mejora el rendimiento (no bloquea otros workers)
   */
  async consultarSaldo(cuentaId: string, usuarioId: string) {
    // Verificar cuenta y permisos
    const [cuenta, permiso] = await Promise.all([
      prisma.cuentaBancaria.findUnique({ where: { id: cuentaId } }),
      // 🎓 Verificar acceso a cuenta (puede ser compartida)
      prisma.usuarioCuenta.findUnique({
        where: {
          usuarioId_cuentaId: {
            usuarioId,
            cuentaId,
          },
        },
      }),
    ]);

    if (!cuenta) {
      throw new Error("Cuenta no encontrada");
    }

    // 🎓 Verificar acceso - incluso rol CONSULTA puede ver el saldo
    if (!permiso) {
      throw new Error("No tienes acceso a esta cuenta");
    }

    return {
      id: cuenta.id,
      numeroCuenta: cuenta.numeroCuenta,
      nombre: cuenta.nombre,
      tipoCuenta: cuenta.tipoCuenta,
      saldo: cuenta.saldo,
      estado: cuenta.estado,
      rol: permiso.rol, // 🎓 Muestra el rol del usuario en esta cuenta
    };
  }
}
