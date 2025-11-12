# 🔧 Solución al Error de Repositorios EOL

## ❌ Problema

```
E: The repository 'http://security.ubuntu.com/ubuntu kinetic-security Release' 
   no longer has a Release file.
```

**Causa**: Ubuntu Kinetic (22.10) llegó a End of Life (EOL).

## ✅ Solución: Usa el Script Simplificado

### 1. Copia el script correcto

```bash
scp setup-ssl-caddy-simple.sh polo@psic-danieladiaz.com:/home/polo/
```

### 2. Ejecútalo en el servidor

```bash
ssh polo@psic-danieladiaz.com
sudo bash /home/polo/setup-ssl-caddy-simple.sh
```

## 🎯 Por qué funciona

Este script:
- ✅ Instala Caddy desde **binario oficial** (no usa apt)
- ✅ No depende de repositorios de Ubuntu
- ✅ Funciona en cualquier versión de Ubuntu (incluso EOL)
- ✅ SSL 100% automático con Let's Encrypt

## 📋 Proceso Completo

1. **Configura DNS primero** (api1, api2, api3, coord)
2. **Copia el script**: `setup-ssl-caddy-simple.sh`
3. **Ejecuta con sudo**
4. **Espera 1-2 minutos** mientras obtiene certificados
5. **Verifica**: `curl https://api1.psic-danieladiaz.com/api/health`

## 🆘 Si aún tienes problemas

### El script se detiene en "¿Ya configuraste DNS?"

**Acción**: Verifica que los registros DNS estén configurados:

```bash
dig api1.psic-danieladiaz.com +short
dig api2.psic-danieladiaz.com +short
dig api3.psic-danieladiaz.com +short
```

Deben devolver la IP de tu servidor.

### "Caddy no está corriendo"

**Acción**: Revisa los logs:

```bash
journalctl -u caddy -n 50
```

### "Failed to obtain certificate"

**Causas posibles**:
1. DNS no está configurado correctamente
2. Puerto 80 bloqueado por firewall
3. Ya existe un servidor usando puerto 80

**Solución**:

```bash
# Verifica que no haya otro servidor en puerto 80
sudo lsof -i :80

# Si hay nginx/apache corriendo, detenlos
sudo systemctl stop nginx
sudo systemctl stop apache2

# Vuelve a ejecutar el script
sudo bash /home/polo/setup-ssl-caddy-simple.sh
```

## ✨ Después de la Instalación

### Configurar CORS

```bash
cd /home/polo/banco-distribuido
nano .env
```

Agrega:
```
CORS_ORIGIN=https://banco-distribuidos.vercel.app
```

Reinicia:
```bash
pm2 restart all
```

### Configurar Vercel

1. Vercel Dashboard → Tu proyecto → Settings → Environment Variables
2. Agrega: `NEXT_PUBLIC_DEFAULT_WORKER_URL=https://api1.psic-danieladiaz.com`
3. Redeploy

---

📚 Guía completa: `SSL-SETUP.md`
