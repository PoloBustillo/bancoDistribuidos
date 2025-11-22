# 🏦 Terminal de Asesor Bancario v2.0 - Guía Completa

## ✨ Novedades v2.0

### 🎯 Mejoras Principales

✅ **Solo últimos 4 dígitos** - Ya no es necesario el número completo de cuenta/tarjeta  
✅ **Interfaz mejorada** - Diseño profesional con emojis y bordes visuales  
✅ **Flujo guiado** - Selección de tipo de recurso (cuenta/tarjeta)  
✅ **Mejor seguridad** - Búsqueda por terminación de número + código de verificación  
✅ **Feedback visual** - Estados claros con iconos y colores semánticos

---

## 📋 Requisitos Previos

1. **Worker corriendo:**

   ```bash
   cd worker
   bun run dev
   ```

2. **Base de datos migrada:**

   ```bash
   bun run prisma:migrate:dev
   ```

3. **Asesor creado:**

   ```bash
   bun run seed:advisor
   ```

   Esto creará un asesor con ID que necesitas guardar. Ejemplo:

   ```
   ID: 550e8400-e29b-41d4-a716-446655440000
   ```

---

## 🚀 Iniciar la Terminal

```bash
cd worker
bun run terminal:asesor
```

O directamente:

```bash
bun terminal-asesor.ts
```

---

## 🔐 Flujo de Uso

### Paso 1: Verificación del Cliente

La terminal ahora guía paso a paso:

```
🔐 VERIFICACIÓN DE CLIENTE

Por favor, solicite al cliente:
  1. Número de cuenta o tarjeta
  2. Últimos 4 dígitos
  3. Código de verificación (6 dígitos)

ID de Asesor: [pegar ID del asesor creado]
Número de cuenta/tarjeta: 1234-5678-9012
Últimos 4 dígitos: 9012
Código de verificación (6 dígitos): 384521
```

**¿Cómo obtener el código de verificación?**

El cliente debe generar el código primero usando:

```bash
curl -X POST http://localhost:3001/api/client/verification-code \
  -H "Authorization: Bearer <token_del_cliente>"
```

O desde su app móvil/web (cuando esté implementada).

### 2. Menú Principal

Después de verificar, verás:

```
╔════════════════════════════════════════════════════════════╗
║         🏦  TERMINAL DE ASESOR BANCARIO  🏦               ║
╚════════════════════════════════════════════════════════════╝

👤 Cliente: María González
📧 Email: maria@example.com

═══════════════════════════════════════════════════════════

MENÚ PRINCIPAL:

  1. Ver cuentas del cliente
  2. Ver tarjetas del cliente
  3. Consultar saldo de cuenta
  4. Cerrar sesión y salir

Seleccione una opción (1-4):
```

### 3. Opciones Disponibles

#### Opción 1: Ver Cuentas

Muestra todas las cuentas del cliente:

```
╔════════════════════════════════════════════════════════════╗
║ Cuenta #1
║ Número: 1234-5678-9012
║ Nombre: Cuenta de María González
║ Tipo: CHEQUES
║ Saldo: $5000.50
║ Estado: ACTIVA
║ Rol: TITULAR
╠════════════════════════════════════════════════════════════╣
```

#### Opción 2: Ver Tarjetas

Muestra tarjetas con números enmascarados:

```
╔════════════════════════════════════════════════════════════╗
║ Tarjeta #1
║ Número: ****-****-****-3456
║ Tipo: DEBITO
║ Estado: ACTIVA
║ Límite Diario: $1000.00
║ Expira: 12/31/2027
║ Cuenta: 1234-5678-9012
╠════════════════════════════════════════════════════════════╣
```

#### Opción 3: Consultar Saldo

Muestra lista de cuentas para seleccionar y luego el saldo detallado:

```
Cuentas disponibles:

  1. 1234-5678-9012 - Cuenta de María González
  2. 9876-5432-1098 - Cuenta Conjunta Familia

Seleccione cuenta (1-2): 1

╔════════════════════════════════════════════════════════════╗
║ Cuenta: 1234-5678-9012
║ Nombre: Cuenta de María González
║ Tipo: CHEQUES
║ Estado: ACTIVA
╠════════════════════════════════════════════════════════════╣
║ 💰 SALDO: $5000.50
╚════════════════════════════════════════════════════════════╝
```

#### Opción 4: Cerrar Sesión

Cierra la sesión del asesor y sale de la terminal.

---

## Configuración Avanzada

### Cambiar URL del Worker

```bash
WORKER_URL=http://localhost:3002 bun run terminal:asesor
```

---

## Troubleshooting

### Error: "No se puede conectar al servidor"

**Solución:**

```bash
# En otra terminal, iniciar el worker
cd worker
bun run dev
```

### Error: "Código de verificación inválido o expirado"

**Causa:** El código tiene 10 minutos de vigencia.

**Solución:**

1. Pedir al cliente que genere un nuevo código
2. Usar el nuevo código inmediatamente

### Error: "Últimos dígitos incorrectos"

**Solución:**

- Confirmar con el cliente los últimos 4 dígitos de su cuenta/tarjeta
- Verificar que estás usando el número correcto

### Error: "Asesor no encontrado o inactivo"

**Solución:**

```bash
# Crear asesor nuevamente
bun run seed:advisor
# Guardar el ID generado
```

---

## Atajos de Teclado

- **Ctrl+C** - Salir de la terminal (cierra sesión automáticamente)
- **Enter** - Confirmar selección

---

## Seguridad

✅ **Todas las acciones quedan registradas** en la base de datos (`AdvisorAuditLog`)

✅ **La sesión expira automáticamente** después de 30 minutos

✅ **Los números de tarjeta están enmascarados** (solo últimos 4 dígitos)

✅ **No se pueden realizar transferencias** ni retiros desde la terminal

---

## Ejemplo Completo de Sesión

```bash
# Terminal 1: Iniciar worker
cd worker
bun run dev

# Terminal 2: Crear asesor (solo primera vez)
cd worker
bun run seed:advisor
# Copiar el ID generado

# Terminal 3: Cliente genera código (simulado con curl)
curl -X POST http://localhost:3001/api/client/verification-code \
  -H "Authorization: Bearer eyJhbGc..." \
  | jq '.codigo'
# Output: "384521"

# Terminal 2: Iniciar terminal de asesor
bun run terminal:asesor

# Ingresar:
# - ID del asesor (del paso 2)
# - Número de cuenta del cliente
# - Últimos 4 dígitos
# - Código (del paso 3)

# Navegar por el menú usando números 1-4
```

---

## Próximas Mejoras

- [ ] Historial de transacciones
- [ ] Crear tickets de soporte
- [ ] Exportar información a PDF
- [ ] Búsqueda de clientes por email
- [ ] Dashboard con estadísticas

---

## Soporte

Para reportar problemas o sugerencias, contacta al equipo de desarrollo.
