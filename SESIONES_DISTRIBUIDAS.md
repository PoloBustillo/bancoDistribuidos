# 🔐 Gestión de Sesiones en Sistema Distribuido

## 📋 Problema Original

**Pregunta**: Si el auth está en los workers, ¿cómo invalidan su sesión si se conecta en otro nodo?

**Respuesta**: Usando una **base de datos centralizada compartida** + configuración de **sesión única**.

## ✅ Solución Implementada

### 1. Base de Datos Compartida

Todos los workers comparten la misma base de datos PostgreSQL:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Worker 1   │     │  Worker 2   │     │  Worker 3   │
│  Port 3001  │     │  Port 3002  │     │  Port 3003  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┴───────────────────┘
                           │
                    ┌──────▼──────┐
                    │  PostgreSQL │
                    │   (Sesiones │
                    │  compartidas)│
                    └─────────────┘
```

**Ventaja**: Todos los workers ven las mismas sesiones en tiempo real.

### 2. Modo Sesión Única (SINGLE_SESSION=true)

Por defecto, el sistema invalida sesiones anteriores cuando el usuario hace login:

```typescript
// En worker/src/auth/authService.ts

if (SINGLE_SESSION) {
  // Eliminar todas las sesiones anteriores del usuario
  await prisma.sesion.deleteMany({
    where: { usuarioId: usuario.id },
  });
}

// Crear nueva sesión
await prisma.sesion.create({
  data: { usuarioId, jti, expiresAt }
});
```

## 🎯 Flujos de Ejemplo

### Escenario 1: Usuario cambia de worker

```
1. Usuario hace login en Worker 1 (Puerto 3001)
   ✅ Token JWT generado con jti="abc-123"
   ✅ Sesión guardada en BD: { jti: "abc-123", usuarioId: "user-1" }

2. Usuario hace login en Worker 2 (Puerto 3002)
   🔒 Worker 2 ELIMINA sesión anterior (jti="abc-123")
   ✅ Nuevo token JWT con jti="def-456"
   ✅ Nueva sesión en BD: { jti: "def-456", usuarioId: "user-1" }

3. Usuario intenta usar token antiguo en Worker 1
   ❌ Worker 1 verifica sesión: jti="abc-123" NO existe en BD
   ❌ Respuesta: 401 Unauthorized - "Sesión inválida"

4. Usuario usa nuevo token en cualquier worker
   ✅ Todos los workers verifican contra la misma BD
   ✅ Sesión válida encontrada: jti="def-456"
```

### Escenario 2: Múltiples dispositivos (SINGLE_SESSION=false)

Si configuras `SINGLE_SESSION=false` en `.env`:

```
1. Usuario login desde móvil (Worker 1)
   ✅ Token JWT jti="mobile-123"
   ✅ Sesión creada

2. Usuario login desde web (Worker 2)
   ✅ Token JWT jti="web-456"
   ✅ Segunda sesión creada (NO elimina la anterior)

3. Ambos tokens funcionan simultáneamente
   ✅ Usuario puede operar desde móvil Y web
```

## 🔍 Verificación de Sesiones

Cada request autenticado verifica la sesión:

```typescript
// En middleware de autenticación
async function verificarToken(token: string) {
  const payload = jwt.verify(token, JWT_SECRET);
  
  // Verificar que la sesión EXISTA en la BD compartida
  const sesion = await prisma.sesion.findFirst({
    where: {
      usuarioId: payload.usuarioId,
      jti: payload.jti,
      expiresAt: { gte: new Date() }  // No expirada
    }
  });
  
  if (!sesion) {
    throw new Error("Sesión inválida o expirada");
  }
  
  return payload;
}
```

## 📊 Tabla de Sesiones

```sql
-- Modelo Prisma
model Sesion {
  id         String   @id @default(cuid())
  usuarioId  String
  jti        String   -- JWT ID único
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  
  usuario    Usuario  @relation(fields: [usuarioId])
  
  @@index([usuarioId])
  @@index([expiresAt])
}
```

## 🎛️ Configuración

### Variables de Entorno (.env)

```bash
# Base de datos compartida (TODOS los workers usan la misma)
DATABASE_URL="postgresql://dbstudent:fcc@01@146.190.119.145:5432/banco"

# Secret compartido (TODOS los workers usan el mismo para JWT)
JWT_SECRET="B4nc0S3cur3_2024_D1str1but3d_JWT_S3cr3t"

# Modo de sesión
SINGLE_SESSION=true   # Solo 1 sesión activa por usuario (MÁS SEGURO)
# SINGLE_SESSION=false  # Múltiples sesiones permitidas
```

### ⚠️ IMPORTANTE: JWT_SECRET debe ser igual en todos los workers

```bash
# ✅ CORRECTO - Mismo secret en todos los workers
Worker 1: JWT_SECRET="B4nc0S3cur3_2024..."
Worker 2: JWT_SECRET="B4nc0S3cur3_2024..."
Worker 3: JWT_SECRET="B4nc0S3cur3_2024..."

