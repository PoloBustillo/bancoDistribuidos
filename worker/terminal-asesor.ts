#!/usr/bin/env bun
// ========================================
// 🏦 TERMINAL DE ASESOR BANCARIO
// ========================================
// Terminal interactiva para que asesores bancarios
// puedan verificar clientes y consultar información.
//
// Ejecutar: bun terminal-asesor.ts
// ========================================

import * as readline from "readline";

// Configuración
const WORKER_URL = process.env.WORKER_URL || "http://localhost:3001";
let advisorToken: string | null = null;
let currentClient: any = null;

// Utilidades de terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function clearScreen() {
  console.clear();
}

function showHeader() {
  console.log(
    "\n╔════════════════════════════════════════════════════════════╗"
  );
  console.log("║         🏦  TERMINAL DE ASESOR BANCARIO  🏦               ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n"
  );
}

function showError(message: string) {
  console.log(`\n❌ Error: ${message}\n`);
}

function showSuccess(message: string) {
  console.log(`\n✅ ${message}\n`);
}

// ========================================
// API Calls
// ========================================

async function verifyClient(
  advisorId: string,
  numeroRecurso: string,
  ultimosDigitos: string,
  codigo: string
) {
  try {
    const response = await fetch(`${WORKER_URL}/api/advisor/verify-client`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        asesorId: advisorId,
        numeroRecurso,
        ultimosDigitos,
        codigo,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al verificar cliente");
    }

    return await response.json();
  } catch (error: any) {
    throw new Error(error.message);
  }
}

