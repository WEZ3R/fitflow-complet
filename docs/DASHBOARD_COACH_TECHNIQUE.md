# Dashboard coach — documentation technique

Ce document décrit, fonctionnalité par fonctionnalité, **ce que le code fait réellement**
dans l'espace coach du dashboard FitFlow. Il a été établi par lecture du code, pas par
lecture des specs : quand les deux divergent, c'est le code qui est décrit ici.

Chaque affirmation renvoie à `fichier:ligne`. Les écarts, approximations et anomalies
relevés en cours de lecture sont rassemblés en [partie 6](#6-points-à-vérifier) plutôt que
corrigés en silence.

- **Dépôt** : `fitflow-dashboard`
- **Périmètre** : les 13 routes sous `app/(dashboard)/coach/`, le socle commun
  (authentification, client HTTP, mise en page) et les composants qu'elles utilisent.
  Environ **11 300 lignes** de TSX pour le seul espace coach.
- **Hors périmètre** : l'espace client, l'espace administration, l'application mobile.

---

## Sommaire

1. [Socle technique](#1-socle-technique)
2. [Pilotage — tableau de bord, clients, fiche client](#2-pilotage)
3. [Prescription — programmes, séances, templates](#3-prescription)
4. [Analyse — performances et progression](#4-analyse)
5. [Relation — messagerie, rendez-vous, profil, signalement](#5-relation)
6. [Points à vérifier](#6-points-à-vérifier)
7. [Récapitulatif des routes d'API](#7-récapitulatif-des-routes-dapi)

---

## 1. Socle technique

### 1.1 Pile

| | Version |
| --- | --- |
| Next.js | 16.1.6, App Router |
| React / React DOM | 19.2.3 |
| TypeScript | 5 |
| Tailwind CSS | 4 (via `@tailwindcss/postcss`) |
| axios | 1.13.5 |
| Recharts | 3.7.0 — tous les graphiques |
| dnd-kit | core 6.3.1, sortable 10.0.0 — réordonnancement des exercices |
| date-fns | 4.1.0, locale `fr` partout |
| Leaflet / react-leaflet | 1.9.4 / 5.0.0 — carte des salles |
| xlsx | 0.18.5 — exports tableur |
| react-easy-crop | 6.2.3 — recadrage d'avatar |
| lucide-react | 0.574.0 — icônes |

Tests : Vitest 4 + Testing Library, Playwright 1.58 pour l'end-to-end.

Toutes les pages coach sont des **composants client** (`"use client"`). Aucune donnée n'est
rendue côté serveur : le dashboard est une application React classique servie par Next.

### 1.2 Client HTTP — `lib/api.ts`

Une instance axios unique, `baseURL = process.env.NEXT_PUBLIC_API_URL || "/api"`
([lib/api.ts:3-10](../fitflow-dashboard/lib/api.ts#L3-L10)). Tous les chemins cités dans ce
document sont relatifs à cette base.

**Intercepteur de requête** ([lib/api.ts:13-26](../fitflow-dashboard/lib/api.ts#L13-L26)) :
ajoute `Authorization: Bearer <token>` en lisant `localStorage.token`. Le garde
`typeof window !== "undefined"` évite l'erreur au rendu serveur.

**Intercepteur de réponse** ([lib/api.ts:29-42](../fitflow-dashboard/lib/api.ts#L29-L42)) :
sur un `401` — sauf sur `/auth/login` et `/auth/register`, où un 401 signifie simplement
« mauvais identifiants » — purge `token` et `user` du `localStorage` puis force
`window.location.href = "/login"`. Une session expirée ramène donc à l'écran de connexion
depuis n'importe quelle page, sans qu'aucune page n'ait à le prévoir.

**`toFormData`** ([lib/api.ts:45-58](../fitflow-dashboard/lib/api.ts#L45-L58)) : convertit un
objet en `FormData` pour les envois avec fichier. Les tableaux sont sérialisés en JSON
(`JSON.stringify`), les `File` appendés tels quels. Aucun encodage base64 nulle part.

Le fichier expose **26 objets d'API** thématiques (`programsAPI`, `sessionsAPI`,
`analyticsAPI`…). C'est la seule couche d'accès réseau : aucune page n'appelle `fetch`
directement.

### 1.3 Authentification — `contexts/auth-context.tsx`

Contexte React exposant `user`, `loading`, `login`, `register`, `logout`, `refreshUser` et
trois prédicats de rôle `isCoach` / `isClient` / `isAdmin`
([contexts/auth-context.tsx:113-115](../fitflow-dashboard/contexts/auth-context.tsx#L113-L115)).

Au montage, si un jeton existe en `localStorage`, un `GET /auth/me` le valide et
réhydrate l'utilisateur ; en cas d'échec le stockage est purgé
([auth-context.tsx:38-56](../fitflow-dashboard/contexts/auth-context.tsx#L38-L56)). Le jeton
et l'utilisateur sont écrits en `localStorage` à la connexion comme à l'inscription
([:64-66](../fitflow-dashboard/contexts/auth-context.tsx#L64-L66)).

> Le stockage du jeton en `localStorage` l'expose à une injection de script. Le choix est
> assumé dans le dossier projet ; il est rappelé ici parce qu'il conditionne tout le reste
> de la chaîne d'authentification côté navigateur.

### 1.4 Mise en page et garde de route

[`app/(dashboard)/layout.tsx`](../fitflow-dashboard/app/%28dashboard%29/layout.tsx) — 39 lignes.
Tant que `loading`, un spinner ; ensuite, si `user` est nul, redirection vers `/login`
([:18-22](../fitflow-dashboard/app/%28dashboard%29/layout.tsx#L18-L22)).

**C'est une garde d'affichage, pas une garde de sécurité.** Elle vérifie qu'un utilisateur
est connecté, mais **ne vérifie pas son rôle** : rien dans ce layout n'empêche un compte
client d'ouvrir une URL `/coach/...`. La protection réelle est côté serveur, par le
middleware `authorize(...roles)`
([backend-coach-app/src/middlewares/auth.js:117-131](../backend-coach-app/src/middlewares/auth.js#L117-L131)),
qui répond `403` si le rôle ne correspond pas. Le commentaire de `adminAPI`
([lib/api.ts:346-349](../fitflow-dashboard/lib/api.ts#L346-L349)) énonce explicitement le
principe : *« masquer les écrans dans l'interface est un confort, pas une protection »*.

### 1.5 Barre latérale — `components/layout/sidebar.tsx`

420 lignes. Rétractable (`w-16` → `w-48` au survol), navigation choisie selon le rôle
(`coachNavItems`, `clientNavItems`, `adminNavItems`), badge de messages non lus, cloche de
notifications rendue en portail, avatar, déconnexion.

**Sondage** : `GET /messages/unread-count` et `GET /notifications/unread-count` toutes les
**10 000 ms** ([sidebar.tsx:127](../fitflow-dashboard/components/layout/sidebar.tsx#L127)),
plus un rafraîchissement immédiat sur `visibilitychange` et `focus`
([:132-136](../fitflow-dashboard/components/layout/sidebar.tsx#L132-L136)) — l'onglet
revenu au premier plan se remet à jour sans attendre le prochain tick.

Elle écoute l'événement `fitflow:messages-read`, émis par la messagerie, pour décrémenter
le badge sans requête supplémentaire (voir [5.1](#51-messagerie)).

### 1.6 Limitation de débit (côté serveur)

Deux limiteurs s'appliquent aux appels du dashboard
([backend-coach-app/src/middlewares/rateLimit.js](../backend-coach-app/src/middlewares/rateLimit.js)) :

| Portée | Fenêtre | Limite |
| --- | --- | --- |
| Connexion | 15 min | **10** en production (100 hors production), échecs seulement |
| Reste de l'API | 1 min | **300** par IP |

Le seuil de connexion est relevé hors production pour ne pas bloquer les seeds et les
tests, avec un commentaire qui précise que « 10 reste la valeur qui compte »
([rateLimit.js:35-41](../backend-coach-app/src/middlewares/rateLimit.js#L35-L41)).

---

## 2. Pilotage

### 2.1 Tableau de bord — `/coach/dashboard`

[`app/(dashboard)/coach/dashboard/page.tsx`](../fitflow-dashboard/app/%28dashboard%29/coach/dashboard/page.tsx) — 428 lignes.

**Rôle.** Page d'accueil : quatre compteurs animés, les prochains rendez-vous, les séances
du jour tous clients confondus, et la liste des clients acceptés.

**Appels.** Un seul `Promise.all` au montage, jamais rejoué — ni sondage, ni rechargement :

| Appel | Usage |
| --- | --- |
| `GET /programs/coach` | programmes actifs, taux de complétion, séances du jour |
| `GET /clients/coach` | filtré sur `requestStatus === 'accepted'` ([:126](../fitflow-dashboard/app/%28dashboard%29/coach/dashboard/page.tsx#L126)) |
| `GET /appointments/upcoming` | prochains rendez-vous |

**Taux de complétion** ([:139-161](../fitflow-dashboard/app/%28dashboard%29/coach/dashboard/page.tsx#L139-L161)).
Fenêtre glissante de **30 jours**, bornée à `00:00:00.000` et `23:59:59.999`. Sont exclus :
les programmes inactifs, les jours de repos (`session.isRestDay`) et les séances hors
fenêtre — donc les séances futures, qui feraient chuter artificiellement le taux.

```
completionRate = due > 0 ? Math.round(done / due * 100) : null
```

Le type est `number | null` et non `number` : **`null` (aucune séance mesurable) est
distinct de `0` (aucune séance faite)**, et s'affiche `--` au lieu de `0 %`
([:242](../fitflow-dashboard/app/%28dashboard%29/coach/dashboard/page.tsx#L242)). La distinction
est explicitement commentée dans le code.

**Séances du jour** ([:165-184](../fitflow-dashboard/app/%28dashboard%29/coach/dashboard/page.tsx#L165-L184)).
La comparaison se fait sur des chaînes `yyyy-MM-dd` produites en heure **locale**, pour
neutraliser le décalage de fuseau qu'introduirait une comparaison d'instants ISO. C'est le
même parti pris que dans le calendrier de programme (voir [3.2](#32-calendrier-de-programme)).

**Animation des compteurs.** Hook maison `useCountUp(target, duration = 800)`
([:72-93](../fitflow-dashboard/app/%28dashboard%29/coach/dashboard/page.tsx#L72-L93)) :
`requestAnimationFrame`, easing ease-out `1 - (1 - progress)³`, annulation au démontage.

**États.** `loading` ne gouverne que le bloc « Mes clients » ; les compteurs s'affichent
immédiatement à zéro. Les erreurs ne font qu'un `console.error`
([:185-186](../fitflow-dashboard/app/%28dashboard%29/coach/dashboard/page.tsx#L185-L186)) : une
panne réseau est indistinguable d'un compte vide.

### 2.2 Liste des clients — `/coach/clients`

[`app/(dashboard)/coach/clients/page.tsx`](../fitflow-dashboard/app/%28dashboard%29/coach/clients/page.tsx) — 872 lignes.

**Rôle.** Deux onglets : « Mes clients » (tableau triable, ligne dépliable) et
« Prospection » (clients potentiels géolocalisés).

**Chargement paresseux.** La prospection n'est appelée qu'au **premier** clic sur son
onglet, via un drapeau `prospectionLoaded`
([:100-106](../fitflow-dashboard/app/%28dashboard%29/coach/clients/page.tsx#L100-L106)).

**Ligne dépliable** ([:114-188](../fitflow-dashboard/app/%28dashboard%29/coach/clients/page.tsx#L114-L188)).
À l'ouverture, trois familles de requêtes : `GET /programs/coach`, `GET /stats/client/{id}`
en parallèle, puis **une requête `GET /sessions/program/{id}` par programme, en série**
(`await` dans une boucle `for`). Fenêtre : `subDays(today, 13)` → **14 jours inclusifs**.

Le cache est explicitement absent : `setExpandedData(null)` à chaque ouverture
([:195](../fitflow-dashboard/app/%28dashboard%29/coach/clients/page.tsx#L195)) — rouvrir la même
ligne refait tous les appels.

**Calendrier de séances** ([:145-156](../fitflow-dashboard/app/%28dashboard%29/coach/clients/page.tsx#L145-L156)) :
un jour sans séance → `REST` ; `status === 'DONE'` → `DONE` ; tout autre statut → `DRAFT`.

**Moyennes sur 14 jours** ([:162-179](../fitflow-dashboard/app/%28dashboard%29/coach/clients/page.tsx#L162-L179)) :
moyenne des seules valeurs non nulles, avec un compteur par métrique. Arrondi à une
décimale pour l'eau, le sommeil et le poids ; à l'entier pour les calories et le temps
d'entraînement. Aucun échantillon → `null`, affiché `-`.

**Tri** ([:266-303](../fitflow-dashboard/app/%28dashboard%29/coach/clients/page.tsx#L266-L303)) :
clés `name`, `age`, `gender`, `height`, `weight`, `goals`. Les valeurs manquantes valent
`-1` (numériques) ou `""` (textuelles) et remontent donc en tête du tri croissant. Le tri
opère sur une copie, l'état source n'est pas muté.

**Recherche** : `includes` insensible à la casse sur `"prénom nom"` ou l'email, **sans
anti-rebond** — le filtrage est purement local et synchrone, donc sans coût réseau.

**Score de prospection** ([:340-344](../fitflow-dashboard/app/%28dashboard%29/coach/clients/page.tsx#L340-L344)) :
`≥ 3` → « Même zone et même salle » ; `= 2` → « Même ville » ; sinon → « Même salle ».

### 2.3 Fiche client — `/coach/clients/[clientId]`

[`app/(dashboard)/coach/clients/[clientId]/page.tsx`](../fitflow-dashboard/app/%28dashboard%29/coach/clients/[clientId]/page.tsx) — 1 365 lignes, la deuxième plus grosse page du dépôt.

Les paramètres de route sont une `Promise` déballée par `use(params)`
([:495-496](../fitflow-dashboard/app/%28dashboard%29/coach/clients/[clientId]/page.tsx#L495-L496)) —
convention Next 15/16.

**Quatre blocs.**

1. **Identité et demande.** Un client `pending` affiche une bannière d'acceptation/refus et
   **masque intégralement** les sections disponibilités et statistiques
   ([:1070](../fitflow-dashboard/app/%28dashboard%29/coach/clients/[clientId]/page.tsx#L1070),
   [:1077](../fitflow-dashboard/app/%28dashboard%29/coach/clients/[clientId]/page.tsx#L1077)) ;
   l'effet analytics ne se déclenche même pas.

2. **Programmes.** Renommage en ligne (pas de modale), activation/désactivation,
   suppression après `window.confirm`. La bascule d'activation renvoie l'objet entier
   augmenté de `isActive` inversé
   ([:561-564](../fitflow-dashboard/app/%28dashboard%29/coach/clients/[clientId]/page.tsx#L561-L564)).

3. **Disponibilités et rendez-vous** (`ClientCalendarSection`,
   [:58-252](../fitflow-dashboard/app/%28dashboard%29/coach/clients/[clientId]/page.tsx#L58-L252)).
   Un seul appel `GET /availability/{clientId}?month=yyyy-MM` sert les créneaux **et** les
   rendez-vous. Il est rejoué à chaque changement de mois.

   L'état d'un jour est déterminé par priorité décroissante : rendez-vous confirmé →
   proposé → disponible → indisponible
   ([:89-96](../fitflow-dashboard/app/%28dashboard%29/coach/clients/[clientId]/page.tsx#L89-L96)).
   **Règle notable** : si le client n'a déclaré aucun créneau, il est réputé disponible en
   permanence — sinon aucun jour ne serait cliquable et le coach ne pourrait jamais rien
   proposer ([:85-87](../fitflow-dashboard/app/%28dashboard%29/coach/clients/[clientId]/page.tsx#L85-L87)).

   Le blocage d'un client est temporaire ou définitif ; `blockedUntil` n'est transmis que
   si le type est temporaire **et** la date renseignée
   ([:380](../fitflow-dashboard/app/%28dashboard%29/coach/clients/[clientId]/page.tsx#L380)).

4. **Statistiques et progression**, quatre onglets : `stats` (graphique Recharts),
   `progress` (`ClientProgressPanel`), `workout` (`WorkoutAnalyticsPanel`), `table`
   (tableau + export Excel).

**Graphique.** Périodes 7 / 30 / 60 / 90 jours, défaut 30. Quatre métriques cochables :
poids `#3b82f6`, eau `#06b6d4`, sommeil `#8b5cf6`, calories `#f59e0b`
([:645-648](../fitflow-dashboard/app/%28dashboard%29/coach/clients/[clientId]/page.tsx#L645-L648)).
`connectNulls` relie les trous plutôt que de casser la courbe.

**Astuce de remontage** : `<InolBreakdown key={period} />`
([:1324-1326](../fitflow-dashboard/app/%28dashboard%29/coach/clients/[clientId]/page.tsx#L1324-L1326)) —
changer la période remonte le composant, ce qui réinitialise son état sans avoir à écrire
un `setState` dans un effet. Le commentaire du code l'explique.

**Décision documentée** : `WorkoutAnalyticsPanel` reçoit ici `showInol={false}`, parce que
le graphique d'intensité par séance comparerait des totaux de séance à des seuils définis
par exercice, et afficherait donc « Intense » en permanence
([:1343-1348](../fitflow-dashboard/app/%28dashboard%29/coach/clients/[clientId]/page.tsx#L1343-L1348)).

---

## 3. Prescription

### 3.1 Création d'un programme — `/coach/clients/[clientId]/program/new`

[Page](../fitflow-dashboard/app/%28dashboard%29/coach/clients/[clientId]/program/new/page.tsx).

**Deux branches d'enregistrement mutuellement exclusives** :

- **Avec template sélectionné** → `POST /templates/{id}/apply` avec seulement
  `{clientId, title, description, startDate, endDate}`
  ([:163-169](../fitflow-dashboard/app/%28dashboard%29/coach/clients/[clientId]/program/new/page.tsx#L163-L169)).
  Les réglages nutrition et suivi affichés à l'écran **ne sont pas transmis** : c'est le
  template côté serveur qui fait foi, même si le coach a modifié ces champs après avoir
  choisi le template.
- **Sans template** → `POST /programs` avec l'ensemble des réglages, puis, si la case
  « Sauvegarder comme programme type » est cochée, un `POST /templates` supplémentaire dont
  l'échec est avalé sans annuler la création du programme
  ([:217-219](../fitflow-dashboard/app/%28dashboard%29/coach/clients/[clientId]/program/new/page.tsx#L217-L219)).

**Calcul nutritionnel.** `CalorieCalculator` appelle `POST /nutrition/calculate` et remonte
le résultat par `onApply`. Facteurs d'activité 1,2 / 1,37 / 1,55 (défaut) / 1,72 / 1,9 ;
objectifs `maintien`, `prise_de_masse`, `seche` avec surplus ou déficit personnalisable.

**Validation** : `title` et `startDate` par attribut `required` HTML uniquement — aucun
contrôle JavaScript, aucun `trim()`.

### 3.2 Calendrier de programme — `/coach/programs/[programId]/calendar`

[Page](../fitflow-dashboard/app/%28dashboard%29/coach/programs/[programId]/calendar/page.tsx).

C'est l'écran le plus riche en interactions du dashboard.

**Clés de date en heure locale.** `toLocalDateStr`
([:26-31](../fitflow-dashboard/app/%28dashboard%29/coach/programs/[programId]/calendar/page.tsx#L26-L31))
produit les clés `YYYY-MM-DD` sans passer par `toISOString()`, qui décalerait d'un jour
selon le fuseau et l'heure. Les séances du mois sont indexées dans un dictionnaire par
cette clé.

**Grille commençant le lundi** : `offset = (firstDay.getDay() + 6) % 7`
([:379](../fitflow-dashboard/app/%28dashboard%29/coach/programs/[programId]/calendar/page.tsx#L379)).

**Simple clic / double clic** discriminés par un temporisateur de **220 ms**
([:342-361](../fitflow-dashboard/app/%28dashboard%29/coach/programs/[programId]/calendar/page.tsx#L342-L361)) :
double clic → éditeur de séance ; simple clic → applique le template sélectionné, ou
bascule la sélection du jour.

**Historique annuler/rétablir maison.** Deux piles `history` et `redoHistory` d'entrées
`{dateKey, previousSession}`, **plafonnées à 50** par `prev.slice(-49)`. Toute action
mutante empile l'état antérieur et vide la pile de rétablissement ; en cas d'échec réseau,
l'entrée est remise dans la pile.

**Raccourcis clavier** : `Ctrl+C` copier, `Ctrl+V` coller, `Ctrl+Z` annuler,
`Ctrl+Shift+Z` rétablir, `Suppr`/`Retour` supprimer — ignorés si le focus est dans un
`INPUT` ([:253](../fitflow-dashboard/app/%28dashboard%29/coach/programs/[programId]/calendar/page.tsx#L253)).

Le listener est monté **une seule fois** (`[]`) et lit l'état courant à travers une `ref`
resynchronisée à chaque rendu
([:99](../fitflow-dashboard/app/%28dashboard%29/coach/programs/[programId]/calendar/page.tsx#L99),
[:166-168](../fitflow-dashboard/app/%28dashboard%29/coach/programs/[programId]/calendar/page.tsx#L166-L168)) :
c'est le contournement classique du problème de fermeture obsolète, qui évite de
détacher/rattacher l'écouteur à chaque frappe.

**Aucune confirmation de suppression** : ni le menu contextuel ni la touche `Suppr` ne
demandent validation. Le filet de sécurité assumé est l'annulation.

### 3.3 Éditeur de séance — composant partagé

[`sessions/_components/session-editor.tsx`](../fitflow-dashboard/app/%28dashboard%29/coach/programs/[programId]/sessions/_components/session-editor.tsx) — 1 033 lignes.

Les deux routes `sessions/new` et `sessions/[sessionId]/edit` ne sont que des enveloppes de
10 et 21 lignes. `new` est enveloppée dans un `<Suspense>` parce qu'elle utilise
`useSearchParams()` pour lire `?date=`.

**Les cinq catégories n'exposent pas les mêmes champs** — c'est le point de conception
central de cet écran ([:232-419](../fitflow-dashboard/app/%28dashboard%29/coach/programs/[programId]/sessions/_components/session-editor.tsx#L232-L419)) :

| Catégorie | Champs |
| --- | --- |
| `MAIN` — Musculation | Séries, **Répétitions**, Poids (ou grille par série), Repos |
| `RENFORCEMENT` — Renforcement | Séries, **Durée par série**, Récupération |
| `CARDIO` | Durée, Récupération, Séries |
| `WARMUP` / `STRETCHING` | Durée seule |

Le commentaire du code justifie la séparation : *« un gainage se prescrit 3 × 45 s, pas
3 × 12 »*. C'est aussi ce qui protège le calcul de volume : 45 secondes enregistrées comme
45 répétitions fausseraient le tonnage d'un facteur soixante.

**Validation des répétitions** (`isValidReps`,
[lib/setComparison.ts:4-9](../fitflow-dashboard/lib/setComparison.ts#L4-L9)) : vide accepté,
sinon `12` ou `8-12` (tiret court ou demi-cadratin, espaces tolérés). C'est **la seule
validation bloquante** : à l'enregistrement, tous les exercices invalides sont listés dans
une `alert()` et la sauvegarde est abandonnée.

**Validation des durées** (`isValidDuration`,
[setComparison.ts:67-72](../fitflow-dashboard/lib/setComparison.ts#L67-L72)) : `45s`,
`2min`, `1min30`, `1m30`. **Un nombre nu est refusé volontairement** — `45` serait ambigu
entre secondes et minutes. Elle ne bloque pas l'enregistrement, seulement l'affichage.

**Temps de repos : champ texte libre, aucun parsing**
([:174-191](../fitflow-dashboard/app/%28dashboard%29/coach/programs/[programId]/sessions/_components/session-editor.tsx#L174-L191)).
Le commentaire documente pourquoi : la version précédente à deux champs numériques `mm:ss`
était destructrice — `split(':')` sur « 90s » rendait une valeur illisible par un
`input type=number`, et toute modification réécrivait « X:00 ».

**Super-sets.** `supersetGroup` est un identifiant `ss-<timestamp>-<random>`. Lier deux
exercices consécutifs réutilise le groupe existant s'il y en a un ; retirer un membre
**dissout le groupe entier** s'il reste moins de deux membres
([:567-579](../fitflow-dashboard/app/%28dashboard%29/coach/programs/[programId]/sessions/_components/session-editor.tsx#L567-L579)).
Les libellés A, B, C… sont recalculés par ordre d'apparition à chaque rendu.

**Glisser-déposer accessible au clavier.** `PointerSensor` avec
`activationConstraint: { distance: 5 }` — un déplacement de 5 px est nécessaire, ce qui
évite qu'un clic soit interprété comme un début de glissement — **et** `KeyboardSensor`
avec `sortableKeyboardCoordinates`
([:447-450](../fitflow-dashboard/app/%28dashboard%29/coach/programs/[programId]/sessions/_components/session-editor.tsx#L447-L450)).
La poignée est un `<button type="button">` focalisable portant `aria-label`. Le
réordonnancement est donc réalisable **entièrement au clavier**, ce qui est rare et vaut
d'être signalé en soutenance.

**Distinction création / modification** : l'`id` n'est transmis que s'il ne commence pas
par `temp-`
([:629](../fitflow-dashboard/app/%28dashboard%29/coach/programs/[programId]/sessions/_components/session-editor.tsx#L629)) —
les exercices nouvellement ajoutés portent un identifiant temporaire local.

**`order` est toujours l'index au moment de l'enregistrement**, jamais un champ maintenu :
le glisser-déposer n'a donc pas à le réécrire.

### 3.4 Templates — `/coach/templates`

[Page](../fitflow-dashboard/app/%28dashboard%29/coach/templates/page.tsx) — 1 335 lignes, la plus
grosse du dépôt.

Deux onglets pour **deux entités distinctes**, souvent confondues :

| | Template de **séance** | Template de **programme** |
| --- | --- | --- |
| Endpoint | `/session-templates` | `/templates` |
| Contenu | une liste d'exercices | un cycle de N jours, chacun avec ses exercices |
| Charge utile | `{name, description, exercisesData}` | `{name, cycleDays, sessionsData, réglages nutrition/suivi, customGoalsData}` |

**Nettoyage à l'enregistrement**
([:293-302](../fitflow-dashboard/app/%28dashboard%29/coach/templates/page.tsx#L293-L302)) : les
exercices sans nom sont supprimés puis `order` réécrit par index ; les objectifs sans titre
supprimés ; les jours d'entraînement vides supprimés **mais les jours de repos conservés** ;
`sessionsData` trié par `dayNumber`.

**Calendrier du cycle** : grille de `cycleDays` cases sur 7 colonnes, lundi → dimanche.
Copier/coller d'une journée entière en mémoire locale, le collage réécrivant `dayNumber`.
Import d'une séance type dans un jour : remplacement **intégral** des exercices.

**Aucune protection des modifications non enregistrées** : fermer la modale par la croix,
par « Annuler » ou en cliquant l'arrière-plan jette la saisie sans confirmation, et il n'y
a pas de `beforeunload`.

---

## 4. Analyse

C'est la partie la plus dense du dashboard, et celle où les règles de calcul comptent le
plus. Les formules ci-dessous sont recopiées du code, pas reformulées.

### 4.1 Analyse des performances — `/coach/analytics`

[Page](../fitflow-dashboard/app/%28dashboard%29/coach/analytics/page.tsx) — 1 236 lignes.

Deux colonnes : liste de clients **redimensionnable** à gauche (défaut 288 px, bornes
220 px et `window.innerWidth - 420`), graphique à droite. Deux onglets, `daily` et
`workout`, dont l'état initial est lu dans l'URL (`?tab=workout&clientId=…`).

**Filtres de la liste** : recherche par nom, genre, poids min/max, âge min/max, programme,
tri sur nom / âge / poids. Un client dont la valeur est nulle est **exclu** dès qu'une
borne numérique est posée.

**Deux modes de sélection** : comparaison (cases à cocher multiples) ou **groupes A/B**
(bleu `#3b82f6`, ambre `#f59e0b`), l'assignation à un groupe retirant automatiquement de
l'autre.

**Encodage visuel** ([:362](../fitflow-dashboard/app/%28dashboard%29/coach/analytics/page.tsx#L362),
[:614](../fitflow-dashboard/app/%28dashboard%29/coach/analytics/page.tsx#L614)) : un seul client
→ la couleur porte la métrique ; plusieurs clients ou groupes → la couleur porte le client,
et c'est le **motif de trait** qui porte la métrique. Deux axes Y, les grandeurs en
milliers (calories, tonnage) allant à droite.

**Moyennes de groupe avec interpolation**
([:407-500](../fitflow-dashboard/app/%28dashboard%29/coach/analytics/page.tsx#L407-L500)). Sans
interpolation, un client qui ne pèse pas tous les jours ferait varier la moyenne du groupe
au gré des jours de saisie plutôt que de la réalité. Quatre étapes : indexation par client
× jour, union triée des jours, interpolation linéaire par client, moyenne arithmétique.

```js
const ratio = (tc - t0) / (t1 - t0);
vals[m] = round1(prevVal + (nextVal - prevVal) * ratio);
```

Extrapolation constante si un seul côté est connu ; un jour sans aucune valeur est sauté,
ce qui écarte la division par zéro.

### 4.2 Panneau musculation — `WorkoutAnalyticsPanel`

[Composant](../fitflow-dashboard/app/%28dashboard%29/coach/analytics/_components/WorkoutAnalyticsPanel.tsx) — 975 lignes, sept sections, **sept requêtes lancées en parallèle** avec chacune son propre drapeau de chargement : une section lente ne bloque pas les autres.

#### 1RM estimé — formule hybride

[backend-coach-app/src/utils/parseSetData.js:53-68](../backend-coach-app/src/utils/parseSetData.js#L53-L68) :

```js
if (reps === 1)       raw = weight;                      // pas d'estimation nécessaire
else if (reps <= 10)  raw = (weight * 36) / (37 - reps); // Brzycki
else                  raw = weight * (1 + reps / 30);    // Epley
return Math.round(raw * 2) / 2;                          // arrondi à 0,5 kg
```

Brzycki est plus juste sur les faibles répétitions, Epley au-delà ; le basculement à 10 est
le point où les deux courbes se croisent. Aucune division par zéro possible : `reps ≤ 10`
donc le dénominateur vaut au moins 27.

#### Volume

`volume = poids × répétitions`, en kg·reps
([workoutAnalyticsController.js:120-128](../backend-coach-app/src/controllers/workoutAnalyticsController.js#L120-L128)).

**Pondération musculaire : aucune.** Chaque `bodyPart` de l'exercice reçoit le volume
**entier** — un développé couché crédite intégralement pectoraux, épaules et triceps. Le
total hebdomadaire, somme des groupes, **surcompte donc les exercices multi-groupes**.
C'est un choix, pas un oubli : il rend la comparaison entre groupes lisible, mais interdit
de lire le total comme un tonnage réel.

Périmètre retenu : séances `completedByClient`, hors jours de repos, exercices avec
`exerciseRefId` et de catégorie `MAIN` ou `RENFORCEMENT`, séries `completed`.

#### INOL — indice d'intensité de Hristov

[workoutAnalyticsController.js:351-362](../backend-coach-app/src/controllers/workoutAnalyticsController.js#L351-L362) :

```js
const pct1RM = (w / ref1RM) * 100;
const denominator = 100 - pct1RM;
if (denominator <= 0) continue;   // poids ≥ 1RM : INOL non défini
exerciseTotal += r / denominator;
```

Le `ref1RM` est le meilleur 1RM estimé sur les **8 semaines précédant** la période
analysée (`refStart - 56 jours`) : un 1RM de référence pris dans la période elle-même
rendrait l'indice circulaire.

Deux échelles de seuils coexistent, ce qui est délibéré :

| Échelle | Seuils |
| --- | --- |
| Par séance (graphique) | 0,5 léger · 1 modéré · 2 intense |
| Par exercice (`use-session-inol.ts`) | < 0,4 insuffisant · ≤ 1,0 optimal · ≤ 2,0 élevé · > 2,0 excessif |

C'est précisément parce que les seuils de Hristov valent **par exercice** que la fiche
client passe `showInol={false}` (voir [2.3](#23-fiche-client--coachclientsclientid)).

#### Standards de force

Fenêtre **fixe de 90 jours**, indépendante de la période choisie
([:432-433](../backend-coach-app/src/controllers/workoutAnalyticsController.js#L432-L433)).
`ratio = 1RM estimé / poids de corps`. Sans poids de corps, l'API répond **422** et l'écran
affiche « poids du client requis ». Barèmes par sexe et par mouvement à la barre
([strengthStandards.js](../backend-coach-app/src/utils/strengthStandards.js)), cinq niveaux
de `beginner` à `elite`.

#### Repères de volume (méthode Renaissance Periodization)

Compte des **séries**, pas du tonnage. Table `LANDMARKS` par groupe musculaire — pectoraux
10/12/20/22, dos 10/14/22/25, quadriceps 6/12/18/20… — et cinq zones : sous-MEV, MEV→MAV,
MAV, MAV→MRV, au-dessus de MRV.

La moyenne divise par le **nombre de semaines contenant au moins une séance**
(`weekMuscle.size || 1`), et non par le nombre de semaines de la période : une semaine de
coupure ne fait pas chuter la moyenne.

#### Semaine ISO

[parseSetData.js:75-83](../backend-coach-app/src/utils/parseSetData.js#L75-L83) — calcul ISO
complet en UTC (décalage au jeudi de la semaine) plutôt qu'une simple division par 7, qui
se décalerait en fin d'année.

#### Parsing des champs texte

`repsAchieved` et `weightUsed` sont des chaînes libres saisies en salle
([parseSetData.js:15-39](../backend-coach-app/src/utils/parseSetData.js#L15-L39)) :
`"12-15"` → borne haute, `"80kg"` → 80, `"AMRAP"` / `""` → `null`, et **`0` est traité
comme `null`** : une série à zéro n'est pas une donnée, c'est une absence.

### 4.3 Cartographie corporelle — `BodyMap`

[Composant](../fitflow-dashboard/app/%28dashboard%29/coach/analytics/_components/BodyMap.tsx) —
236 lignes, alimenté par [lib/bodyPolygons.ts](../fitflow-dashboard/lib/bodyPolygons.ts)
(263 lignes de polygones SVG dérivés de `react-body-highlighter`, licence MIT).

Deux silhouettes, face (`0 0 100 200`) et dos (`0 0 100 222`). Les zones neutres
(tête, cou, genoux) portent `bodyPart: null` et ne sont pas interactives. Plusieurs zones
partagent un même `bodyPart` et donc une même couleur : abdominaux et obliques sont tous
deux `WAIST`, fessiers, adducteurs, ischios et quadriceps tous `UPPER_LEGS`.

**Interpolation de couleur** ([:32-40](../fitflow-dashboard/app/%28dashboard%29/coach/analytics/_components/BodyMap.tsx#L32-L40)) :

```js
if (!volume || volume === 0 || maxVolume === 0) return "#e2e8f0";
const ratio = Math.min(1, volume / maxVolume);
// interpolation linéaire par canal, #fde2e2 → #7f1d1d
```

**La normalisation est relative au client et à la période** : le muscle le plus travaillé
est toujours au bordeaux maximum. La carte se lit donc comme un équilibre relatif, jamais
comme une charge absolue — deux clients ne sont pas comparables par leurs couleurs.

### 4.4 Progression — `/coach/clients/[clientId]/progress`

La route n'est qu'une enveloppe de 33 lignes autour de
[`components/clients/client-progress-panel.tsx`](../fitflow-dashboard/components/clients/client-progress-panel.tsx)
(460 lignes), également monté en onglet de la fiche client.

Calendrier mensuel coloré par statut de jour (`completed`, `missed`, `future`,
`no-program`, `pending`) puis détail du jour sélectionné : séances, séries prévues contre
réalisées, repas.

**Comparaison prévu / réalisé** ([lib/setComparison.ts](../fitflow-dashboard/lib/setComparison.ts)) :

- `setStatus` compare répétitions **et** poids ; `below` l'emporte sur `above`.
- **Sans information exploitable, le statut est `in`** ([:54](../fitflow-dashboard/lib/setComparison.ts#L54)) :
  on ne pénalise pas un client faute de donnée.
- `durationStatus` existe séparément parce que `setStatus` utilise `parseFloat`, qui lirait
  `"1min30"` comme 1. Les exercices `RENFORCEMENT` passent par cette voie.

---

## 5. Relation

### 5.1 Messagerie — `/coach/messages`

[Page](../fitflow-dashboard/app/%28dashboard%29/coach/messages/page.tsx) — 565 lignes.

**Il n'existe pas d'endpoint « conversations » côté coach** : la colonne de gauche est la
liste des clients (`GET /clients/coach`), et le premier est sélectionné d'office.

**Sondage : 3 000 ms** ([:264](../fitflow-dashboard/app/%28dashboard%29/coach/messages/page.tsx#L264)),
recréé à chaque changement de client, nettoyé au démontage. Il n'y a **pas** de WebSocket :
c'est une limite assumée du projet, à énoncer plutôt qu'à masquer.

**Marquage comme lu — optimiste, avec réalignement**
([:235-246](../fitflow-dashboard/app/%28dashboard%29/coach/messages/page.tsx#L235-L246)). La
séquence mérite d'être détaillée, c'est le mécanisme le plus fin de la page :

1. la pastille est remise à 0 **avant** l'appel réseau ;
2. un `CustomEvent("fitflow:messages-read", {detail:{count}})` décrémente le badge de la
   barre latérale **sans requête** ;
3. le `PATCH …/read` part ;
4. un second événement, **sans détail**, force la barre latérale à se réaligner sur le
   serveur ;
5. en cas d'échec, rien n'est affiché : le sondage de la barre latérale rallumera la
   pastille au tick suivant.

**L'envoi de message, lui, n'est pas optimiste** : le champ est vidé après réponse, puis un
`fetchMessages()` complet est relancé.

**Défilement automatique** à chaque changement de `messages` — donc aussi à chaque tick de
sondage.

**Ordre d'initialisation volontairement séquentiel** (compteurs, puis clients) pour
connaître le nombre de non-lus du client auto-sélectionné
([:249-257](../fitflow-dashboard/app/%28dashboard%29/coach/messages/page.tsx#L249-L257)).

**Proposition de rendez-vous depuis la conversation** : bouton dans l'en-tête, modale
titre / date / heure / durée / lieu / récurrence. Le coach ne peut accepter ou refuser que
les propositions **venues du client**
([:54](../fitflow-dashboard/app/%28dashboard%29/coach/messages/page.tsx#L54)).

### 5.2 Rendez-vous — `/coach/appointments`

[Page](../fitflow-dashboard/app/%28dashboard%29/coach/appointments/page.tsx) — 838 lignes.

**Trois statuts** : `PROPOSED` (jaune), `CONFIRMED` (vert), `CANCELLED` (gris, opacité 50 %).
La modification est interdite sur un rendez-vous annulé.

**Deux vues côte à côte** : calendrier mensuel à gauche (point sous les jours ayant au moins
un rendez-vous non annulé), **grille horaire du jour** à droite — 24 heures à 44 px, soit
1 056 px, cadrée initialement sur 7 h. Les blocs sont positionnés à
`(h + m/60) × 44`, avec une hauteur plancher de 20 px pour rester cliquables, et un rendu
« compact » en dessous de 56 px.

**Résolution de conflit.** Le serveur renvoie `response.data.conflict` avec le rendez-vous
en cause ; le front propose trois issues — `replace`, `shorten`, `cancel` — les deux
premières étant renvoyées au `POST /appointments` avec `resolution` et `conflictId`
([:483-506](../fitflow-dashboard/app/%28dashboard%29/coach/appointments/page.tsx#L483-L506)).
C'est le seul endroit du dashboard où une erreur serveur ouvre une interface de décision
plutôt qu'un message.

**Séries récurrentes** : annulation et suppression acceptent un `scope` `single` ou
`series`, avec double confirmation.

**Fuseaux horaires** : aucune bibliothèque de fuseau. Tout est en heure locale du
navigateur, converti en UTC à l'envoi par `new Date(...).toISOString()`. Correct tant que
coach et client sont dans le même fuseau — ce qui est l'hypothèse du produit, mais n'est
écrit nulle part.

### 5.3 Profil — `/coach/profile`

[Page](../fitflow-dashboard/app/%28dashboard%29/coach/profile/page.tsx) — 424 lignes.

Champs éditables : photo, bio, ville, lieux d'entraînement (cases à cocher issues de
[lib/locations.ts](../fitflow-dashboard/lib/locations.ts)), coaching à distance.

**Chaîne de traitement de l'avatar** — la partie la plus technique de cet écran :

1. filtre `file.type.startsWith('image/')`, puis `e.target.value = ''` pour permettre de
   re-sélectionner le même fichier après une annulation ;
2. [`PhotoCropper`](../fitflow-dashboard/components/profile/PhotoCropper.tsx) : recadrage
   circulaire avec `react-easy-crop`, zoom 1→4, rotation par pas de 90° ; redressement dans
   un canvas intermédiaire puis extraction dans un canvas **512 × 512**, export
   `image/jpeg` **qualité 0,88** ;
3. envoi en `multipart/form-data` sur `PUT /coaches/me`, les tableaux sérialisés en JSON par
   `toFormData`.

Le redimensionnement à 512 px côté navigateur évite de transférer une photo de 4 Mo pour
l'afficher en 128 px.

**Aucune validation côté client** : ni champ requis, ni longueur, ni taille de fichier.

**Deux mécanismes de « lieux » coexistent sans se recouper** : les `trainingLocations` du
profil sont du texte libre (« Basic-Fit », « Parc »…), tandis que les `gymIds` de
l'onboarding sont des UUID issus de la table `gyms`.

**Jours bloqués** : récurrents (`dayOfWeek`) ou ponctuels (`date`), avec motif facultatif.

### 5.4 Onboarding coach — `/coach/onboarding`

[Page](../fitflow-dashboard/app/%28dashboard%29/coach/onboarding/page.tsx) — 169 lignes, deux
étapes : spécialités (10 valeurs) puis localisation (`GymPicker`, carte Leaflet).

`PUT /coaches/onboarding` puis `refreshUser()` et redirection. **En cas d'échec, la
redirection a lieu quand même.**

La condition d'entrée n'est pas dans cette page ni dans le layout : elle est dans
[`app/page.tsx:21-22`](../fitflow-dashboard/app/page.tsx#L21-L22), qui route selon
`coachProfile.onboardingCompletedAt`. Un bouton « Passer » permet de sortir sans rien
enregistrer, et **rien ne réintercepte** ensuite tant que l'utilisateur ne repasse pas par
la racine.

**`GymPicker`** ([composant](../fitflow-dashboard/components/onboarding/GymPicker.tsx), 355 l.) :
filtre texte débouncé à **300 ms**, chargement des salles par emprise de carte
(`GET /gyms/bbox`, 300 max), recherche de secours en base quand l'emprise ne donne rien,
répertoire local des salles déjà vues pour ne pas afficher un UUID quand une salle sort du
cadre. La carte est chargée en `dynamic(..., {ssr:false})` — Leaflet ne supporte pas le
rendu serveur.

### 5.5 Signalement

[`components/moderation/report-dialog.tsx`](../fitflow-dashboard/components/moderation/report-dialog.tsx) — 176 lignes.

Accessible depuis l'en-tête de conversation. Cinq motifs fermés (`HARASSMENT`, `SPAM`,
`INAPPROPRIATE_CONTENT`, `FAKE_PROFILE`, `OTHER`), description facultative, `POST /reports`.

Le signalement vise le **`User`** et non le profil client — d'où la présence de `user.id`
dans l'interface. L'écran de confirmation précise que la décision prise ne sera pas
communiquée au signalant, et, en contexte conversation, qu'un modérateur pourra consulter
les échanges : c'est la traduction en interface des contraintes RGPD retenues.

---

## 6. Points à vérifier

Ces points ont été relevés pendant la lecture. **Aucun n'a été corrigé** — ils sont listés
pour décision.

### 6.1 Anomalies confirmées sur le code

**⚠️ Taux de complétion multiplié deux fois par cent.** Le serveur renvoie déjà un
pourcentage entier :

```js
rate: total > 0 ? Math.round((completed / total) * 100) : 0
// workoutAnalyticsController.js:195
```

et le front le multiplie à nouveau :

```js
rate: Math.round(w.rate * 100)
// WorkoutAnalyticsPanel.tsx:615
```

Un taux de 80 % s'affiche donc **8 000 %**. La valeur n'apparaît que dans une infobulle
secondaire, ce qui explique qu'elle soit passée inaperçue.

**⚠️ Les poids par série ne sont pas enregistrés.** L'éditeur de séance lit
`ex.weightsPerSet` au chargement
([session-editor.tsx:481-483](../fitflow-dashboard/app/%28dashboard%29/coach/programs/[programId]/sessions/_components/session-editor.tsx#L481-L483)),
propose une grille de saisie par série, mais la construction de la charge utile
([:613-631](../fitflow-dashboard/app/%28dashboard%29/coach/programs/[programId]/sessions/_components/session-editor.tsx#L613-L631))
n'inclut **ni `setWeights` ni `usePerSetWeights` ni `weightsPerSet`** — vérifié ligne à
ligne. Les poids différenciés saisis semblent perdus à l'enregistrement.

**⚠️ `RRULE:FREQ=BIWEEKLY` n'est pas une fréquence RFC 5545 valide**
([appointments/page.tsx:32](../fitflow-dashboard/app/%28dashboard%29/coach/appointments/page.tsx#L32)).
La messagerie utilise, pour le même besoin, la forme correcte
`RRULE:FREQ=WEEKLY;INTERVAL=2`. Les deux écrans divergent.

### 6.2 Limites assumées ou approximations

- **Le filtre « Anciens clients » n'a aucun effet** : seules les valeurs `pending` et
  `active` sont traitées, tout le reste retourne `true`
  ([clients/page.tsx:259-263](../fitflow-dashboard/app/%28dashboard%29/coach/clients/page.tsx#L259-L263)).
- **Requêtes de séances séquentielles** dans la ligne dépliable de la liste clients
  (`await` en boucle) : N+1 potentiel pour un client à plusieurs programmes.
- **Refetch inutile** sur la fiche client : `selectedMetrics` figure dans les dépendances de
  l'effet analytics alors que la requête n'en dépend pas — cocher une métrique relance un
  appel réseau.
- **Repères MEV/MAV/MRV du graphique de volume** : les trois lignes de référence ne sont
  tracées que d'après le **premier** muscle, alors que les seuils diffèrent par groupe. La
  limite est reconnue dans un commentaire du code.
- **`parseNumericField` ignore l'unité** : `"80 lbs"` est lu comme 80, sans conversion.
- **Aucune pondération musculaire du volume** (voir [4.2](#volume)) : le total surcompte les
  exercices multi-groupes.
- **Application d'un template dans le calendrier** : le statut est forcé à `DONE` en dur
  ([calendar/page.tsx:278](../fitflow-dashboard/app/%28dashboard%29/coach/programs/[programId]/calendar/page.tsx#L278)),
  alors qu'appliquer un modèle décrit une séance à faire, pas une séance faite.
- **Messages non lus câblés à `0`** sur le tableau de bord
  ([dashboard/page.tsx:160](../fitflow-dashboard/app/%28dashboard%29/coach/dashboard/page.tsx#L160)) :
  la carte affiche toujours zéro, aucune API n'est appelée.
- **Une valeur `0` s'affiche `-`** sur la fiche client et à l'export, les tests étant faits
  sur la véracité et non sur la nullité.

### 6.3 Traitement des erreurs

Le constat est homogène sur tout l'espace coach, et il vaut mieux l'énoncer que le laisser
découvrir : **les erreurs de lecture ne sont presque jamais montrées à l'utilisateur.**
Elles font un `console.error` et l'écran affiche son état vide — une panne réseau est donc
indistinguable d'une absence de données. Les erreurs d'écriture, elles, passent par
`alert()` natif, y compris les confirmations de suppression (`window.confirm`).

Un seul cas fait exception : `getStrengthStandards` transforme l'échec en liste vide
([WorkoutAnalyticsPanel.tsx:389](../fitflow-dashboard/app/%28dashboard%29/coach/analytics/_components/WorkoutAnalyticsPanel.tsx#L389)),
ce qui rend l'échec encore moins distinguable.

### 6.4 Accessibilité

Le tableau est contrasté :

**Ce qui est fait** — le glisser-déposer des exercices est **utilisable au clavier**
(`KeyboardSensor` + `sortableKeyboardCoordinates`), les poignées sont des `<button>`
focalisables avec `aria-label`, et les onglets de statistiques portent `role="tab"` et
`aria-selected`.

**Ce qui ne l'est pas** — les modales n'ont ni `role="dialog"`, ni `aria-modal`, ni piège
de focus, ni fermeture par `Échap` ; les lignes dépliables de la liste clients sont des
`<div onClick>` sans `tabIndex` ni gestion de `Entrée`/`Espace` ; les en-têtes de tri n'ont
pas d'`aria-sort` ; les conteneurs d'onglets n'ont pas de `role="tablist"`.

### 6.5 Code mort ou incertain

- `handleCancel` ([appointments/page.tsx:203](../fitflow-dashboard/app/%28dashboard%29/coach/appointments/page.tsx#L203))
  est défini mais n'est appelé nulle part dans le rendu.
- `SessionInolReport.tsx` (216 lignes) : aucun import trouvé dans le dépôt — remplacé
  fonctionnellement par le hook `use-session-inol.ts`.
- Le paramètre d'URL `appointmentId`, poussé par la barre latérale
  ([sidebar.tsx:341](../fitflow-dashboard/components/layout/sidebar.tsx#L341)), n'est lu
  nulle part par la page agenda.
- `moveExercise` dans l'éditeur de séance : fonction de réordonnancement par boutons
  haut/bas, sans appelant identifié dans le JSX.
- La prop `gender` de `BodyMap` est reçue puis ignorée (`gender: _gender`) : il n'existe
  qu'une silhouette.
- Les libellés de la page de création de programme sont **non accentués** (« Creer un
  programme », « Client non trouve »), contrairement au reste du dashboard.

---

## 7. Récapitulatif des routes d'API

Routes appelées par l'espace coach, groupées par écran d'origine.

| Écran | Routes |
| --- | --- |
| Tableau de bord | `GET /programs/coach` · `GET /clients/coach` · `GET /appointments/upcoming` |
| Liste clients | `GET /clients/coach` · `GET /clients/prospection` · `GET /programs/coach` · `GET /stats/client/{id}` · `GET /sessions/program/{id}` · `PUT /requests/{id}/accept` · `PUT /requests/{id}/reject` |
| Fiche client | `GET /clients/{id}` · `GET /programs/coach` · `PUT /programs/{id}` · `DELETE /programs/{id}` · `GET /analytics/stats` · `GET /availability/{clientId}` · `GET`/`POST`/`DELETE /availability/client-block/{clientId}` · `POST /appointments` |
| Création de programme | `GET /clients/{id}` · `GET /templates` · `GET /templates/{id}` · `POST /templates/{id}/apply` · `POST /programs` · `POST /templates` · `POST /nutrition/calculate` |
| Calendrier de programme | `GET /programs/{id}` · `GET /session-templates` · `GET /sessions/program/{id}` · `POST /sessions` · `DELETE /sessions/{id}` |
| Éditeur de séance | `GET /sessions/{id}` · `POST /sessions` · `GET /exercise-refs/search` |
| Templates | `GET`/`POST`/`PUT`/`DELETE /templates` · `GET`/`POST`/`PUT`/`DELETE /session-templates` · `GET /exercise-refs/search` |
| Analyse | `GET /analytics/clients` · `GET /analytics/stats` · `GET /analytics/workout/{estimated-1rm,volume,completion,load-progression,inol,strength-standards,volume-landmarks}` |
| Progression | `GET /clients/{id}` · `GET /programs/coach` · `GET /stats/client/{id}` · `GET /sessions/program/{id}` · `GET /meals/client/{userId}` · `GET /analytics/workout/inol` |
| Messagerie | `GET /messages/unread-counts` · `GET /messages/conversation/{coachId}/{clientId}` · `PATCH /messages/conversation/{coachId}/{clientId}/read` · `POST /messages` · `POST /appointments` · `PUT /appointments/{id}/confirm` · `PUT /appointments/{id}/cancel` · `POST /reports` |
| Rendez-vous | `GET /appointments` · `GET /clients/coach` · `POST /appointments` · `PUT /appointments/{id}` · `PUT /appointments/{id}/cancel` · `DELETE /appointments/{id}` |
| Profil | `GET /coaches/me` · `PUT /coaches/me` · `GET`/`POST`/`DELETE /availability/coach/blocks` |
| Onboarding | `GET /gyms/search` · `GET /gyms/bbox` · `GET /gyms/db-search` · `PUT /coaches/onboarding` |
| Barre latérale | `GET /messages/unread-count` · `GET /notifications/unread-count` · `GET /notifications` |
