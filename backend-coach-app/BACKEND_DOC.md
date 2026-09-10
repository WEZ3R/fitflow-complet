# FitFlow Backend — Documentation complète

## Vue d'ensemble

API REST Node.js/Express pour une plateforme de coaching fitness. Elle gère l'authentification, les programmes d'entraînement, la nutrition, la messagerie, la prise de rendez-vous et les statistiques.

- **Runtime :** Node.js (ES Modules)
- **Framework :** Express.js ^4.18.2
- **Base de données :** PostgreSQL via Prisma ^5.9.1
- **Auth :** JWT (7 jours)
- **Port par défaut :** 5001

---

## Architecture du dossier

```
fitflow-backend/
├── src/
│   ├── config/
│   │   ├── database.js          # Singleton Prisma Client
│   │   └── env.js               # Variables d'environnement typées
│   ├── middlewares/
│   │   ├── auth.js              # JWT + RBAC
│   │   └── upload.js            # Multer (fichiers)
│   ├── utils/
│   │   ├── jwt.js               # generateToken / verifyToken
│   │   ├── bcrypt.js            # hashPassword / comparePassword
│   │   └── responseHandler.js   # sendSuccess / sendError
│   ├── controllers/             # 19 controllers (logique métier)
│   ├── routes/                  # 17 fichiers de routes
│   ├── jobs/
│   │   └── appointmentReminders.js  # Cron de rappels RDV
│   └── server.js                # Point d'entrée Express
├── prisma/
│   ├── schema.prisma            # 19 modèles, 6 enums
│   └── seed.js                  # Données de test (35 users, ~1600 sessions)
└── uploads/                     # Créé à l'exécution (photos, vidéos)
```

---

## Variables d'environnement

```env
PORT=5001
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@host:5432/coaching_app
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=coaching_app
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
MAX_FILE_SIZE=5242880
UPLOAD_DIR=./uploads
```

---

## Scripts npm

```bash
npm run dev              # Développement avec nodemon
npm start                # Production
npm run seed             # Peupler la base de test
npm run prisma:generate  # Régénérer le client Prisma
npm run prisma:migrate   # Appliquer les migrations
npm run prisma:studio    # Interface graphique Prisma
```

---

## Structure des données (Prisma)

### Enums

| Enum | Valeurs |
|------|---------|
| `UserRole` | `COACH`, `CLIENT` |
| `SessionStatus` | `EMPTY`, `DRAFT`, `DONE` |
| `ExerciseCategory` | `WARMUP`, `MAIN`, `CARDIO`, `STRETCHING` |
| `MessageType` | `CHAT`, `TIP`, `APPOINTMENT_PROPOSAL` |
| `AppointmentStatus` | `PROPOSED`, `CONFIRMED`, `CANCELLED` |
| `LocationType` | `PHYSICAL`, `REMOTE`, `PHONE`, `GYM`, `CAFE`, `VISIO` |

---

### Modèles — Utilisateurs

#### `User`
Compte utilisateur de base.

| Champ | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `email` | String | unique |
| `password` | String | bcrypt |
| `role` | UserRole | COACH ou CLIENT |
| `firstName`, `lastName` | String | |
| `phone`, `birthDate` | String? | optionnels |
| Relations | coachProfile, clientProfile | 1:1 |

#### `CoachProfile`
Profil spécifique d'un coach.

| Champ | Type | Notes |
|-------|------|-------|
| `userId` | UUID | FK → User (1:1) |
| `bio`, `experience` | String? | |
| `rating` | Float | défaut 0 |
| `ratingCount` | Int | défaut 0 |
| `city`, `profilePicture` | String? | |
| `isRemote` | Boolean | défaut false |
| `trainingLocations` | String[] | |
| Relations | clientCoaches, programs, messages, appointments, scheduleBlocks, clientBlocks, posts, reviews | |

#### `ClientProfile`
Profil spécifique d'un client.

