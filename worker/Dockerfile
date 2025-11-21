# Multi-stage build para optimizar tamaño de imagen
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Crear package.json temporal solo con workspaces necesarios (sin lockfile)
RUN echo '{"name":"banco-distribuido","workspaces":["shared","worker"]}' > package.json

# Copiar shared workspace (requerido por worker)
COPY shared ./shared

# Copiar worker
COPY worker ./worker

# Instalar solo dependencias de worker (sin lockfile, más lento pero funciona)
RUN bun install --production

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

# Copiar node_modules del workspace root (contiene Prisma Client generado)
COPY --from=builder /app/node_modules ./node_modules

# Copiar shared
COPY --from=builder /app/shared ./shared

# Copiar worker (incluye prisma/schema.prisma)
COPY --from=builder /app/worker ./worker

# Cambiar al directorio del worker
WORKDIR /app/worker

# No re-generar aquí - Prisma 6 funciona bien con client generado en builder stage

# Exponer puerto (será dinámico según ENV)
EXPOSE 3001

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3001}/api/health || exit 1

# Script de inicio - en Prisma 7, migrate deploy requiere prisma.config.ts complejo
# Asumimos que las migraciones ya están aplicadas en la BD (hecho manualmente o en otro deploy)
# Solo generamos el cliente e iniciamos el servidor
CMD ["bun", "src/server.ts"]
