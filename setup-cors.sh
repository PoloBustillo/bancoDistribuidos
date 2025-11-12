#!/bin/bash

# 🔧 Script para configurar CORS en el backend
# Dominio de Vercel: https://banco-distribuidos.vercel.app

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

VERCEL_DOMAIN="https://banco-distribuidos.vercel.app"
PROJECT_PATH="/home/polo/banco-distribuido"

echo -e "${BLUE}🔧 Configurando CORS para Vercel${NC}"
echo ""

# Verificar que el directorio existe
if [ ! -d "$PROJECT_PATH" ]; then
    log_error "Directorio $PROJECT_PATH no encontrado"
    log_info "Ingresa la ruta correcta del proyecto:"
    read -r PROJECT_PATH
fi

cd "$PROJECT_PATH" || exit 1

# Backup del .env si existe
if [ -f .env ]; then
    log_info "Haciendo backup de .env..."
    cp .env .env.backup.$(date +%s)
    log_success "Backup creado"
fi

# Verificar si CORS_ORIGIN ya existe
if grep -q "^CORS_ORIGIN=" .env 2>/dev/null; then
    log_warning "CORS_ORIGIN ya existe en .env"
    log_info "Valor actual:"
    grep "^CORS_ORIGIN=" .env
    echo ""
    read -p "¿Deseas actualizarlo? (s/n): " update
    
    if [[ "$update" =~ ^[SsYy]$ ]]; then
        # Actualizar valor existente
        sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=$VERCEL_DOMAIN|g" .env
        log_success "CORS_ORIGIN actualizado"
    fi
else
    # Agregar CORS_ORIGIN
    log_info "Agregando CORS_ORIGIN a .env..."
    echo "" >> .env
    echo "# CORS Configuration for Vercel Frontend" >> .env
    echo "CORS_ORIGIN=$VERCEL_DOMAIN" >> .env
    log_success "CORS_ORIGIN agregado"
fi

# Mostrar configuración actual
echo ""
log_info "Configuración actual en .env:"
echo "================================"
grep "CORS_ORIGIN" .env || echo "CORS_ORIGIN no encontrado"
echo "================================"
echo ""

# Reiniciar servicios PM2
log_info "Reiniciando servicios PM2..."
pm2 restart all

sleep 2

# Verificar estado
log_info "Estado de servicios:"
pm2 status

echo ""
log_success "🎉 Configuración completada!"
echo ""
log_info "Próximos pasos:"
echo "1. Verifica que los workers estén corriendo: pm2 status"
echo "2. Prueba desde Vercel: https://banco-distribuidos.vercel.app"
echo "3. Abre la consola del navegador (F12) para ver si ya no hay errores de CORS"
echo ""
log_warning "Si aún hay errores de CORS, verifica que Caddy esté corriendo:"
echo "  sudo systemctl status caddy"
echo ""
log_info "Ver logs en tiempo real:"
echo "  pm2 logs worker-3001  # Logs del worker"
echo "  journalctl -u caddy -f # Logs de Caddy"
