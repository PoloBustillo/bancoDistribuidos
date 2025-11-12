#!/bin/bash

# 🔐 Script para configurar SSL automáticamente con Caddy
# Dominio: psic-danieladiaz.com
# Puertos: 3001, 3002, 3003, 4000

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

DOMAIN="psic-danieladiaz.com"

echo -e "${BLUE}🔐 Configurando SSL con Caddy para Banco Distribuido${NC}"
echo ""

# Verificar que se está ejecutando como root
if [[ $EUID -ne 0 ]]; then
   log_error "Este script debe ejecutarse como root (usa sudo)"
   exit 1
fi

# 1. Instalar Caddy
log_info "Instalando Caddy..."
if ! command -v caddy &> /dev/null; then
    apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt update
    apt install -y caddy
    log_success "Caddy instalado"
else
    log_success "Caddy ya está instalado"
fi

# 2. Verificar DNS
log_info "Verificando configuración DNS..."
echo ""
log_warning "IMPORTANTE: Asegúrate de que estos subdominios apunten a tu servidor:"
echo "  api1.${DOMAIN} → $(curl -s ifconfig.me)"
echo "  api2.${DOMAIN} → $(curl -s ifconfig.me)"
echo "  api3.${DOMAIN} → $(curl -s ifconfig.me)"
echo "  coord.${DOMAIN} → $(curl -s ifconfig.me)"
echo ""
read -p "¿Ya configuraste los registros DNS? (s/n): " dns_ready

if [[ ! "$dns_ready" =~ ^[SsYy]$ ]]; then
    log_error "Por favor configura los registros DNS primero:"
    echo ""
    echo "En tu proveedor de DNS (ej: Cloudflare, GoDaddy, etc):"
    echo "Tipo  | Nombre | Valor"
    echo "------|--------|-------"
    echo "A     | api1   | $(curl -s ifconfig.me)"
    echo "A     | api2   | $(curl -s ifconfig.me)"
    echo "A     | api3   | $(curl -s ifconfig.me)"
    echo "A     | coord  | $(curl -s ifconfig.me)"
    echo ""
    log_info "Después de configurar DNS, espera 5-10 minutos y ejecuta este script nuevamente"
    exit 1
fi

# 3. Backup de configuración existente si existe
if [ -f /etc/caddy/Caddyfile ]; then
    log_info "Haciendo backup de Caddyfile existente..."
    cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup.$(date +%s)
fi

# 4. Crear Caddyfile
log_info "Creando configuración de Caddy..."
cat > /etc/caddy/Caddyfile << EOF
# Banco Distribuido - Configuración SSL
# Generado: $(date)

# Worker 1 - Puerto 3001
api1.${DOMAIN} {
    reverse_proxy localhost:3001 {
        # Configuración para WebSocket
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
    
    # Logs
    log {
        output file /var/log/caddy/api1.log
    }
}

# Worker 2 - Puerto 3002
api2.${DOMAIN} {
    reverse_proxy localhost:3002 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
    
    log {
        output file /var/log/caddy/api2.log
    }
}

# Worker 3 - Puerto 3003
api3.${DOMAIN} {
    reverse_proxy localhost:3003 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
    
    log {
        output file /var/log/caddy/api3.log
    }
}

# Coordinador - Puerto 4000
coord.${DOMAIN} {
    reverse_proxy localhost:4000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
    
    log {
        output file /var/log/caddy/coord.log
    }
}

# Dominio principal - Redirigir a documentación o frontend
${DOMAIN} {
    respond "Banco Distribuido API. Usa: api1.${DOMAIN}, api2.${DOMAIN}, api3.${DOMAIN}, coord.${DOMAIN}"
}

www.${DOMAIN} {
    redir https://${DOMAIN}{uri}
}
EOF

log_success "Configuración creada"

# 5. Crear directorio de logs
mkdir -p /var/log/caddy
chown caddy:caddy /var/log/caddy

# 6. Validar configuración
log_info "Validando configuración..."
if caddy validate --config /etc/caddy/Caddyfile; then
    log_success "Configuración válida"
else
    log_error "Error en la configuración de Caddy"
    exit 1
fi

# 7. Abrir puertos en firewall
log_info "Configurando firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 3001/tcp
    ufw allow 3002/tcp
    ufw allow 3003/tcp
    ufw allow 4000/tcp
    log_success "Puertos abiertos en UFW"
fi

# 8. Reiniciar Caddy
log_info "Reiniciando Caddy..."
systemctl restart caddy
systemctl enable caddy

# Esperar a que Caddy inicie
sleep 3

# 9. Verificar estado
if systemctl is-active --quiet caddy; then
    log_success "Caddy está corriendo"
else
    log_error "Caddy no está corriendo. Verifica los logs:"
    echo "  journalctl -u caddy -f"
    exit 1
fi

# 10. Verificar certificados SSL
log_info "Esperando a que Caddy obtenga certificados SSL..."
echo "Esto puede tardar 30-60 segundos..."
sleep 10

echo ""
log_success "🎉 ¡Configuración completada!"
echo ""
log_info "URLs disponibles:"
echo "  ✅ https://api1.${DOMAIN} (Worker 1)"
echo "  ✅ https://api2.${DOMAIN} (Worker 2)"
echo "  ✅ https://api3.${DOMAIN} (Worker 3)"
echo "  ✅ https://coord.${DOMAIN} (Coordinador)"
echo ""
log_info "Prueba la conexión:"
echo "  curl https://api1.${DOMAIN}/api/health"
echo "  curl https://api2.${DOMAIN}/api/health"
echo "  curl https://api3.${DOMAIN}/api/health"
echo ""
log_info "Ver logs de Caddy:"
echo "  journalctl -u caddy -f"
echo "  tail -f /var/log/caddy/api1.log"
echo ""
log_warning "IMPORTANTE: Actualiza tu frontend en Vercel:"
echo "  Variables de entorno:"
echo "  NEXT_PUBLIC_DEFAULT_WORKER_URL=https://api1.${DOMAIN}"
echo ""
log_info "Certificados SSL se renovarán automáticamente cada 60 días"
