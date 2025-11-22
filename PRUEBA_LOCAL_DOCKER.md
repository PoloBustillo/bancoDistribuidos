# 🧪 Prueba Local con Docker - Guía Completa

## 📋 Requisitos Previos

- Docker Desktop instalado y corriendo
- Git Bash o PowerShell
- Puertos disponibles: 3001-3003, 4000, 4001, 5672, 15672, 50051

---

## 🚀 Opción 1: Usando docker-compose.dev.yml (Recomendado para desarrollo)

### Paso 1: Preparar el entorno

```bash
# Abrir terminal en la raíz del proyecto
cd c:\Users\leopo\OneDrive\Escritorio\BUAP\DISTRIBUIDOS\bancoDistribuidos

# Crear archivo .env local (si no existe)
cp .env.example .env

# Editar .env con tu configuración
notepad .env
```

### Paso 2: Configurar .env

```env
# Base de datos (apunta a tu PostgreSQL local o remoto)
DATABASE_URL=postgresql://dbstudent:fcc@01@146.190.119.145:5432/banco

# JWT Secret
JWT_SECRET=tu_secreto_super_seguro_local

# CORS
CORS_ORIGIN=http://localhost:3000

# RabbitMQ
RABBITMQ_USER=user
RABBITMQ_PASS=password
RABBITMQ_URL=amqp://user:password@rabbitmq:5672
NOTIF_QUEUE=notificaciones

# Resend
RESEND_API_KEY=re_9tqqBrPs_8ESmesJHa6D4G6UdDv8Zfo53
RESEND_FROM="Banco <no-reply@psicologopuebla.com>"

# Environment
NODE_ENV=development
```

### Paso 3: Levantar servicios

```bash
# Levantar todo el stack
docker-compose -f docker-compose.dev.yml up --build

# O en modo background (detached)
docker-compose -f docker-compose.dev.yml up -d --build

# Ver logs en tiempo real
docker-compose -f docker-compose.dev.yml logs -f
```

---

## 🚀 Opción 2: Usando docker-compose.yml (Producción local)

### Paso 1: Cambiar a modo build local

Edita `docker-compose.yml` y descomenta las secciones de build:

```yaml
# Para cada servicio, comenta "image:" y descomenta "build:"
coordinador:
  # image: ghcr.io/polobustillo/bancodistribuidos-coordinador:latest
  build:
    context: .
    dockerfile: coordinador/Dockerfile
```

### Paso 2: Levantar servicios

```bash
docker-compose up --build
```

---

## 🧪 Verificar que Todo Funciona

### 1. Ver estado de contenedores

```powershell
docker-compose ps
```

Deberías ver:
```
NAME                   STATUS
banco-coordinador      Up (healthy)
banco-worker-1         Up (healthy)
banco-worker-2         Up (healthy)
banco-worker-3         Up (healthy)
banco-rabbitmq         Up (healthy)
banco-notificaciones   Up (healthy)
```

### 2. Verificar logs

```powershell
# Todos los servicios
docker-compose logs

# Solo un servicio específico
docker-compose logs notificaciones
docker-compose logs rabbitmq
docker-compose logs worker-1

# Seguir logs en tiempo real
docker-compose logs -f notificaciones
```

### 3. Health Checks

```powershell
# Coordinador
curl http://localhost:4000/health

# Worker 1
curl http://localhost:3001/api/health

# Notificaciones
curl http://localhost:4001/api/health
```

### 4. Acceder a RabbitMQ UI

Abre en tu navegador:
```
http://localhost:15672
Usuario: user
Contraseña: password
```

---

## 🧪 Probar el Sistema Completo

### 1. Registrar un usuario

```powershell
curl -X POST http://localhost:3001/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{
    "nombre": "Test User",
    "email": "test@ejemplo.com",
    "password": "password123"
  }'
```

### 2. Login

```powershell
curl -X POST http://localhost:3001/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{
    "email": "test@ejemplo.com",
    "password": "password123"
  }'
```

Guarda el token que te devuelve.

### 3. Hacer un retiro (debería enviar email)

