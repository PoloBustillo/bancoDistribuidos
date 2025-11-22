# Multi-stage build para optimizar tamaño de imagen
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Crear package.json temporal solo con workspaces necesarios
# Esto evita el error "Workspace not found" para frontend/coordinador
RUN echo '{"name":"banco-distribuido","workspaces":["shared","worker"]}' > package.json

# Copiar shared workspace completo (con su package.json)
COPY shared ./shared

# Copiar worker completo (con su package.json y bun.lockb)
COPY worker ./worker

# Instalar dependencias de todos los workspaces
# Bun manejará los workspaces automáticamente desde package.json temporal
RUN bun install

# Instalar Prisma 6 explícitamente desde package.json del worker
# bunx prisma siempre descarga la última versión (v7), debemos usar las deps del workspace
WORKDIR /app/worker
RUN bun install
RUN bunx prisma generate --schema=prisma/schema.prisma

# Production stage
FROM oven/bun:1-alpine

WORKDIR /app

# Instalar curl para health checks y openssl para Prisma
RUN apk add --no-cache curl openssl

# IMPORTANTE: Recrear package.json con workspaces para runtime
RUN echo '{"name":"banco-distribuido","workspaces":["shared","worker"]}' > package.json

# Copiar node_modules del workspace root (contiene Prisma Client generado)
COPY --from=builder /app/node_modules ./node_modules

# Copiar shared (código fuente + su package.json)
COPY --from=builder /app/shared ./shared

# Copiar worker (incluye prisma/schema.prisma + su package.json)
COPY --from=builder /app/worker ./worker

# No cambiar a WORKDIR /app/worker para ejecutar
# Bun necesita ejecutarse desde /app para resolver workspaces correctamente

# Exponer puerto (será dinámico según ENV)
EXPOSE 3001

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3001}/api/health || exit 1

# Script de inicio - ejecutar desde /app root para que Bun resuelva workspaces
# Asumimos que las migraciones ya están aplicadas en la BD
WORKDIR /app

# Establecer NODE_PATH para que Node/Bun encuentre los módulos
ENV NODE_PATH=/app/node_modules:/app

CMD ["bun", "run", "worker/src/server.ts"]
