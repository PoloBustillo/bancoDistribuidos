# 🚀 Guía de Deployment con GitHub Actions + Docker

## 📋 Requisitos Previos

1. **Cuenta GitHub** con tu repositorio
2. **Servidor** con Docker y Docker Compose instalados
3. **Acceso SSH** al servidor
4. **PostgreSQL** configurado (externo o en servidor)

---

## 🔐 Paso 1: Configurar Secrets en GitHub

Ve a tu repositorio en GitHub:

```
Settings → Secrets and variables → Actions → New repository secret
```

### Secrets Requeridos:

```bash
# Conexión SSH al Servidor
SSH_HOST=146.190.119.145
SSH_USERNAME=root
SSH_PRIVATE_KEY=<tu clave privada SSH completa>

# Base de Datos
DATABASE_URL=postgresql://dbstudent:fcc@01@146.190.119.145:5432/banco

# JWT
JWT_SECRET=B4nc0S3cur3_2024_D1str1but3d_JWT_S3cr3t
```

### 📝 Obtener SSH Key:

En tu máquina local:

```bash
cat ~/.ssh/id_rsa
```

Copia **TODO** el contenido (incluyendo `-----BEGIN` y `-----END-----`)

---

## 🐋 Paso 2: Configurar el Servidor

### 2.1 Instalar Docker (si no está instalado)

```bash
# Conectarse al servidor
ssh root@146.190.119.145

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose
apt-get update
apt-get install -y docker-compose-plugin

# Verificar
docker --version
docker compose version
```

### 2.2 Clonar el Repositorio

```bash
cd /root
git clone https://github.com/PoloBustillo/bancoDistribuidos.git
cd bancoDistribuidos
```

### 2.3 Crear archivo .env

```bash
nano .env
```

Contenido:

```env
DATABASE_URL=postgresql://dbstudent:fcc@01@146.190.119.145:5432/banco
JWT_SECRET=tu_secret_aqui
SINGLE_SESSION=true
```

---

## 🔑 Paso 3: Login a GitHub Container Registry

En el servidor:

```bash
# Crear un Personal Access Token en GitHub:
# Settings → Developer settings → Personal access tokens → Generate new token
# Permisos: read:packages

echo "TU_PAT_TOKEN" | docker login ghcr.io -u PoloBustillo --password-stdin
```

---

## 🚀 Paso 4: Deployment Inicial Manual

```bash
cd /root/bancoDistribuidos

# Pull imágenes desde GHCR
docker compose pull

# Iniciar servicios
docker compose up -d

# Verificar
docker compose ps
docker compose logs -f
```

---

## ⚙️ Paso 5: Deployment Automático

Una vez configurado todo, **cada push a `main`** ejecutará automáticamente:

1. ✅ Build de imágenes Docker
2. ✅ Push a GitHub Container Registry
3. ✅ Deploy al servidor
4. ✅ Reinicio de contenedores

### Ver el progreso:

```
GitHub → Actions → Docker Build & Deploy
```

---

## 🛠️ Comandos Útiles

### En tu máquina local:

```bash
# Development (build local)
docker compose -f docker-compose.dev.yml up --build

# Production (pull de GHCR)
docker compose up -d
```

### En el servidor:

```bash
# Ver logs
docker compose logs -f

# Ver logs de un servicio específico
docker compose logs -f worker-1

# Reiniciar servicio
docker compose restart worker-1

# Ver estado
docker compose ps

# Actualizar manualmente
git pull origin main
docker compose pull
docker compose up -d --force-recreate

# Limpiar imágenes viejas
docker image prune -af
```

---

## 🔍 Troubleshooting

### ❌ Error: "Cannot connect to database"

```bash
# Verificar que DATABASE_URL está en .env
cat .env

# Verificar que PostgreSQL acepta conexiones
psql $DATABASE_URL -c "SELECT 1"
```

### ❌ Error: "Permission denied (publickey)"

```bash
# Verificar que SSH key está correctamente en secrets
# Probar conexión manual:
ssh -i ~/.ssh/id_rsa root@146.190.119.145
```

### ❌ Workers no son healthy

```bash
# Ver logs detallados
docker compose logs worker-1

# Verificar Prisma Client
docker compose exec worker-1 bunx prisma --version
```

---

## 📊 Arquitectura del Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    PUSH TO MAIN                             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              JOB 1: BUILD & PUSH                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Build coordinador → Push ghcr.io/*/banco-coordinador │   │
│  │ Build worker-1    → Push ghcr.io/*/banco-worker-1    │   │
│  │ Build worker-2    → Push ghcr.io/*/banco-worker-2    │   │
│  │ Build worker-3    → Push ghcr.io/*/banco-worker-3    │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              JOB 2: DEPLOY TO SERVER                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ SSH to server                                        │   │
│  │ git pull                                             │   │
│  │ docker compose pull                                  │   │
│  │ docker compose up -d --force-recreate                │   │
│  │ docker image prune                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Checklist Final

Antes del primer deployment:

- [ ] Secrets configurados en GitHub
- [ ] Docker instalado en servidor
- [ ] Repositorio clonado en `/root/bancoDistribuidos`
- [ ] Archivo `.env` creado en servidor
- [ ] Login a GHCR exitoso (`docker login ghcr.io`)
- [ ] PostgreSQL accesible desde servidor
- [ ] SSH key funciona

---

## 🎯 Próximos Pasos

1. Hacer un pequeño cambio en el código
2. Commit y push a `main`
3. Ver el workflow ejecutándose en Actions
4. Verificar deployment en el servidor

¡Listo! 🎉
