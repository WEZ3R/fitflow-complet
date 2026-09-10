# FitFlow — Cahier des charges (synthèse)

## 1. Origine du projet

Le projet part d'un besoin exprimé par un coach sportif indépendant de mon entourage. Son suivi client repose sur un empilement d'outils non conçus pour ça : programmes d'entraînement dans un tableur, échanges et photos de progression sur WhatsApp, rendez-vous dans un agenda séparé, conseils nutritionnels dictés à l'oral. Résultat : l'information est éclatée, rien n'est historisé, et le temps passé à recopier des séances est du temps non facturé.

Le problème n'est pas le manque d'outils fitness — c'est qu'aucun ne réunit **la vue coach** et **la vue client** sur la même donnée.

## 2. Problème à résoudre

| Pour le coach | Pour le client |
|---|---|
| Reconstruire un programme à la main pour chaque client | Ne pas savoir quoi faire une fois en salle |
| Ignorer si la séance a réellement été faite | Perdre ses performances passées d'une séance à l'autre |
| Dispersion des échanges sur plusieurs canaux | Ne pouvoir suivre qu'un seul coach à la fois |
| Aucune vue chiffrée de la progression de son portefeuille | Nutrition traitée à part de l'entraînement |

## 3. Solution proposée

Une plateforme de coaching sportif **tout-en-un**, articulée autour de quatre partis pris :

1. **Un seul outil pour toute la relation** — programmes, séances, nutrition, rendez-vous, messagerie et statistiques dans un même produit, plutôt que cinq applications juxtaposées.
2. **Multi-coach assumé** — un client peut être suivi simultanément par plusieurs coachs (musculation, nutrition, préparation physique) avec la notion de coach principal. C'est la principale différenciation face aux plateformes existantes, structurellement mono-coach.
3. **Suivi terrain en temps réel** — le client valide ses séries depuis son téléphone pendant l'entraînement ; le coach voit la charge et les répétitions réellement effectuées et ajuste le programme suivant sur du réel, pas du déclaratif.
4. **Nutrition intégrée** — plans alimentaires et suivi des apports adossés à la base officielle française **CIQUAL**, dans le même produit que l'entraînement.

## 4. Réponse fonctionnelle

- **Coach** : gestion du portefeuille clients, création de programmes et de séances (bibliothèque d'exercices, templates réutilisables, planification calendaire par glisser-déposer), suivi de progression par client, tableau de bord analytique, agenda et rendez-vous, messagerie.
- **Client** : consultation du programme du jour, exécution guidée de la séance avec validation des séries et minuteur de repos, saisie des statistiques quotidiennes (hydratation, calories, sommeil, repas), recherche et demande de mise en relation avec un coach, messagerie, rendez-vous.
- **Transverse** : authentification JWT avec rôles COACH / CLIENT, notifications, rappels de rendez-vous automatisés, avis et évaluations, salles de sport et lieux d'entraînement.

## 5. Architecture et stack

Architecture en trois applications autour d'une **API REST unique**, ce qui permet à un client web et à un client mobile de partager exactement la même logique métier et le même modèle de données.

| Brique | Technologie | Justification du choix |
|---|---|---|
| **API** `backend-coach-app` | Node.js (ES Modules), Express 4, JWT, bcrypt, multer, express-validator | Stack légère et maîtrisée ; un seul langage (JavaScript) sur les trois briques réduit le coût de contexte |
| **Base de données** | PostgreSQL + Prisma 5 | Le domaine est fortement relationnel (client ↔ coach ↔ programme ↔ séance ↔ exercice ↔ série) ; Prisma apporte des migrations versionnées et un typage du schéma |
| **Dashboard web** `fitflow-dashboard` | Next.js 16, React 19, Tailwind, Recharts, dnd-kit | Interface de production du coach : construction de programmes au glisser-déposer et graphiques de progression, difficilement confortables sur mobile |
| **App mobile** `coach-mobile-app` | React Native 0.81 / Expo 54, React Navigation, expo-secure-store | Le client utilise l'app **en salle** : le mobile est le seul support pertinent ; Expo évite le coût d'une double base native iOS/Android |

Le modèle de données compte aujourd'hui une trentaine d'entités et un jeu de données de démonstration d'environ 35 utilisateurs et 1 600 séances, dimensionné pour éprouver les écrans sur des volumes réalistes.

## 6. Périmètre

**Dans le MVP** : authentification et rôles, relation multi-coach, programmes et séances, exécution et validation de séance, statistiques quotidiennes, nutrition, messagerie, rendez-vous, tableau de bord coach.

**Hors périmètre (non-objectifs)** : paiement et facturation en ligne, notifications push, mode hors-ligne, visioconférence, application mobile dédiée aux coachs, ouverture d'une API publique à des tiers.

## 7. Hypothèses à valider

| Hypothèse | Comment la tester |
|---|---|
| Le besoin multi-coach concerne une part significative des clients, pas seulement un cas isolé | Entretiens avec 5 à 10 coachs indépendants |
| Le client accepte de saisir ses séries pendant la séance plutôt qu'après | Test d'usage en salle sur 2 semaines |
| Le coach est prêt à abandonner son tableur pour un outil imposé à ses clients | Pilote sur un coach réel et son portefeuille |
