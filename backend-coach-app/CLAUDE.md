# CLAUDE.md - FitFlow Backend

> **claude.md lu**

## Vue d'ensemble

Application backend Node.js/Express pour une plateforme de coaching fitness. API REST complète avec authentification JWT, gestion des programmes d'entraînement, nutrition, statistiques et messagerie.

---

## Architecture du projet

```
fitflow-backend/
├── src/
│   ├── config/              # Configuration
│   │   ├── database.js      # Client Prisma
│   │   └── env.js           # Variables d'environnement
│   ├── controllers/         # Logique métier (24 controllers)
│   │   ├── authController.js
│   │   ├── programController.js
│   │   ├── sessionController.js
│   │   ├── clientCoachController.js
│   │   ├── mealController.js
│   │   ├── statController.js
│   │   ├── messageController.js
│   │   └── ...
│   ├── routes/              # Définition des routes API (22 fichiers)
│   ├── middlewares/         # Middlewares Express
│   │   ├── auth.js          # Authentification JWT & autorisation
│   │   └── upload.js        # Upload fichiers avec multer
│   ├── utils/               # Utilitaires
│   │   ├── jwt.js           # Génération/vérification tokens
│   │   ├── bcrypt.js        # Hashage mots de passe
│   │   └── responseHandler.js  # Format réponses standardisé
│   └── server.js            # Point d'entrée Express
├── prisma/
│   ├── schema.prisma        # Schéma base de données
│   └── migrations/          # Migrations
└── package.json
```

---

## Stack technique

| Catégorie | Technologie |
|-----------|-------------|
| Runtime | Node.js (ES Modules) |
| Framework | Express.js ^4.18.2 |
| Base de données | PostgreSQL |
| ORM | Prisma ^5.9.1 |
| Auth | JWT (jsonwebtoken ^9.0.2) |
| Hash | bcrypt ^5.1.1 |
| Upload | multer ^1.4.5 |
| Validation | express-validator ^7.0.1 |

---

## Conventions de code

### Nommage

- **Fichiers controllers** : `camelCaseController.js` ou `camelCase.controller.js`
- **Fichiers routes** : `camelCase.js` (pluriel : `clients.js`, `programs.js`)
- **Fonctions** : camelCase (`createProgram`, `getCoachClients`)
- **Variables** : camelCase (`coachProfile`, `clientId`)
- **Constantes** : UPPER_SNAKE_CASE (`SALT_ROUNDS`)

### Structure d'un controller

```javascript
export const actionName = async (req, res) => {
  try {
    const { field } = req.body;
    const userId = req.user.id;  // Depuis middleware authenticate

    // Validation
    if (!field) return sendError(res, 'Champ requis', 400);

    // Opération base de données
    const result = await prisma.model.action({...});

    // Réponse
    sendSuccess(res, result, 'Message', 201);
  } catch (error) {
    console.error('Action error:', error);
    sendError(res, 'Échec opération', 500);
  }
};
```

### Format de réponse standardisé

```javascript
// Succès
{ success: true, message: "Message", data: {...} }

// Erreur
{ success: false, message: "Erreur", errors: null }
```

### Commentaires

- **Langue** : Français pour les commentaires
- **JSDoc** : Pour les fonctions utilitaires et auth

---

## Base de données (Prisma)

### Modèles principaux

- **User** : Utilisateur (email, password, role: COACH/CLIENT)
- **CoachProfile** : Profil coach (bio, experience, rating, city)
- **ClientProfile** : Profil client (weight, height, goals, level)
- **ClientCoach** : Relation many-to-many client-coach (isPrimary, isActive)
- **Program** : Programme d'entraînement
- **Session** : Séance (status: EMPTY/DRAFT/DONE, isRestDay)
- **Exercise** : Exercice (category: WARMUP/MAIN/CARDIO/STRETCHING)
- **SetCompletion** : Complétion des séries
- **DailyStat** : Statistiques quotidiennes (sleep, water, weight)
- **Meal** : Repas (calories, protein, carbs, fats)
- **Message** : Messages (type: CHAT/TIP)
- **Review** : Avis sur les coaches

### Conventions Prisma

- Clés primaires : UUID
- Timestamps : `createdAt`, `updatedAt`
- Suppression en cascade sur les clés étrangères
- Index unique pour les contraintes métier

---

## Routes API

### Authentification
```
POST /api/auth/register    # Inscription
POST /api/auth/login       # Connexion (retourne JWT)
GET  /api/auth/me          # Profil utilisateur connecté
```

### Pattern CRUD standard
```
POST   /api/resource/           # Créer
GET    /api/resource/           # Lister
GET    /api/resource/:id        # Détail
PUT    /api/resource/:id        # Modifier
DELETE /api/resource/:id        # Supprimer
```

### Middlewares de route
```javascript
router.use(authenticate);  // Appliqué à toutes les routes
router.post('/', authorize('COACH'), createProgram);  // Autorisation par rôle
```

---

## Middlewares

### authenticate
- Vérifie le token JWT dans `Authorization: Bearer {token}`
- Ajoute `req.user` avec les données utilisateur

### authorize(...roles)
- Vérifie que `req.user.role` est dans la liste autorisée
- Retourne 403 si non autorisé

### upload (multer)
- Stockage : dossier `/uploads`
- Taille max : 5MB
- Types autorisés : jpeg, jpg, png, gif, mp4, mov, avi

---

## Variables d'environnement

```env
PORT=5001
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/coaching_app"
JWT_SECRET="votre-secret-jwt"
NODE_ENV=development
```

---

## Scripts npm

```bash
npm run dev          # Développement avec nodemon
npm start            # Production
npm run prisma:generate  # Générer client Prisma
npm run prisma:migrate   # Exécuter migrations
npm run prisma:studio    # Interface Prisma
```

---

## Codes d'erreur HTTP

- `200` : Succès
- `201` : Créé
- `400` : Requête invalide
- `401` : Non authentifié
- `403` : Non autorisé
- `404` : Non trouvé
- `500` : Erreur serveur

---

## Bonnes pratiques

1. **Toujours utiliser** `sendSuccess()` et `sendError()` pour les réponses
2. **Valider les données** avant les opérations DB
3. **Gérer les erreurs Prisma** (P2002 = contrainte unique, P2003 = clé étrangère)
4. **Logger les erreurs** avec `console.error()`
5. **Commenter en français**
6. **Utiliser async/await** avec try/catch
