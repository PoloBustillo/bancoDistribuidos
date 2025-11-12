# 🚀 Guía Rápida: SSL para psic-danieladiaz.com

## Paso 1: Configurar DNS

Ve a tu proveedor de DNS y crea estos registros A:

| Tipo | Nombre | Valor (IP del servidor) |
|------|--------|------------------------|
| A    | api1   | Tu IP del servidor     |
| A    | api2   | Tu IP del servidor     |
| A    | api3   | Tu IP del servidor     |
| A    | coord  | Tu IP del servidor     |

⏱️ **Espera 5-10 minutos** para que DNS se propague.

## Paso 2: Copiar Scripts al Servidor

```bash
# Desde tu máquina local, en el directorio del proyecto
scp setup-ssl-caddy.sh polo@psic-danieladiaz.com:/home/polo/
```

## Paso 3: Ejecutar Script en el Servidor

```bash
# SSH al servidor
ssh polo@psic-danieladiaz.com

# Ejecutar script (Caddy recomendado)
sudo bash /home/polo/setup-ssl-caddy.sh
```

## Paso 4: Verificar

```bash
curl https://api1.psic-danieladiaz.com/api/health
curl https://api2.psic-danieladiaz.com/api/health
```

## Paso 5: Configurar Vercel

1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Settings → Environment Variables
4. Agrega: `NEXT_PUBLIC_DEFAULT_WORKER_URL=https://api1.psic-danieladiaz.com`
5. Redeploy

## ✅ ¡Listo!

Ahora tu frontend en Vercel puede conectarse de forma segura (HTTPS) a tu backend.

---

📚 **Más detalles**: Ver `SSL-SETUP.md`
