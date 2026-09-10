# Commande: generate-adr

Génère un ADR (Architecture Decision Record) complet du projet backend FitFlow.

## Instructions

Analyse le projet et génère un rapport structuré contenant:

1. **Architecture globale**
   - Structure des dossiers
   - Pattern architectural (MVC, etc.)
   - Flux de données

2. **Stack technique**
   - Technologies utilisées
   - Versions des dépendances principales
   - Base de données

3. **Conventions de code**
   - Nommage des fichiers et fonctions
   - Structure des controllers
   - Format des réponses API

4. **Modèles de données**
   - Schéma Prisma
   - Relations entre entités
   - Enums et types

5. **Patterns API**
   - Routes et endpoints
   - Middlewares
   - Authentification/Autorisation

6. **Bonnes pratiques**
   - Gestion des erreurs
   - Validation des données
   - Sécurité

## Fichiers à analyser

- `src/server.js` - Point d'entrée
- `src/config/` - Configuration
- `src/controllers/` - Logique métier
- `src/routes/` - Définition des routes
- `src/middlewares/` - Middlewares
- `src/utils/` - Utilitaires
- `prisma/schema.prisma` - Schéma base de données
- `package.json` - Dépendances

## Format de sortie

Génère un document markdown structuré avec des exemples de code concrets tirés du projet.