```powershell
# Reemplaza TU_TOKEN y UUID_CUENTA con tus valores
curl -X POST http://localhost:3001/api/banco/retirar `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer TU_TOKEN" `
  -d '{
    "cuentaId": "UUID_DE_TU_CUENTA",
    "monto": 100
  }'
```

### 4. Verificar RabbitMQ

1. Ve a http://localhost:15672
2. Click en "Queues"
3. Deberías ver la cola "notificaciones"
4. Verifica que tenga mensajes procesados

### 5. Verificar logs de notificaciones

```powershell
docker-compose logs notificaciones
```

Deberías ver:
```
notificaciones | 📧 Notificación enviada a cola: test@ejemplo.com - Retiro Realizado
notificaciones | Notificación enviada a test@ejemplo.com (RabbitMQ)
```

---

## 🛠️ Comandos Útiles

### Ver estado de contenedores
```powershell
docker-compose ps
```

### Reiniciar un servicio específico
```powershell
docker-compose restart notificaciones
docker-compose restart rabbitmq
```

### Ver logs de un servicio
```powershell
docker-compose logs -f notificaciones
```

### Ejecutar comando dentro de un contenedor
```powershell
# Ver variables de entorno
docker-compose exec worker-1 env

# Acceder a shell
docker-compose exec worker-1 sh
```

### Limpiar todo y empezar de nuevo
```powershell
# Detener y eliminar contenedores
docker-compose down

# Eliminar también volúmenes
docker-compose down -v

# Reconstruir desde cero
docker-compose up --build --force-recreate
```

### Ver consumo de recursos
```powershell
docker stats
```

---

## 🐛 Troubleshooting

### Error: "Port already in use"

```powershell
# Ver qué está usando el puerto
netstat -ano | findstr :4001

# Matar el proceso (reemplaza PID)
taskkill /PID <PID> /F
```

### Error: "Cannot connect to RabbitMQ"

```powershell
# Ver logs de RabbitMQ
docker-compose logs rabbitmq

# Reiniciar RabbitMQ
docker-compose restart rabbitmq

# Verificar que esté healthy
docker-compose ps rabbitmq
```

### Workers no se conectan a la base de datos

```powershell
# Verificar que DATABASE_URL sea correcta
docker-compose exec worker-1 env | findstr DATABASE

# Ver logs del worker
docker-compose logs worker-1
```

### Notificaciones no se envían

```powershell
# Ver logs
docker-compose logs notificaciones

# Verificar que RabbitMQ esté corriendo
docker-compose ps rabbitmq

# Verificar API key de Resend
docker-compose exec notificaciones env | findstr RESEND

# Probar endpoint directamente
curl -X POST http://localhost:4001/api/notificaciones/send `
  -H "Content-Type: application/json" `
  -d '{
    "to": "tu@email.com",
    "subject": "Prueba",
    "message": "Test desde local"
  }'
```

---

## 🎯 Verificación Final

Lista de verificación para asegurar que todo funciona:

- [ ] Todos los contenedores están "Up (healthy)"
- [ ] RabbitMQ UI accesible en http://localhost:15672
- [ ] Coordinador responde en http://localhost:4000/health
- [ ] Workers responden en puertos 3001, 3002, 3003
- [ ] Notificaciones responde en http://localhost:4001/api/health
- [ ] Puedes hacer login/registro
- [ ] Al hacer un retiro, aparece mensaje en cola de RabbitMQ
- [ ] Al hacer un retiro, llega el email (o se ve en logs)

---

## 🔄 Desarrollo con Hot Reload

Si quieres que los cambios se reflejen sin reconstruir:

```yaml
# En docker-compose.dev.yml, agregar volumes:
worker-1:
  volumes:
    - ./worker/src:/app/src
    - ./worker/package.json:/app/package.json
  command: bun --watch src/server.ts
```

---

## 📊 Monitoreo en Tiempo Real

### Ver todos los logs juntos
```powershell
docker-compose logs -f
```

### Ver logs de servicios específicos
```powershell
docker-compose logs -f coordinador worker-1 notificaciones
```

### Ver cola de RabbitMQ
```powershell
docker-compose exec rabbitmq rabbitmqctl list_queues
```

---

¿Todo listo? ¡Vamos a probarlo! 🚀
