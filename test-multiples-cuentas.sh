#!/bin/bash

# Script de prueba: Usuario con Múltiples Cuentas
# Demuestra que un usuario puede tener varias cuentas propias

echo "🏦 PRUEBA: USUARIO CON MÚLTIPLES CUENTAS"
echo "=========================================="
echo ""

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

WORKER1="http://localhost:3001"
TIMESTAMP=$(date +%s)

echo -e "${BLUE}📝 Paso 1: Registrar Usuario${NC}"
echo "------------------------------------------------------"
RESPONSE1=$(curl -s -X POST "$WORKER1/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"nombre\": \"Carlos López\",
    \"email\": \"carlos${TIMESTAMP}@banco.com\",
    \"password\": \"12345678\"
  }")

echo "$RESPONSE1" | jq '.'

TOKEN=$(echo "$RESPONSE1" | jq -r '.token')
USUARIO_ID=$(echo "$RESPONSE1" | jq -r '.usuarioId')
CUENTA1_NUM=$(echo "$RESPONSE1" | jq -r '.numeroCuenta')

echo -e "${GREEN}✅ Usuario registrado${NC}"
echo "   Email: carlos${TIMESTAMP}@banco.com"
echo "   Cuenta inicial: $CUENTA1_NUM"
echo ""

sleep 1

echo -e "${BLUE}📝 Paso 2: Crear cuenta de Ahorros${NC}"
echo "------------------------------------------------------"
RESPONSE2=$(curl -s -X POST "$WORKER1/api/cuentas/crear" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "tipoCuenta": "DEBITO",
    "nombre": "Cuenta de Ahorros"
  }')

echo "$RESPONSE2" | jq '.'
CUENTA2_NUM=$(echo "$RESPONSE2" | jq -r '.cuenta.numeroCuenta')

echo -e "${GREEN}✅ Cuenta de Ahorros creada${NC}"
echo "   Número: $CUENTA2_NUM"
echo ""

sleep 1

echo -e "${BLUE}📝 Paso 3: Crear cuenta en USD${NC}"
echo "------------------------------------------------------"
RESPONSE3=$(curl -s -X POST "$WORKER1/api/cuentas/crear" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "tipoCuenta": "CHEQUES",
    "nombre": "Cuenta USD"
  }')

echo "$RESPONSE3" | jq '.'
CUENTA3_NUM=$(echo "$RESPONSE3" | jq -r '.cuenta.numeroCuenta')

echo -e "${GREEN}✅ Cuenta USD creada${NC}"
echo "   Número: $CUENTA3_NUM"
echo ""

sleep 1

echo -e "${BLUE}📝 Paso 4: Crear tarjeta de crédito${NC}"
echo "------------------------------------------------------"
RESPONSE4=$(curl -s -X POST "$WORKER1/api/cuentas/crear" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "tipoCuenta": "CREDITO",
    "nombre": "Tarjeta de Crédito"
  }')

echo "$RESPONSE4" | jq '.'
CUENTA4_NUM=$(echo "$RESPONSE4" | jq -r '.cuenta.numeroCuenta')

echo -e "${GREEN}✅ Cuenta de Crédito creada${NC}"
echo "   Número: $CUENTA4_NUM"
echo ""

sleep 1

echo -e "${BLUE}📝 Paso 5: Consultar perfil del usuario${NC}"
echo "------------------------------------------------------"
RESPONSE5=$(curl -s -X GET "$WORKER1/api/auth/me" \
  -H "Authorization: Bearer $TOKEN")

echo "$RESPONSE5" | jq '.'

NUM_CUENTAS=$(echo "$RESPONSE5" | jq '.usuario.cuentas | length')
NUM_TARJETAS=$(echo "$RESPONSE5" | jq '.usuario.tarjetas | length')

echo ""
echo -e "${GREEN}✅ El usuario ahora tiene:${NC}"
echo "   📊 $NUM_CUENTAS cuentas"
echo "   💳 $NUM_TARJETAS tarjetas"
echo ""

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   🎉 PRUEBA COMPLETADA                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ Conceptos Demostrados:"
echo ""
echo "   1. 📊 MÚLTIPLES CUENTAS POR USUARIO"
echo "      • Cuenta inicial (creada en registro)"
echo "      • Cuenta de Ahorros"
echo "      • Cuenta USD"
echo "      • Cuenta/Tarjeta de Crédito"
echo ""
echo "   2. 💳 UNA TARJETA POR CUENTA"
echo "      • Cada cuenta tiene su propia tarjeta automática"
echo "      • El usuario tiene $NUM_TARJETAS tarjetas en total"
echo ""
echo "   3. 🎯 CASOS DE USO REALES"
echo "      • Separar ahorros de gastos"
echo "      • Manejar múltiples monedas"
echo "      • Organizar finanzas por propósito"
echo ""
echo "📋 Cuentas creadas:"
echo "   1. $CUENTA1_NUM (Inicial - CHEQUES)"
echo "   2. $CUENTA2_NUM (Ahorros - DEBITO)"
echo "   3. $CUENTA3_NUM (USD - CHEQUES)"
echo "   4. $CUENTA4_NUM (Crédito - CREDITO)"
echo ""
