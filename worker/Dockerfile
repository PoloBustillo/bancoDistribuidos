# Multi-stage build para optimizar tamaño de imagen
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copiar package.json del workspace root
COPY package.json bun.lockb* ./

# Copiar TODOS los workspaces (necesario para resolver dependencies)
COPY shared ./shared
COPY worker ./worker
COPY coordinador ./coordinador
COPY frontend ./frontend

# Instalar dependencias desde el workspace root
RUN bun install

# Generar Prisma Client (necesita DATABASE_URL temporal)
WORKDIR /app/worker
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN bunx prisma generate --schema=prisma/schema.prisma

# Production stage
FROM oven/bun:1-alpine

WORKDIR /app

# Instalar curl para health checks y openssl para Prisma
RUN apk add --no-cache curl openssl

# Copiar node_modules del workspace root
COPY --from=builder /app/node_modules ./node_modules

# Copiar shared
COPY --from=builder /app/shared ./shared

# Copiar worker con Prisma client
COPY --from=builder /app/worker ./worker

# Cambiar al directorio del worker
WORKDIR /app/worker

# Exponer puerto (será dinámico según ENV)
EXPOSE 3001

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3001}/api/health || exit 1

# Script de inicio que ejecuta migraciones y luego inicia el servidor
CMD ["sh", "-c", "bunx prisma migrate deploy --schema=prisma/schema.prisma && bun src/server.ts"]
