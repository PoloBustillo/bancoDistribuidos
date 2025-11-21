#!/bin/bash
# stop-pm2.sh
# Script para detener PM2 y liberar puertos antes de usar Docker

set -e

echo "🛑 Deteniendo todos los servicios PM2..."

# Detener PM2
if command -v pm2 &> /dev/null; then
    echo "  ↳ PM2 encontrado, deteniendo procesos..."
    pm2 delete all 2>/dev/null || true
    pm2 save --force 2>/dev/null || true
    pm2 kill 2>/dev/null || true
    echo "  ✅ PM2 detenido"
else
    echo "  ℹ️  PM2 no instalado, saltando..."
fi

# Liberar puertos
echo ""
echo "🔓 Liberando puertos necesarios para Docker..."
for port in 4000 3001 3002 3003; do
    echo "  ↳ Puerto ${port}..."
    fuser -k ${port}/tcp 2>/dev/null || true
    lsof -ti:${port} | xargs kill -9 2>/dev/null || true
done

echo ""
echo "⏳ Esperando 3 segundos para asegurar que los puertos están libres..."
sleep 3

# Verificar que los puertos estén libres
echo ""
echo "🔍 Verificando puertos..."
all_free=true
for port in 4000 3001 3002 3003; do
    if lsof -Pi :${port} -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "  ❌ Puerto ${port} AÚN OCUPADO"
        lsof -Pi :${port} -sTCP:LISTEN
        all_free=false
    else
        echo "  ✅ Puerto ${port} libre"
    fi
done

if [ "$all_free" = true ]; then
    echo ""
    echo "✅ Todos los puertos liberados correctamente!"
    echo "🐋 Ahora puedes iniciar Docker con: docker compose up -d"
    exit 0
else
    echo ""
    echo "⚠️  Algunos puertos siguen ocupados. Ejecuta este script nuevamente o reinicia el servidor."
    exit 1
fi
