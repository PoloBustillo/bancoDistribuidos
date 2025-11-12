# 🔐 Configuración SSL para psic-danieladiaz.com

## 📋 Prerequisitos

### 1. Configurar DNS (IMPORTANTE - Hacer PRIMERO)

En tu proveedor de DNS (GoDaddy, Cloudflare, etc.), crea estos registros:

```
Tipo: A    Nombre: api1     Valor: [IP de tu servidor]
Tipo: A    Nombre: api2     Valor: [IP de tu servidor]
Tipo: A    Nombre: api3     Valor: [IP de tu servidor]
Tipo: A    Nombre: coord    Valor: [IP de tu servidor]
```

**⏱️ Espera 5-10 minutos** después de configurar DNS antes de continuar.

### 2. Verificar DNS

```bash
# Verifica que los subdominios apunten a tu servidor
dig api1.psic-danieladiaz.com +short
dig api2.psic-danieladiaz.com +short
dig api3.psic-danieladiaz.com +short
dig coord.psic-danieladiaz.com +short
```

Todos deben devolver la IP de tu servidor.

---

## 🚀 Opción 1: Caddy (Recomendado - Más Fácil)

### Por qué Caddy:
- ✅ SSL automático (cero configuración)
- ✅ Renovación automática de certificados
- ✅ Configuración más simple
- ✅ WebSocket support nativo

### Instalación:

```bash
# 1. Copia el script al servidor
scp setup-ssl-caddy.sh polo@psic-danieladiaz.com:/home/polo/

# 2. SSH al servidor
ssh polo@psic-danieladiaz.com

# 3. Ejecuta el script
sudo bash /home/polo/setup-ssl-caddy.sh
```

El script:
1. Instala Caddy
2. Configura subdominios con SSL automático
3. Configura firewall
4. Obtiene certificados SSL automáticamente

### Después de ejecutar:

URLs disponibles:
- `https://api1.psic-danieladiaz.com` → Worker 1 (puerto 3001)
- `https://api2.psic-danieladiaz.com` → Worker 2 (puerto 3002)
- `https://api3.psic-danieladiaz.com` → Worker 3 (puerto 3003)
- `https://coord.psic-danieladiaz.com` → Coordinador (puerto 4000)

---

## 🚀 Opción 2: Nginx + Certbot

### Por qué Nginx:
- ✅ Más conocido
- ✅ Más control granular
- ✅ Mejor performance en alta carga

### Instalación:

```bash
# 1. Copia el script al servidor
scp setup-ssl-nginx.sh polo@psic-danieladiaz.com:/home/polo/

# 2. SSH al servidor
ssh polo@psic-danieladiaz.com

# 3. Ejecuta el script
sudo bash /home/polo/setup-ssl-nginx.sh
```

El script:
1. Instala Nginx + Certbot
2. Configura reverse proxy para cada puerto
3. Obtiene certificados SSL con Let's Encrypt
4. Configura renovación automática

---

## ✅ Verificación

### 1. Verifica que los servicios estén corriendo

```bash
# Backend services
pm2 status

# Caddy (si usas Caddy)
sudo systemctl status caddy

# Nginx (si usas Nginx)
sudo systemctl status nginx
```

### 2. Prueba las URLs con SSL

```bash
curl https://api1.psic-danieladiaz.com/api/health
curl https://api2.psic-danieladiaz.com/api/health
curl https://api3.psic-danieladiaz.com/api/health
curl https://coord.psic-danieladiaz.com/api/health
```

Deberías ver respuestas exitosas.

### 3. Prueba desde el navegador

Abre en tu navegador:
- https://api1.psic-danieladiaz.com/api/health

Debes ver un candado 🔒 verde (SSL válido).

---

## 🔧 Configurar Frontend en Vercel

### 1. Ve a tu proyecto en Vercel

https://vercel.com/dashboard → Selecciona proyecto

### 2. Settings → Environment Variables

Agrega estas variables:

```
NEXT_PUBLIC_DEFAULT_WORKER_URL=https://api1.psic-danieladiaz.com
```

