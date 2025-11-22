// ========================================
// Script para crear un asesor de prueba
// ========================================
// Ejecutar: bun run seed-advisor
// ========================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Creando asesores de prueba...\n");

  // Verificar conexión a la base de datos
  if (!process.env.DATABASE_URL) {
    console.error("❌ ERROR: DATABASE_URL no está configurada.");
    console.log("\n💡 Soluciones posibles:");
    console.log(
      "   1. Asegúrate de tener un archivo .env en el directorio worker/"
    );
    console.log("   2. O ejecuta: docker-compose up -d postgres");
    console.log("   3. O define DATABASE_URL manualmente:");
    console.log(
      "      set DATABASE_URL=postgresql://user:pass@localhost:5432/banco (Windows)"
    );
    console.log(
      "      export DATABASE_URL=postgresql://user:pass@localhost:5432/banco (Linux/Mac)\n"
    );
    process.exit(1);
  }

  console.log("🔌 Conectando a la base de datos...");
  try {
    await prisma.$connect();
    console.log("✅ Conexión exitosa\n");
  } catch (error: any) {
    console.error("❌ Error de conexión:", error.message);
    console.log("\n💡 Verifica que PostgreSQL esté corriendo:");
    console.log("   docker-compose up -d postgres\n");
    process.exit(1);
  }

  // Crear múltiples asesores con IDs fáciles de recordar
  // Usando timestamp para evitar conflictos
  const timestamp = Date.now();
  const asesores = [
    {
      id: "12345678a",
      nombre: "Juan Pérez",
      email: `juan.perez.${timestamp}@banco.com`,
      codigo: `ASR001-${timestamp}`,
    },
    {
      id: "87654321b",
      nombre: "María García",
      email: `maria.garcia.${timestamp}@banco.com`,
      codigo: `ASR002-${timestamp}`,
    },
    {
      id: "11223344c",
      nombre: "Carlos López",
      email: `carlos.lopez.${timestamp}@banco.com`,
      codigo: `ASR003-${timestamp}`,
    },
  ];

  for (const asesorData of asesores) {
    try {
      // Intentar crear o actualizar el asesor
      const asesor = await prisma.asesor.upsert({
        where: { id: asesorData.id },
        update: {
          nombre: asesorData.nombre,
          email: asesorData.email,
          codigo: asesorData.codigo,
          activo: true,
        },
        create: {
          id: asesorData.id,
          nombre: asesorData.nombre,
          email: asesorData.email,
          codigo: asesorData.codigo,
          activo: true,
        },
      });

      console.log(`✅ Asesor: ${asesor.nombre}`);
      console.log(`   ID: ${asesor.id}`);
      console.log(`   Email: ${asesor.email}`);
      console.log(`   Código: ${asesor.codigo}\n`);
    } catch (error: any) {
      console.error(`❌ Error al crear ${asesorData.nombre}:`, error.message);
      return; // Salir si hay error
    }
  }

  console.log(
    "\n╔════════════════════════════════════════════════════════════╗"
  );
  console.log("║                                                            ║");
  console.log("║           🎉 Asesores creados exitosamente                 ║");
  console.log("║                                                            ║");
  console.log("╠════════════════════════════════════════════════════════════╣");
  console.log("║                                                            ║");
  console.log("║  💡 Para usar en la terminal, usa estos IDs:               ║");
  console.log("║                                                            ║");
  console.log("║     • 12345678a (Juan Pérez)                               ║");
  console.log("║     • 87654321b (María García)                             ║");
  console.log("║     • 11223344c (Carlos López)                             ║");
  console.log("║                                                            ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n"
  );
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