| Champ | Type | Notes |
|-------|------|-------|
| `userId` | UUID | FK → User (1:1) |
| `coachId` | UUID? | FK → CoachProfile (compat. rétro) |
| `weight`, `height` | Float? | |
| `dateOfBirth` | DateTime? | |
| `gender`, `goals`, `level` | String? | |
| `city`, `profilePicture` | String? | |
| `trainingLocations` | String[] | |
| Relations | coaches (M:M via ClientCoach), stats, meals, messages, reviews, appointments, availabilities, blockedBy | |

#### `ClientCoach`
Table de jointure M:M client ↔ coach avec métadonnées.

| Champ | Type | Notes |
|-------|------|-------|
| `clientId`, `coachId` | UUID | FK, unique(clientId, coachId) |
| `isPrimary` | Boolean | défaut false |
| `isActive` | Boolean | défaut true |
| `startDate`, `endDate` | DateTime? | |

---

### Modèles — Programmes & Séances

#### `Program`
Programme d'entraînement assigné à un client.

| Champ | Type | Notes |
|-------|------|-------|
| `coachId`, `clientId` | UUID | FK |
| `title`, `description` | String | |
| `cycleDays` | Int? | durée du cycle |
| `startDate`, `endDate` | DateTime | |
| `isActive` | Boolean | défaut true |
| `dietEnabled` | Boolean | |
| `dietType` | String? | `calories` ou `menu` |
| `targetCalories` | Int? | |
| `waterTrackingEnabled`, `waterGoal` | Boolean/Float? | |
| `sleepTrackingEnabled`, `weightTrackingEnabled` | Boolean | |
| Relations | sessions, mealPlans, customGoals | |

#### `Session`
Séance d'entraînement pour une date donnée.

| Champ | Type | Notes |
|-------|------|-------|
| `programId` | UUID | FK |
| `date` | DateTime | unique(programId, date) |
| `status` | SessionStatus | EMPTY / DRAFT / DONE |
| `isRestDay` | Boolean | |
| `notes` | String? | |
| Relations | exercises, comments | |

#### `Exercise`
Exercice dans une séance.

| Champ | Type | Notes |
|-------|------|-------|
| `sessionId` | UUID | FK |
| `name` | String | |
| `category` | ExerciseCategory | |
| `sets` | Int? | |
| `reps` | String? | ex: "8-10" |
| `weight`, `restTime`, `duration` | Float?/Int? | |
| `videoUrl`, `gifUrl`, `description` | String? | |
| `order` | Int | |
| `exerciseRefId` | UUID? | FK → ExerciseReference |
| Relations | setCompletions, exerciseRef | |

#### `SetCompletion`
Complétion d'une série par le client.

| Champ | Type | Notes |
|-------|------|-------|
| `exerciseId` | UUID | FK, unique(exerciseId, setNumber) |
| `setNumber` | Int | |
| `repsAchieved` | Int? | |
| `weightUsed` | Float? | |
| `completed` | Boolean | |

#### `ProgramTemplate`
Template réutilisable de programme.

| Champ | Type | Notes |
|-------|------|-------|
| `coachId` | UUID | FK |
| `name`, `description` | String | |
| `cycleDays` | Int? | |
| `sessionsData` | Json | structure des séances |
| `customGoalsData` | Json | structure des objectifs |
| + tous les flags de tracking | | identiques à Program |

#### `CustomGoal`
Objectif personnalisé dans un programme.

| Champ | Type | Notes |
|-------|------|-------|
| `programId` | UUID | FK |
| `title`, `description` | String | |
| `order` | Int | |
| Relations | completions (GoalCompletion) | |

#### `GoalCompletion`
Complétion quotidienne d'un objectif.

| Champ | Type | Notes |
|-------|------|-------|
| `customGoalId`, `clientId` | UUID | FK, unique(customGoalId, clientId, date) |
| `date` | DateTime | |
| `completed` | Boolean | |

---

### Modèles — Nutrition

