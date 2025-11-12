# 🚀 Deployment Guide - Banco Distribuido

## 📋 Prerequisitos en el Servidor

1. **Bun Runtime**
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **PM2 (Process Manager)**
   ```bash
   npm install -g pm2
   ```

3. **PostgreSQL** (para la base de datos)
   ```bash
   # Ubuntu/Debian
   sudo apt install postgresql postgresql-contrib
   ```

4. **Git**
   ```bash
   sudo apt install git
   ```

## 🔐 Configurar GitHub Secrets

Para que el deployment automático funcione, necesitas configurar estos secrets en tu repositorio de GitHub:

1. Ve a: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

2. Agrega los siguientes secrets:

| Secret Name | Descripción | Ejemplo |
|-------------|-------------|---------|
| `SSH_HOST` | IP o dominio del servidor | `146.190.119.145` |
| `SSH_USERNAME` | Usuario SSH del servidor | `root` o `ubuntu` |
| `SSH_PRIVATE_KEY` | Llave privada SSH completa | `-----BEGIN RSA PRIVATE KEY-----...` |
| `SSH_PORT` | Puerto SSH (opcional, default: 22) | `22` |

### 📝 Cómo obtener la SSH Private Key:

```bash
# En tu máquina local, genera un par de llaves (si no tienes una)
ssh-keygen -t rsa -b 4096 -C "deploy@banco-distribuido"

# Copia la llave pública al servidor
ssh-copy-id usuario@tu-servidor.com

# Copia la llave PRIVADA completa para GitHub Secrets
cat ~/.ssh/id_rsa
# Copia TODO el contenido (incluyendo -----BEGIN y -----END)
```

## 🗄️ Configurar Base de Datos

En tu servidor, crea el archivo `.env` en la carpeta `worker`:

```bash
# En el servidor
cd /home/polo/banco-distribuido/worker
nano .env
```

Agrega:

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/banco?schema=public"
JWT_SECRET="tu-secret-super-seguro-aqui"
PORT=3001
COORDINADOR_URL="http://localhost:4000"
```

**Importante**: Crea la base de datos en PostgreSQL:

```bash
# Conectar a PostgreSQL
sudo -u postgres psql

# Crear base de datos y usuario
CREATE DATABASE banco;
CREATE USER banco_user WITH ENCRYPTED PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE banco TO banco_user;
\q
```

## 🚀 Deployment Automático

### Opción 1: Push a main (Automático)

Cada vez que hagas `git push` a la rama `main`, se ejecutará automáticamente el deployment:

```bash
git add .
git commit -m "feat: nueva funcionalidad"
git push origin main
```

### Opción 2: Manual desde GitHub

1. Ve a **Actions** en tu repositorio
2. Selecciona **Deploy Banco Distribuido**
3. Click en **Run workflow**
4. Selecciona la rama `main`
5. Click en **Run workflow**

## 🛠️ Comandos PM2 Útiles

Una vez deployado, puedes manejar los servicios con PM2:

```bash
# Ver todos los procesos
pm2 list

# Ver logs en tiempo real
pm2 logs

# Ver logs de un servicio específico
pm2 logs coordinador
pm2 logs worker-3001

# Reiniciar un servicio
pm2 restart coordinador
pm2 restart worker-3001

# Reiniciar todos los servicios
pm2 restart all

# Detener todos los servicios
pm2 stop all

# Eliminar todos los servicios
pm2 delete all

# Ver métricas en tiempo real
pm2 monit

# Guardar configuración actual
pm2 save

# Ver logs de errores
pm2 logs --err
```

## 🔄 Deployment Manual (sin GitHub Actions)

Si prefieres deployar manualmente:

```bash
# 1. SSH al servidor
ssh usuario@tu-servidor

# 2. Ir al directorio
cd /home/polo/banco-distribuido

# 3. Actualizar código
git pull origin main

# 4. Instalar dependencias
cd coordinador && bun install && cd ..
cd worker && bun install && cd ..

# 5. Generar Prisma Client
cd worker
bunx prisma generate
bunx prisma migrate deploy
cd ..

# 6. Usar PM2 con el archivo de configuración
pm2 delete all
pm2 start ecosystem.config.json
pm2 save
```

## 🏥 Health Checks

Verifica que los servicios estén funcionando:

```bash
# Coordinador
curl http://localhost:4000/health

