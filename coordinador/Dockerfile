# Multi-stage build - Stage 1: Builder
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copiar package.json del root
COPY package.json ./

# Copiar shared workspace completo (con su package.json)
COPY shared ./shared

# Copiar coordinador completo (con su package.json y bun.lockb)
COPY coordinador ./coordinador

# Instalar dependencias de todos los workspaces
# Bun manejará los workspaces automáticamente desde package.json
RUN bun install

# Stage 2: Production
FROM oven/bun:1-alpine

WORKDIR /app

# Instalar curl para health checks
RUN apk add --no-cache curl

# IMPORTANTE: Copiar package.json del root para mantener configuración de workspaces
COPY --from=builder /app/package.json ./package.json

# Copiar node_modules root (contiene symlinks a workspace packages)
COPY --from=builder /app/node_modules ./node_modules

# Copiar shared (código fuente + su package.json)
COPY --from=builder /app/shared ./shared

# Copiar coordinador (código fuente + su package.json, deps están en root node_modules via symlinks)
COPY --from=builder /app/coordinador ./coordinador

# No cambiar a WORKDIR /app/coordinador para ejecutar
# Bun necesita ejecutarse desde /app para resolver workspaces correctamente

# Exponer puerto
EXPOSE 4000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:4000/health || exit 1

## Ejecutar aplicación desde /app root para que Bun resuelva workspaces
WORKDIR /app

# Establecer NODE_PATH para que Node/Bun encuentre los módulos
ENV NODE_PATH=/app/node_modules:/app

CMD ["bun", "run", "coordinador/src/server.ts"]
