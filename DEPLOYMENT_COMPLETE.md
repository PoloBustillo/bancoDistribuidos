# 🚀 Deployment Completo - Sistema Bancario Distribuido con Notificaciones

## 📊 Resumen de Cambios

He integrado completamente el **microservicio de notificaciones** en el workflow de GitHub Actions y docker-compose.

### ✅ Cambios Realizados

| Archivo | Cambios |
|---------|---------|
| `.github/workflows/deploy-docker.yml` | ✅ Agregado build y push de imagen de notificaciones a GHCR |
| `docker-compose.yml` | ✅ Agregados servicios: RabbitMQ + Notificaciones |
| `microservicios/notificaciones/src/index.ts` | ✅ Agregado endpoint `/api/health` |
| `.env.example` | ✅ Documentadas variables de RabbitMQ y Resend |

---

## 🏗️ Arquitectura del Deployment

```
GitHub Actions (CI/CD)
│
├─ Build Images → Push to GHCR
│  ├─ coordinador:latest
│  ├─ worker:latest
│  └─ notificaciones:latest  ← NUEVO
│
└─ Deploy to Server
   │
   └─ Docker Compose
      ├─ coordinador (puerto 4000)
      ├─ worker-1 (puerto 3001)
      ├─ worker-2 (puerto 3002)
      ├─ worker-3 (puerto 3003)
      ├─ rabbitmq (puertos 5672, 15672)  ← NUEVO
      └─ notificaciones (puertos 4001, 50051)  ← NUEVO
```

---

## 🔄 Flujo de Deployment Automático

### 1. Trigger (Inicio)
```bash
git push origin main
# O ejecutar manualmente desde GitHub Actions tab
```

### 2. Build & Push (GitHub Actions)
```yaml
- Build coordinador → Push a ghcr.io
- Build worker → Push a ghcr.io
- Build notificaciones → Push a ghcr.io  # NUEVO
```

### 3. Deploy (SSH al servidor)
```bash
- Pull latest images desde GHCR
- docker-compose down
- docker-compose up -d
  ├─ Inicia RabbitMQ (con health check)
  ├─ Espera a que RabbitMQ esté healthy
  ├─ Inicia workers (conectados a RabbitMQ)
  └─ Inicia microservicio de notificaciones
```

### 4. Health Checks
```bash
✅ Coordinador (puerto 4000)
✅ Workers (puertos 3001, 3002, 3003)
✅ RabbitMQ (puerto 5672)
✅ Notificaciones (puerto 4001)
```

---

## ⚙️ Configuración Requerida

### 1. Variables de GitHub Secrets

Ya están configurados:
- `SSH_HOST` - IP del servidor
- `SSH_USERNAME` - Usuario SSH
- `SSH_PRIVATE_KEY` - Clave privada SSH
- `SSH_PORT` - Puerto SSH (opcional, default 22)

### 2. Variables en el Servidor (.env)

Debes agregar al archivo `.env` en el servidor:

```bash
# Conectarse al servidor
ssh dbstudent@146.190.119.145

# Editar .env
cd ~/banco-distribuido
nano .env

# Agregar estas líneas:
RABBITMQ_USER=user
RABBITMQ_PASS=password
RABBITMQ_URL=amqp://user:password@rabbitmq:5672
NOTIF_QUEUE=notificaciones

# API Key de Resend (obtener en https://resend.com)
RESEND_API_KEY=tu_api_key_real_aqui
RESEND_FROM="Banco <no-reply@psicologopuebla.com>"
```

---

## 🚀 Cómo Hacer el Deployment

### Opción A: Automático (Push a main)

```bash
# Hacer tus cambios
git add .
git commit -m "feat: integrar microservicio de notificaciones"
git push origin main

# GitHub Actions se ejecutará automáticamente
# Puedes ver el progreso en:
# https://github.com/PoloBustillo/bancoDistribuidos/actions
```

### Opción B: Manual (GitHub UI)

1. Ir a https://github.com/PoloBustillo/bancoDistribuidos/actions
2. Click en "Deploy Banco Distribuido (Docker)"
3. Click en "Run workflow"
4. Seleccionar branch `main`
5. Click en "Run workflow"

### Opción C: Deployment Local al Servidor

Si prefieres deployar manualmente sin GitHub Actions:

```bash
# Desde tu máquina local
cd /c/Users/leopo/OneDrive/Escritorio/BUAP/DISTRIBUIDOS/bancoDistribuidos

# Ejecutar script de deployment
bash scripts/deploy-notificaciones.sh

# O usar el script de PowerShell
.\scripts\manage-notificaciones.ps1 deploy
```

---

## 🔍 Verificar el Deployment

### Desde GitHub Actions

1. Ver logs en tiempo real:
   - Ve a GitHub Actions tab
   - Click en el workflow en ejecución
   - Expande los steps para ver logs

2. Verificar imágenes publicadas:
   - Ve a https://github.com/PoloBustillo?tab=packages
   - Deberías ver 3 paquetes:
     - `bancodistribuidos-coordinador`
     - `bancodistribuidos-worker`
     - `bancodistribuidos-notificaciones`

### Desde el Servidor