# ❌ INCORRECTO - Secrets diferentes
Worker 1: JWT_SECRET="secret1"
Worker 2: JWT_SECRET="secret2"  # ❌ No podrá verificar tokens de Worker 1
```

## 🧪 Pruebas con Postman

### Prueba 1: Sesión Única (SINGLE_SESSION=true)

```bash
# 1. Login en Worker 1 (Puerto 3001)
POST http://localhost:3001/api/auth/login
{
  "email": "juan@example.com",
  "password": "password123"
}
# Respuesta: { "token": "eyJhbGc...TOKEN_1" }

# 2. Guardar TOKEN_1 y hacer una operación
GET http://localhost:3001/api/auth/me
Authorization: Bearer TOKEN_1
# ✅ Funciona

# 3. Login en Worker 2 (Puerto 3002)
POST http://localhost:3002/api/auth/login
{
  "email": "juan@example.com",
  "password": "password123"
}
# Respuesta: { "token": "eyJhbGc...TOKEN_2" }
# 🔒 Logs del Worker 2: "Sesiones previas invalidadas para usuario juan@example.com (1)"

# 4. Intentar usar TOKEN_1 de nuevo
GET http://localhost:3001/api/auth/me
Authorization: Bearer TOKEN_1
# ❌ Error 401: "Sesión inválida o expirada"

# 5. Usar TOKEN_2 en cualquier worker
GET http://localhost:3003/api/auth/me
Authorization: Bearer TOKEN_2
# ✅ Funciona en CUALQUIER worker
```

### Prueba 2: Múltiples Sesiones (SINGLE_SESSION=false)

```bash
# Cambiar .env: SINGLE_SESSION=false
# Reiniciar workers

# 1. Login en Worker 1
POST http://localhost:3001/api/auth/login
# Respuesta: TOKEN_1

# 2. Login en Worker 2
POST http://localhost:3002/api/auth/login
# Respuesta: TOKEN_2

# 3. Ambos tokens funcionan
GET http://localhost:3001/api/auth/me
Authorization: Bearer TOKEN_1
# ✅ Funciona

GET http://localhost:3002/api/auth/me
Authorization: Bearer TOKEN_2
# ✅ También funciona

# Usuario puede usar ambos tokens simultáneamente
```

## 🔒 Seguridad

### Ventajas de SINGLE_SESSION=true (Recomendado)

✅ **Más seguro**: Si alguien roba un token, el usuario puede invalidarlo haciendo login de nuevo  
✅ **Control total**: Solo 1 sesión activa a la vez  
✅ **Logout automático**: Login en nuevo dispositivo = logout automático del anterior  
✅ **Auditoría simple**: Siempre hay máximo 1 sesión por usuario  

### Cuándo usar SINGLE_SESSION=false

⚠️ **Conveniencia**: Usuario puede estar en móvil + laptop + tablet  
⚠️ **UX mejor**: No cierra sesión en otros dispositivos  
⚠️ **Riesgo mayor**: Tokens robados siguen siendo válidos hasta expiración  

## 🛠️ Otros Mecanismos de Sincronización

### Opción Alternativa 1: Redis (para alta escala)

Si tienes MUCHOS workers y alto tráfico:

```typescript
import Redis from 'ioredis';

const redis = new Redis();

// Guardar sesión en Redis (más rápido que BD)
await redis.setex(
  `session:${jti}`,
  86400,  // 24 horas
  JSON.stringify({ usuarioId, email })
);

// Verificar sesión
const sesion = await redis.get(`session:${jti}`);
```

### Opción Alternativa 2: Coordinador maneja auth

Centralizar autenticación en el coordinador:

```
┌─────────────┐     ┌─────────────┐
│  Worker 1   │────▶│ Coordinador │◀────┌─────────────┐
│  (Solo BD)  │     │   (Auth)    │     │  Worker 2   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │ Sesiones en │
                    │   memoria   │
                    └─────────────┘
```

Pero con BD compartida **NO es necesario** (solución actual es suficiente).

## 📈 Estadísticas de Sesiones

Agregar endpoint para monitorear:

```typescript
// GET /api/admin/sessions
app.get('/api/admin/sessions', async (req, res) => {
  const stats = await prisma.sesion.groupBy({
    by: ['usuarioId'],
    _count: { jti: true }
  });
  
  res.json({
    totalSesiones: await prisma.sesion.count(),
    usuariosConectados: stats.length,
    sesionesPorUsuario: stats
  });
});
```

## 🎯 Resumen

| Aspecto | Solución Implementada |
|---------|----------------------|
| **Almacenamiento** | PostgreSQL compartida |
| **Sincronización** | Automática (misma BD) |
| **Invalidación** | En login (si SINGLE_SESSION=true) |
| **Verificación** | Cada request consulta BD |
| **Performance** | Buena (índices en BD) |
| **Escalabilidad** | Alta (BD soporta muchos workers) |
| **Seguridad** | Alta (sesión única por defecto) |

---

✅ **Conclusión**: El sistema ya tiene sesiones sincronizadas entre workers usando la base de datos compartida. La configuración `SINGLE_SESSION=true` asegura que el login en un worker invalide automáticamente las sesiones anteriores del usuario en cualquier otro worker.
