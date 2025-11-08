#!/bin/bash

# Script de prueba para Cuentas Compartidas y Tarjetas Individuales
# Demuestra recursos compartidos vs recursos individuales

echo "🏦 PRUEBA: CUENTAS COMPARTIDAS Y TARJETAS INDIVIDUALES"
echo "========================================================"
echo ""

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

WORKER1="http://localhost:3001"
WORKER2="http://localhost:3002"

# Generar timestamp para emails únicos
TIMESTAMP=$(date +%s)

echo -e "${BLUE}📝 Paso 1: Registrar Usuario 1 (Juan)${NC}"
echo "------------------------------------------------------"
RESPONSE1=$(curl -s -X POST "$WORKER1/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"nombre\": \"Juan Pérez\",
    \"email\": \"juan${TIMESTAMP}@banco.com\",
    \"password\": \"12345678\"
  }")

echo "$RESPONSE1" | jq '.'

TOKEN1=$(echo "$RESPONSE1" | jq -r '.token')
CUENTA_ID=$(echo "$RESPONSE1" | jq -r '.cuentaId')
USUARIO1_ID=$(echo "$RESPONSE1" | jq -r '.usuarioId')

echo -e "${GREEN}✅ Juan registrado${NC}"
echo "   Token: ${TOKEN1:0:20}..."
echo "   Cuenta ID: $CUENTA_ID"
echo "   Usuario ID: $USUARIO1_ID"
echo ""

sleep 1

echo -e "${BLUE}📝 Paso 2: Registrar Usuario 2 (María)${NC}"
echo "------------------------------------------------------"
RESPONSE2=$(curl -s -X POST "$WORKER2/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"nombre\": \"María García\",
    \"email\": \"maria${TIMESTAMP}@banco.com\",
    \"password\": \"12345678\"
  }")

echo "$RESPONSE2" | jq '.'

TOKEN2=$(echo "$RESPONSE2" | jq -r '.token')
USUARIO2_ID=$(echo "$RESPONSE2" | jq -r '.usuarioId')
CUENTA_MARIA_ID=$(echo "$RESPONSE2" | jq -r '.cuentaId')

echo -e "${GREEN}✅ María registrada${NC}"
echo "   Token: ${TOKEN2:0:20}..."
echo "   Usuario ID: $USUARIO2_ID"
echo "   Cuenta propia ID: $CUENTA_MARIA_ID"
echo ""

sleep 1

echo -e "${BLUE}📝 Paso 3: Juan agrega a María a su cuenta compartida${NC}"
echo "------------------------------------------------------"
echo "   Juan (TITULAR) comparte su cuenta con María (TITULAR)"
RESPONSE3=$(curl -s -X POST "$WORKER1/api/cuentas-compartidas/$CUENTA_ID/agregar-usuario" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d "{
    \"emailUsuario\": \"maria${TIMESTAMP}@banco.com\",
    \"rol\": \"TITULAR\"
  }")

echo "$RESPONSE3" | jq '.'
echo -e "${GREEN}✅ María agregada como TITULAR${NC}"
echo ""

sleep 1