#### `Meal`
Repas enregistré par un client.

| Champ | Type | Notes |
|-------|------|-------|
| `clientId` | UUID | FK |
| `date` | DateTime | |
| `mealType` | String | breakfast/lunch/dinner/snack |
| `description` | String? | |
| `photoUrl` | String? | |
| `calories`, `protein`, `carbs`, `fats` | Float? | |

#### `MealPlan`
Plan alimentaire lié à un programme.

| Champ | Type | Notes |
|-------|------|-------|
| `programId` | UUID | FK |
| `title`, `description` | String? | |
| `dailyCalories` | Int? | |
| Relations | menuItems | |

#### `MenuItem`
Élément d'un plan alimentaire.

| Champ | Type | Notes |
|-------|------|-------|
| `mealPlanId` | UUID | FK |
| `mealType`, `name`, `description` | String | |
| `calories`, `protein`, `carbs`, `fats` | Float? | |

#### `CiqualFood`
Base de données alimentaire française (CIQUAL).

| Champ | Type | Notes |
|-------|------|-------|
| `ciqualCode` | String | unique |
| `name`, `groupName` | String | |
| `energyKcal100g`, `proteins100g`, `carbohydrates100g`, `fat100g` | Float? | |
| `fiber100g`, `sugars100g`, `salt100g` | Float? | |

---

### Modèles — Statistiques

#### `DailyStat`
Statistiques quotidiennes d'un client.

| Champ | Type | Notes |
|-------|------|-------|
| `clientId` | UUID | FK, unique(clientId, date) |
| `date` | DateTime | |
| `sleepHours` | Float? | |
| `bedTime`, `wakeTime` | String? | |
| `waterIntake` | Float? | litres |
| `weight` | Float? | kg |
| `totalCalories` | Float? | calculé automatiquement |
| `workoutTime`, `workoutDuration` | String?/Int? | |
| `notes` | String? | |

---

### Modèles — Communication

#### `Message`
Message entre coach et client.

| Champ | Type | Notes |
|-------|------|-------|
| `coachId`, `clientId` | UUID | FK |
| `content` | String | |
| `type` | MessageType | CHAT / TIP / APPOINTMENT_PROPOSAL |
| `scheduledTime` | DateTime? | pour les TIPs |
| `isRead` | Boolean | |
| `isSentByCoach` | Boolean | |
| `appointmentId` | UUID? | FK unique → Appointment |

#### `CoachPost`
Publication sur le mur d'un coach.

| Champ | Type | Notes |
|-------|------|-------|
| `coachId` | UUID | FK |
| `content` | String | |
| `mediaType`, `mediaUrl` | String? | image ou vidéo |
| `isPublic` | Boolean | |

#### `Review`
Avis d'un client sur un coach.

| Champ | Type | Notes |
|-------|------|-------|
| `coachId`, `clientId` | UUID | FK, unique(coachId, clientId) |
| `rating` | Int | 1–5 |
| `comment` | String? | |

---

### Modèles — Rendez-vous & Disponibilités

#### `Appointment`
Rendez-vous entre coach et client.

| Champ | Type | Notes |
|-------|------|-------|
| `coachId` | UUID | FK |
| `clientId` | UUID? | FK (optionnel) |
| `title` | String | |
| `startAt`, `endAt` | DateTime | |
| `durationMinutes` | Int | |
| `locationType` | LocationType | |
| `locationDetail` | String? | |
| `status` | AppointmentStatus | PROPOSED / CONFIRMED / CANCELLED |
| `rrule` | String? | RFC 5545 (récurrence) |
| `parentId` | UUID? | FK self (série récurrente) |
| Relations | children (self), message | |

#### `ClientAvailability`
Créneaux récurrents de disponibilité d'un client.

| Champ | Type | Notes |
|-------|------|-------|
| `clientId` | UUID | FK |
| `dayOfWeek` | Int | 0 (lundi) – 6 (dimanche) |
| `startTime`, `endTime` | String | |
| `contactTypes` | String[] | PHONE/GYM/CAFE/VISIO |

