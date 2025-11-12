#!/bin/bash

# 🚀 Script de deployment local para Banco Distribuido
# Este script facilita el deployment en el servidor sin usar GitHub Actions

set -e  # Detener en caso de error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
DEPLOY_PATH="/var/www/banco-distribuido"
REPO_URL="https://github.com/PoloBustillo/bancoDistribuidos.git"

echo -e "${BLUE}🚀 Banco Distribuido - Deployment Script${NC}"
echo ""

# Función para mostrar mensajes
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar si estamos en el servidor o local
if [ "$1" == "--remote" ]; then
    REMOTE_MODE=true
    SSH_HOST="$2"
    SSH_USER="${3:-root}"
    
    if [ -z "$SSH_HOST" ]; then
        log_error "Uso: $0 --remote <HOST> [USER]"
        exit 1
    fi
    
    log_info "Modo remoto: Conectando a $SSH_USER@$SSH_HOST"
    
    # Ejecutar este script en el servidor remoto
    ssh "$SSH_USER@$SSH_HOST" 'bash -s' < "$0" --local
    exit $?
fi

# Modo local (ejecutándose en el servidor)
if [ "$1" != "--local" ] && [ -z "$REMOTE_MODE" ]; then
    log_info "Ejecutando en modo local..."
fi

# Verificar que Bun esté instalado
if ! command -v bun &> /dev/null; then
    log_warning "Bun no encontrado. Instalando..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
    log_success "Bun instalado"
fi

# Verificar que PM2 esté instalado
if ! command -v pm2 &> /dev/null; then
    log_warning "PM2 no encontrado. Instalando..."
    npm install -g pm2
    log_success "PM2 instalado"
fi

# Crear directorio de deployment
log_info "Preparando directorio de deployment..."
mkdir -p "$DEPLOY_PATH"
cd "$DEPLOY_PATH"

# Clonar o actualizar repositorio
if [ -d ".git" ]; then
    log_info "Actualizando repositorio..."
    git fetch origin
    git reset --hard origin/main
    git pull origin main
else
    log_info "Clonando repositorio..."
    git clone "$REPO_URL" .
fi
log_success "Código actualizado"

# Instalar dependencias del coordinador
log_info "Instalando dependencias del coordinador..."
cd coordinador
bun install
cd ..
log_success "Dependencias del coordinador instaladas"

# Instalar dependencias de los workers
log_info "Instalando dependencias de los workers..."
cd worker
bun install

# Verificar si existe .env
if [ ! -f ".env" ]; then
    log_warning "Archivo .env no encontrado. Creando template..."
    cat > .env << EOL
DATABASE_URL="postgresql://usuario:password@localhost:5432/banco?schema=public"
JWT_SECRET="cambiar-por-secret-seguro"
NODE_ENV="production"
EOL
    log_warning "⚠️  IMPORTANTE: Edita el archivo .env con tus credenciales reales"
    log_warning "    Ubicación: $DEPLOY_PATH/worker/.env"
fi

# Generar Prisma Client
log_info "Generando Prisma Client..."
bunx prisma generate --schema=prisma/schema.prisma
log_success "Prisma Client generado"

# Ejecutar migraciones
log_info "Ejecutando migraciones de base de datos..."
if bunx prisma migrate deploy --schema=prisma/schema.prisma; then
    log_success "Migraciones aplicadas"
else
    log_warning "No se pudieron aplicar las migraciones (puede ser normal en primera ejecución)"
fi

cd ..

# Crear directorio de logs
mkdir -p logs

# Detener servicios existentes
log_info "Deteniendo servicios existentes..."
pm2 delete all 2>/dev/null || log_info "No había servicios previos"

# Iniciar servicios usando ecosystem.config.json
log_info "Iniciando servicios..."
pm2 start ecosystem.config.json

# Guardar configuración de PM2
log_info "Guardando configuración de PM2..."
pm2 save

# Configurar PM2 para auto-inicio
log_info "Configurando PM2 para auto-inicio..."
pm2 startup systemd -u "$USER" --hp "$HOME" 2>/dev/null || log_warning "PM2 startup ya configurado"

log_success "Deployment completado!"
echo ""
log_info "Estado de los servicios:"
pm2 list
echo ""

# Esperar un momento para que los servicios inicien
sleep 5

# Health checks
echo ""
log_info "Ejecutando health checks..."
HEALTH_OK=true

# Verificar Workers
for port in 3001 3002 3003; do
    if curl -f http://localhost:$port/api/health > /dev/null 2>&1; then
        log_success "Worker en puerto $port está saludable"
    else
        log_error "Worker en puerto $port no responde"
        HEALTH_OK=false
    fi
done

echo ""
if [ "$HEALTH_OK" = true ]; then
    log_success "🎉 Todos los servicios están funcionando correctamente!"
else
    log_warning "Algunos servicios no están respondiendo. Revisa los logs con: pm2 logs"
fi

echo ""
log_info "URLs de los servicios:"
echo "  - Coordinador: http://localhost:4000"
echo "  - Worker 1: http://localhost:3001"
echo "  - Worker 2: http://localhost:3002"
echo "  - Worker 3: http://localhost:3003"

echo ""
log_info "Comandos útiles:"
echo "  - Ver logs: pm2 logs"
echo "  - Ver estado: pm2 list"
echo "  - Reiniciar todo: pm2 restart all"
echo "  - Detener todo: pm2 stop all"
echo "  - Monitor en tiempo real: pm2 monit"
