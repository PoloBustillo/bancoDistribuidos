#!/bin/bash

# 🔧 Script para liberar puertos y reiniciar servicios
# Útil cuando los puertos están ocupados después de un deployment fallido

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

echo -e "${BLUE}🔧 Liberando puertos y reiniciando servicios${NC}"
echo ""

# Detener todos los procesos de PM2
log_info "Deteniendo todos los procesos de PM2..."
pm2 delete all 2>/dev/null || log_warning "No había procesos de PM2 corriendo"

# Esperar a que los procesos terminen
sleep 2

# Liberar puertos específicos
PORTS=(4000 3001 3002 3003)

for port in "${PORTS[@]}"; do
    log_info "Liberando puerto $port..."
    
    # Buscar el PID del proceso usando el puerto
    PID=$(lsof -ti:$port 2>/dev/null || echo "")
    
    if [ -n "$PID" ]; then
        log_warning "Puerto $port está siendo usado por PID: $PID"
        kill -9 $PID 2>/dev/null || true
        log_success "Puerto $port liberado"
    else
        log_info "Puerto $port ya está libre"
    fi
done

# Esperar un momento
sleep 2

# Verificar que los puertos estén libres
echo ""
log_info "Verificando puertos..."
ALL_FREE=true

for port in "${PORTS[@]}"; do
    if lsof -ti:$port >/dev/null 2>&1; then
        log_error "Puerto $port aún está ocupado"
        ALL_FREE=false
    else
        log_success "Puerto $port está libre"
    fi
done

if [ "$ALL_FREE" = true ]; then
    echo ""
    log_success "🎉 Todos los puertos están libres!"
    
    # Preguntar si desea iniciar los servicios
    read -p "¿Deseas iniciar los servicios ahora? (s/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[SsYy]$ ]]; then
        log_info "Iniciando servicios con PM2..."
        
        # Ir al directorio del proyecto
        cd "$(dirname "$0")"
        
        # Iniciar servicios usando ecosystem.config.json
        pm2 start ecosystem.config.json
        
        # Guardar configuración
        pm2 save
        
        echo ""
        log_success "Servicios iniciados exitosamente"
        log_info "Ver estado: pm2 list"
        log_info "Ver logs: pm2 logs"
    fi
else
    echo ""
    log_error "Algunos puertos siguen ocupados. Por favor verifica manualmente:"
    echo "  sudo lsof -i :4000"
    echo "  sudo lsof -i :3001"
    echo "  sudo lsof -i :3002"
    echo "  sudo lsof -i :3003"
fi
