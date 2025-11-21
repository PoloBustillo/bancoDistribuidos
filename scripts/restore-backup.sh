#!/bin/bash

# Script para restaurar un backup de la base de datos

if [ -z "$1" ]; then
  echo "❌ Error: Debes especificar el archivo de backup"
  echo "Uso: ./restore-backup.sh <archivo_backup.sql.gz>"
  echo ""
  echo "Backups disponibles:"
  ls -lh ./backups/*.sql.gz 2>/dev/null || echo "  No hay backups disponibles"
  exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Error: El archivo $BACKUP_FILE no existe"
  exit 1
fi

echo "⚠️  ADVERTENCIA: Esto sobreescribirá la base de datos actual"
read -p "¿Estás seguro? (escribe 'SI' para continuar): " confirmacion

if [ "$confirmacion" != "SI" ]; then
  echo "❌ Operación cancelada"
  exit 0
fi

echo "🔄 Restaurando backup desde $BACKUP_FILE..."

# Descomprimir si está comprimido
if [[ $BACKUP_FILE == *.gz ]]; then
  echo "📦 Descomprimiendo backup..."
  gunzip -c $BACKUP_FILE | docker compose exec -T postgres psql -U banco_user -d banco
else
  cat $BACKUP_FILE | docker compose exec -T postgres psql -U banco_user -d banco
fi

if [ $? -eq 0 ]; then
  echo "✅ Backup restaurado exitosamente"
else
  echo "❌ Error al restaurar backup"
  exit 1
fi
