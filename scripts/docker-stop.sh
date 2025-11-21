#!/bin/bash

# Script para detener todos los contenedores

echo "🛑 Deteniendo contenedores de Docker..."

docker compose down --remove-orphans

echo "✅ Contenedores detenidos"
