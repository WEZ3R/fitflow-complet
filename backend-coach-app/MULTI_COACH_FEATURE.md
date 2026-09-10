# Fonctionnalité : Un client peut avoir plusieurs coaches

## Résumé des changements

Cette mise à jour permet à un client d'avoir plusieurs coaches simultanément, avec la possibilité de définir un coach principal.

## Changements dans la base de données

### Nouvelle table : `client_coaches`

Table de liaison many-to-many entre clients et coaches.

```sql
CREATE TABLE "client_coaches" (
    "id" TEXT PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "isPrimary" BOOLEAN DEFAULT false,
    "startDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP,
    UNIQUE("clientId", "coachId")
);
```

### Champs

- `isPrimary` : Indique si c'est le coach principal du client
- `startDate` : Date de début de la relation
- `endDate` : Date de fin (optionnel, si la relation se termine)
- `isActive` : Relation active ou non

### Migration des données

Les relations existantes dans `client_profiles.coachId` ont été automatiquement migrées vers la nouvelle table avec `isPrimary = true`.

## Nouvelles API

### Endpoints `/api/client-coaches`

#### 1. Ajouter un coach à un client
```http
POST /api/client-coaches
Content-Type: application/json
Authorization: Bearer {token}

{
  "clientId": "uuid",
  "coachId": "uuid",
  "isPrimary": false
}
```

#### 2. Obtenir tous les coaches d'un client
```http
GET /api/client-coaches/client/:clientId
Authorization: Bearer {token}
```

Retourne la liste des coaches triés par :
- Coach principal en premier (`isPrimary = true`)
- Date de création

#### 3. Obtenir tous les clients d'un coach
```http
GET /api/client-coaches/coach/:coachId
Authorization: Bearer {token}
```

#### 4. Définir un coach comme principal
```http
PATCH /api/client-coaches/:id/primary
Authorization: Bearer {token}
```

Note : Retire automatiquement le statut principal des autres coaches.

#### 5. Retirer un coach d'un client
```http
DELETE /api/client-coaches/:id
Authorization: Bearer {token}
```

Note : Désactive la relation (`isActive = false`) et définit `endDate`.

## Rétrocompatibilité

Le champ `coachId` dans `client_profiles` est maintenu pour assurer la rétrocompatibilité :
- Il pointe toujours vers le coach principal (`isPrimary = true`)
- Il est automatiquement mis à jour lors du changement de coach principal
- Les anciennes requêtes utilisant `clientProfile.coachId` fonctionnent toujours

## Changements dans l'application mobile

Le fichier `MessagesScreen.js` a été mis à jour pour :
- Afficher une liste de tous les coaches disponibles
- Permettre au client de sélectionner n'importe quel coach pour converser
- Ajouter un bouton pour changer de coach dans une conversation

## Exemple d'utilisation

### Scénario : Client avec plusieurs coaches

1. **Client avec un coach de musculation et un coach de nutrition**
   ```javascript
   // Ajouter le coach de musculation (principal)
   POST /api/client-coaches
   { "clientId": "client1", "coachId": "coachMusculation", "isPrimary": true }

   // Ajouter le coach de nutrition (secondaire)
   POST /api/client-coaches
   { "clientId": "client1", "coachId": "coachNutrition", "isPrimary": false }
   ```

2. **Obtenir tous les coaches du client**
   ```javascript
   GET /api/client-coaches/client/client1

   // Retourne:
   [
     { "coach": {...}, "isPrimary": true, ... },  // Coach de musculation
     { "coach": {...}, "isPrimary": false, ... }  // Coach de nutrition
   ]
   ```

3. **Changer le coach principal**
   ```javascript
   PATCH /api/client-coaches/{relationId}/primary
   ```

## Tests recommandés

1. ✅ Créer plusieurs relations client-coach
2. ✅ Vérifier qu'un seul coach peut être principal à la fois
3. ✅ Tester la désactivation d'une relation
4. ✅ Vérifier la rétrocompatibilité avec `clientProfile.coachId`
5. ✅ Tester les messages entre client et différents coaches

## Prochaines étapes possibles

- [ ] Interface web (dashboard) pour gérer les relations client-coach
- [ ] Notifications lors de l'ajout/retrait d'un coach
- [ ] Historique des relations (coaches passés)
- [ ] Permissions spécifiques par coach (nutrition, entraînement, etc.)