async function getClientAccounts(usuarioId: string) {
  try {
    const response = await fetch(
      `${WORKER_URL}/api/advisor/client/${usuarioId}/accounts`,
      {
        headers: {
          Authorization: `Bearer ${advisorToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al obtener cuentas");
    }

    return await response.json();
  } catch (error: any) {
    throw new Error(error.message);
  }
}

async function getClientCards(usuarioId: string) {
  try {
    const response = await fetch(
      `${WORKER_URL}/api/advisor/client/${usuarioId}/cards`,
      {
        headers: {
          Authorization: `Bearer ${advisorToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al obtener tarjetas");
    }

    return await response.json();
  } catch (error: any) {
    throw new Error(error.message);
  }
}

async function getAccountBalance(usuarioId: string, cuentaId: string) {
  try {
    const response = await fetch(
      `${WORKER_URL}/api/advisor/client/${usuarioId}/account/${cuentaId}/balance`,
      {
        headers: {
          Authorization: `Bearer ${advisorToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al obtener saldo");
    }

    return await response.json();
  } catch (error: any) {
    throw new Error(error.message);
  }
}

async function logout() {
  try {
    await fetch(`${WORKER_URL}/api/advisor/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${advisorToken}`,
      },
    });
  } catch (error) {
    // Ignorar errores en logout
  }
}

// ========================================
// Pantallas
// ========================================

async function loginScreen() {
  clearScreen();
  showHeader();
  console.log("🔐 VERIFICACIÓN DE CLIENTE\n");
  console.log("Por favor, solicite al cliente:\n");
  console.log("  1. Número de cuenta o tarjeta");
  console.log("  2. Últimos 4 dígitos");
  console.log("  3. Código de verificación (6 dígitos)\n");

  const advisorId = await prompt("ID de Asesor: ");
  if (!advisorId) {
    showError("ID de asesor requerido");
    await prompt("Presione Enter para continuar...");
    return false;
  }

  const numeroRecurso = await prompt("Número de cuenta/tarjeta: ");
  if (!numeroRecurso) {
    showError("Número de recurso requerido");
    await prompt("Presione Enter para continuar...");
    return false;
  }

  const ultimosDigitos = await prompt("Últimos 4 dígitos: ");
  if (ultimosDigitos.length !== 4) {
    showError("Debe ingresar exactamente 4 dígitos");
    await prompt("Presione Enter para continuar...");
    return false;
  }

  const codigo = await prompt("Código de verificación (6 dígitos): ");
  if (codigo.length !== 6) {
    showError("Debe ingresar exactamente 6 dígitos");
    await prompt("Presione Enter para continuar...");
    return false;
  }

  console.log("\n⏳ Verificando cliente...\n");

  try {
    const result = await verifyClient(
      advisorId,
      numeroRecurso,
      ultimosDigitos,
      codigo
    );

    advisorToken = result.token;
    currentClient = result.usuario;

    showSuccess("Cliente verificado exitosamente");
    console.log("📋 Información del Cliente:");
    console.log(`   Nombre: ${currentClient.nombre}`);
    console.log(`   Email: ${currentClient.email}`);
    console.log(`   ID: ${currentClient.id}\n`);

    await prompt("Presione Enter para continuar...");
    return true;
  } catch (error: any) {
    showError(error.message);
    await prompt("Presione Enter para reintentar...");
    return false;
  }
}

async function mainMenu() {
  while (true) {
    clearScreen();
    showHeader();
    console.log(`👤 Cliente: ${currentClient.nombre}`);
    console.log(`📧 Email: ${currentClient.email}\n`);
    console.log(
      "═══════════════════════════════════════════════════════════\n"
    );
    console.log("MENÚ PRINCIPAL:\n");
    console.log("  1. Ver cuentas del cliente");
    console.log("  2. Ver tarjetas del cliente");
    console.log("  3. Consultar saldo de cuenta");
    console.log("  4. Cerrar sesión y salir\n");

    const option = await prompt("Seleccione una opción (1-4): ");

    switch (option) {
      case "1":
        await showAccounts();
        break;
      case "2":
        await showCards();
        break;
      case "3":
        await showBalance();
        break;
      case "4":
        await logoutAndExit();
        return;
      default:
        showError("Opción inválida");
        await prompt("Presione Enter para continuar...");
    }
  }
}

async function showAccounts() {
  clearScreen();
  showHeader();
  console.log("💰 CUENTAS DEL CLIENTE\n");
  console.log("⏳ Cargando...\n");

  try {
    const cuentas = await getClientAccounts(currentClient.id);

    if (cuentas.length === 0) {
      console.log("No se encontraron cuentas.\n");
    } else {
      console.log(
        "╔════════════════════════════════════════════════════════════╗"
      );
      cuentas.forEach((cuenta: any, index: number) => {
        console.log(`║ Cuenta #${index + 1}`);
        console.log(`║ Número: ${cuenta.numeroCuenta}`);
        console.log(`║ Nombre: ${cuenta.nombre}`);
        console.log(`║ Tipo: ${cuenta.tipoCuenta}`);
        console.log(`║ Saldo: $${cuenta.saldo.toFixed(2)}`);
        console.log(`║ Estado: ${cuenta.estado}`);
        console.log(`║ Rol: ${cuenta.rol}`);
        console.log(
          "╠════════════════════════════════════════════════════════════╣"
        );
      });
      console.log(
        "╚════════════════════════════════════════════════════════════╝\n"
      );
    }
  } catch (error: any) {
    showError(error.message);
  }

  await prompt("Presione Enter para volver al menú...");
}

async function showCards() {
  clearScreen();
  showHeader();
  console.log("💳 TARJETAS DEL CLIENTE\n");
  console.log("⏳ Cargando...\n");

  try {
    const tarjetas = await getClientCards(currentClient.id);

    if (tarjetas.length === 0) {
      console.log("No se encontraron tarjetas.\n");
    } else {
      console.log(
        "╔════════════════════════════════════════════════════════════╗"
      );
      tarjetas.forEach((tarjeta: any, index: number) => {
        console.log(`║ Tarjeta #${index + 1}`);
        console.log(`║ Número: ${tarjeta.numeroTarjeta}`);
        console.log(`║ Tipo: ${tarjeta.tipoTarjeta}`);
        console.log(`║ Estado: ${tarjeta.estado}`);
        console.log(
          `║ Límite Diario: $${tarjeta.limiteDiario?.toFixed(2) || "N/A"}`
        );
        console.log(
          `║ Expira: ${new Date(tarjeta.fechaExpiracion).toLocaleDateString()}`
        );
        console.log(`║ Cuenta: ${tarjeta.cuenta.numeroCuenta}`);
        console.log(
          "╠════════════════════════════════════════════════════════════╣"
        );
      });
      console.log(
        "╚════════════════════════════════════════════════════════════╝\n"
      );
    }
  } catch (error: any) {
    showError(error.message);
  }

  await prompt("Presione Enter para volver al menú...");
}

async function showBalance() {
  clearScreen();
  showHeader();
  console.log("💵 CONSULTAR SALDO\n");

  try {
    // Primero obtener las cuentas para mostrarlas
    const cuentas = await getClientAccounts(currentClient.id);

    if (cuentas.length === 0) {
      showError("El cliente no tiene cuentas");
      await prompt("Presione Enter para volver al menú...");
      return;
    }

    console.log("Cuentas disponibles:\n");
    cuentas.forEach((cuenta: any, index: number) => {
      console.log(`  ${index + 1}. ${cuenta.numeroCuenta} - ${cuenta.nombre}`);
    });

    const selection = await prompt(
      `\nSeleccione cuenta (1-${cuentas.length}): `
    );
    const selectedIndex = parseInt(selection) - 1;

    if (selectedIndex < 0 || selectedIndex >= cuentas.length) {
      showError("Selección inválida");
      await prompt("Presione Enter para volver al menú...");
      return;
    }

    const cuentaSeleccionada = cuentas[selectedIndex];
    console.log("\n⏳ Consultando saldo...\n");

    const saldo = await getAccountBalance(
      currentClient.id,
      cuentaSeleccionada.cuentaId
    );

    console.log(
      "╔════════════════════════════════════════════════════════════╗"
    );
    console.log(`║ Cuenta: ${saldo.numeroCuenta}`);
    console.log(`║ Nombre: ${saldo.nombre}`);
    console.log(`║ Tipo: ${saldo.tipoCuenta}`);
    console.log(`║ Estado: ${saldo.estado}`);
    console.log(
      "╠════════════════════════════════════════════════════════════╣"
    );
    console.log(`║ 💰 SALDO: $${saldo.saldo.toFixed(2)}`);
    console.log(
      "╚════════════════════════════════════════════════════════════╝\n"
    );
  } catch (error: any) {
    showError(error.message);
  }

  await prompt("Presione Enter para volver al menú...");
}

async function logoutAndExit() {
  console.log("\n⏳ Cerrando sesión...\n");

  try {
    await logout();
    showSuccess("Sesión cerrada exitosamente");
  } catch (error: any) {
    console.log("⚠️  Error al cerrar sesión, pero continuando...");
  }

  console.log("👋 ¡Hasta pronto!\n");
  rl.close();
  process.exit(0);
}

// ========================================
// Main
// ========================================

async function main() {
  console.log("\n🚀 Iniciando Terminal de Asesor Bancario...\n");
  console.log(`📡 Conectando a: ${WORKER_URL}\n`);

  // Intentar verificar que el servidor esté disponible
  try {
    const healthResponse = await fetch(`${WORKER_URL}/api/health`);
    if (!healthResponse.ok) {
      throw new Error("Servidor no disponible");
    }
    console.log("✅ Conexión establecida\n");
  } catch (error) {
    console.log("❌ No se puede conectar al servidor");
    console.log(
      `   Asegúrese de que el worker esté corriendo en ${WORKER_URL}`
    );
    console.log("   Puede iniciar el worker con: cd worker && bun run dev\n");
    rl.close();
    process.exit(1);
  }

  await prompt("Presione Enter para continuar...");

  // Loop de login
  while (!advisorToken) {
    const success = await loginScreen();
    if (!success) {
      const retry = await prompt("¿Desea reintentar? (s/n): ");
      if (retry.toLowerCase() !== "s") {
        console.log("\n👋 ¡Hasta pronto!\n");
        rl.close();
        process.exit(0);
      }
    }
  }

  // Menú principal
  await mainMenu();
}

// Manejar Ctrl+C
process.on("SIGINT", async () => {
  console.log("\n\n⚠️  Interrupción detectada...");
  if (advisorToken) {
    console.log("⏳ Cerrando sesión...");
    await logout();
  }
  console.log("👋 ¡Hasta pronto!\n");
  rl.close();
  process.exit(0);
});

main().catch((error) => {
  console.error("\n❌ Error fatal:", error.message);
  rl.close();
  process.exit(1);
});
