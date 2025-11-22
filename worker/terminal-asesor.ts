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
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                                                            ║");
  console.log("║         🏦  TERMINAL DE ASESOR BANCARIO  🏦                ║");
  console.log("║              Sistema Distribuido v2.0                      ║");
  console.log("║                                                            ║");
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
  console.log("═══════════════════════════════════════════════════════════\n");
  console.log("📋 PROCESO DE VERIFICACIÓN:\n");
  console.log("  1. El cliente debe generar un código en su aplicación");
  console.log("  2. Solicite al cliente los últimos 4 dígitos de su:");
  console.log("     • Número de cuenta, O");
  console.log("     • Número de tarjeta");
  console.log("  3. Solicite el código de verificación (6 dígitos)\n");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Paso 1: ID del asesor
  console.log("👤 IDENTIFICACIÓN DEL ASESOR\n");
  console.log("   IDs disponibles:");
  console.log("   • 12345678a (Juan Pérez)");
  console.log("   • 87654321b (María García)");
  console.log("   • 11223344c (Carlos López)\n");

  const advisorId = await prompt("� Ingrese su ID de asesor: ");
  if (!advisorId) {
    showError("ID de asesor requerido");
    await prompt("Presione Enter para continuar...");
    return false;
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Paso 2: Tipo de recurso
  console.log("🏦 ¿Qué tipo de recurso usará para la verificación?\n");
  console.log("  1. Cuenta bancaria");
  console.log("  2. Tarjeta de débito/crédito\n");

  const tipoRecurso = await prompt("Seleccione tipo (1-2): ");
  if (!["1", "2"].includes(tipoRecurso)) {
    showError("Tipo inválido. Debe seleccionar 1 o 2");
    await prompt("Presione Enter para continuar...");
    return false;
  }

  const esCuenta = tipoRecurso === "1";
  const nombreRecurso = esCuenta ? "cuenta" : "tarjeta";

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Paso 3: Últimos 4 dígitos
  console.log(
    `🔢 Solicite al cliente los últimos 4 dígitos de su ${nombreRecurso}\n`
  );
  console.log(`   Ejemplo de ${nombreRecurso}:`);
  if (esCuenta) {
    console.log("   Cuenta: 1234-5678-9012-3456");
    console.log("   Últimos 4 dígitos: 3456\n");
  } else {
    console.log("   Tarjeta: 4532-1234-5678-9010");
    console.log("   Últimos 4 dígitos: 9010\n");
  }

  let ultimosDigitos = await prompt(
    `💳 Últimos 4 dígitos de ${nombreRecurso}: `
  );
  ultimosDigitos = ultimosDigitos.replace(/\D/g, ""); // Eliminar no-dígitos

  if (ultimosDigitos.length !== 4) {
    showError("Debe ingresar exactamente 4 dígitos");
    await prompt("Presione Enter para continuar...");
    return false;
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Paso 4: Código de verificación
  console.log("🔐 Solicite al cliente el código de verificación\n");
  console.log("   • El código tiene 6 dígitos");
  console.log("   • Es válido por 10 minutos");
  console.log("   • Se genera en su aplicación móvil/web\n");

  let codigo = await prompt("🔑 Código de verificación (6 dígitos): ");
  codigo = codigo.replace(/\D/g, ""); // Eliminar no-dígitos

  if (codigo.length !== 6) {
    showError("Debe ingresar exactamente 6 dígitos");
    await prompt("Presione Enter para continuar...");
    return false;
  }

  console.log("\n⏳ Verificando cliente...");
  console.log(`   • Tipo: ${nombreRecurso.toUpperCase()}`);
  console.log(`   • Últimos 4 dígitos: ****${ultimosDigitos}`);
  console.log(`   • Código: ******\n`);

  try {
    // Construir "numeroRecurso" usando últimos 4 dígitos como identificador
    // El backend buscará coincidencias en cuentas/tarjetas que terminen en estos dígitos
    const numeroRecurso = ultimosDigitos;

    const result = await verifyClient(
      advisorId,
      numeroRecurso,
      ultimosDigitos,
      codigo
    );

    advisorToken = result.token;
    currentClient = result.usuario;

    console.log("\n✨ ¡VERIFICACIÓN EXITOSA! ✨\n");
    console.log(
      "╔════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║              📋 INFORMACIÓN DEL CLIENTE                    ║"
    );
    console.log(
      "╠════════════════════════════════════════════════════════════╣"
    );
    console.log(`║ 👤 Nombre: ${currentClient.nombre.padEnd(48, " ")}║`);
    console.log(`║ 📧 Email:  ${currentClient.email.padEnd(48, " ")}║`);
    console.log(
      `║ 🆔 ID:     ${currentClient.id.substring(0, 48).padEnd(48, " ")}║`
    );
    console.log(
      "╚════════════════════════════════════════════════════════════╝\n"
    );

    await prompt("✅ Presione Enter para acceder al menú principal...");
    return true;
  } catch (error: any) {
    console.log("\n");
    showError(error.message);
    console.log("\n💡 POSIBLES CAUSAS:\n");
    console.log("  • Los últimos 4 dígitos no coinciden");
    console.log("  • El código de verificación expiró (10 minutos)");
    console.log("  • El código ya fue usado");
    console.log("  • El cliente no generó el código en su app\n");
    await prompt("Presione Enter para reintentar...");
    return false;
  }
}

async function mainMenu() {
  while (true) {
    clearScreen();
    showHeader();
    console.log(
      "╔════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║                    SESIÓN ACTIVA                           ║"
    );
    console.log(
      "╠════════════════════════════════════════════════════════════╣"
    );
    console.log(`║ 👤 Cliente: ${currentClient.nombre.padEnd(47, " ")}║`);
    console.log(`║ 📧 Email:   ${currentClient.email.padEnd(47, " ")}║`);
    console.log(
      "╚════════════════════════════════════════════════════════════╝\n"
    );
    console.log("━━━━━━━━━━━━━━━━━━ MENÚ PRINCIPAL ━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("  📊 CONSULTAS:");
    console.log("    1️⃣  Ver todas las cuentas del cliente");
    console.log("    2️⃣  Ver todas las tarjetas del cliente");
    console.log("    3️⃣  Consultar saldo de cuenta específica\n");
    console.log("  ⚙️  ADMINISTRACIÓN:");
    console.log("    4️⃣  Cambiar estado de cuenta");
    console.log("    5️⃣  Cambiar estado de tarjeta\n");
    console.log("  6️⃣  Cerrar sesión y salir\n");
    console.log(
      "═══════════════════════════════════════════════════════════\n"
    );

    const option = await prompt("👉 Seleccione una opción (1-6): ");

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
        await changeAccountStatus();
        break;
      case "5":
        await changeCardStatus();
        break;
      case "6":
        await logoutAndExit();
        return;
      default:
        showError("Opción inválida. Debe seleccionar un número del 1 al 6");
        await prompt("Presione Enter para continuar...");
    }
  }
}

async function showAccounts() {
  clearScreen();
  showHeader();
  console.log("━━━━━━━━━━━━━━━━━━ 💰 CUENTAS DEL CLIENTE ━━━━━━━━━━━━━━━\n");
  console.log("⏳ Cargando información...\n");

  try {
    const cuentas = await getClientAccounts(currentClient.id);

    if (cuentas.length === 0) {
      console.log(
        "╔════════════════════════════════════════════════════════════╗"
      );
      console.log(
        "║                                                            ║"
      );
      console.log(
        "║        ℹ️  El cliente no tiene cuentas registradas         ║"
      );
      console.log(
        "║                                                            ║"
      );
      console.log(
        "╚════════════════════════════════════════════════════════════╝\n"
      );
    } else {
      cuentas.forEach((cuenta: any, index: number) => {
        const saldoColor = cuenta.saldo >= 0 ? "💰" : "⚠️";
        console.log(
          "╔════════════════════════════════════════════════════════════╗"
        );
        console.log(`║  CUENTA #${(index + 1).toString().padEnd(52, " ")}║`);
        console.log(
          "╠════════════════════════════════════════════════════════════╣"
        );
        console.log(`║ 🔢 Número:  ${cuenta.numeroCuenta.padEnd(46, " ")}║`);
        console.log(`║ 📝 Nombre:  ${cuenta.nombre.padEnd(46, " ")}║`);
        console.log(`║ 🏦 Tipo:    ${cuenta.tipoCuenta.padEnd(46, " ")}║`);
        console.log(
          `║ ${saldoColor} Saldo:   $${cuenta.saldo
            .toFixed(2)
            .padEnd(45, " ")}║`
        );
        console.log(`║ 📊 Estado:  ${cuenta.estado.padEnd(46, " ")}║`);
        console.log(`║ 👤 Rol:     ${cuenta.rol.padEnd(46, " ")}║`);
        console.log(
          "╚════════════════════════════════════════════════════════════╝"
        );
        if (index < cuentas.length - 1) console.log("");
      });
      console.log("\n");
      console.log(`✅ Total de cuentas: ${cuentas.length}`);
    }
  } catch (error: any) {
    showError(error.message);
  }

  console.log("\n");
  await prompt("⏎ Presione Enter para volver al menú...");
}

async function showCards() {
  clearScreen();
  showHeader();
  console.log("━━━━━━━━━━━━━━━━━ 💳 TARJETAS DEL CLIENTE ━━━━━━━━━━━━━━━\n");
  console.log("⏳ Cargando información...\n");

  try {
    const tarjetas = await getClientCards(currentClient.id);

    if (tarjetas.length === 0) {
      console.log(
        "╔════════════════════════════════════════════════════════════╗"
      );
      console.log(
        "║                                                            ║"
      );
      console.log(
        "║       ℹ️  El cliente no tiene tarjetas registradas         ║"
      );
      console.log(
        "║                                                            ║"
      );
      console.log(
        "╚════════════════════════════════════════════════════════════╝\n"
      );
    } else {
      tarjetas.forEach((tarjeta: any, index: number) => {
        const estadoIcon =
          tarjeta.estado === "ACTIVA"
            ? "✅"
            : tarjeta.estado === "BLOQUEADA"
            ? "🔒"
            : "❌";
        const tipoIcon = tarjeta.tipoTarjeta === "DEBITO" ? "💳" : "💎";

        console.log(
          "╔════════════════════════════════════════════════════════════╗"
        );
        console.log(
          `║  ${tipoIcon} TARJETA #${(index + 1).toString().padEnd(49, " ")}║`
        );
        console.log(
          "╠════════════════════════════════════════════════════════════╣"
        );
        console.log(`║ 🔢 Número:  ${tarjeta.numeroTarjeta.padEnd(46, " ")}║`);
        console.log(`║ 🏷️  Tipo:    ${tarjeta.tipoTarjeta.padEnd(46, " ")}║`);
        console.log(
          `║ ${estadoIcon} Estado:  ${tarjeta.estado.padEnd(46, " ")}║`
        );

        const limite = tarjeta.limiteDiario
          ? `$${tarjeta.limiteDiario.toFixed(2)}`
          : "Sin límite";
        console.log(`║ 💵 Límite:  ${limite.padEnd(46, " ")}║`);

        const expira = new Date(tarjeta.fechaExpiracion).toLocaleDateString(
          "es-MX"
        );
        console.log(`║ 📅 Expira:  ${expira.padEnd(46, " ")}║`);
        console.log(
          `║ 🏦 Cuenta:  ${tarjeta.cuenta.numeroCuenta.padEnd(46, " ")}║`
        );
        console.log(
          "╚════════════════════════════════════════════════════════════╝"
        );
        if (index < tarjetas.length - 1) console.log("");
      });
      console.log("\n");
      console.log(`✅ Total de tarjetas: ${tarjetas.length}`);
    }
  } catch (error: any) {
    showError(error.message);
  }

  console.log("\n");
  await prompt("⏎ Presione Enter para volver al menú...");
}

async function showBalance() {
  clearScreen();
  showHeader();
  console.log("━━━━━━━━━━━━━━━━━ 💵 CONSULTAR SALDO ━━━━━━━━━━━━━━━━━━━\n");

  try {
    // Primero obtener las cuentas para mostrarlas
    const cuentas = await getClientAccounts(currentClient.id);

    if (cuentas.length === 0) {
      console.log(
        "╔════════════════════════════════════════════════════════════╗"
      );
      console.log(
        "║                                                            ║"
      );
      console.log(
        "║         ⚠️  El cliente no tiene cuentas disponibles        ║"
      );
      console.log(
        "║                                                            ║"
      );
      console.log(
        "╚════════════════════════════════════════════════════════════╝\n"
      );
      await prompt("⏎ Presione Enter para volver al menú...");
      return;
    }

    console.log("📋 CUENTAS DISPONIBLES:\n");
    cuentas.forEach((cuenta: any, index: number) => {
      const numero = cuenta.numeroCuenta.slice(-4);
      console.log(`  ${index + 1}️⃣  ****${numero} - ${cuenta.nombre}`);
      console.log(
        `     ${cuenta.tipoCuenta} | Saldo: $${cuenta.saldo.toFixed(2)}`
      );
      console.log("");
    });

    const selection = await prompt(
      `👉 Seleccione cuenta (1-${cuentas.length}): `
    );
    const selectedIndex = parseInt(selection) - 1;

    if (
      isNaN(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= cuentas.length
    ) {
      showError("Selección inválida");
      await prompt("⏎ Presione Enter para volver al menú...");
      return;
    }

    const cuentaSeleccionada = cuentas[selectedIndex];
    console.log("\n⏳ Consultando saldo actualizado...\n");

    const saldo = await getAccountBalance(
      currentClient.id,
      cuentaSeleccionada.cuentaId
    );

    const saldoIcon =
      saldo.saldo >= 1000 ? "💰" : saldo.saldo >= 0 ? "💵" : "⚠️";

    console.log(
      "╔════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║                    DETALLE DE CUENTA                       ║"
    );
    console.log(
      "╠════════════════════════════════════════════════════════════╣"
    );
    console.log(`║ 🔢 Cuenta:  ${saldo.numeroCuenta.padEnd(46, " ")}║`);
    console.log(`║ 📝 Nombre:  ${saldo.nombre.padEnd(46, " ")}║`);
    console.log(`║ 🏦 Tipo:    ${saldo.tipoCuenta.padEnd(46, " ")}║`);
    console.log(`║ 📊 Estado:  ${saldo.estado.padEnd(46, " ")}║`);
    console.log(
      "╠════════════════════════════════════════════════════════════╣"
    );
    console.log(
      `║ ${saldoIcon}  SALDO ACTUAL: $${saldo.saldo
        .toFixed(2)
        .padEnd(40, " ")}║`
    );
    console.log(
      "╚════════════════════════════════════════════════════════════╝\n"
    );
  } catch (error: any) {
    showError(error.message);
  }

  console.log("");
  await prompt("⏎ Presione Enter para volver al menú...");
}

async function logoutAndExit() {
  clearScreen();
  showHeader();
  console.log("━━━━━━━━━━━━━━━━━━ 🔐 CERRANDO SESIÓN ━━━━━━━━━━━━━━━━━\n");
  console.log("⏳ Finalizando sesión de asesor...\n");

  try {
    await logout();
    console.log(
      "╔════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║                                                            ║"
    );
    console.log(
      "║              ✅ Sesión cerrada exitosamente                ║"
    );
    console.log(
      "║                                                            ║"
    );
    console.log(
      "╚════════════════════════════════════════════════════════════╝\n"
    );
  } catch (error: any) {
    console.log(
      "╔════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║                                                            ║"
    );
    console.log(
      "║          ⚠️  Sesión cerrada localmente                     ║"
    );
    console.log(
      "║                                                            ║"
    );
    console.log(
      "╚════════════════════════════════════════════════════════════╝\n"
    );
  }

  console.log("👋 ¡Gracias por usar el Terminal de Asesor Bancario!");
  console.log("   Vuelva pronto.\n");
  rl.close();
  process.exit(0);
}

async function changeAccountStatus() {
  clearScreen();
  showHeader();
  console.log("━━━━━━━━━━━━ ⚙️  CAMBIAR ESTADO DE CUENTA ━━━━━━━━━━━━━━━\n");

  try {
    // Obtener cuentas
    const cuentas = await getClientAccounts(currentClient.id);

    if (cuentas.length === 0) {
      showError("El cliente no tiene cuentas registradas");
      await prompt("Presione Enter para continuar...");
      return;
    }

    // Mostrar cuentas disponibles
    console.log("📋 Cuentas disponibles:\n");
    cuentas.forEach((cuenta: any, index: number) => {
      console.log(
        `  ${index + 1}. ${cuenta.numeroCuenta} - ${cuenta.nombre} (${
          cuenta.estado
        })`
      );
    });

    console.log("\n");
    const seleccion = await prompt(
      `👉 Seleccione una cuenta (1-${cuentas.length}): `
    );
    const index = parseInt(seleccion) - 1;

    if (isNaN(index) || index < 0 || index >= cuentas.length) {
      showError("Selección inválida");
      await prompt("Presione Enter para continuar...");
      return;
    }

    const cuentaSeleccionada = cuentas[index];

    // Mostrar estados disponibles
    console.log("\n📊 Estados disponibles:\n");
    console.log("  1. ACTIVA");
    console.log("  2. BLOQUEADA");
    console.log("  3. CERRADA\n");

    const estadoOpt = await prompt("👉 Seleccione nuevo estado (1-3): ");
    const estados = ["ACTIVA", "BLOQUEADA", "CERRADA"];
    const nuevoEstado = estados[parseInt(estadoOpt) - 1];

    if (!nuevoEstado) {
      showError("Estado inválido");
      await prompt("Presione Enter para continuar...");
      return;
    }

    // Confirmar
    const confirmar = await prompt(
      `\n⚠️  ¿Confirma cambiar el estado de la cuenta ${cuentaSeleccionada.numeroCuenta} a ${nuevoEstado}? (s/n): `
    );

    if (confirmar.toLowerCase() !== "s") {
      console.log("\n❌ Operación cancelada\n");
      await prompt("Presione Enter para continuar...");
      return;
    }

    // Realizar cambio
    console.log("\n⏳ Actualizando estado...\n");

    const response = await fetch(
      `${WORKER_URL}/api/advisor/client/${currentClient.id}/account/${cuentaSeleccionada.cuentaId}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${advisorToken}`,
        },
        body: JSON.stringify({ estado: nuevoEstado }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al cambiar estado");
    }

    console.log("✅ Estado actualizado exitosamente\n");
    console.log(
      `   Cuenta: ${cuentaSeleccionada.numeroCuenta} → ${nuevoEstado}\n`
    );
  } catch (error: any) {
    showError(error.message);
  }

  await prompt("⏎ Presione Enter para volver al menú...");
}

async function changeCardStatus() {
  clearScreen();
  showHeader();
  console.log("━━━━━━━━━━━━ ⚙️  CAMBIAR ESTADO DE TARJETA ━━━━━━━━━━━━━━\n");

  try {
    // Obtener tarjetas
    const tarjetas = await getClientCards(currentClient.id);

    if (tarjetas.length === 0) {
      showError("El cliente no tiene tarjetas registradas");
      await prompt("Presione Enter para continuar...");
      return;
    }

    // Mostrar tarjetas disponibles
    console.log("💳 Tarjetas disponibles:\n");
    tarjetas.forEach((tarjeta: any, index: number) => {
      console.log(
        `  ${index + 1}. ${tarjeta.numeroTarjeta} - ${tarjeta.tipoTarjeta} (${
          tarjeta.estado
        })`
      );
    });

    console.log("\n");
    const seleccion = await prompt(
      `👉 Seleccione una tarjeta (1-${tarjetas.length}): `
    );
    const index = parseInt(seleccion) - 1;

    if (isNaN(index) || index < 0 || index >= tarjetas.length) {
      showError("Selección inválida");
      await prompt("Presione Enter para continuar...");
      return;
    }

    const tarjetaSeleccionada = tarjetas[index];

    // Mostrar estados disponibles
    console.log("\n📊 Estados disponibles:\n");
    console.log("  1. ACTIVA");
    console.log("  2. BLOQUEADA");
    console.log("  3. CANCELADA\n");

    const estadoOpt = await prompt("👉 Seleccione nuevo estado (1-3): ");
    const estados = ["ACTIVA", "BLOQUEADA", "CANCELADA"];
    const nuevoEstado = estados[parseInt(estadoOpt) - 1];

    if (!nuevoEstado) {
      showError("Estado inválido");
      await prompt("Presione Enter para continuar...");
      return;
    }

    // Confirmar
    const confirmar = await prompt(
      `\n⚠️  ¿Confirma cambiar el estado de la tarjeta ${tarjetaSeleccionada.numeroTarjeta} a ${nuevoEstado}? (s/n): `
    );

    if (confirmar.toLowerCase() !== "s") {
      console.log("\n❌ Operación cancelada\n");
      await prompt("Presione Enter para continuar...");
      return;
    }

    // Realizar cambio
    console.log("\n⏳ Actualizando estado...\n");

    const response = await fetch(
      `${WORKER_URL}/api/advisor/client/${currentClient.id}/card/${tarjetaSeleccionada.id}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${advisorToken}`,
        },
        body: JSON.stringify({ estado: nuevoEstado }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Error al cambiar estado");
    }

    console.log("✅ Estado actualizado exitosamente\n");
    console.log(
      `   Tarjeta: ${tarjetaSeleccionada.numeroTarjeta} → ${nuevoEstado}\n`
    );
  } catch (error: any) {
    showError(error.message);
  }

  await prompt("⏎ Presione Enter para volver al menú...");
}

// ========================================
// Main
// ========================================

async function main() {
  clearScreen();
  showHeader();
  console.log("━━━━━━━━━━━━━━━━━━━━ INICIALIZANDO ━━━━━━━━━━━━━━━━━━━━\n");
  console.log("🚀 Iniciando Terminal de Asesor Bancario...");
  console.log(`📡 Servidor: ${WORKER_URL}\n`);
  console.log("⏳ Verificando conectividad...\n");

  // Intentar verificar que el servidor esté disponible
  try {
    const healthResponse = await fetch(`${WORKER_URL}/api/health`);
    if (!healthResponse.ok) {
      throw new Error("Servidor no disponible");
    }
    const health = await healthResponse.json();

    console.log(
      "╔════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║                                                            ║"
    );
    console.log(
      "║              ✅ Conexión establecida con éxito             ║"
    );
    console.log(
      "║                                                            ║"
    );
    console.log(
      "╠════════════════════════════════════════════════════════════╣"
    );
    console.log(`║ Worker ID: ${health.workerId?.padEnd(46, " ")}║`);
    console.log(`║ Estado:    ${health.status?.padEnd(46, " ")}║`);
    console.log(
      "╚════════════════════════════════════════════════════════════╝\n"
    );
  } catch (error) {
    console.log(
      "╔════════════════════════════════════════════════════════════╗"
    );
    console.log(
      "║                                                            ║"
    );
    console.log(
      "║           ❌ ERROR: No se puede conectar                   ║"
    );
    console.log(
      "║                                                            ║"
    );
    console.log(
      "╠════════════════════════════════════════════════════════════╣"
    );
    console.log(`║ Servidor: ${WORKER_URL.padEnd(47, " ")}║`);
    console.log(
      "║                                                            ║"
    );
    console.log(
      "║ 💡 Soluciones:                                             ║"
    );
    console.log(
      "║   • Verifique que el worker esté ejecutándose             ║"
    );
    console.log(
      "║   • Inicie con: cd worker && bun run dev                  ║"
    );
    console.log(
      "║   • Verifique la variable WORKER_URL                      ║"
    );
    console.log(
      "║                                                            ║"
    );
    console.log(
      "╚════════════════════════════════════════════════════════════╝\n"
    );
    rl.close();
    process.exit(1);
  }

  await prompt("⏎ Presione Enter para continuar...");

  // Loop de login
  while (!advisorToken) {
    const success = await loginScreen();
    if (!success) {
      console.log("\n");
      const retry = await prompt(
        "❓ ¿Desea reintentar la verificación? (s/n): "
      );
      if (retry.toLowerCase() !== "s") {
        console.log(
          "\n╔════════════════════════════════════════════════════════════╗"
        );
        console.log(
          "║                                                            ║"
        );
        console.log(
          "║            👋 Saliendo del sistema...                      ║"
        );
        console.log(
          "║                                                            ║"
        );
        console.log(
          "╚════════════════════════════════════════════════════════════╝\n"
        );
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
  console.log("\n\n");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                                                            ║");
  console.log("║         ⚠️  Interrupción de teclado detectada (Ctrl+C)    ║");
  console.log("║                                                            ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n"
  );

  if (advisorToken) {
    console.log("⏳ Cerrando sesión activa...");
    try {
      await logout();
      console.log("✅ Sesión cerrada\n");
    } catch {
      console.log("⚠️  Sesión cerrada localmente\n");
    }
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