# Workers
curl http://localhost:3001/api/health
curl http://localhost:3002/api/health
curl http://localhost:3003/api/health
```

## 🌐 Configurar Nginx (Opcional pero Recomendado)

Para acceso público y HTTPS:

```bash
# Instalar Nginx
sudo apt install nginx

# Crear configuración
sudo nano /etc/nginx/sites-available/banco-distribuido
```

Contenido del archivo:

```nginx
# Coordinador
server {
    listen 80;
    server_name coordinador.tudominio.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Worker 1
server {
    listen 80;
    server_name worker1.tudominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Worker 2
server {
    listen 80;
    server_name worker2.tudominio.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Worker 3
server {
    listen 80;
    server_name worker3.tudominio.com;

    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activar configuración:

```bash
sudo ln -s /etc/nginx/sites-available/banco-distribuido /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Instalar SSL con Let's Encrypt (opcional)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d coordinador.tudominio.com -d worker1.tudominio.com -d worker2.tudominio.com -d worker3.tudominio.com
```

## 🔍 Troubleshooting

### Puerto en uso - Error "port 3001 in use"

Si ves errores como `Failed to start server. Is port 3001 in use?`:

```bash
# Opción 1: Usar el script automático
cd /home/polo/banco-distribuido
chmod +x restart-services.sh
./restart-services.sh

# Opción 2: Manual - Liberar puertos específicos
# Ver qué proceso está usando el puerto
sudo lsof -i :3001

# Matar el proceso (reemplaza PID con el número que viste)
kill -9 PID

# O liberar todos los puertos de una vez
pm2 delete all
fuser -k 4000/tcp 3001/tcp 3002/tcp 3003/tcp

# Esperar y reiniciar
sleep 3
pm2 start ecosystem.config.json
pm2 save
```

### Los workers no se conectan al coordinador

```bash
# Verificar que el coordinador esté corriendo
pm2 logs coordinador

# Verificar la URL del coordinador en los workers
pm2 env worker-3001 | grep COORDINADOR_URL
```

### Error de base de datos

```bash
# Verificar conexión a PostgreSQL
cd /home/polo/banco-distribuido/worker
bunx prisma db push

# Ver logs de errores
pm2 logs worker-3001 --err
```

### Servicios no inician después de reiniciar servidor

```bash
# Configurar PM2 para auto-inicio
pm2 startup systemd
# Ejecutar el comando que PM2 te indique

pm2 save
```

## 📊 Monitoreo

### Ver estado en tiempo real

```bash
# Dashboard de PM2
pm2 monit

# Ver uso de recursos
pm2 status
```

### Logs centralizados

```bash
# Todos los logs
pm2 logs

# Solo errores
pm2 logs --err

# Últimas 100 líneas
pm2 logs --lines 100
```

## 🎯 Arquitectura del Deployment

```
┌─────────────────────────────────────┐
│         GitHub Repository           │
│         (Push to main)              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│       GitHub Actions Runner         │
│    (appleboy/ssh-action)            │
└──────────────┬──────────────────────┘
               │ SSH
               ▼
```bash
┌─────────────────────────────────────┐
│         Your Server                 │
│  /home/polo/banco-distribuido       │
│                                     │
│  ┌──────────────────────┐          │
│  │  PM2 Process Manager │          │
│  ├──────────────────────┤          │
│  │ • coordinador:4000   │          │
│  │ • worker-3001:3001   │          │
│  │ • worker-3002:3002   │          │
│  │ • worker-3003:3003   │          │
│  └──────────────────────┘          │
│                                     │
│  ┌──────────────────────┐          │
│  │    PostgreSQL        │          │
│  │   Database: banco    │          │
│  └──────────────────────┘          │
└─────────────────────────────────────┘
```

## ✅ Checklist de Deployment

- [ ] Servidor configurado con Bun, PM2, PostgreSQL
- [ ] GitHub Secrets configurados (SSH_HOST, SSH_USERNAME, SSH_PRIVATE_KEY)
- [ ] Base de datos PostgreSQL creada
- [ ] Archivo `.env` configurado en `/var/www/banco-distribuido/worker/`
- [ ] Primera ejecución manual exitosa
- [ ] PM2 configurado para auto-inicio (`pm2 startup`)
- [ ] Health checks pasando para todos los servicios
- [ ] (Opcional) Nginx configurado para acceso público
- [ ] (Opcional) SSL/HTTPS configurado con Let's Encrypt

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs: `pm2 logs`
2. Verifica la configuración: `pm2 list`
3. Revisa los GitHub Actions logs en la pestaña "Actions" del repositorio
