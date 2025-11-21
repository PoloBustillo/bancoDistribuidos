#!/bin/bash
# verify-secrets.sh
# Script para verificar que los secrets de GitHub estén configurados correctamente

set -e

REPO="PoloBustillo/bancoDistribuidos"

echo "🔍 Verificando configuración de secrets para GitHub Actions..."
echo "📦 Repositorio: $REPO"
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Lista de secrets requeridos
REQUIRED_SECRETS=(
    "SSH_HOST"
    "SSH_USERNAME"
    "SSH_PRIVATE_KEY"
    "DATABASE_URL"
    "JWT_SECRET"
)

echo "✅ Secrets requeridos para deployment:"
echo ""

for secret in "${REQUIRED_SECRETS[@]}"; do
    echo "  • $secret"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar si gh CLI está instalado
if ! command -v gh &> /dev/null; then
    echo "⚠️  GitHub CLI (gh) no está instalado."
    echo ""
    echo "Para instalar:"
    echo "  Windows: winget install GitHub.cli"
    echo "  Mac:     brew install gh"
    echo "  Linux:   https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
    echo ""
    echo "Después ejecuta: gh auth login"
    echo ""
    echo "📋 Mientras tanto, verifica manualmente en:"
    echo "   https://github.com/$REPO/settings/secrets/actions"
    exit 1
fi

# Verificar autenticación
if ! gh auth status &> /dev/null; then
    echo "❌ No estás autenticado con GitHub CLI"
    echo ""
    echo "Ejecuta: gh auth login"
    exit 1
fi

echo "🔐 Verificando secrets en GitHub..."
echo ""

# Intentar listar secrets (gh CLI no muestra valores, solo nombres)
if gh secret list --repo "$REPO" &> /dev/null; then
    EXISTING_SECRETS=$(gh secret list --repo "$REPO" --json name -q '.[].name')
    
    echo "📋 Secrets encontrados en GitHub:"
    echo ""
    
    for secret in "${REQUIRED_SECRETS[@]}"; do
        if echo "$EXISTING_SECRETS" | grep -q "^$secret$"; then
            echo -e "  ${GREEN}✓${NC} $secret"
        else
            echo -e "  ${RED}✗${NC} $secret ${YELLOW}(FALTA)${NC}"
        fi
    done
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Verificar si faltan secrets
    MISSING=0
    for secret in "${REQUIRED_SECRETS[@]}"; do
        if ! echo "$EXISTING_SECRETS" | grep -q "^$secret$"; then
            ((MISSING++))
        fi
    done
    
    if [ $MISSING -eq 0 ]; then
        echo -e "${GREEN}✅ ¡Todos los secrets están configurados!${NC}"
        echo ""
        echo "Próximo paso: Ejecutar script de migración PM2 → Docker"
        echo "Ver: MIGRATION-PM2-TO-DOCKER.md"
    else
        echo -e "${YELLOW}⚠️  Faltan $MISSING secret(s)${NC}"
        echo ""
        echo "Para agregar secrets:"
        echo "  1. Ve a: https://github.com/$REPO/settings/secrets/actions"
        echo "  2. Click en 'New repository secret'"
        echo "  3. Sigue la guía en: GITHUB-SECRETS-SETUP.md"
        echo ""
        echo "O usa GitHub CLI:"
        echo "  gh secret set SECRET_NAME --repo $REPO"
    fi
else
    echo "❌ No se pudo acceder a los secrets del repositorio"
    echo ""
    echo "Verifica:"
    echo "  1. Que tienes permisos en el repo: $REPO"
    echo "  2. Que estás autenticado: gh auth login"
    echo "  3. Manualmente en: https://github.com/$REPO/settings/secrets/actions"
fi

echo ""
