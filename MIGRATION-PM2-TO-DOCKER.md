# 🔄 Migración de PM2 a Docker

## 📋 Situación Actual

Anteriormente tenías **2 workflows**:
- ✅ `deploy.yml` - Deployment con PM2 (Bun directo)
- ✅ `deploy-docker.yml` - Deployment con Docker (antiguo)

Ahora solo tienes:
- 🚀 `docker-deploy.yml` - Deployment moderno con Docker + GHCR

Los workflows antiguos están en: `.github/workflows/_old/`

---

## ⚠️ IMPORTANTE: Conflicto de Puertos

### Problema:
PM2 y Docker **NO pueden correr al mismo tiempo** porque ambos usan los mismos puertos:
- Puerto `4000` - Coordinador
- Puertos `3001, 3002, 3003` - Workers

### Solución:
Antes del primer deployment con Docker, debes **detener PM2** en el servidor.

---

## 🛠️ Migración Manual (Una Sola Vez)

### Opción 1: Ejecutar script de limpieza

SSH al servidor y ejecuta:

```bash
cd /root/bancoDistribuidos
chmod +x stop-pm2.sh
./stop-pm2.sh
```

El script hará:
1. ✅ Detener todos los procesos PM2
2. ✅ Liberar puertos 4000, 3001, 3002, 3003
3. ✅ Verificar que los puertos estén libres
4. ✅ Preparar para Docker

### Opción 2: Manual paso a paso

```bash
# 1. Conectarse al servidor
ssh root@146.190.119.145

# 2. Detener PM2
pm2 delete all
pm2 save --force
pm2 kill

# 3. Liberar puertos (por si acaso)
fuser -k 4000/tcp
fuser -k 3001/tcp
fuser -k 3002/tcp
fuser -k 3003/tcp

# 4. Verificar que los puertos estén libres
netstat -tulpn | grep -E ':(4000|3001|3002|3003)'
# (No debería mostrar nada)

# 5. Ahora puedes usar Docker
cd /root/bancoDistribuidos
docker compose up -d
```

---

## 🚀 Deployment Automático (Después de la Migración)

Una vez hecho el paso anterior **UNA SOLA VEZ**, todos los deployments futuros serán automáticos:

```bash
# En tu máquina local:
git add .
git commit -m "Deploy con Docker"
git push origin main

# GitHub Actions automáticamente:
# 1. ✅ Verifica y detiene PM2 (si existe)
# 2. ✅ Libera puertos
# 3. ✅ Build de imágenes Docker
# 4. ✅ Push a GHCR
# 5. ✅ Pull en servidor
# 6. ✅ Reinicia contenedores
```

---

## 📊 Comparación: PM2 vs Docker

| Característica | PM2 (Antes) | Docker (Ahora) |
|----------------|-------------|----------------|
| **Build** | En servidor (lento) | En CI (rápido) |
| **Recursos** | Bun directo | Contenedores |
| **Rollback** | Manual (git) | Automático (tags) |
| **Consistencia** | Depende del entorno | Idéntico en todos lados |
| **Escalabilidad** | Manual | Fácil con `docker-compose scale` |
| **Isolación** | Procesos separados | Contenedores aislados |
| **Logs** | `pm2 logs` | `docker compose logs` |
| **Health checks** | Manual | Automático |

---

## 🔍 Verificación Post-Migración

### Ver estado de Docker:

```bash
ssh root@146.190.119.145

# Ver contenedores
docker compose ps

# Ver logs
docker compose logs -f

# Ver logs de un servicio específico
docker compose logs -f worker-1

# Ver health checks
docker inspect banco-worker-1 --format='{{.State.Health.Status}}'
```

### Comandos útiles:

```bash
# Reiniciar todos los servicios
docker compose restart

# Reiniciar un servicio específico
docker compose restart worker-1

# Ver uso de recursos
docker stats

# Limpiar imágenes viejas
docker image prune -af
```

---

## 🆘 Rollback a PM2 (Si es necesario)

Si por alguna razón necesitas volver a PM2:

```bash
# 1. Detener Docker
docker compose down

# 2. Instalar dependencias
cd /root/bancoDistribuidos
cd worker && bun install && cd ..
cd coordinador && bun install && cd ..

# 3. Iniciar con PM2
pm2 start ecosystem.config.json
pm2 save
```

O usa el workflow viejo en `.github/workflows/_old/deploy.yml`

---

## 📝 Checklist de Migración

Antes del primer deployment con Docker:

- [ ] PM2 detenido en servidor
- [ ] Puertos 4000, 3001, 3002, 3003 libres
- [ ] Docker y Docker Compose instalados en servidor
- [ ] Secrets configurados en GitHub (SERVER_HOST, SERVER_USER, SERVER_SSH_KEY, DATABASE_URL, JWT_SECRET)
- [ ] Login a GHCR desde servidor (`docker login ghcr.io`)
- [ ] Archivo `.env` creado en `/root/bancoDistribuidos`
- [ ] Repositorio clonado en `/root/bancoDistribuidos`

Después de la primera migración exitosa:

- [ ] Contenedores healthy (`docker compose ps`)
- [ ] Health checks pasando
- [ ] Coordinador accesible en puerto 4000
- [ ] Workers accesibles en puertos 3001, 3002, 3003
- [ ] Logs sin errores (`docker compose logs`)

---

## 🎯 Próximos Pasos

1. **Ejecutar `stop-pm2.sh` en el servidor** (una sola vez)
2. **Commit y push** este cambio a main
3. **Ver GitHub Actions** ejecutándose
4. **Verificar** que los contenedores estén healthy

¡Listo! 🎉
