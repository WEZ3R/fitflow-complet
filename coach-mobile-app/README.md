# Coach Mobile App

Application mobile React Native pour les clients de coaching sportif.

## Fonctionnalités

- **Authentification** : Connexion sécurisée avec JWT
- **Dashboard** : Vue d'ensemble du programme actif et des séances
- **Séances** :
  - Affichage détaillé des exercices
  - Validation des exercices
  - Chronomètre de repos automatique entre les séries
- **Statistiques quotidiennes** :
  - Suivi de l'hydratation (eau)
  - Suivi des calories
  - Suivi du sommeil
  - Journal des repas
  - Notes personnelles

## Installation

```bash
cd coach-mobile-app
npm install
```

## Configuration

### URL du Backend

Modifie le fichier `config.js` pour pointer vers ton backend :

```javascript
// Pour l'émulateur iOS
export const API_URL = 'http://localhost:5000/api';

// Pour un appareil physique sur le même WiFi
export const API_URL = 'http://192.168.1.23:5000/api';
```

Pour trouver ton IP local, utilise le script dans le projet parent :
```bash
cd ../"coach app"
./get-local-ip.sh
```

## Lancer l'application

### Émulateur iOS
```bash
npm run ios
```

### Émulateur Android
```bash
npm run android
```

### Expo Go (appareil physique)
```bash
npm start
```
Puis scanne le QR code avec l'app Expo Go.

## Structure du projet

```
src/
├── contexts/        # Contextes React (Auth)
├── navigation/      # Configuration de la navigation
├── screens/         # Écrans de l'application
│   ├── LoginScreen.js
│   ├── DashboardScreen.js
│   ├── SessionDetailScreen.js
│   └── DailyStatsScreen.js
└── services/        # Services API
    └── api.js
```

## Comptes de test

**Client** :
- Email : client1@test.com
- Password : password123

## Technologies

- **React Native** : Framework mobile
- **Expo** : Plateforme de développement
- **React Navigation** : Navigation
- **Axios** : Requêtes HTTP
- **Expo Secure Store** : Stockage sécurisé des tokens

## Développement

L'application se connecte au backend créé dans le projet `coach app`. Assure-toi que :

1. Le backend est lancé : `cd ../coach\ app/backend && npm run dev`
2. La base de données PostgreSQL est démarrée : `docker-compose up -d`
3. L'URL dans `config.js` pointe vers le bon serveur

## À venir

- Messagerie avec le coach
- Notifications push
- Mode offline
- Graphiques de progression
- Photos de suivi
