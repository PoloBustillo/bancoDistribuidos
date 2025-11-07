import { PrismaClient } from "@prisma/client";
import { WorkerClient } from "./workerClient";
import { Prioridad } from "../shared/types";

const prisma = new PrismaClient();

export class BancoService {
  constructor(private workerClient: WorkerClient) {}

  /**
   * Transferencia entre cuentas usando locks distribuidos
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

    // Ordenar IDs para evitar deadlocks (siempre bloquear en el mismo orden)
    const cuentaIds = [cuentaOrigenId, cuentaDestinoId].sort();
    let lockId: string | null = null;

    try {
      // 1. Solicitar lock al coordinador
      console.log(`🔒 Solicitando lock para cuentas: ${cuentaIds.join(", ")}`);
      lockId = await this.workerClient.lockCuentas(
        cuentaIds,
        `transferencia de $${monto}`,
        Prioridad.NORMAL
      );
      console.log(`✅ Lock obtenido: ${lockId}`);

      // 2. Verificar cuentas existen
      const [origen, destino] = await Promise.all([
        prisma.cuentaBancaria.findUnique({ where: { id: cuentaOrigenId } }),
        prisma.cuentaBancaria.findUnique({ where: { id: cuentaDestinoId } }),
      ]);

      if (!origen || !destino) {
        throw new Error("Una o ambas cuentas no existen");
      }

      // 3. Verificar que el usuario es dueño de la cuenta origen
      if (origen.usuarioId !== usuarioId) {
        throw new Error("No tienes permiso para realizar esta transferencia");
      }

      // 4. Verificar saldo suficiente
      if (origen.saldo < monto) {
        throw new Error(`Saldo insuficiente. Disponible: $${origen.saldo}`);
      }

      // 5. Verificar estado de cuentas
      if (origen.estado !== "ACTIVA" || destino.estado !== "ACTIVA") {
        throw new Error("Una o ambas cuentas no están activas");
      }

      // 6. Realizar transferencia en transacción
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

      return {
        mensaje: "Transferencia realizada exitosamente",
        monto,
        ...resultado,
      };
    } finally {
      // 7. Liberar lock SIEMPRE
      if (lockId) {
        console.log(`🔓 Liberando lock: ${lockId}`);
        await this.workerClient.unlockCuentas(lockId, cuentaIds);
      }
    }
  }

  /**
   * Depósito en cuenta usando locks distribuidos
   */
  async depositar(cuentaId: string, monto: number, usuarioId: string) {
    if (monto <= 0) {
      throw new Error("El monto debe ser mayor a 0");
    }

    let lockId: string | null = null;

    try {
      // 1. Solicitar lock
      console.log(`🔒 Solicitando lock para cuenta: ${cuentaId}`);
      lockId = await this.workerClient.lockCuenta(
        cuentaId,
        `depósito de $${monto}`,
        Prioridad.NORMAL
      );
      console.log(`✅ Lock obtenido: ${lockId}`);

      // 2. Verificar cuenta
      const cuenta = await prisma.cuentaBancaria.findUnique({
        where: { id: cuentaId },
      });

      if (!cuenta) {
        throw new Error("Cuenta no encontrada");
      }

      if (cuenta.usuarioId !== usuarioId) {
        throw new Error("No tienes permiso para depositar en esta cuenta");
      }

      if (cuenta.estado !== "ACTIVA") {
        throw new Error("La cuenta no está activa");
      }

      // 3. Realizar depósito
      const cuentaActualizada = await prisma.cuentaBancaria.update({
        where: { id: cuentaId },
        data: { saldo: { increment: monto } },
      });

      console.log(`✅ Depósito completado: $${monto}`);

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
      if (lockId) {
        console.log(`🔓 Liberando lock: ${lockId}`);
        await this.workerClient.unlockCuentas(lockId, [cuentaId]);
      }
    }
  }

  /**
   * Retiro de cuenta usando locks distribuidos
   */
  async retirar(cuentaId: string, monto: number, usuarioId: string) {
    if (monto <= 0) {
      throw new Error("El monto debe ser mayor a 0");
    }

    let lockId: string | null = null;

    try {
      // 1. Solicitar lock
      console.log(`🔒 Solicitando lock para cuenta: ${cuentaId}`);
      lockId = await this.workerClient.lockCuenta(
        cuentaId,
        `retiro de $${monto}`,
        Prioridad.NORMAL
      );
      console.log(`✅ Lock obtenido: ${lockId}`);

      // 2. Verificar cuenta
      const cuenta = await prisma.cuentaBancaria.findUnique({
        where: { id: cuentaId },
      });

      if (!cuenta) {
        throw new Error("Cuenta no encontrada");
      }

      if (cuenta.usuarioId !== usuarioId) {
        throw new Error("No tienes permiso para retirar de esta cuenta");
      }

      if (cuenta.estado !== "ACTIVA") {
        throw new Error("La cuenta no está activa");
      }

      if (cuenta.saldo < monto) {
        throw new Error(`Saldo insuficiente. Disponible: $${cuenta.saldo}`);
      }

      // 3. Realizar retiro
      const cuentaActualizada = await prisma.cuentaBancaria.update({
        where: { id: cuentaId },
        data: { saldo: { decrement: monto } },
      });

      console.log(`✅ Retiro completado: $${monto}`);

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
      if (lockId) {
        console.log(`🔓 Liberando lock: ${lockId}`);
        await this.workerClient.unlockCuentas(lockId, [cuentaId]);
      }
    }
  }

  /**
   * Consultar saldo (no requiere lock)
   */
  async consultarSaldo(cuentaId: string, usuarioId: string) {
    const cuenta = await prisma.cuentaBancaria.findUnique({
      where: { id: cuentaId },
    });

    if (!cuenta) {
      throw new Error("Cuenta no encontrada");
    }

    if (cuenta.usuarioId !== usuarioId) {
      throw new Error("No tienes permiso para consultar esta cuenta");
    }

    return {
      id: cuenta.id,
      numeroCuenta: cuenta.numeroCuenta,
      titular: cuenta.titularCuenta,
      saldo: cuenta.saldo,
      estado: cuenta.estado,
    };
  }
}
