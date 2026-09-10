# CLAUDE.md - FitFlow Mobile App

> **claude.md lu**

## Vue d'ensemble

Application mobile React Native/Expo pour les clients FitFlow. Permet aux clients de suivre leurs séances d'entraînement, statistiques quotidiennes, communiquer avec leurs coaches et gérer leur profil.

---

## Architecture du projet

```
fitflow-mobile/
├── App.js                   # Point d'entrée
├── index.js                 # Initialisation
├── config.js                # Configuration (API_URL)
├── app.json                 # Configuration Expo
├── assets/                  # Icônes et splash screens
│   ├── icon.png
│   ├── splash-icon.png
│   └── adaptive-icon.png
└── src/
    ├── navigation/          # Configuration navigation
    │   └── AppNavigator.js
    ├── contexts/            # React Context
    │   └── AuthContext.js
    ├── screens/             # Écrans (26 fichiers)
    │   ├── LoginScreen.js
    │   ├── DashboardScreen.js
    │   ├── SessionDetailScreen.js
    │   ├── DailyStatsScreen.js
    │   ├── ProfileScreen.js
    │   ├── EditProfileScreen.js
    │   ├── CoachSearchScreen.js
    │   ├── CoachDetailScreen.js
    │   └── MessagesScreen.js
    ├── components/          # Composants réutilisables
    │   └── Avatar.js
    └── services/            # Communication API
        └── api.js
```

---

## Stack technique

| Catégorie | Technologie |
|-----------|-------------|
| Framework | React Native 0.81.5 |
| Plateforme | Expo ~54.0.20 |
| Navigation | React Navigation 7.x |
| HTTP | Axios ^1.13.1 |
| Stockage sécurisé | expo-secure-store ~15.0.7 |
| Dates | date-fns ^4.1.0 |
| Icônes | @expo/vector-icons (Ionicons) |

---

## Conventions de code

### Nommage

- **Écrans** : PascalCase + suffix "Screen" (`LoginScreen.js`, `DashboardScreen.js`)
- **Composants** : PascalCase (`Avatar.js`)
- **Fonctions** : camelCase (`handleLogin`, `fetchPrograms`, `formatDate`)
- **Variables d'état** : camelCase (`loading`, `setLoading`, `filteredCoaches`)
- **Constantes** : UPPER_SNAKE_CASE (`API_URL`)

### Structure d'un écran

```javascript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../config';
import * as SecureStore from 'expo-secure-store';

const NomScreen = ({ navigation, route }) => {
  // États
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Effects
  useEffect(() => {
    fetchData();
  }, []);

  // Fonctions
  const fetchData = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      const response = await fetch(`${API_URL}/endpoint`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Message d\'erreur');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  // Rendu principal
  return (
    <View style={styles.container}>
      {/* Contenu */}
    </View>
  );
};

// Styles en bas du fichier
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NomScreen;
```

### Commentaires

- **Langue** : Français pour les commentaires et textes UI
- **Organisation** : Un fichier = un écran/composant avec ses styles

---

## Navigation

### Structure de navigation

```
NavigationContainer
├── Si non connecté:
│   └── Stack.Screen → LoginScreen
│
└── Si connecté:
    ├── MainTabs (Bottom Tabs)
    │   ├── Dashboard (home)
    │   ├── Stats (stats-chart)
    │   ├── Messages (chatbubbles)
    │   ├── Coaches (search)
    │   └── Profile (person)
    │
    └── Modals (Stack)
        ├── SessionDetail
        ├── EditProfile
        └── CoachDetail
```

### Navigation entre écrans

```javascript
// Naviguer vers un écran
navigation.navigate('ScreenName', { param: value });

// Retour
navigation.goBack();

// Accès aux paramètres
const { paramName } = route.params;
```

### Icônes des tabs

```javascript
// Actif: icon-name
// Inactif: icon-name-outline
{
  Dashboard: 'home' / 'home-outline',
  Stats: 'stats-chart' / 'stats-chart-outline',
  Messages: 'chatbubbles' / 'chatbubbles-outline',
  Coaches: 'search' / 'search-outline',
  Profile: 'person' / 'person-outline'
}
```

---

## Gestion d'état

### AuthContext
```javascript
import { useAuth } from '../contexts/AuthContext';

const { user, login, logout, loadUser } = useAuth();
```

