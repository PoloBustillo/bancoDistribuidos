#!/bin/bash

# Script para hacer backup manual de la base de datos

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/manual_backup_$TIMESTAMP.sql"

echo "💾 Creando backup manual de la base de datos..."

mkdir -p $BACKUP_DIR

# Hacer backup usando docker compose
docker compose exec -T postgres pg_dump -U banco_user -d banco > $BACKUP_FILE

if [ $? -eq 0 ]; then
  echo "✅ Backup creado exitosamente: $BACKUP_FILE"
  
  # Comprimir el backup
  gzip $BACKUP_FILE
  echo "📦 Backup comprimido: $BACKUP_FILE.gz"
  
  # Mostrar tamaño
  ls -lh $BACKUP_FILE.gz
else
  echo "❌ Error al crear backup"
  exit 1
fi