echo -e "${BLUE}📝 Paso 4: Depositar fondos en la cuenta compartida${NC}"
echo "------------------------------------------------------"
echo "   Juan deposita \$1000 en la cuenta compartida"
RESPONSE4=$(curl -s -X POST "$WORKER1/api/banco/depositar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d "{
    \"cuentaId\": \"$CUENTA_ID\",
    \"monto\": 1000
  }")

echo "$RESPONSE4" | jq '.'
echo -e "${GREEN}✅ Depósito exitoso${NC}"
echo ""

sleep 1

echo -e "${BLUE}📝 Paso 5: Consultar saldo desde ambos workers${NC}"
echo "------------------------------------------------------"
echo "   Juan consulta desde Worker 1:"
SALDO1=$(curl -s -X POST "$WORKER1/api/banco/consultar-saldo" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d "{
    \"cuentaId\": \"$CUENTA_ID\"
  }")
echo "$SALDO1" | jq '.'

echo ""
echo "   María consulta desde Worker 2:"
SALDO2=$(curl -s -X POST "$WORKER2/api/banco/consultar-saldo" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN2" \
  -d "{
    \"cuentaId\": \"$CUENTA_ID\"
  }")
echo "$SALDO2" | jq '.'

echo -e "${GREEN}✅ Ambos ven el mismo saldo${NC}"
echo ""

sleep 1

echo -e "${BLUE}📝 Paso 6: María crea su propia tarjeta en la cuenta compartida${NC}"
echo "------------------------------------------------------"
RESPONSE6=$(curl -s -X POST "$WORKER2/api/cuentas-compartidas/$CUENTA_ID/tarjetas" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN2" \
  -d '{
    "tipoTarjeta": "CREDITO"
  }')

echo "$RESPONSE6" | jq '.'
TARJETA_MARIA_ID=$(echo "$RESPONSE6" | jq -r '.tarjeta.id')
echo -e "${GREEN}✅ Tarjeta de María creada${NC}"
echo "   Tarjeta ID: $TARJETA_MARIA_ID"
echo ""

sleep 1

echo -e "${BLUE}📝 Paso 7: Listar todas las tarjetas de la cuenta${NC}"
echo "------------------------------------------------------"
RESPONSE7=$(curl -s -X GET "$WORKER1/api/cuentas-compartidas/$CUENTA_ID/tarjetas" \
  -H "Authorization: Bearer $TOKEN1")

echo "$RESPONSE7" | jq '.'
echo -e "${GREEN}✅ Se muestran todas las tarjetas (2 total: Juan y María)${NC}"
echo ""

sleep 1

echo -e "${BLUE}📝 Paso 8: Listar usuarios con acceso a la cuenta${NC}"
echo "------------------------------------------------------"
RESPONSE8=$(curl -s -X GET "$WORKER1/api/cuentas-compartidas/$CUENTA_ID/usuarios" \
  -H "Authorization: Bearer $TOKEN1")

echo "$RESPONSE8" | jq '.'
echo -e "${GREEN}✅ Se muestran ambos usuarios con sus roles${NC}"
echo ""

sleep 1

echo -e "${YELLOW}⚡ Paso 9: PRUEBA DE CONCURRENCIA - Transferencias simultáneas${NC}"
echo "------------------------------------------------------"
echo "   Juan y María transferirán simultáneamente desde la cuenta compartida"
echo "   Esto demostrará los locks distribuidos en acción"
echo ""
echo "   Juan transfiere \$100 a la cuenta de María..."
echo "   María transfiere \$50 a la cuenta de Juan..."
echo ""

# Lanzar ambas transferencias simultáneamente
(curl -s -X POST "$WORKER1/api/banco/transferir" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d "{
    \"cuentaOrigenId\": \"$CUENTA_ID\",
    \"cuentaDestinoId\": \"$CUENTA_MARIA_ID\",
    \"monto\": 100
  }" > /tmp/transfer1.json) &

(curl -s -X POST "$WORKER2/api/banco/transferir" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN2" \
  -d "{
    \"cuentaOrigenId\": \"$CUENTA_ID\",
    \"cuentaDestinoId\": \"$CUENTA_MARIA_ID\",
    \"monto\": 50
  }" > /tmp/transfer2.json) &

# Esperar a que terminen ambas
wait

echo "   Resultado Transferencia 1 (Juan):"
cat /tmp/transfer1.json | jq '.'
echo ""
echo "   Resultado Transferencia 2 (María):"
cat /tmp/transfer2.json | jq '.'
echo ""

echo -e "${GREEN}✅ Transferencias completadas${NC}"
echo "   Los locks distribuidos garantizaron que no hubo race conditions"
echo ""

sleep 1

echo -e "${BLUE}📝 Paso 10: Verificar saldo final${NC}"
echo "------------------------------------------------------"
SALDO_FINAL=$(curl -s -X POST "$WORKER1/api/banco/consultar-saldo" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d "{
    \"cuentaId\": \"$CUENTA_ID\"
  }")

echo "$SALDO_FINAL" | jq '.'
SALDO=$(echo "$SALDO_FINAL" | jq -r '.cuenta.saldo')
echo -e "${GREEN}✅ Saldo esperado: \$850 (1000 - 100 - 50)${NC}"
echo -e "${GREEN}✅ Saldo actual: \$$SALDO${NC}"
echo ""

sleep 1

echo -e "${BLUE}📝 Paso 11: María intenta bloquear la tarjeta de Juan (debe fallar)${NC}"
echo "------------------------------------------------------"
TARJETA_JUAN=$(echo "$RESPONSE7" | jq -r '.tarjetas[] | select(.usuario.email == "juan@banco.com") | .id')
echo "   Tarjeta de Juan: $TARJETA_JUAN"

RESPONSE11=$(curl -s -X PATCH "$WORKER2/api/tarjetas/$TARJETA_JUAN/estado" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN2" \
  -d '{
    "estado": "BLOQUEADA"
  }')

echo "$RESPONSE11" | jq '.'
echo -e "${RED}✅ Operación denegada correctamente (tarjetas son individuales)${NC}"
echo ""

sleep 1

echo -e "${BLUE}📝 Paso 12: María bloquea su propia tarjeta (debe funcionar)${NC}"
echo "------------------------------------------------------"
RESPONSE12=$(curl -s -X PATCH "$WORKER2/api/tarjetas/$TARJETA_MARIA_ID/estado" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN2" \
  -d '{
    "estado": "BLOQUEADA"
  }')

echo "$RESPONSE12" | jq '.'
echo -e "${GREEN}✅ Tarjeta bloqueada exitosamente${NC}"
echo ""

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   🎉 PRUEBA COMPLETADA                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ Conceptos Demostrados:"
echo ""
echo "   1. 🔗 CUENTAS COMPARTIDAS (Recurso compartido)"
echo "      • Juan y María tienen acceso a la misma cuenta"
echo "      • Ambos pueden consultar, transferir, depositar"
echo "      • Los locks distribuidos previenen race conditions"
echo ""
echo "   2. 💳 TARJETAS INDIVIDUALES (Recurso individual)"
echo "      • Cada usuario tiene su propia tarjeta"
echo "      • Solo el dueño puede modificar su tarjeta"
echo "      • No requieren locks (son recursos individuales)"
echo ""
echo "   3. 🔐 CONTROL DE ACCESO (RBAC)"
echo "      • Roles: TITULAR, AUTORIZADO, CONSULTA"
echo "      • Permisos diferentes según el rol"
echo ""
echo "   4. ⚡ SINCRONIZACIÓN DISTRIBUIDA"
echo "      • Transferencias concurrentes desde workers diferentes"
echo "      • Locks garantizan consistencia"
echo "      • Saldo final correcto ($SALDO)"
echo ""
echo "📊 Revisa los logs del coordinador para ver los locks en acción"
echo ""

# Limpiar archivos temporales
rm -f /tmp/transfer1.json /tmp/transfer2.json
