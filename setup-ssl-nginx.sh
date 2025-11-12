#!/bin/bash

# 🔐 Script para configurar SSL con Nginx + Let's Encrypt (Certbot)
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

echo -e "${BLUE}🔐 Configurando SSL con Nginx + Certbot${NC}"
echo ""

# Verificar que se está ejecutando como root
if [[ $EUID -ne 0 ]]; then
   log_error "Este script debe ejecutarse como root (usa sudo)"
   exit 1
fi

# 1. Instalar Nginx y Certbot
log_info "Instalando Nginx y Certbot..."
apt update
apt install -y nginx certbot python3-certbot-nginx

log_success "Nginx y Certbot instalados"

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
    log_error "Por favor configura los registros DNS primero"
    exit 1
fi

# 3. Crear configuración de Nginx para Worker 1
log_info "Creando configuración para api1.${DOMAIN}..."
cat > /etc/nginx/sites-available/api1-${DOMAIN} << EOF
server {
    listen 80;
    server_name api1.${DOMAIN};

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Headers
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# 4. Crear configuración para Worker 2
log_info "Creando configuración para api2.${DOMAIN}..."
cat > /etc/nginx/sites-available/api2-${DOMAIN} << EOF
server {
    listen 80;
    server_name api2.${DOMAIN};

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# 5. Crear configuración para Worker 3
log_info "Creando configuración para api3.${DOMAIN}..."
cat > /etc/nginx/sites-available/api3-${DOMAIN} << EOF
server {
    listen 80;
    server_name api3.${DOMAIN};

    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# 6. Crear configuración para Coordinador
log_info "Creando configuración para coord.${DOMAIN}..."
cat > /etc/nginx/sites-available/coord-${DOMAIN} << EOF
server {
    listen 80;
    server_name coord.${DOMAIN};

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# 7. Activar sitios
log_info "Activando sitios..."
ln -sf /etc/nginx/sites-available/api1-${DOMAIN} /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/api2-${DOMAIN} /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/api3-${DOMAIN} /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/coord-${DOMAIN} /etc/nginx/sites-enabled/

# 8. Validar configuración
log_info "Validando configuración de Nginx..."
if nginx -t; then
    log_success "Configuración válida"
else
    log_error "Error en la configuración de Nginx"
    exit 1
fi

# 9. Abrir puertos en firewall
log_info "Configurando firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 'Nginx Full'
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 3001/tcp
    ufw allow 3002/tcp
    ufw allow 3003/tcp
    ufw allow 4000/tcp
    log_success "Puertos abiertos en UFW"
fi

# 10. Reiniciar Nginx
log_info "Reiniciando Nginx..."
systemctl restart nginx
systemctl enable nginx

# 11. Obtener certificados SSL con Certbot
log_info "Obteniendo certificados SSL con Let's Encrypt..."
log_warning "Certbot solicitará tu email para notificaciones importantes"
echo ""

# Obtener certificados para todos los subdominios
certbot --nginx \
    -d api1.${DOMAIN} \
    -d api2.${DOMAIN} \
    -d api3.${DOMAIN} \
    -d coord.${DOMAIN} \
    --non-interactive \
    --agree-tos \
    --redirect \
    || {
        log_error "Error al obtener certificados SSL"
        log_info "Puedes ejecutar manualmente:"
        echo "  certbot --nginx -d api1.${DOMAIN} -d api2.${DOMAIN} -d api3.${DOMAIN} -d coord.${DOMAIN}"
        exit 1
    }

# 12. Configurar renovación automática
log_info "Configurando renovación automática de certificados..."
systemctl enable certbot.timer
systemctl start certbot.timer

# 13. Verificar estado
if systemctl is-active --quiet nginx; then
    log_success "Nginx está corriendo"
else
    log_error "Nginx no está corriendo"
    exit 1
fi

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
log_info "Ver logs de Nginx:"
echo "  tail -f /var/log/nginx/access.log"
echo "  tail -f /var/log/nginx/error.log"
echo ""
log_info "Verificar renovación automática:"
echo "  certbot renew --dry-run"
echo ""
log_warning "IMPORTANTE: Actualiza tu frontend en Vercel:"
echo "  Variables de entorno:"
echo "  NEXT_PUBLIC_DEFAULT_WORKER_URL=https://api1.${DOMAIN}"
