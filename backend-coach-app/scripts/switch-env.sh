#!/bin/bash
# Switch de configuration par OS
# Usage : ./scripts/switch-env.sh [linux|mac|windows|auto]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

detect_os() {
  case "$(uname -s)" in
    Linux*)   echo "linux" ;;
    Darwin*)  echo "mac" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *)        echo "linux" ;;
  esac
}

OS="${1:-auto}"
if [ "$OS" = "auto" ]; then
  OS=$(detect_os)
fi

ENV_FILE="$PROJECT_DIR/.env.$OS"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Fichier $ENV_FILE introuvable"
  echo "   OS disponibles : linux, mac, windows"
  exit 1
fi

cp "$ENV_FILE" "$PROJECT_DIR/.env"
echo "✅ Config $OS activée (.env.$OS → .env)"

# Regénérer Prisma pour la bonne plateforme
echo "🔄 Régénération du client Prisma..."
cd "$PROJECT_DIR"
npx prisma generate
echo "✅ Prisma client régénéré pour $OS"
