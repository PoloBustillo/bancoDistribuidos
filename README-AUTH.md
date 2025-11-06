# 🏦 Sistema Bancario - Autenticación

Sistema de autenticación profesional para un banco con integración a PostgreSQL usando Prisma.

## ✅ Estado Actual

- ✅ Base de datos PostgreSQL configurada
- ✅ Schema de Prisma creado (Usuario, Sesion, CuentaBancaria, Transaccion)
- ✅ Migraciones aplicadas
- ✅ AuthService completo con JWT + bcrypt
- ✅ Servidor Express corriendo en puerto 3001
- ✅ Colección de Postman lista para probar

## 🚀 Inicio Rápido

### 1. Verificar que el servidor esté corriendo

```bash
cd /Users/dou1013/Banco/backend
bun src/servidor.ts
```

Deberías ver:
```
🏦 Servidor bancario iniciado en puerto 3001
📍 Endpoints disponibles:
   POST /api/auth/register - Registrar usuario
   POST /api/auth/login - Iniciar sesión
   POST /api/auth/logout - Cerrar sesión
   GET  /api/auth/me - Perfil del usuario
   POST /api/auth/change-password - Cambiar contraseña
   GET  /api/health - Estado del servidor
```

### 2. Probar con cURL

#### Registrar un usuario
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan Pérez",
    "email": "juan@demo.com",
    "password": "password123"
  }'
```

Respuesta:
```json
{
  "mensaje": "Usuario registrado exitosamente. Cuenta bancaria creada.",
  "usuario": {
    "id": "uuid",
    "nombre": "Juan Pérez",
    "email": "juan@demo.com"
  },
  "cuenta": {
    "numeroCuenta": "1234-5678-9012",
    "saldo": 0
  }
}
```

#### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "juan@demo.com",
    "password": "password123"
  }'
```

Respuesta:
```json
{
  "mensaje": "Login exitoso",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": "uuid",
    "nombre": "Juan Pérez",
    "email": "juan@demo.com"
  },
  "cuentas": [
    {
      "numeroCuenta": "1234-5678-9012",
      "saldo": 0
    }
  ]
}
```

#### Ver mi perfil (requiere token)
```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

### 3. Usar Postman

1. Importa la colección: `/Users/dou1013/Banco/postman/banco-auth.postman_collection.json`
2. La colección incluye:
   - ✅ Registrar Usuario
   - ✅ Login (guarda automáticamente el token)
   - ✅ Mi Perfil (usa el token guardado)
   - ✅ Cambiar Password
   - ✅ Logout
   - ✅ Health Check

## 🗄️ Base de Datos

### Configuración (.env)
```env
DATABASE_URL="postgresql://dbstudent:fcc@01@146.190.119.145:5432/banco?schema=public"
JWT_SECRET="B4nc0S3cur3_2024_P0l0Bust1ll0_JWT_S3cr3t_K3y_R4nd0m_H4sh_9876543210"
PORT=3001
```

### Modelos de Prisma

#### Usuario
- `id`: UUID único
- `nombre`: Nombre completo
- `email`: Email único (para login)
- `passwordHash`: Password hasheado con bcrypt
- `createdAt`, `updatedAt`: Timestamps

#### Sesion
- `id`: UUID único
- `usuarioId`: Relación con Usuario
- `jti`: JWT ID único (para invalidar tokens)
- `socketId`: Opcional para WebSocket
- `expiresAt`: Fecha de expiración (24 horas)

#### CuentaBancaria
- `id`: UUID único
- `numeroCuenta`: Formato XXXX-XXXX-XXXX (único)
- `titularCuenta`: Nombre del titular
- `saldo`: Saldo actual
- `usuarioId`: Relación con Usuario
- `estado`: ACTIVA, BLOQUEADA, CERRADA
- `version`: Control de concurrencia optimista

#### Transaccion
- `id`: UUID único
- `tipo`: DEPOSITO, RETIRO, TRANSFERENCIA
- `monto`: Cantidad de dinero
- `cuentaOrigenId`, `cuentaDestinoId`: Cuentas involucradas
- `descripcion`: Descripción opcional
- `estado`: COMPLETADA, PENDIENTE, FALLIDA
- `referencia`: Número de confirmación

## 🔒 Características de Seguridad

### AuthService

1. **Registro de Usuario**
   - Valida que el email no exista
   - Password mínimo 8 caracteres
   - Hash con bcrypt (10 rounds)
   - Crea usuario + cuenta bancaria en transacción atómica
   - Genera número de cuenta único automáticamente

2. **Login**
   - Valida email y password
   - Compara hash con bcrypt
   - Genera JWT con expiración de 24h
   - Crea sesión en BD con JTI único
   - Retorna usuario + cuentas + token

3. **Verificación de Token**
   - Valida firma JWT
   - Verifica que la sesión exista en BD
   - Verifica que no haya expirado
   - Auto-limpia sesiones expiradas

4. **Logout**
   - Puede cerrar sesión específica (con JTI)
   - O cerrar todas las sesiones del usuario

5. **Cambio de Password**
   - Valida password actual
   - Requiere mínimo 8 caracteres
   - Invalida TODAS las sesiones (fuerza re-login)

6. **Limpieza Automática**
   - Cada hora elimina sesiones expiradas
   - Mantiene la BD limpia

## 📝 Comandos Útiles

```bash
# Iniciar servidor
bun src/servidor.ts

# Ver la base de datos con Prisma Studio
bun db:studio

# Crear nueva migración
bun db:migrate

# Regenerar cliente de Prisma
bun db:generate

# Ver logs de la base de datos
bunx prisma studio
```

## 🎯 Próximos Pasos

- [ ] Agregar endpoints de transacciones
- [ ] Implementar transferencias bancarias
- [ ] Agregar gestión de tarjetas
- [ ] Implementar préstamos
- [ ] Agregar notificaciones
- [ ] WebSocket para actualizaciones en tiempo real

## 🐛 Troubleshooting

### El servidor no inicia
```bash
# Verificar que PostgreSQL esté accesible
psql postgresql://dbstudent:fcc@01@146.190.119.145:5432/banco

# Regenerar cliente de Prisma
bunx prisma generate
```

### Error de conexión a BD
- Verifica que DATABASE_URL en `.env` sea correcta
- Verifica que el servidor PostgreSQL esté corriendo
- Verifica que las credenciales sean correctas

### Errores de migración
```bash
# Resetear BD (¡CUIDADO: Borra todos los datos!)
bunx prisma migrate reset --force

# Crear nueva migración
bunx prisma migrate dev --name nombre_migracion
```

---

**Autor**: Polo Bustillo  
**Fecha**: Noviembre 2024  
**Stack**: Bun + TypeScript + Express + Prisma + PostgreSQL + JWT