### Stockage sécurisé
```javascript
import * as SecureStore from 'expo-secure-store';

// Stocker
await SecureStore.setItemAsync('token', token);

// Récupérer
const token = await SecureStore.getItemAsync('token');

// Supprimer
await SecureStore.deleteItemAsync('token');
```

---

## Services API (api.js)

### Modules disponibles
```javascript
import {
  authAPI,      // login, getMe, updateProfile, logout
  programsAPI,  // getClientPrograms
  sessionsAPI,  // getById, validateSession
  statsAPI,     // upsert, getClientStats, getByDate
  goalsAPI      // toggleCompletion, getCompletions
} from '../services/api';
```

### Appel API direct avec fetch
```javascript
const token = await SecureStore.getItemAsync('token');
const response = await fetch(`${API_URL}/endpoint`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});
const result = await response.json();
```

### Format de réponse
```javascript
// Succès
{ success: true, data: {...} }

// Données imbriquées
response.data.data  // via axios
result.data         // via fetch
```

---

## Palette de couleurs

```javascript
// Couleurs principales
const colors = {
  primary: '#6366f1',      // Indigo (principal)
  primaryLight: '#ede9fe', // Fond bouton secondaire
  success: '#10b981',      // Vert (succès)
  warning: '#f59e0b',      // Orange (attention)
  danger: '#ef4444',       // Rouge (erreur)
  dark: '#0f172a',         // Texte principal
  gray: '#64748b',         // Texte secondaire
  lightGray: '#f8fafc',    // Fond
  white: '#ffffff',
  border: '#e2e8f0',       // Bordures
};
```

---

## Icônes (Ionicons)

```javascript
import { Ionicons } from '@expo/vector-icons';

<Ionicons name="home" size={24} color="#6366f1" />
<Ionicons name="home-outline" size={24} color="#64748b" />
```

### Icônes courantes
```
home, home-outline
stats-chart, stats-chart-outline
chatbubbles, chatbubbles-outline
search, search-outline
person, person-outline
arrow-back
checkmark-circle
chevron-forward
location
people
send
```

---

## Dates (date-fns)

```javascript
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

format(new Date(), 'PPP', { locale: fr });  // "13 janvier 2026"
format(parseISO(dateString), 'PPp', { locale: fr });  // "13 janvier 2026 à 14:30"
```

---

## Patterns courants

### Loading state
```javascript
if (loading) {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color="#6366f1" />
    </View>
  );
}
```

### Empty state
```javascript
<View style={styles.emptyContainer}>
  <Ionicons name="document-outline" size={64} color="#cbd5e1" />
  <Text style={styles.emptyText}>Aucune donnée</Text>
  <Text style={styles.emptySubtext}>Description explicative</Text>
</View>
```

### Pull-to-refresh
```javascript
<FlatList
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={['#6366f1']}
    />
  }
/>
```

### Header personnalisé
```javascript
<View style={styles.header}>
  <TouchableOpacity onPress={() => navigation.goBack()}>
    <Ionicons name="arrow-back" size={24} color="#0f172a" />
  </TouchableOpacity>
  <Text style={styles.headerTitle}>Titre</Text>
</View>
```

---

## Styles communs

```javascript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  button: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

---

## Configuration

### config.js
```javascript
export const API_URL = 'http://localhost:5001/api';
// Ou pour un appareil physique:
// export const API_URL = 'http://192.168.x.x:5001/api';
```

### app.json
```json
{
  "expo": {
    "name": "FitFlow",
    "slug": "fitflow-mobile",
    "version": "1.0.0",
    "orientation": "portrait"
  }
}
```

---

## Scripts npm

```bash
npm start        # Démarrer Expo
npm run android  # Lancer sur Android
npm run ios      # Lancer sur iOS
npm run web      # Lancer sur web
```

---

## Bonnes pratiques

1. **Gérer les états loading** avec `ActivityIndicator`
2. **Gérer les états vides** avec icône + message explicatif
3. **Utiliser Alert.alert()** pour les erreurs utilisateur
4. **Utiliser console.error()** pour le debug
5. **Stocker le token** dans SecureStore (pas AsyncStorage)
6. **Utiliser try/catch** pour tous les appels API
7. **Styles en bas du fichier** avec `StyleSheet.create()`
8. **Commenter en français**
9. **Un fichier = un écran** avec ses styles intégrés
