#!/bin/bash

# Script para desarrollo local con Docker

echo "🐳 Iniciando PostgreSQL para desarrollo..."

# Iniciar solo PostgreSQL
docker compose -f docker-compose.dev.yml up -d

echo "⏳ Esperando a que PostgreSQL esté listo..."
sleep 5

echo "✅ PostgreSQL está corriendo en localhost:5432"
echo ""
echo "📝 Configura tu .env con:"
echo "DATABASE_URL=postgresql://banco_user:banco_dev_password@localhost:5432/banco"
echo ""
echo "🚀 Ahora puedes ejecutar:"
echo "  cd worker && bun run dev"
echo "  cd coordinador && bun run dev"
