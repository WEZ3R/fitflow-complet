# Guide de sauvegarde et restauration de la base de données

## 📋 Pourquoi faire des backups ?

Quand vous changez de PC ou si vous voulez récupérer vos données, vous aurez besoin d'exporter et d'importer votre base de données PostgreSQL.

## 🔧 Configuration initiale

Avant d'utiliser les scripts, vous devez configurer vos informations de connexion:

1. Ouvrez `scripts/export-database.sh`
2. Modifiez ces variables selon votre configuration:
   ```bash
   DB_HOST="localhost"       # Adresse de votre serveur PostgreSQL
   DB_PORT="5432"           # Port PostgreSQL
   DB_NAME="coaching_app"   # Nom de votre base de données
   DB_USER="postgres"       # Votre nom d'utilisateur
   ```
3. Remplacez `your_password` par votre mot de passe PostgreSQL

4. Faites de même dans `scripts/import-database.sh`

## 📤 Exporter la base de données (ancien PC)

### Méthode 1: Avec le script (recommandé)

```bash
cd backend/scripts
chmod +x export-database.sh
./export-database.sh
```

Le fichier de backup sera créé dans `backend/backups/` avec un nom comme:
- `backup_20250127_143052.sql`

### Méthode 2: Manuellement avec pg_dump

```bash
pg_dump -h localhost -p 5432 -U postgres -d coaching_app -F c -f backup.sql
```

## 📥 Importer la base de données (nouveau PC)

### Prérequis sur le nouveau PC:
1. PostgreSQL installé
2. Base de données `coaching_app` créée:
   ```bash
   psql -U postgres
   CREATE DATABASE coaching_app;
   \q
   ```
3. Les migrations Prisma exécutées:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

### Méthode 1: Avec le script (recommandé)

```bash
cd backend/scripts
chmod +x import-database.sh
./import-database.sh backup_20250127_143052.sql
```

### Méthode 2: Manuellement avec pg_restore

```bash
pg_restore -h localhost -p 5432 -U postgres -d coaching_app -c backup.sql
```

## 🚀 Transfert complet vers un nouveau PC

### Sur l'ancien PC:

1. **Exporter la base de données:**
   ```bash
   cd backend/scripts
   ./export-database.sh
   ```

2. **Copier le projet complet:**
   - Copiez tout le dossier `coach-app` sur une clé USB ou cloud
   - OU utilisez Git:
     ```bash
     git add .
     git commit -m "Backup avant changement de PC"
     git push
     ```

### Sur le nouveau PC:

1. **Installer les prérequis:**
   - Node.js (v18+)
   - PostgreSQL (v14+)
   - Git (optionnel)

2. **Récupérer le projet:**
   - Copier le dossier depuis la clé USB
   - OU cloner depuis Git:
     ```bash
     git clone <votre-repo>
     cd coach-app
     ```

3. **Installer les dépendances:**
   ```bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd ../frontend
   npm install
   ```

4. **Configurer PostgreSQL:**
   ```bash
   # Créer la base de données
   psql -U postgres
   CREATE DATABASE coaching_app;
   \q
   ```

5. **Configurer les variables d'environnement:**
   ```bash
   cd backend
   cp .env.example .env
   # Éditer .env avec vos informations
   ```

6. **Exécuter les migrations Prisma:**
   ```bash
   cd backend
   npx prisma generate
   npx prisma migrate deploy
   ```

7. **Importer les données:**
   ```bash
   cd scripts
   chmod +x import-database.sh
   ./import-database.sh backup_20250127_143052.sql
   ```

8. **Démarrer l'application:**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev

   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

## 📝 Bonnes pratiques

1. **Sauvegardes régulières:**
   - Faites un backup avant chaque grosse modification
   - Gardez plusieurs versions de backup

2. **Nommer les backups:**
   - Les scripts génèrent automatiquement des noms avec date/heure
   - Format: `backup_YYYYMMDD_HHMMSS.sql`

3. **Stocker les backups:**
   - Sur un cloud (Google Drive, Dropbox, etc.)
   - Sur un disque externe
   - Dans un dépôt Git privé (attention à la taille!)

4. **Tester la restauration:**
   - Testez régulièrement que vos backups fonctionnent
   - Essayez de restaurer sur une base de test

## ⚠️ Important

- **Ne commitez JAMAIS** les fichiers `.sql` dans Git (ils sont ignorés par défaut)
- **Protégez vos backups:** ils contiennent toutes les données sensibles
- **Mot de passe:** Pour plus de sécurité, utilisez un fichier `.pgpass` au lieu de mettre le mot de passe dans le script

## 🔒 Sécurité - Fichier .pgpass (optionnel)

Pour éviter de mettre le mot de passe dans les scripts:

1. Créer `~/.pgpass`:
   ```bash
   echo "localhost:5432:coaching_app:postgres:votre_mot_de_passe" > ~/.pgpass
   chmod 600 ~/.pgpass
   ```

2. Retirer `PGPASSWORD="your_password"` des scripts

## 🆘 Dépannage

### Erreur: "permission denied"
```bash
chmod +x scripts/export-database.sh
chmod +x scripts/import-database.sh
```

### Erreur: "database does not exist"
Créez d'abord la base de données:
```bash
psql -U postgres -c "CREATE DATABASE coaching_app;"
```

### Erreur: "pg_dump: command not found"
PostgreSQL n'est pas dans le PATH. Utilisez le chemin complet:
```bash
/usr/local/bin/pg_dump ...
# ou sur Mac avec Postgres.app:
/Applications/Postgres.app/Contents/Versions/latest/bin/pg_dump ...
```

## 📞 Support

Si vous rencontrez des problèmes, vérifiez:
1. PostgreSQL est bien démarré
2. Les informations de connexion sont correctes dans les scripts
3. Vous avez les permissions nécessaires sur la base de données
