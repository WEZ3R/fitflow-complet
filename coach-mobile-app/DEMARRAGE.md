# Guide de démarrage rapide

## Avant de commencer

Assure-toi que le backend est configuré et lancé :

1. **Base de données** (depuis le dossier `backend-coach-app`) :
   ```bash
   cd ../backend-coach-app
   docker compose up -d
   ```

2. **Backend** :
   ```bash
   cd ../backend-coach-app
   npm run dev
   ```

## Lancer l'app mobile

### Option 1 : Émulateur iOS (Mac uniquement)

```bash
npm run ios
```

### Option 2 : Émulateur Android

```bash
npm run android
```

### Option 3 : Sur ton téléphone (recommandé pour tester)

1. **Configure l'URL du backend** :

   Ouvre `config.js` et trouve ton IP local :
   ```bash
   cd ../backend-coach-app
   npm run db:host
   ```

   Copie l'IP affichée et mets-la dans `config.js` :
   ```javascript
   export const API_URL = 'http://TON_IP:5001/api';
   // Exemple : http://192.168.1.23:5001/api
   ```

2. **Lance Expo** :
   ```bash
   npm start
   ```

3. **Sur ton téléphone** :
   - **iPhone** : Télécharge "Expo Go" sur l'App Store
   - **Android** : Télécharge "Expo Go" sur le Play Store
   - Scanne le QR code affiché dans le terminal

## Se connecter

Utilise un compte client test :
- **Email** : client1@test.com
- **Password** : password123

## Tester les fonctionnalités

### 1. Dashboard
- Tu verras ton programme actif
- La séance du jour (si elle existe)
- Les séances à venir

### 2. Séance d'entraînement
- Clique sur "Commencer" sur la séance du jour
- Coche les exercices au fur et à mesure
- Utilise le bouton "Repos" pour lancer le chronomètre
- Le chronomètre s'affiche en plein écran
- Valide la séance quand tous les exercices sont terminés

### 3. Statistiques
- Va dans l'onglet "Statistiques" (icône graphique)
- Remplis ton eau consommée (en litres)
- Remplis tes calories
- Ajoute tes repas et notes
- Clique sur "Enregistrer"

## Problèmes fréquents

### "Network request failed"
- Vérifie que le backend est bien lancé
- Vérifie que l'URL dans `config.js` est correcte
- Assure-toi d'être sur le même WiFi que ton ordinateur

### "401 Unauthorized"
- Le token a expiré, déconnecte-toi et reconnecte-toi

### L'app ne se lance pas
- Supprime le cache : `npm start -- --clear`
- Réinstalle les dépendances : `rm -rf node_modules && npm install`

## Développement

Pour voir les logs en temps réel :
```bash
npm start
```

Puis appuie sur :
- `i` pour ouvrir l'émulateur iOS
- `a` pour ouvrir l'émulateur Android
- `w` pour ouvrir dans le navigateur web
- `r` pour recharger l'app
- `m` pour toggle le menu