```bash
# Conectarse
ssh dbstudent@146.190.119.145

# Ver contenedores corriendo
cd ~/banco-distribuido
docker-compose ps

# Deberías ver:
# - banco-coordinador
# - banco-worker-1
# - banco-worker-2
# - banco-worker-3
# - banco-rabbitmq          ← NUEVO
# - banco-notificaciones    ← NUEVO

# Ver logs
docker-compose logs -f notificaciones
docker-compose logs -f rabbitmq

# Ver estado de RabbitMQ
docker-compose exec rabbitmq rabbitmq-diagnostics ping
```

### Desde tu Navegador

1. **RabbitMQ Management UI:**
   ```
   http://146.190.119.145:15672
   Usuario: user
   Contraseña: password
   ```

2. **Health Checks:**
   ```
   http://146.190.119.145:4000/health  (Coordinador)
   http://146.190.119.145:3001/api/health  (Worker 1)
   http://146.190.119.145:4001/api/health  (Notificaciones)
   ```

---

## 🧪 Probar el Sistema Completo

### 1. Login
```bash
curl -X POST http://146.190.119.145:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"tu@email.com",
    "password":"tupassword"
  }'
```

### 2. Hacer un Retiro (debería enviar email)
```bash
curl -X POST http://146.190.119.145:3001/api/banco/retirar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -d '{
    "cuentaId":"uuid-de-tu-cuenta",
    "monto":100
  }'
```

### 3. Verificar en RabbitMQ
- Ir a http://146.190.119.145:15672
- Ver Queues → "notificaciones"
- Verificar mensajes procesados

### 4. Verificar Email
- Revisar tu bandeja de entrada
- Deberías recibir un email con detalles del retiro

---

## 📋 Subdominios (Opcional)

Si quieres usar subdominios en lugar de IPs:

### Configurar en Caddy

```bash
# Conectarse al servidor
ssh dbstudent@146.190.119.145

# Editar Caddyfile
nano /etc/caddy/Caddyfile

# Agregar:
rabbitmq.psic-danieladiaz.com {
    reverse_proxy localhost:15672
}

notificaciones.psic-danieladiaz.com {
    reverse_proxy localhost:4001
}

# Recargar Caddy
sudo systemctl reload caddy
```

### Configurar DNS

En tu proveedor de DNS (DigitalOcean, Cloudflare, etc.):

```
Tipo  Nombre          Valor              TTL
A     rabbitmq        146.190.119.145    300
A     notificaciones  146.190.119.145    300
```

Luego acceder a:
- https://rabbitmq.psic-danieladiaz.com
- https://notificaciones.psic-danieladiaz.com

---

## 🐛 Troubleshooting

### Error: "Image not found" al hacer pull

**Solución:** Las imágenes deben ser públicas o el servidor debe tener acceso a GHCR.

```bash
# Hacer las imágenes públicas en GitHub:
# 1. Ve a https://github.com/PoloBustillo?tab=packages
# 2. Click en cada paquete
# 3. Package settings → Change visibility → Public
```

### Error: RabbitMQ no se conecta

```bash
# Ver logs
docker-compose logs rabbitmq

# Verificar health
docker-compose exec rabbitmq rabbitmq-diagnostics status

# Reiniciar RabbitMQ
docker-compose restart rabbitmq
```

### Workers no envían notificaciones

```bash
# Verificar que workers tengan RABBITMQ_URL
docker-compose exec worker-1 env | grep RABBITMQ

# Ver logs de workers
docker-compose logs worker-1 | grep -i rabbit

# Verificar cola en RabbitMQ UI
# http://146.190.119.145:15672 → Queues
```

### Emails no se envían

```bash
# Verificar logs del microservicio
docker-compose logs notificaciones

# Verificar API key de Resend
docker-compose exec notificaciones env | grep RESEND

# Probar envío manual
curl -X POST http://localhost:4001/api/notificaciones/send \
  -H "Content-Type: application/json" \
  -d '{
    "to":"tu@email.com",
    "subject":"Test",
    "message":"Prueba"
  }'
```

---

## 📊 Monitoreo

### Ver estado de todos los servicios
```bash
ssh dbstudent@146.190.119.145 "cd ~/banco-distribuido && docker-compose ps"
```

### Ver logs en tiempo real
```bash
ssh dbstudent@146.190.119.145 "cd ~/banco-distribuido && docker-compose logs -f"
```

### Ver consumo de recursos
```bash
ssh dbstudent@146.190.119.145 "docker stats"
```

### Ver colas de RabbitMQ
```bash
ssh dbstudent@146.190.119.145 "docker-compose exec rabbitmq rabbitmqctl list_queues"
```

---

## ✅ Checklist de Deployment

Antes de hacer el deployment, verifica:

- [ ] Archivo `.env` configurado en el servidor
- [ ] `RESEND_API_KEY` configurada con key válida
- [ ] `DATABASE_URL` apunta a tu base de datos
- [ ] Puertos 5672, 15672, 4001, 50051 disponibles
- [ ] Imágenes Docker publicadas en GHCR (o públicas)
- [ ] Secrets de GitHub Actions configurados
- [ ] Dominio verificado en Resend (si usas email personalizado)

---

## 🎯 Próximos Pasos

1. **Hacer push a main** para deployar automáticamente
2. **Verificar** que todos los servicios estén UP
3. **Probar** un retiro para verificar que llegue el email
4. **Monitorear** RabbitMQ UI para ver mensajes
5. **Configurar subdominios** (opcional)

---

¿Listo para hacer el deployment? 🚀