#### `CoachScheduleBlock`
Blocage de créneau dans l'agenda d'un coach.

| Champ | Type | Notes |
|-------|------|-------|
| `coachId` | UUID | FK |
| `dayOfWeek` | Int? | si récurrent |
| `date` | DateTime? | si ponctuel |
| `reason` | String? | |

#### `CoachClientBlock`
Blocage d'un client par un coach.

| Champ | Type | Notes |
|-------|------|-------|
| `coachId`, `clientId` | UUID | FK, unique |
| `blockedUntil` | DateTime? | null = permanent |
| `reason` | String? | |

#### `CoachRequest`
Demande de coaching envoyée par un client.

| Champ | Type | Notes |
|-------|------|-------|
| `coachId`, `clientId` | UUID | FK, unique |
| `message` | String? | |
| `status` | String | pending / accepted / rejected |

---

### Modèles — Référentiels

#### `ExerciseReference`
Bibliothèque d'exercices.

| Champ | Type | Notes |
|-------|------|-------|
| `exerciseDbId` | String | unique |
| `name` | String | |
| `bodyParts`, `targetMuscles`, `secondaryMuscles`, `equipments` | String[] | |
| `exerciseType` | String? | |
| `gifUrl` | String? | |
| `instructions` | String[] | |

#### `Comment`
Commentaire coach sur une séance client.

| Champ | Type | Notes |
|-------|------|-------|
| `sessionId` | UUID? | FK |
| `clientId` | UUID | |
| `content` | String | |
| `date` | DateTime | |
| `isPastComment` | Boolean | |

#### `Channel`
Canal de contenu d'un coach.

| Champ | Type | Notes |
|-------|------|-------|
| `coachId` | UUID | FK |
| `title`, `description`, `content` | String? | |
| `isPublished` | Boolean | |

---

## Middlewares

### `auth.js`

#### `authenticate`
Vérifie le JWT dans `Authorization: Bearer {token}`.
- Attache `req.user` : `{ id, email, role, firstName, lastName }`
- 401 si token absent, invalide ou utilisateur inexistant en base

#### `authorize(...roles)`
Retourne un middleware qui vérifie `req.user.role`.
- 403 si le rôle ne correspond pas
- Usage : `router.post('/', authorize('COACH'), controller)`

### `upload.js`
Multer configuré pour sauvegarder dans `/uploads`.
- Nom de fichier : `{fieldname}-{timestamp}-{random}.{ext}`
- Types autorisés : jpeg, jpg, png, gif, mp4, mov, avi
- Taille max : 5 MB
- Exporte `upload` et `handleUploadError`

---

## Utilitaires

### `jwt.js`
- `generateToken(payload)` → signe avec `JWT_SECRET`, expire dans `JWT_EXPIRES_IN`
- `verifyToken(token)` → décode ou lève `Error('Invalid token')`

### `bcrypt.js`
- `hashPassword(password)` → bcrypt SALT_ROUNDS=10
- `comparePassword(password, hash)` → retourne booléen

### `responseHandler.js`
Standardise toutes les réponses de l'API.
- `sendSuccess(res, data, message, statusCode=200)` → `{ success: true, message, data }`
- `sendError(res, message, statusCode=500, errors)` → `{ success: false, message, errors }`

---

## Controllers & Routes

### Authentification — `authController.js` → `/api/auth`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/register` | — | Inscription + création profil |
| POST | `/login` | — | Connexion → JWT |
| GET | `/me` | ✓ | Profil complet de l'utilisateur connecté |
| PUT | `/profile` | ✓ | Mise à jour des infos de base |

**`register`** : valide email/password/role, hash le mdp, crée User + CoachProfile ou ClientProfile, retourne JWT.
**`login`** : compare bcrypt, retourne user (sans password) + JWT.
**`getMe`** : inclut les relations (coaches pour client, clients pour coach).

