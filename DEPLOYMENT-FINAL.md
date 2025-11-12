# ✅ Pasos Finales para Completar el Deployment

## 🎯 Situación Actual

✅ **Frontend**: Desplegándose en Vercel (commit c9c2b0e)
- Ahora detecta automáticamente si está en producción
- Usa `https://api1.psic-danieladiaz.com` en Vercel
- Usa `http://localhost:3001` en desarrollo local

✅ **SSL**: Caddy instalado y funcionando
- Certificados SSL obtenidos correctamente
- `https://api1.psic-danieladiaz.com` responde 200 OK

❌ **CORS**: Falta configurar en el backend

---

## 📋 Paso Final: Configurar CORS

### Opción 1: Script Automático (Recomendado)

```bash
# Desde tu máquina local
scp setup-cors.sh polo@psic-danieladiaz.com:/home/polo/

# SSH al servidor
ssh polo@psic-danieladiaz.com

# Ejecuta el script
bash /home/polo/setup-cors.sh
```

### Opción 2: Manual (Más rápido)

```bash
# SSH al servidor
ssh polo@psic-danieladiaz.com

# Edita .env
cd /home/polo/banco-distribuido
nano .env

# Agrega al final del archivo:
CORS_ORIGIN=https://banco-distribuidos.vercel.app

# Guarda: Ctrl+O, Enter, Ctrl+X

# Reinicia servicios
pm2 restart all

# Verifica que estén corriendo
pm2 status
```

---

## 🧪 Verificación Final

### 1. Espera a que Vercel termine el deploy

Ve a: https://vercel.com/dashboard

O verifica el último commit en GitHub Actions.

### 2. Prueba la aplicación

1. Abre: https://banco-distribuidos.vercel.app
2. Abre la consola del navegador (F12)
3. Intenta hacer login o registrarte

**Deberías ver**:
- ✅ `🌐 API Request: POST https://api1.psic-danieladiaz.com/api/auth/login`
- ✅ `📡 Response Status: 200 OK`
- ✅ `✅ API Success: {usuario: {...}, token: "..."}`
- ✅ Sin errores de CORS
- ✅ Socket.IO conectado

**NO deberías ver**:
- ❌ `Access-Control-Allow-Origin` error
- ❌ `ERR_CONNECTION_REFUSED`
- ❌ `localhost:3001` en las URLs

### 3. Prueba las funcionalidades

- ✅ Login/Registro
- ✅ Crear cuenta
- ✅ Transferencias
- ✅ Tarjetas
- ✅ Eventos en tiempo real (Socket.IO)

---

## 🎉 Una vez funcionando

Tu aplicación estará completamente desplegada:

**Frontend**:
- 🌐 https://banco-distribuidos.vercel.app
- ✅ Deploys automáticos con cada push a `main`

**Backend**:
- 🔒 https://api1.psic-danieladiaz.com (Worker 1)
- 🔒 https://api2.psic-danieladiaz.com (Worker 2)
- 🔒 https://api3.psic-danieladiaz.com (Worker 3)
- 🔒 https://coord.psic-danieladiaz.com (Coordinador)

**Características**:
- ✅ SSL/HTTPS en todos los endpoints
- ✅ Certificados renovados automáticamente
- ✅ CORS configurado
- ✅ Socket.IO funcionando
- ✅ Sistema distribuido completo

---

## 🔧 Comandos Útiles

### Ver logs en el servidor

```bash
# Logs de PM2
pm2 logs worker-3001
pm2 logs worker-3002
pm2 logs worker-3003

# Logs de Caddy
sudo journalctl -u caddy -f

# Estado general
pm2 status
sudo systemctl status caddy
```

### Reiniciar servicios

```bash
# Reiniciar workers
pm2 restart all

# Reiniciar Caddy
sudo systemctl restart caddy
```

### Ver variables de entorno

```bash
cd /home/polo/banco-distribuido
cat .env | grep CORS
```

---

## 🆘 Si algo falla

### Error de CORS persiste

```bash
# Verifica que CORS_ORIGIN esté configurado
ssh polo@psic-danieladiaz.com
cd /home/polo/banco-distribuido
grep CORS_ORIGIN .env

# Reinicia workers
pm2 restart all
```

### Caddy no responde

```bash
# Ejecuta el script de diagnóstico
scp fix-caddy.sh polo@psic-danieladiaz.com:/home/polo/
ssh polo@psic-danieladiaz.com
sudo bash /home/polo/fix-caddy.sh
```

### Workers no están corriendo

```bash
# Revisa el estado
pm2 status

# Si están stopped
pm2 restart all

# Si tienen errores
pm2 logs worker-3001
```

---

## 📚 Archivos de Ayuda Creados

- `QUICKSTART-SSL.md` - Guía rápida de configuración SSL
- `SSL-SETUP.md` - Documentación completa de SSL
- `TROUBLESHOOTING-SSL.md` - Solución de problemas
- `setup-cors.sh` - Script para configurar CORS
- `fix-caddy.sh` - Script para arreglar problemas de Caddy
- `diagnose.sh` - Script de diagnóstico general

---

## ✅ Checklist Final

- [x] DNS configurado (api1, api2, api3, coord)
- [x] Caddy instalado y funcionando
- [x] Certificados SSL obtenidos
- [x] Frontend actualizado para usar URLs de producción
- [x] Commit y push realizados
- [x] Vercel desplegando
- [ ] **CORS configurado en backend** ← SIGUIENTE PASO
- [ ] Verificación completa en Vercel

---

🚀 **¡Casi listo!** Solo falta configurar CORS y tu aplicación estará 100% funcional en producción.