### 3. Redeploy

```bash
# Trigger redeploy desde Git
git commit --allow-empty -m "Update environment variables"
git push origin main
```

O desde Vercel Dashboard: **Deployments** → Click en el último → **Redeploy**

---

## 📊 Actualizar WorkerSelector en Frontend

También necesitas actualizar el código para usar las URLs HTTPS por defecto:

```typescript
// frontend/src/context/AppContext.tsx
const defaultWorkers: Worker[] = [
  {
    id: '1',
    name: 'Worker 1',
    url: 'https://api1.psic-danieladiaz.com',
    color: 'bg-blue-500',
  },
  {
    id: '2',
    name: 'Worker 2',
    url: 'https://api2.psic-danieladiaz.com',
    color: 'bg-green-500',
  },
  {
    id: '3',
    name: 'Worker 3',
    url: 'https://api3.psic-danieladiaz.com',
    color: 'bg-purple-500',
  },
];
```

---

## 🔐 Configurar CORS en Backend

Actualiza las variables de entorno en el servidor:

```bash
# SSH al servidor
ssh polo@psic-danieladiaz.com

# Edita el archivo .env
cd /home/polo/banco-distribuido
nano .env
```

Agrega o actualiza:

```bash
CORS_ORIGIN=https://banco-distribuidos.vercel.app,https://psic-danieladiaz.com
HOST=0.0.0.0
```

Reinicia servicios:

```bash
pm2 restart all
```

---

## 🧪 Testing Completo

### 1. Desde tu máquina local

```bash
# Test SSL certificate
openssl s_client -connect api1.psic-danieladiaz.com:443 -servername api1.psic-danieladiaz.com

# Test HTTP to HTTPS redirect
curl -I http://api1.psic-danieladiaz.com

# Test API endpoint
curl https://api1.psic-danieladiaz.com/api/health
```

### 2. Desde el frontend en Vercel

1. Abre https://banco-distribuidos.vercel.app
2. Abre Console del navegador (F12)
3. Intenta hacer login
4. Verifica que las peticiones vayan a `https://api1.psic-danieladiaz.com`
5. No debe haber errores de CORS o Mixed Content

---

## 📋 Checklist Final

- [ ] DNS configurado (api1, api2, api3, coord)
- [ ] Script de SSL ejecutado (Caddy o Nginx)
- [ ] Certificados SSL obtenidos correctamente
- [ ] PM2 services corriendo
- [ ] Firewall permite puertos 80, 443
- [ ] CORS configurado con dominio de Vercel
- [ ] Variables de entorno en Vercel actualizadas
- [ ] Frontend redeployado
- [ ] Tests de conexión exitosos

---

## 🆘 Troubleshooting

### "Error obtaining certificate"

```bash
# Verifica que DNS esté configurado correctamente
dig api1.psic-danieladiaz.com +short

# Verifica que el puerto 80 esté abierto
sudo ufw status
```

### "Connection refused"

```bash
# Verifica que PM2 esté corriendo
pm2 status

# Verifica logs
pm2 logs worker-3001
```

### "Certificate is not trusted"

- Espera 1-2 minutos, los certificados tardan en propagarse
- Verifica que Caddy/Nginx esté corriendo correctamente

### Verificar logs:

```bash
# Caddy
sudo journalctl -u caddy -f

# Nginx
sudo tail -f /var/log/nginx/error.log

# Certbot
sudo certbot certificates
```

---

## 🔄 Renovación de Certificados

### Caddy
- ✅ Automático (no requiere acción)
- Caddy renueva certificados automáticamente cada 60 días

### Nginx + Certbot
- ✅ Automático (configurado por el script)
- Verifica con: `sudo certbot renew --dry-run`
- Timer automático: `sudo systemctl status certbot.timer`

---

## 📞 Siguientes Pasos

1. **Ejecuta el script** de tu elección (Caddy recomendado)
2. **Verifica SSL** con curl
3. **Actualiza variables** en Vercel
4. **Prueba el frontend** desde Vercel
5. **¡Listo!** 🎉
