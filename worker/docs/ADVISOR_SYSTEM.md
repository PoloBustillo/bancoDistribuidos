# Sistema de Asesores Bancarios

## Descripción General

El sistema de asesores permite que empleados bancarios (pre-autenticados) accedan a información de clientes después de verificar su identidad mediante:
1. Últimos 4 dígitos de cuenta o tarjeta
2. Código temporal de 6 dígitos generado por el cliente

**Características de seguridad:**
- ✅ Sesiones independientes (no invalidan sesiones de clientes)
- ✅ Scope limitado (solo lectura por defecto)
- ✅ TTL corto (30 minutos)
- ✅ Auditoría completa de todas las acciones
- ✅ Tokens JWT separados con claims específicos
- ✅ Códigos de verificación hasheados y con expiración

---

## Modelos de Base de Datos

### Asesor
```prisma
model Asesor {
  id        String   @id @default(uuid())
  nombre    String
  email     String   @unique
  codigo    String   @unique // Código de empleado
  activo    Boolean  @default(true)
  createdAt DateTime @default(now())
}
```

### VerificationCode
```prisma
model VerificationCode {
  id        String   @id @default(uuid())
  usuarioId String
  codeHash  String   // Hash bcrypt del código
  expiresAt DateTime // Expira en 10 minutos
  usado     Boolean  @default(false)
}
```

### AsesorSesion
```prisma
model AsesorSesion {
  id                    String   @id @default(uuid())
  asesorId              String
  jti                   String   @unique
  impersonatedUsuarioId String   // Cliente que se está atendiendo
  scope                 String   // Permisos
  expiresAt             DateTime // Expira en 30 minutos
}
```

### AdvisorAuditLog
```prisma
model AdvisorAuditLog {
  id         String   @id @default(uuid())
  asesorId   String?
  usuarioId  String?
  operacion  String   // Ej: "VIEW_BALANCE"
  resource   String?  // Recurso accedido
  metadata   Json?
  createdAt  DateTime @default(now())
}
```

---

## Flujo de Operación

### 1. Cliente genera código de verificación

**Endpoint:** `POST /api/client/verification-code`

**Headers:**
```
Authorization: Bearer <client_jwt>
```

**Response:**
```json
{
  "message": "Código generado exitosamente. Proporcione este código al asesor.",
  "codigo": "384521",
  "expiresIn": "10 minutos"
}
```

El cliente muestra este código al asesor (verbalmente o en pantalla).

---

### 2. Asesor verifica al cliente

**Endpoint:** `POST /api/advisor/verify-client`

**Body:**
```json
{
  "asesorId": "uuid-del-asesor",
  "numeroRecurso": "1234-5678-9012",
  "ultimosDigitos": "9012",
  "codigo": "384521"
}
```

**Response exitoso:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": "uuid-del-cliente",
    "nombre": "María González",
    "email": "maria@example.com",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Token claims:**
```json
{
  "sub": "uuid-del-asesor",
  "role": "ASESOR",
  "impersonatedUser": "uuid-del-cliente",
  "scope": ["advisor:view", "advisor:ticket"],
  "jti": "session-uuid",
  "exp": 1704460200,
  "iat": 1704458400
}
```

---

### 3. Asesor consulta información del cliente

Todos los siguientes endpoints requieren el token del asesor en el header:
```
Authorization: Bearer <advisor_jwt>
```

#### Ver cuentas del cliente

**Endpoint:** `GET /api/advisor/client/:usuarioId/accounts`

**Response:**
```json
[
  {
    "cuentaId": "uuid",
    "numeroCuenta": "1234-5678-9012",
    "nombre": "Cuenta de María González",
    "saldo": 5000.50,
    "tipoCuenta": "CHEQUES",
    "estado": "ACTIVA",
    "rol": "TITULAR"
  }
]
```

#### Ver tarjetas del cliente

**Endpoint:** `GET /api/advisor/client/:usuarioId/cards`

**Response:**
```json
[
  {
    "id": "uuid",
    "numeroTarjeta": "****-****-****-3456",
    "tipoTarjeta": "DEBITO",
    "estado": "ACTIVA",
    "limiteDiario": 1000,
    "fechaExpiracion": "2027-12-31T00:00:00Z",
    "cuenta": {
      "numeroCuenta": "1234-5678-9012",
      "nombre": "Cuenta de María González"
    }
  }
]
```

#### Ver saldo de una cuenta específica

**Endpoint:** `GET /api/advisor/client/:usuarioId/account/:cuentaId/balance`

**Response:**
```json
{
  "cuentaId": "uuid",
  "numeroCuenta": "1234-5678-9012",
  "nombre": "Cuenta de María González",
  "saldo": 5000.50,
  "tipoCuenta": "CHEQUES",
  "estado": "ACTIVA"
}
```

---

### 4. Asesor cierra sesión

**Endpoint:** `POST /api/advisor/logout`

**Headers:**
```
Authorization: Bearer <advisor_jwt>
```

**Response:**
```json
{
  "message": "Sesión cerrada exitosamente"
}
```

---

## Operaciones Permitidas vs Prohibidas

### ✅ Permitidas (implementadas)
- Ver cuentas del cliente
- Ver tarjetas del cliente (números enmascarados)
- Ver saldos de cuentas
- Cerrar sesión propia

### ✅ Permitidas (por implementar según necesidad)
- Ver historial de transacciones (últimas N)
- Crear tickets de soporte
- Solicitar cambios (requieren aprobación)
- Enviar notificaciones al cliente

