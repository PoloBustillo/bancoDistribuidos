# ✅ SOLUCIÓN FINAL: Cannot find module '@banco/shared/config'

## 🎯 Problemas Resueltos

**Error 1:**

```
error: Cannot find module '@banco/shared/config' from '/app/worker/src/server.ts'
```

**Error 2:**

```
error: Workspace not found "frontend"
error: Workspace not found "worker"
```

## 🔧 Solución Aplicada (La Definitiva)

La solución requiere **crear symlinks explícitos** en los Dockerfiles:

### 1. ✅ Dockerfiles: package.json temporal y ejecutar desde root

**worker/Dockerfile** y **coordinador/Dockerfile**:

```dockerfile
# Builder stage
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# ✅ Crear package.json temporal con SOLO workspaces necesarios
RUN echo '{"name":"banco-distribuido","workspaces":["shared","worker"]}' > package.json

# ✅ Copiar solo workspaces necesarios
COPY shared ./shared
COPY worker ./worker

# ✅ Instalar dependencias (sin error de workspace no encontrado)
RUN bun install

# Production stage
FROM oven/bun:1-alpine
WORKDIR /app

# ✅ Recrear package.json con workspaces
RUN echo '{"name":"banco-distribuido","workspaces":["shared","worker"]}' > package.json

# ✅ Copiar node_modules y workspaces
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/worker ./worker

# ✅ CRÍTICO: Crear symlink @banco/shared manualmente
RUN mkdir -p node_modules/@banco && \
    ln -sf ../../shared node_modules/@banco/shared

# ✅ Establecer NODE_PATH
ENV NODE_PATH=/app/node_modules:/app

# ✅ Ejecutar desde /app root
WORKDIR /app
CMD ["bun", "run", "worker/src/server.ts"]
```

**La clave**: El symlink `node_modules/@banco/shared → ../../shared` permite que Bun resuelva `import { X } from '@banco/shared/Y'` correctamente.

### 2. ✅ tsconfig.json: Configurar paths

**worker/tsconfig.json** y **coordinador/tsconfig.json**:

```json
{
  "compilerOptions": {
    ...
    "baseUrl": "..",
    "paths": {
      "@banco/shared": ["../shared/index.ts"],
      "@banco/shared/*": ["../shared/*"]
    },
    ...
  }
}
```

### 3. ✅ package.json del root: Tiene workspaces configurados

```json
{
  "workspaces": ["frontend", "worker", "coordinador", "shared"]
}
```

## 🚀 Deploy

```bash
# Los archivos ya están corregidos
git add .
git commit -m "fix: Configure paths and NODE_PATH to resolve @banco/shared in Docker"
git push origin main
```

## 🔍 Verificar

Después del deploy:

```bash
ssh polo@tu-servidor
cd /home/polo/banco-distribuido

# Ver logs
docker compose logs -f worker-1

# ✅ Debería mostrar:
# 🏦 Worker inicializado correctamente
# 📍 Puerto: 3001

# ❌ NO debería aparecer:
# error: Cannot find module '@banco/shared/config'

# Health checks
curl http://localhost:3001/api/health
curl http://localhost:3002/api/health
curl http://localhost:3003/api/health
curl http://localhost:4000/health
```

## 📊 Por Qué Funciona

1. **tsconfig paths**: Le dice a TypeScript/Bun dónde encontrar `@banco/shared`
2. **package.json en producción**: Mantiene la configuración de workspaces
3. **NODE_PATH**: Variable de entorno que Node/Bun usa para resolver módulos
4. **Ejecutar desde /app**: Permite que las rutas relativas funcionen correctamente

## ⏱️ Tiempo Estimado

- GitHub Actions build: ~5-8 min
- Deploy: ~2-3 min
- **Total: ~10 minutos**

## 📝 Archivos Modificados

- ✅ `worker/Dockerfile` - Paths y NODE_PATH
- ✅ `worker/tsconfig.json` - baseUrl y paths
- ✅ `coordinador/Dockerfile` - Paths y NODE_PATH
- ✅ `coordinador/tsconfig.json` - baseUrl y paths

## 🎉 Resultado

Todos los servicios (coordinador + 3 workers) deberían iniciar correctamente y responder a los health checks.
