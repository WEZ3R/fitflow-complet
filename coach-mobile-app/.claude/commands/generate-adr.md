# Commande: generate-adr

Génère un ADR (Architecture Decision Record) complet du projet mobile FitFlow.

## Instructions

Analyse le projet et génère un rapport structuré contenant:

1. **Architecture globale**
   - Structure des dossiers
   - Pattern architectural (screens/components)
   - Flux de données

2. **Stack technique**
   - Technologies utilisées (React Native, Expo)
   - Versions des dépendances principales
   - Configuration Expo

3. **Conventions de code**
   - Nommage des fichiers et composants
   - Structure des écrans
   - StyleSheet patterns

4. **Navigation**
   - React Navigation configuration
   - Stack Navigator
   - Bottom Tabs Navigator
   - Passage de paramètres

5. **Gestion d'état**
   - AuthContext
   - SecureStore pour le stockage
   - États locaux (useState)

6. **Communication API**
   - Services API (api.js)
   - Fetch vs Axios
   - Gestion des tokens

7. **UI/UX Patterns**
   - Loading states
   - Empty states
   - Pull-to-refresh
   - Icônes (Ionicons)

8. **Bonnes pratiques**
   - Gestion des erreurs (Alert.alert)
   - Dates (date-fns)
   - Styles en fin de fichier

## Fichiers à analyser

- `App.js` - Point d'entrée
- `config.js` - Configuration
- `src/navigation/` - Configuration navigation
- `src/screens/` - Écrans de l'application
- `src/components/` - Composants réutilisables
- `src/contexts/` - Contextes React
- `src/services/` - Services API
- `app.json` - Configuration Expo
- `package.json` - Dépendances

## Format de sortie

Génère un document markdown structuré avec des exemples de code concrets tirés du projet.
