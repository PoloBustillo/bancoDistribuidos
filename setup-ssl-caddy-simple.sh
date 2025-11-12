#!/bin/bash

# 🔐 Script SIMPLIFICADO para configurar SSL con Caddy
# Dominio: psic-danieladiaz.com
# Instala Caddy directamente desde binario (sin problemas de repos)

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

echo -e "${BLUE}🔐 Configurando SSL con Caddy (Instalación Simplificada)${NC}"
echo ""

# Verificar root
if [[ $EUID -ne 0 ]]; then
   log_error "Este script debe ejecutarse como root (usa sudo)"
   exit 1
fi

# 1. Instalar Caddy desde binario oficial
log_info "Instalando Caddy desde binario oficial..."
if ! command -v caddy &> /dev/null; then
    # Detectar arquitectura
    ARCH=$(uname -m)
    if [[ "$ARCH" == "x86_64" ]]; then
        CADDY_ARCH="amd64"
    elif [[ "$ARCH" == "aarch64" ]] || [[ "$ARCH" == "arm64" ]]; then
        CADDY_ARCH="arm64"
    else
        log_error "Arquitectura no soportada: $ARCH"
        exit 1
    fi
    
    # Descargar Caddy
    CADDY_VERSION="2.7.6"
    cd /tmp
    wget -O caddy.tar.gz "https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_linux_${CADDY_ARCH}.tar.gz"
    tar -xzf caddy.tar.gz caddy
    mv caddy /usr/bin/caddy
    chmod +x /usr/bin/caddy
    
    # Crear usuario caddy
    id -u caddy &>/dev/null || useradd -r -d /var/lib/caddy -s /bin/false caddy
    
    # Crear directorios
    mkdir -p /etc/caddy
    mkdir -p /var/lib/caddy
    chown -R caddy:caddy /var/lib/caddy
    
    # Crear servicio systemd
    cat > /etc/systemd/system/caddy.service << 'EOF'
[Unit]
Description=Caddy
Documentation=https://caddyserver.com/docs/
After=network.target network-online.target
Requires=network-online.target

[Service]
Type=notify
User=caddy
Group=caddy
ExecStart=/usr/bin/caddy run --environ --config /etc/caddy/Caddyfile
ExecReload=/usr/bin/caddy reload --config /etc/caddy/Caddyfile --force
TimeoutStopSec=5s
LimitNOFILE=1048576
LimitNPROC=512
PrivateTmp=true
ProtectSystem=full
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    log_success "Caddy instalado desde binario"
else
    log_success "Caddy ya está instalado"
fi

# 2. Verificar DNS
log_info "Verificando configuración DNS..."
echo ""
log_warning "IMPORTANTE: Asegúrate de que estos subdominios apunten a tu servidor:"
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "Tu IP")
echo "  api1.${DOMAIN} → $SERVER_IP"
echo "  api2.${DOMAIN} → $SERVER_IP"
echo "  api3.${DOMAIN} → $SERVER_IP"
echo "  coord.${DOMAIN} → $SERVER_IP"
echo ""
read -p "¿Ya configuraste los registros DNS? (s/n): " dns_ready

if [[ ! "$dns_ready" =~ ^[SsYy]$ ]]; then
    log_error "Por favor configura los registros DNS primero:"
    echo ""
    echo "En tu proveedor de DNS (ej: Cloudflare, GoDaddy, etc):"
    echo "Tipo  | Nombre | Valor"
    echo "------|--------|-------"
    echo "A     | api1   | $SERVER_IP"
    echo "A     | api2   | $SERVER_IP"
    echo "A     | api3   | $SERVER_IP"
    echo "A     | coord  | $SERVER_IP"
    echo ""
    log_info "Después de configurar DNS, espera 5-10 minutos y ejecuta este script nuevamente"
    exit 1
fi

# 3. Backup de configuración existente
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
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
    
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

# Dominio principal
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
chown -R caddy:caddy /var/log/caddy

# 6. Validar configuración
log_info "Validando configuración..."
if caddy validate --config /etc/caddy/Caddyfile; then
    log_success "Configuración válida"
else
    log_error "Error en la configuración de Caddy"
    exit 1
fi

# 7. Configurar firewall
log_info "Configurando firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp 2>/dev/null || true
    ufw allow 443/tcp 2>/dev/null || true
    ufw allow 3001/tcp 2>/dev/null || true
    ufw allow 3002/tcp 2>/dev/null || true
    ufw allow 3003/tcp 2>/dev/null || true
    ufw allow 4000/tcp 2>/dev/null || true
    log_success "Puertos abiertos en UFW"
fi

# 8. Iniciar Caddy
log_info "Iniciando Caddy..."
systemctl enable caddy
systemctl restart caddy

# Esperar a que inicie
sleep 3

# 9. Verificar estado
if systemctl is-active --quiet caddy; then
    log_success "Caddy está corriendo"
else
    log_error "Caddy no está corriendo. Verifica los logs:"
    echo "  journalctl -u caddy -f"
    exit 1
fi

# 10. Esperar certificados SSL
log_info "Esperando a que Caddy obtenga certificados SSL..."
echo "Esto puede tardar 30-60 segundos..."
sleep 15

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
log_warning "SIGUIENTE PASO: Configurar CORS en el backend"
echo "  cd /home/polo/banco-distribuido"
echo "  nano .env"
echo "  Agrega: CORS_ORIGIN=https://banco-distribuidos.vercel.app"
echo "  pm2 restart all"
echo ""
log_warning "ACTUALIZA Vercel Environment Variables:"
echo "  NEXT_PUBLIC_DEFAULT_WORKER_URL=https://api1.${DOMAIN}"
echo ""
log_info "Los certificados SSL se renovarán automáticamente cada 60 días"
