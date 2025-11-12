#!/bin/bash

# 🔥 Script para configurar firewall y abrir puertos necesarios
# Ejecuta esto en tu servidor para permitir conexiones externas

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

echo -e "${BLUE}🔥 Configurando Firewall para Banco Distribuido${NC}"
echo ""

# Detectar el sistema de firewall
if command -v ufw &> /dev/null; then
    FIREWALL="ufw"
    log_info "Detectado: UFW (Uncomplicated Firewall)"
elif command -v firewall-cmd &> /dev/null; then
    FIREWALL="firewalld"
    log_info "Detectado: firewalld"
else
    log_warning "No se detectó UFW ni firewalld"
    log_info "Intentando configurar con iptables..."
    FIREWALL="iptables"
fi

# Puertos a abrir
PORTS=(4000 3001 3002 3003)

case $FIREWALL in
    ufw)
        log_info "Configurando UFW..."
        
        # Habilitar UFW si no está activo
        if ! sudo ufw status | grep -q "Status: active"; then
            log_warning "UFW no está activo. ¿Deseas activarlo? (s/n)"
            read -r response
            if [[ "$response" =~ ^[SsYy]$ ]]; then
                sudo ufw enable
                log_success "UFW activado"
            else
                log_error "Necesitas activar UFW para continuar"
                exit 1
            fi
        fi
        
        # Asegurar que SSH esté permitido
        log_info "Asegurando acceso SSH..."
        sudo ufw allow ssh
        sudo ufw allow 22/tcp
        
        # Abrir puertos de la aplicación
        for port in "${PORTS[@]}"; do
            log_info "Abriendo puerto $port..."
            sudo ufw allow $port/tcp
            log_success "Puerto $port abierto"
        done
        
        # Recargar UFW
        sudo ufw reload
        
        # Mostrar estado
        echo ""
        log_success "Configuración de UFW completada"
        sudo ufw status verbose
        ;;
        
    firewalld)
        log_info "Configurando firewalld..."
        
        # Asegurar que SSH esté permitido
        log_info "Asegurando acceso SSH..."
        sudo firewall-cmd --permanent --add-service=ssh
        
        # Abrir puertos de la aplicación
        for port in "${PORTS[@]}"; do
            log_info "Abriendo puerto $port..."
            sudo firewall-cmd --permanent --add-port=$port/tcp
            log_success "Puerto $port abierto"
        done
        
        # Recargar firewalld
        sudo firewall-cmd --reload
        
        # Mostrar estado
        echo ""
        log_success "Configuración de firewalld completada"
        sudo firewall-cmd --list-all
        ;;
        
    iptables)
        log_info "Configurando iptables..."
        
        # Asegurar que SSH esté permitido
        log_info "Asegurando acceso SSH..."
        sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
        
        # Abrir puertos de la aplicación
        for port in "${PORTS[@]}"; do
            log_info "Abriendo puerto $port..."
            sudo iptables -A INPUT -p tcp --dport $port -j ACCEPT
            log_success "Puerto $port abierto"
        done
        
        # Guardar reglas (depende de la distribución)
        if command -v netfilter-persistent &> /dev/null; then
            sudo netfilter-persistent save
        elif [ -f /etc/sysconfig/iptables ]; then
            sudo service iptables save
        else
            log_warning "No se pudo guardar las reglas de iptables automáticamente"
            log_info "Guarda manualmente con: iptables-save > /etc/iptables/rules.v4"
        fi
        
        # Mostrar reglas
        echo ""
        log_success "Configuración de iptables completada"
        sudo iptables -L -n
        ;;
esac

echo ""
log_success "🎉 Firewall configurado correctamente!"
echo ""
log_info "Puertos abiertos:"
for port in "${PORTS[@]}"; do
    echo "  ✓ $port/tcp"
done

echo ""
log_info "Verifica que los servicios estén corriendo:"
echo "  pm2 list"
echo ""
log_info "Prueba la conexión desde tu máquina local:"
echo "  curl http://TU_IP:3001/api/health"
echo ""
log_warning "IMPORTANTE: Asegúrate de tener configurado CORS_ORIGIN en tus variables de entorno"
echo "  export CORS_ORIGIN='http://localhost:3000,http://tu-frontend.com'"
