#!/bin/bash

# 🔐 Script para configurar SSL con Nginx + Certbot (Compatible con Ubuntu EOL)
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

# Detectar versión de Ubuntu
UBUNTU_VERSION=$(lsb_release -cs 2>/dev/null || echo "unknown")
log_info "Detectada versión de Ubuntu: $UBUNTU_VERSION"

# Si es una versión EOL (kinetic, impish, etc), actualizar sources.list
if [[ "$UBUNTU_VERSION" == "kinetic" ]] || [[ "$UBUNTU_VERSION" == "impish" ]] || [[ "$UBUNTU_VERSION" == "hirsute" ]]; then
    log_warning "Ubuntu $UBUNTU_VERSION ha llegado a End of Life (EOL)"
    log_info "Actualizando repositorios a old-releases.ubuntu.com..."
    
    # Backup de sources.list
    cp /etc/apt/sources.list /etc/apt/sources.list.backup.$(date +%s)
    
    # Actualizar a old-releases
    sed -i -e 's/http:\/\/archive.ubuntu.com\/ubuntu\//http:\/\/old-releases.ubuntu.com\/ubuntu\//g' /etc/apt/sources.list
    sed -i -e 's/http:\/\/security.ubuntu.com\/ubuntu\//http:\/\/old-releases.ubuntu.com\/ubuntu\//g' /etc/apt/sources.list
    sed -i -e 's/http:\/\/us.archive.ubuntu.com\/ubuntu\//http:\/\/old-releases.ubuntu.com\/ubuntu\//g' /etc/apt/sources.list
    
    log_success "Repositorios actualizados"
fi

# 1. Actualizar repositorios
log_info "Actualizando repositorios..."
apt update || {
    log_warning "Algunos repositorios fallaron, continuando de todas formas..."
}

# 2. Instalar Nginx
log_info "Instalando Nginx..."
if ! command -v nginx &> /dev/null; then
    apt install -y nginx
    log_success "Nginx instalado"
else
    log_success "Nginx ya está instalado"
fi

# 3. Instalar Certbot (usando snap para compatibilidad)
log_info "Instalando Certbot via snap..."
if ! command -v certbot &> /dev/null; then
    # Instalar snapd si no está
    if ! command -v snap &> /dev/null; then
        apt install -y snapd
        systemctl enable --now snapd.socket
        sleep 3
    fi
    
    # Instalar certbot via snap
    snap install --classic certbot
    ln -sf /snap/bin/certbot /usr/bin/certbot
    
    # Plugin de nginx
    snap set certbot trust-plugin-with-root=ok
    snap install certbot-dns-cloudflare || true
    
    log_success "Certbot instalado"
else
    log_success "Certbot ya está instalado"
fi

# 4. Verificar DNS
log_info "Verificando configuración DNS..."
echo ""
log_warning "IMPORTANTE: Asegúrate de que estos subdominios apunten a tu servidor:"
SERVER_IP=$(curl -s ifconfig.me || echo "Tu IP")
echo "  api1.${DOMAIN} → $SERVER_IP"
echo "  api2.${DOMAIN} → $SERVER_IP"
echo "  api3.${DOMAIN} → $SERVER_IP"
echo "  coord.${DOMAIN} → $SERVER_IP"
echo ""
read -p "¿Ya configuraste los registros DNS? (s/n): " dns_ready

if [[ ! "$dns_ready" =~ ^[SsYy]$ ]]; then
    log_error "Por favor configura los registros DNS primero"
    exit 1
fi

# 5. Eliminar configuración default de nginx
rm -f /etc/nginx/sites-enabled/default

# 6. Crear configuración de Nginx para Worker 1
log_info "Creando configuración para api1.${DOMAIN}..."
cat > /etc/nginx/sites-available/api1-${DOMAIN} << 'EOF_API1'
server {
    listen 80;
    server_name api1.psic-danieladiaz.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF_API1

# 7. Crear configuración para Worker 2
log_info "Creando configuración para api2.${DOMAIN}..."
cat > /etc/nginx/sites-available/api2-${DOMAIN} << 'EOF_API2'
server {
    listen 80;
    server_name api2.psic-danieladiaz.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF_API2

# 8. Crear configuración para Worker 3
log_info "Creando configuración para api3.${DOMAIN}..."
cat > /etc/nginx/sites-available/api3-${DOMAIN} << 'EOF_API3'
server {
    listen 80;
    server_name api3.psic-danieladiaz.com;

    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF_API3

# 9. Crear configuración para Coordinador
log_info "Creando configuración para coord.${DOMAIN}..."
cat > /etc/nginx/sites-available/coord-${DOMAIN} << 'EOF_COORD'
server {
    listen 80;
    server_name coord.psic-danieladiaz.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF_COORD

# 10. Activar sitios
log_info "Activando sitios..."
ln -sf /etc/nginx/sites-available/api1-${DOMAIN} /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/api2-${DOMAIN} /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/api3-${DOMAIN} /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/coord-${DOMAIN} /etc/nginx/sites-enabled/

# 11. Validar configuración
log_info "Validando configuración de Nginx..."
if nginx -t; then
    log_success "Configuración válida"
else
    log_error "Error en la configuración de Nginx"
    exit 1
fi

# 12. Abrir puertos en firewall
log_info "Configurando firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 'Nginx Full' 2>/dev/null || true
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 3001/tcp
    ufw allow 3002/tcp
    ufw allow 3003/tcp
    ufw allow 4000/tcp
    log_success "Puertos abiertos en UFW"
fi

# 13. Reiniciar Nginx
log_info "Reiniciando Nginx..."
systemctl restart nginx
systemctl enable nginx

# 14. Obtener certificados SSL con Certbot
log_info "Obteniendo certificados SSL con Let's Encrypt..."
echo ""
log_warning "Se solicitará tu email para notificaciones importantes"
echo ""

# Obtener email del usuario
read -p "Ingresa tu email: " EMAIL

# Obtener certificados para todos los subdominios
certbot --nginx \
    -d api1.${DOMAIN} \
    -d api2.${DOMAIN} \
    -d api3.${DOMAIN} \
    -d coord.${DOMAIN} \
    --email "$EMAIL" \
    --agree-tos \
    --redirect \
    --non-interactive || {
        log_error "Error al obtener certificados SSL"
        log_info "Puedes ejecutar manualmente:"
        echo "  certbot --nginx -d api1.${DOMAIN} -d api2.${DOMAIN} -d api3.${DOMAIN} -d coord.${DOMAIN}"
        exit 1
    }

# 15. Verificar estado
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
log_info "Certificados SSL se renovarán automáticamente"
echo ""
log_warning "SIGUIENTE PASO: Actualiza CORS_ORIGIN en el servidor"
echo "  cd /home/polo/banco-distribuido"
echo "  nano .env"
echo "  Agrega: CORS_ORIGIN=https://banco-distribuidos.vercel.app"
echo "  pm2 restart all"
