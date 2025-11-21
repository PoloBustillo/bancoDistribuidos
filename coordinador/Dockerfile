# Multi-stage build - Stage 1: Builder
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Crear package.json temporal solo con workspaces necesarios (sin lockfile)
RUN echo '{"name":"banco-distribuido","workspaces":["shared","coordinador"]}' > package.json

# Copiar shared workspace (requerido por coordinador)
COPY shared ./shared

# Copiar coordinador
COPY coordinador ./coordinador

# Instalar solo dependencias de coordinador (sin lockfile, más lento pero funciona)
RUN bun install --production

# Stage 2: Production
FROM oven/bun:1-alpine

WORKDIR /app

# Instalar curl para health checks
RUN apk add --no-cache curl

# Copiar SOLO node_modules root (contiene symlinks a workspace packages)
COPY --from=builder /app/node_modules ./node_modules

# Copiar shared (código fuente)
COPY --from=builder /app/shared ./shared

# Copiar coordinador (código fuente, sus deps están en root node_modules via symlinks)
COPY --from=builder /app/coordinador ./coordinador

# Cambiar al directorio del coordinador
WORKDIR /app/coordinador

# Exponer puerto
EXPOSE 4000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:4000/health || exit 1

# Ejecutar aplicación
CMD ["bun", "src/server.ts"]
