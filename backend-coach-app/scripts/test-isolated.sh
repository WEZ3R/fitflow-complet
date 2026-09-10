#!/bin/bash
# Lance la suite de tests d'intégration contre une base et un serveur dédiés.
#
# Les tests créent de vrais comptes via l'API : sans isolation ils polluent la base de
# développement (c'est l'origine des comptes *@test.com trouvés dans coaching_app).
#
# Usage : npm test  (ou npm run test:isolated, identique)
#
# `npm test` pointe sur CE script. Le lanceur brut est `npm run test:raw`, qui refuse
# de tourner si l'API ciblée n'est pas en NODE_ENV=test (cf. __tests__/helpers.js).

set -euo pipefail

TEST_DB="${TEST_DB:-coaching_app_test}"
TEST_PORT="${TEST_PORT:-5002}"
PG_CONTAINER="${PG_CONTAINER:-fitflow-db}"
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
DB_URL="postgresql://postgres:postgres@${PG_HOST}:${PG_PORT}/${TEST_DB}"

cd "$(dirname "$0")/.."

# En local, PostgreSQL tourne dans le conteneur $PG_CONTAINER et on l'administre par
# `docker exec`. En intégration continue, c'est un service container GitHub : le
# conteneur nommé n'existe pas, mais le serveur est joignable sur $PG_HOST et le client
# psql est installé sur le runner. On choisit donc la voie disponible.
if docker inspect "$PG_CONTAINER" >/dev/null 2>&1; then
  echo "▸ PostgreSQL : conteneur ${PG_CONTAINER}"
  psql_admin() { docker exec "$PG_CONTAINER" psql -U postgres "$@"; }
else
  echo "▸ PostgreSQL : serveur ${PG_HOST}:${PG_PORT}"
  psql_admin() { PGPASSWORD=postgres psql -h "$PG_HOST" -p "$PG_PORT" -U postgres "$@"; }
fi

echo "▸ Base de test : ${TEST_DB}"

if [ "${RESET_DB:-0}" = "1" ]; then
  # Un serveur de test laissé ouvert garde des connexions et bloque le DROP. On les coupe,
  # en ciblant strictement la base de test — jamais la base de développement.
  echo "  fermeture des connexions puis suppression…"
  psql_admin -tAc \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
     WHERE datname='${TEST_DB}' AND pid <> pg_backend_pid();" >/dev/null
  psql_admin -c "DROP DATABASE IF EXISTS ${TEST_DB};"
fi

if ! psql_admin -tAc \
      "SELECT 1 FROM pg_database WHERE datname='${TEST_DB}'" | grep -q 1; then
  echo "  création…"
  psql_admin -c "CREATE DATABASE ${TEST_DB} OWNER postgres;"
fi

echo "▸ Synchronisation du schéma"
# --accept-data-loss : la base de test est jetable et son schéma peut avoir divergé
# (colonnes supprimées depuis). Le drapeau ne porte QUE sur $DB_URL, construite plus
# haut à partir de $TEST_DB — jamais sur la base de développement.
# DIRECT_URL doit accompagner DATABASE_URL : dès que le schéma déclare `directUrl`,
# c'est CETTE URL que `prisma db push` utilise pour se connecter. Sans elle, le schéma
# partait dans la base pointée par l'environnement — en intégration continue, la base
# applicative — et les tests trouvaient une base de test vide : « The table
# `public.users` does not exist in the current database ».
DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" npx prisma db push --skip-generate --accept-data-loss >/dev/null

echo "▸ Démarrage du serveur de test sur le port ${TEST_PORT}"
DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" PORT="$TEST_PORT" NODE_ENV=test node src/server.js >/tmp/fitflow-test-server.log 2>&1 &
SERVER_PID=$!
# Arrête le serveur quoi qu'il arrive (succès, échec, interruption)
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  curl -sf -m 2 "http://localhost:${TEST_PORT}/api/health" >/dev/null 2>&1 && break
  sleep 0.5
done

if ! curl -sf -m 2 "http://localhost:${TEST_PORT}/api/health" >/dev/null 2>&1; then
  echo "✖ Le serveur de test n'a pas démarré. Journal :"
  tail -20 /tmp/fitflow-test-server.log
  exit 1
fi

echo "▸ Exécution des tests"
# DATABASE_URL est transmis aux tests, et pas seulement au serveur : certains
# scénarios doivent vérifier en base ce que l'API ne renvoie pas — l'écriture
# d'un journal de modération, par exemple. Ils pointent ainsi sur la base de
# TEST, jamais sur celle de développement.
TEST_API_URL="http://localhost:${TEST_PORT}/api" DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" npm run test:raw
