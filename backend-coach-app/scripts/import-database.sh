#!/bin/bash

# Script pour importer la base de données PostgreSQL

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Import de la base de données...${NC}"

# Vérifier si un fichier de backup est fourni
if [ -z "$1" ]; then
    echo -e "${RED}❌ Erreur: Veuillez spécifier le fichier de backup${NC}"
    echo -e "${YELLOW}Usage: ./import-database.sh backup_YYYYMMDD_HHMMSS.sql${NC}"
    exit 1
fi

BACKUP_FILE="../backups/$1"

# Vérifier si le fichier existe
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Erreur: Le fichier $BACKUP_FILE n'existe pas${NC}"
    exit 1
fi

# Informations de connexion
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="coaching_app"
DB_USER="postgres"

echo -e "${YELLOW}⚠️  ATTENTION: Cette opération va écraser la base de données existante!${NC}"
read -p "Voulez-vous continuer? (oui/non): " confirm

if [ "$confirm" != "oui" ]; then
    echo -e "${YELLOW}Import annulé${NC}"
    exit 0
fi

# Import avec pg_restore
PGPASSWORD="postgres" pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c -v "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Import réussi!${NC}"
else
    echo -e "${RED}❌ Erreur lors de l'import${NC}"
    exit 1
fi
