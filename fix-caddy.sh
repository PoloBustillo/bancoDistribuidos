#!/bin/bash

# 🔍 Script de diagnóstico y corrección para Caddy
# Ejecuta esto si el servicio de Caddy falla

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

echo -e "${BLUE}🔍 Diagnóstico de Caddy${NC}"
echo ""

# Verificar root
if [[ $EUID -ne 0 ]]; then
   log_error "Este script debe ejecutarse como root (usa sudo)"
   exit 1
fi

# 1. Ver logs de Caddy
log_info "Últimos logs de Caddy:"
echo ""
journalctl -u caddy -n 30 --no-pager
echo ""

# 2. Verificar qué está usando el puerto 80 y 443
log_info "Verificando puertos 80 y 443..."
echo ""

PORT_80=$(lsof -i :80 -t 2>/dev/null | head -1)
PORT_443=$(lsof -i :443 -t 2>/dev/null | head -1)

if [ ! -z "$PORT_80" ]; then
    log_warning "Puerto 80 está siendo usado por:"
    ps -p $PORT_80 -o comm=
    PROCESS_80=$(ps -p $PORT_80 -o comm=)
    
    if [[ "$PROCESS_80" == "nginx" ]] || [[ "$PROCESS_80" == "apache2" ]]; then
        log_info "Deteniendo $PROCESS_80..."
        systemctl stop $PROCESS_80
        systemctl disable $PROCESS_80
        log_success "$PROCESS_80 detenido"
    fi
else
    log_success "Puerto 80 está libre"
fi

if [ ! -z "$PORT_443" ]; then
    log_warning "Puerto 443 está siendo usado por:"
    ps -p $PORT_443 -o comm=
    PROCESS_443=$(ps -p $PORT_443 -o comm=)
    
    if [[ "$PROCESS_443" == "nginx" ]] || [[ "$PROCESS_443" == "apache2" ]]; then
        log_info "Deteniendo $PROCESS_443..."
        systemctl stop $PROCESS_443
        systemctl disable $PROCESS_443
        log_success "$PROCESS_443 detenido"
    fi
else
    log_success "Puerto 443 está libre"
fi

# 3. Verificar permisos
log_info "Verificando permisos..."
if [ -f /etc/caddy/Caddyfile ]; then
    chown caddy:caddy /etc/caddy/Caddyfile
    chmod 644 /etc/caddy/Caddyfile
    log_success "Permisos de Caddyfile actualizados"
fi

if [ -d /var/lib/caddy ]; then
    chown -R caddy:caddy /var/lib/caddy
    chmod 755 /var/lib/caddy
    log_success "Permisos de /var/lib/caddy actualizados"
fi

if [ -d /var/log/caddy ]; then
    chown -R caddy:caddy /var/log/caddy
    chmod 755 /var/log/caddy
fi

# 4. Verificar capabilities de Caddy
log_info "Configurando capabilities para Caddy..."
setcap 'cap_net_bind_service=+ep' /usr/bin/caddy
log_success "Capabilities configuradas"

# 5. Formatear Caddyfile
log_info "Formateando Caddyfile..."
caddy fmt --overwrite /etc/caddy/Caddyfile
log_success "Caddyfile formateado"

# 6. Validar configuración
log_info "Validando configuración..."
if caddy validate --config /etc/caddy/Caddyfile; then
    log_success "Configuración válida"
else
    log_error "Configuración inválida. Revisa /etc/caddy/Caddyfile"
    exit 1
fi

# 7. Reintentar iniciar Caddy
log_info "Reiniciando Caddy..."
systemctl daemon-reload
systemctl restart caddy

sleep 3

# 8. Verificar estado
if systemctl is-active --quiet caddy; then
    log_success "🎉 Caddy está corriendo!"
    echo ""
    systemctl status caddy --no-pager -l
    echo ""
    log_info "Ver logs en tiempo real:"
    echo "  journalctl -u caddy -f"
else
    log_error "Caddy aún no está corriendo"
    echo ""
    log_info "Logs de error:"
    journalctl -u caddy -n 20 --no-pager
    echo ""
    log_info "Intenta ejecutar Caddy manualmente para ver el error:"
    echo "  sudo -u caddy caddy run --config /etc/caddy/Caddyfile"
fi
