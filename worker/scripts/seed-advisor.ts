// ========================================
// Script para crear un asesor de prueba
// ========================================
// Ejecutar: bun run seed-advisor
// ========================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Creando asesor de prueba...");

  const asesor = await prisma.asesor.create({
    data: {
      nombre: "Juan Pérez",
      email: "juan.perez@banco.com",
      codigo: "ASR001",
      activo: true,
    },
  });

  console.log("✅ Asesor creado:");
  console.log(JSON.stringify(asesor, null, 2));
  console.log("\n📋 Datos para verificación:");
  console.log(`ID: ${asesor.id}`);
  console.log(`Nombre: ${asesor.nombre}`);
  console.log(`Email: ${asesor.email}`);
  console.log(`Código: ${asesor.codigo}`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