### ❌ Prohibidas
- Transferir fondos
- Retirar dinero
- Modificar credenciales del cliente
- Ver CVV completo
- Revocar sesiones del cliente
- Crear/eliminar cuentas sin workflow de aprobación

---

## Auditoría

Todas las acciones del asesor se registran en `AdvisorAuditLog`:

```typescript
{
  asesorId: "uuid-del-asesor",
  usuarioId: "uuid-del-cliente",
  operacion: "VIEW_BALANCE",
  resource: "cuenta-uuid",
  metadata: { saldo: 5000.50 },
  ip: "192.168.1.100",
  userAgent: "Mozilla/5.0...",
  createdAt: "2024-01-15T10:35:00Z"
}
```

**Operaciones registradas:**
- `VERIFY_CLIENT_SUCCESS` - Verificación exitosa
- `VERIFY_CLIENT_FAILED` - Verificación fallida (con razón)
- `VIEW_ACCOUNTS` - Consulta de cuentas
- `VIEW_CARDS` - Consulta de tarjetas
- `VIEW_BALANCE` - Consulta de saldo

---

## Configuración y Setup

### 1. Generar esquema de Prisma

```bash
cd worker
bun run prisma:generate
```

### 2. Crear migración (cuando DB esté disponible)

```bash
bun run prisma:migrate:dev
```

### 3. Crear asesor de prueba

```bash
bun run seed:advisor
```

Esto creará un asesor con:
- Nombre: Juan Pérez
- Email: juan.perez@banco.com
- Código: ASR001

Guarda el `id` generado para usarlo en las pruebas.

---

## Ejemplo de Flujo Completo

### Paso 1: Cliente genera código
```bash
curl -X POST http://localhost:3001/api/client/verification-code \
  -H "Authorization: Bearer <client_token>" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "codigo": "384521",
  "expiresIn": "10 minutos"
}
```

### Paso 2: Asesor verifica (con código del cliente)
```bash
curl -X POST http://localhost:3001/api/advisor/verify-client \
  -H "Content-Type: application/json" \
  -d '{
    "asesorId": "<asesor-uuid>",
    "numeroRecurso": "1234-5678-9012",
    "ultimosDigitos": "9012",
    "codigo": "384521"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "usuario": { "id": "...", "nombre": "María" }
}
```

### Paso 3: Asesor consulta cuentas
```bash
curl -X GET http://localhost:3001/api/advisor/client/<usuario-id>/accounts \
  -H "Authorization: Bearer <advisor_token>"
```

---

## Seguridad

### Códigos de Verificación
- ✅ Hasheados con bcrypt (nunca en texto plano)
- ✅ Expiran en 10 minutos
- ✅ Un solo uso (se marcan como `usado`)
- ✅ Invalidación automática al generar nuevo código

### Sesiones de Asesor
- ✅ TTL corto (30 minutos)
- ✅ Scope limitado por defecto
- ✅ JWT con claims específicos
- ✅ Revocables manualmente
- ✅ No afectan sesiones de clientes

### Rate Limiting (recomendado implementar)
- Limitar intentos de verificación (3-5 por minuto)
- Bloquear asesor tras N intentos fallidos
- Alertas automáticas por patrones sospechosos

### Notificaciones (recomendado implementar)
- Enviar push/email al cliente cuando un asesor accede
- Incluir: nombre del asesor, fecha/hora, IP
- Permitir al cliente reportar acceso no autorizado

---

## Testing

### Test de generación de código
```typescript
// Como cliente autenticado
const response = await fetch('/api/client/verification-code', {
  method: 'POST',
  headers: { Authorization: `Bearer ${clientToken}` }
});
const { codigo } = await response.json();
// codigo es string de 6 dígitos
```

### Test de verificación exitosa
```typescript
const response = await fetch('/api/advisor/verify-client', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    asesorId: advisorUuid,
    numeroRecurso: '1234-5678-9012',
    ultimosDigitos: '9012',
    codigo: '384521'
  })
});
const { token, usuario } = await response.json();
```

### Test de verificación fallida
```typescript
// Código incorrecto
const response = await fetch('/api/advisor/verify-client', {
  method: 'POST',
  body: JSON.stringify({ /* código wrong */ })
});
// Esperado: 400 Bad Request
```

---

## Próximas Mejoras

1. **Rate limiting** en endpoints de verificación
2. **Notificaciones push** al cliente cuando asesor accede
3. **Dashboard de auditoría** para supervisores
4. **Permisos granulares** (diferentes roles de asesores)
5. **Workflow de aprobación** para operaciones sensibles
6. **Integración con MFA** corporativa para asesores
7. **Alertas automáticas** por patrones anómalos

---

## Troubleshooting

### Error: "Código de verificación inválido o expirado"
- Verificar que el código no ha expirado (10 min)
- Verificar que no se haya usado ya
- Generar nuevo código si es necesario

### Error: "Últimos dígitos incorrectos"
- Confirmar con el cliente los últimos 4 dígitos
- Verificar que se está usando el número correcto (cuenta vs tarjeta)

### Error: "Asesor no encontrado o inactivo"
- Verificar que el asesor existe en la BD
- Verificar campo `activo = true`
- Crear asesor con `bun run seed:advisor`

---

## Contacto y Soporte

Para más información sobre el sistema de asesores, contacta al equipo de desarrollo.
