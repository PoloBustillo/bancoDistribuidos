#!/bin/sh
# wait-for-it.sh - Script para esperar a que RabbitMQ esté listo

set -e

host="$1"
shift
cmd="$@"

until nc -z rabbitmq 5672; do
  >&2 echo "RabbitMQ is unavailable - sleeping"
  sleep 1
done

>&2 echo "RabbitMQ is up - executing command"
exec $cmd