---

### Clients — `clients.controller.js` → `/api/clients`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/me` | CLIENT | Mon profil |
| PUT | `/me` | CLIENT | Modifier mon profil (+ photo) |
| GET | `/coach` | COACH | Liste de mes clients actifs |
| GET | `/prospection` | COACH | Clients sans coach dans ma zone |
| GET | `/:id` | COACH | Profil d'un client spécifique |

**`getProspectiveClients`** : retourne les clients non encore liés correspondant à la ville/lieux du coach avec un score de compatibilité.

---

### Coaches — `coaches.controller.js` → `/api/coaches`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/` | — | Liste publique des coaches |
| GET | `/me` | COACH | Mon profil complet |
| PUT | `/me` | COACH | Modifier mon profil (+ photo) |
| GET | `/:coachId` | — | Profil public d'un coach |

La route publique n'expose pas les emails. Elle inclut les posts récents et les avis.

---

### Programmes — `programController.js` → `/api/programs`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/` | COACH | Créer un programme |
| GET | `/coach` | COACH | Mes programmes |
| GET | `/client` | CLIENT | Mes programmes |
| GET | `/:id` | ✓ | Détail complet |
| PUT | `/:id` | COACH | Modifier |
| DELETE | `/:id` | COACH | Supprimer (cascade) |

**`createProgram`** : vérifie que le client est bien assigné au coach, crée les CustomGoals en même temps.

---

### Séances — `sessionController.js` → `/api/sessions`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/` | COACH | Créer ou mettre à jour |
| GET | `/program/:programId` | ✓ | Séances d'un programme |
| GET | `/:id` | ✓ | Détail d'une séance |
| PUT | `/:id/validate` | CLIENT | Marquer comme DONE |
| DELETE | `/:id` | COACH | Supprimer |
| POST | `/:sessionId/comments` | COACH | Ajouter un commentaire |

**`upsertSession`** : upsert par `(programId, date)`. Remplace entièrement la liste d'exercices si fournie.

---

### Repas — `mealController.js` → `/api/meals`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/` | ✓ | Créer un repas |
| GET | `/:clientId` | ✓ | Repas d'un client |
| PUT | `/:id` | ✓ | Modifier |
| DELETE | `/:id` | ✓ | Supprimer |

Chaque création/modification/suppression recalcule automatiquement `DailyStat.totalCalories` pour la journée.

---

### Statistiques — `statController.js` → `/api/stats`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/` | ✓ | Créer/mettre à jour une stat journalière |
| GET | `/:clientId` | ✓ | Stats sur une plage de dates |
| GET | `/:clientId/aggregated` | ✓ | Stats agrégées (moyennes, totaux) |
| GET | `/:clientId/date/:date` | ✓ | Stat d'une journée précise |

---

### Messages — `messageController.js` → `/api/messages`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/` | ✓ | Envoyer un message |
| GET | `/conversation/:coachId/:clientId` | ✓ | Conversation entre deux users |
| GET | `/tips/:clientId` | ✓ | Tips planifiés |
| PUT | `/:id/read` | ✓ | Marquer comme lu |
| GET | `/unread/count` | ✓ | Total non lus |
| GET | `/unread/by-conversation` | ✓ | Non lus par conversation |
| PUT | `/read/:coachId/:clientId` | ✓ | Marquer toute la conv comme lue |
| DELETE | `/:id` | ✓ | Supprimer un message |

