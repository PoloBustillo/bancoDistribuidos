-- CreateEnum
CREATE TYPE "EstadoCuenta" AS ENUM ('ACTIVA', 'BLOQUEADA', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoCuenta" AS ENUM ('CHEQUES', 'DEBITO', 'CREDITO');

-- CreateEnum
CREATE TYPE "TipoTarjeta" AS ENUM ('DEBITO', 'CREDITO');

-- CreateEnum
CREATE TYPE "EstadoTarjeta" AS ENUM ('ACTIVA', 'BLOQUEADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_bancarias" (
    "id" TEXT NOT NULL,
    "numeroCuenta" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoCuenta" "TipoCuenta" NOT NULL DEFAULT 'CHEQUES',
    "saldo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "limiteDiario" DOUBLE PRECISION,
    "estado" "EstadoCuenta" NOT NULL DEFAULT 'ACTIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_cuentas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'TITULAR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarjetas" (
    "id" TEXT NOT NULL,
    "numeroTarjeta" TEXT NOT NULL,
    "cvv" TEXT NOT NULL,
    "fechaExpiracion" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "tipoTarjeta" "TipoTarjeta" NOT NULL,
    "estado" "EstadoTarjeta" NOT NULL DEFAULT 'ACTIVA',
    "limiteDiario" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tarjetas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_jti_key" ON "sesiones"("jti");

-- CreateIndex
CREATE INDEX "sesiones_usuarioId_idx" ON "sesiones"("usuarioId");

-- CreateIndex
CREATE INDEX "sesiones_expiresAt_idx" ON "sesiones"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_bancarias_numeroCuenta_key" ON "cuentas_bancarias"("numeroCuenta");

-- CreateIndex
CREATE INDEX "cuentas_bancarias_numeroCuenta_idx" ON "cuentas_bancarias"("numeroCuenta");

-- CreateIndex
CREATE INDEX "usuarios_cuentas_usuarioId_idx" ON "usuarios_cuentas"("usuarioId");

-- CreateIndex
CREATE INDEX "usuarios_cuentas_cuentaId_idx" ON "usuarios_cuentas"("cuentaId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_cuentas_usuarioId_cuentaId_key" ON "usuarios_cuentas"("usuarioId", "cuentaId");

-- CreateIndex
CREATE UNIQUE INDEX "tarjetas_numeroTarjeta_key" ON "tarjetas"("numeroTarjeta");

-- CreateIndex
CREATE INDEX "tarjetas_usuarioId_idx" ON "tarjetas"("usuarioId");

-- CreateIndex
CREATE INDEX "tarjetas_cuentaId_idx" ON "tarjetas"("cuentaId");

-- CreateIndex
CREATE INDEX "tarjetas_numeroTarjeta_idx" ON "tarjetas"("numeroTarjeta");

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_cuentas" ADD CONSTRAINT "usuarios_cuentas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_cuentas" ADD CONSTRAINT "usuarios_cuentas_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarjetas" ADD CONSTRAINT "tarjetas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarjetas" ADD CONSTRAINT "tarjetas_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cuentas_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
