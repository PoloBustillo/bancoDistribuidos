/*
  Warnings:

  - The `estado` column on the `cuentas_bancarias` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `estado` column on the `transacciones` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[referencia]` on the table `transacciones` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `tipo` on the `transacciones` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `referencia` on table `transacciones` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "EstadoCuenta" AS ENUM ('ACTIVA', 'BLOQUEADA', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoTransaccion" AS ENUM ('DEPOSITO', 'RETIRO', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "EstadoTransaccion" AS ENUM ('COMPLETADA', 'PENDIENTE', 'FALLIDA');

-- AlterTable
ALTER TABLE "cuentas_bancarias" ADD COLUMN     "limiteRetiroDiario" DOUBLE PRECISION NOT NULL DEFAULT 10000,
ADD COLUMN     "limiteTransferencia" DOUBLE PRECISION NOT NULL DEFAULT 50000,
DROP COLUMN "estado",
ADD COLUMN     "estado" "EstadoCuenta" NOT NULL DEFAULT 'ACTIVA';

-- AlterTable
ALTER TABLE "transacciones" DROP COLUMN "tipo",
ADD COLUMN     "tipo" "TipoTransaccion" NOT NULL,
DROP COLUMN "estado",
ADD COLUMN     "estado" "EstadoTransaccion" NOT NULL DEFAULT 'COMPLETADA',
ALTER COLUMN "referencia" SET NOT NULL;

-- CreateIndex
CREATE INDEX "cuentas_bancarias_estado_idx" ON "cuentas_bancarias"("estado");

-- CreateIndex
CREATE INDEX "sesiones_usuarioId_expiresAt_idx" ON "sesiones"("usuarioId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "transacciones_referencia_key" ON "transacciones"("referencia");

-- CreateIndex
CREATE INDEX "transacciones_tipo_idx" ON "transacciones"("tipo");

-- CreateIndex
CREATE INDEX "transacciones_estado_idx" ON "transacciones"("estado");

-- CreateIndex
CREATE INDEX "transacciones_cuentaOrigenId_createdAt_idx" ON "transacciones"("cuentaOrigenId", "createdAt");

-- CreateIndex
CREATE INDEX "transacciones_estado_createdAt_idx" ON "transacciones"("estado", "createdAt");