**Types** : `CHAT` (message direct), `TIP` (conseil planifié), `APPOINTMENT_PROPOSAL` (créé automatiquement lors d'un RDV).

---

### Relation Client-Coach — `clientCoachController.js` → `/api/client-coaches`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/` | ✓ | Lier un client à un coach |
| GET | `/client/:clientId` | ✓ | Coaches d'un client |
| GET | `/coach/:coachId` | ✓ | Clients d'un coach |
| PUT | `/:id/primary` | ✓ | Définir comme coach principal |
| DELETE | `/:id` | ✓ | Désactiver la relation |

**`setPrimaryCoach`** : enlève le flag `isPrimary` des autres coaches, met à jour `ClientProfile.coachId` pour la compatibilité rétrograde.

---

### Demandes de coaching — `requests.controller.js` → `/api/requests`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/` | CLIENT | Envoyer une demande |
| GET | `/received` | COACH | Demandes reçues |
| GET | `/sent` | CLIENT | Demandes envoyées |
| PUT | `/:id/accept` | COACH | Accepter → crée ClientCoach |
| PUT | `/:id/reject` | COACH | Rejeter |

**`acceptRequest`** : transaction atomique — passe le statut à `accepted` ET crée la relation `ClientCoach` (avec `isPrimary=true` si c'est le premier coach).

---

### Rendez-vous — `appointment.controller.js` → `/api/appointments`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/` | ✓ | Créer (simple ou récurrent) |
| GET | `/` | ✓ | Mes rendez-vous |
| GET | `/upcoming` | ✓ | 3 prochains |
| GET | `/:id` | ✓ | Détail |
| PUT | `/:id/confirm` | CLIENT | Confirmer |
| PUT | `/:id/cancel` | ✓ | Annuler (ou toute la série) |
| DELETE | `/:id` | COACH | Supprimer |

**Récurrence** : si `rrule` fourni, crée un parent + toutes les occurrences sur 1 an.
**Conflit** : vérification lors de la confirmation (pas à la proposition).
**Message automatique** : un `APPOINTMENT_PROPOSAL` est créé dans la conversation quand un RDV inclut un client.

---

### Disponibilités — `availabilityController.js` → `/api/availability`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/me` | CLIENT | Mes créneaux |
| PUT | `/me` | CLIENT | Remplacer tous mes créneaux |
| GET | `/client/:clientId` | COACH | Créneaux + RDV d'un client |
| GET | `/coach/:coachId` | CLIENT | Blocages d'un coach |
| GET | `/blocks` | COACH | Mes blocages de créneaux |
| POST | `/blocks` | COACH | Ajouter un blocage |
| DELETE | `/blocks/:id` | COACH | Supprimer un blocage |
| POST | `/block-client` | COACH | Bloquer un client |
| DELETE | `/block-client/:clientId` | COACH | Débloquer |
| GET | `/block-status` | ✓ | Statut du blocage |

---

### Objectifs — `goalController.js` → `/api/goals`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| PUT | `/:goalId/toggle` | CLIENT | Cocher/décocher un objectif |
| GET | `/` | CLIENT | Mes complétions du jour |

---

### Templates — `templateController.js` → `/api/templates`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/` | COACH | Créer (depuis zéro ou depuis un programme) |
| GET | `/` | COACH | Mes templates |
| GET | `/:id` | COACH | Détail |
| PUT | `/:id` | COACH | Modifier |
| DELETE | `/:id` | COACH | Supprimer |
| POST | `/:id/apply` | COACH | Appliquer à un client |

**`createTemplate`** : si `programId` fourni, extrait la structure des séances et objectifs du programme pour la stocker en JSON.
**`applyTemplate`** : régénère des séances à partir du JSON sur les dates calculées.

---

### Analytics — `analyticsController.js` → `/api/analytics`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/clients` | COACH | Clients avec stats résumées |
| GET | `/stats` | COACH | Stats journalières multi-clients |
| GET | `/progress` | COACH | Taux de complétion des séances |
| GET | `/goals` | COACH | Taux de complétion des objectifs |

---

### Completions de séries — `setCompletions.controller.js` → `/api/set-completions`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/toggle` | CLIENT | Toggle (crée ou supprime) |
| PUT | `/` | CLIENT | Upsert avec reps/poids |
| GET | `/exercise/:id` | ✓ | Par exercice |
| GET | `/session/:id` | ✓ | Toutes les completions d'une séance |
| DELETE | `/:exerciseId/:setNumber` | CLIENT | Supprimer |

---

### Posts — `posts.controller.js` → `/api/posts`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/` | COACH | Publier |
| GET | `/coach/:coachId` | — | Posts publics d'un coach |
| GET | `/me` | COACH | Mes posts (paginé) |
| PUT | `/:id` | COACH | Modifier |
| DELETE | `/:id` | COACH | Supprimer |

---

### Alimentation — `foodController.js` → `/api/food`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/search?q=` | ✓ | Recherche dans la base CIQUAL |
| GET | `/:code` | ✓ | Aliment par code CIQUAL |

Recherche paginée (20 par page), trie les correspondances exactes en premier.

---

### Exercices référence — `exerciseRefController.js` → `/api/exercise-refs`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/search?q=` | ✓ | Recherche (nom, muscles, équipement) |
| GET | `/:id` | ✓ | Exercice par ID |

Recherche sur 6 champs en OR, limite max 50 résultats.

---

## Patterns architecturaux

### Upsert pour l'idempotence
`DailyStat`, `GoalCompletion`, `SetCompletion`, `Session` utilisent Prisma `upsert()` avec des clés composites, ce qui rend les appels répétés idempotents.

### Clés composites uniques
Empêchent les doublons à la base :
- `(clientId, date)` → DailyStat
- `(programId, date)` → Session
- `(exerciseId, setNumber)` → SetCompletion
- `(coachId, clientId)` → ClientCoach, CoachRequest, CoachClientBlock

### Suppression en cascade
`onDelete: Cascade` sur la majorité des FK. Supprimer un User supprime tout son contenu.

### Soft delete via statut
`ClientCoach.isActive`, `Appointment.status` — conserve l'historique sans perdre de données.

### Stockage JSON pour les templates
`ProgramTemplate.sessionsData` et `customGoalsData` sont des colonnes JSON qui stockent la structure complète, évitant des tables supplémentaires pour des données temporaires.

### Récurrence RFC 5545
Les `Appointment` récurrents stockent la règle `rrule` sur le parent. Les occurrences individuelles sont générées à la création (horizon 1 an max) et référencent le parent via `parentId`.

### Compatibilité rétrograde
`ClientProfile.coachId` maintenu en parallèle de la table `ClientCoach` M:M. Mis à jour automatiquement lors du `setPrimaryCoach`.

---

## Sécurité

- **Mots de passe** : bcrypt SALT_ROUNDS=10
- **Tokens** : JWT HS256, expiration 7 jours, vérification en base à chaque requête
- **RBAC** : middleware `authorize()` par route
- **CORS** : configurable par environnement
- **Upload** : whitelist de types MIME + limite 5 MB + nom aléatoire
- **Injection SQL** : impossible via les requêtes paramétrées Prisma
- **Validation** : express-validator sur les routes sensibles

---

## Codes HTTP utilisés

| Code | Signification |
|------|---------------|
| 200 | Succès |
| 201 | Créé |
| 400 | Requête invalide (validation, champ manquant) |
| 401 | Non authentifié |
| 403 | Non autorisé (rôle, client bloqué) |
| 404 | Ressource introuvable |
| 409 | Conflit (créneau RDV déjà pris) |
| 500 | Erreur serveur |

---

## Données de test (seed)

Mot de passe universel : `123456`

**5 coaches :**
| Nom | Spécialité | Ville |
|-----|-----------|-------|
| Thomas Dupont | Musculation | Paris |
| Sarah Martin | Cardio | Lyon (remote) |
| Nicolas Bernard | CrossFit | Bordeaux |
| Emma Leroy | Yoga | Marseille (remote) |
| Julien Petit | Nutrition | Toulouse (remote) |

**30 clients** (6 par coach), **30 programmes**, **~1 600 séances**, **~2 000 DailyStat** (90 jours en arrière, 80% de couverture).

Emails coach : `prenom.nom@fitflow-seed.com`
Emails client : même pattern.
