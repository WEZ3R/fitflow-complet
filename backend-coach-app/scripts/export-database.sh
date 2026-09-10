#!/bin/bash

# Script pour exporter la base de données PostgreSQL

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Export de la base de données...${NC}"

# Nom du fichier de backup avec la date
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"

# Exporter la base de données
# Remplacez ces valeurs par vos informations de connexion
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="coaching_app"
DB_USER="postgres"

# Export avec pg_dump
PGPASSWORD="postgres" pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -F c -b -v -f "../backups/$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Export réussi!${NC}"
    echo -e "${GREEN}📁 Fichier: backups/$BACKUP_FILE${NC}"
else
    echo -e "${YELLOW}❌ Erreur lors de l'export${NC}"
    exit 1
fi
