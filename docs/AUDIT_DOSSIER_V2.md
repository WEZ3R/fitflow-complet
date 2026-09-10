# Audit du dossier de projet FitFlow — en vue du RNCP 37873

Document de travail. Il analyse `DOSSIER_PROJET.pdf` (64 pages, version de mai 2026),
confronte son contenu au code réellement présent dans les trois dépôts, et liste les
corrections à apporter dans la nouvelle version.

**Le PDF d'origine n'est pas modifié.** La nouvelle version est produite à part
(`DOSSIER_PROJET_V2.pdf`).

---

## 0. Avertissement méthodologique — référentiel RNCP

**[À COMPLÉTER : le référentiel officiel RNCP 37873 n'a pas été fourni]**

Le prompt mentionnait un référentiel joint ; il n'est présent ni dans `docs/`, ni ailleurs
dans le projet. La cartographie des compétences ci-dessous s'appuie donc sur ma
**connaissance générale** du titre Concepteur Développeur d'Applications, explicitement
identifiée comme telle. Elle est structurée en trois blocs de compétences (BC01, BC02,
BC03).

> ⚠️ **Point à vérifier** — Avant tout rendu, confronte cette liste au référentiel officiel
> téléchargé sur France Compétences. Les libellés exacts, la numérotation et le découpage
> des compétences font foi, pas ma reconstitution. Fournis-moi le PDF et je réaligne la
> cartographie.

---

## 1. Méthode de vérification

Chaque affirmation technique du dossier a été confrontée au code des trois dépôts :

| Vérification | Méthode |
| --- | --- |
| Nombre de tests | Exécution réelle des suites (`npm test`, `npx vitest run`) |
| Versions | Lecture des `package.json` |
| Structure | Comptage des fichiers `controllers/`, `routes/`, modèles Prisma |
| CI/CD | Lecture de `.github/workflows/` |
| Accessibilité | Comptage des attributs `aria-*`, `htmlFor` |
| RGPD | Recherche des routes de suppression de compte |

---

## 2. Audit page par page

Les pages blanches (6, 9, 18, 24, 30, 33, 38, 42, 53, 56, 59) sont des séparateurs de
partie ; elles ne sont pas listées.

| Page | Contenu actuel | À conserver | À modifier | À supprimer | À déplacer en annexe | Élément manquant |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Page de garde | Titre, sous-titre, stack | Ajouter la mention **RNCP 37873** et le nom complet du candidat | — | — | Mention du titre visé, date de session |
| 2 | Note d'intention, public visé | Le raisonnement « mosaïque d'outils » | Requalifier en **hypothèse de conception** (aucune étude terrain citée) | — | — | Origine réelle du besoin (le coach de l'entourage) |
| 2-4 | 3 personas (Thomas, Camille, Inès) | Les trois personas, bien construits | Préciser qu'ils sont **fictifs et déduits**, pas issus d'entretiens | — | — | Méthode de construction des personas |
| 4-5 | 3 parcours utilisateurs | Excellent matériau, à garder | Renuméroter en cas d'usage formalisés | — | — | Diagramme de cas d'utilisation UML |
| 5 | Promesse produit, 3 principes | Tel quel | — | — | — | — |
| 7 | Vue d'ensemble 3 composants | Le tableau | — | — | — | **Vrai schéma d'architecture** (actuellement une description) |
| 7-8 | Périmètre fonctionnel + hors-périmètre | Tel quel, très bon | — | — | — | — |
| 10-17 | Cahier des charges fonctionnel F1→F16 | Le fond : 16 exigences bien écrites | Alléger — beaucoup de détails d'UI (couleurs de boutons, tailles de carrés) | Détails cosmétiques (F2.5, F4.6, F8.1) | Le détail exigence par exigence | Lien explicite exigence → user story → test |
| 19-23 | Cahier des charges technique T1→T9 | Le fond | **T3.1 : « Next.js 15 » → le projet est en Next.js 16.1.6** | — | Le détail T2/T3/T4 | — |
| 22 | **T7.1 « 65 tests Jest »** | — | **Faux — voir §4** | — | — | Les tests dashboard et E2E, absents du dossier |
| 22 | T7.5 « pas de pipeline CI/CD » | — | **Faux — deux workflows existent, voir §4** | — | — | Documentation des pipelines |
| 25 | Arborescence des 3 dépôts | Utile | Corriger : les dossiers réels sont `backend-coach-app`, `fitflow-dashboard`, `coach-mobile-app` | — | L'arborescence détaillée | — |
| 25 | « Diagramme de séquence d'authentification » | L'intention | — | La description textuelle | — | **La vraie figure** |
| 26 | Code `login` | Extrait pertinent, ~15 lignes | Ajouter légende + compétence visée | — | — | — |
| 26-28 | Cartographie API (22 modules) | L'information | Résumer en 6 lignes dans le corps | — | **Le tableau complet des endpoints** | — |
| 28-29 | « Diagramme entité-relation » | L'intention | — | La description textuelle | — | **Le vrai MCD/MPD** |
| 29 | Extraits Prisma (User, ClientCoach, Appointment) | Très bons extraits | Ajouter légendes | — | — | — |
| 31-32 | Design system (palette indigo #6366f1) | La démarche | **Obsolète — la DA a changé, voir §5** | — | Le détail des composants | Capture du thème sombre |
| 34-41 | **16 « maquettes » du dashboard et du mobile** | Les intentions d'écran | — | — | — | **Aucune image réelle. C'est le point le plus pénalisant du dossier.** |
| 43-52 | Fonctionnalités clés + extraits de code | Excellent matériau | Restructurer en Besoin / Solution / Preuve / Compétence | — | Les extraits > 20 lignes | Résultat observable de chaque fonctionnalité |
| 45-46 | Règle métier « on n'accepte pas sa propre proposition » | Très bon cas | En faire une **étude de cas** complète | — | — | Le test qui prouve la règle |
| 54-55 | Sécurité | Bon contenu | Ajouter les **limites assumées** | — | — | localStorage/XSS, absence de refresh token, rate limiting |
| 57 | Limitations v1 | Honnête et bien vu | Passer au code couleur 🟢🟡🔴🔵 | — | — | — |
| 58 | Pistes v2 | Le tableau | Réduire aux 4 plus justifiées | 3 lignes de wishlist | — | — |
| 60-64 | Annexes (stack, commandes, glossaire) | Tout | Corriger les versions | — | — | — |
| — | **Absent du dossier** | — | — | — | — | Gestion de projet, RGPD, RGAA, éco-conception, déploiement, DevOps, veille, difficultés structurées, bilan, cartographie RNCP |

---

## 3. Ce que le dossier dit vs. ce que le code contient

C'est le cœur de l'audit. Six écarts, dont quatre en ta défaveur et deux en ta faveur.

### ⚠️ Écart 1 — Les tests (le plus grave)

**Le dossier écrit (p. 22) :** « Suite de 65 tests sur le backend (Jest) ».

**Le code dit :**

| Fait vérifié | Valeur réelle |
| --- | --- |
| Runner backend | **`node:test`** (runner natif Node.js) — `npm test` exécute `node --test` |
| Jest présent ? | **Non.** Jest n'apparaît dans aucun `package.json` |
| Tests backend d'intégration | **105 tests, 33 suites**, 9 fichiers |
| Tests backend unitaires purs | **42 tests, 3 suites** (`parseSetData.test.js`) — 42/42 au vert |
| Tests dashboard | **41 tests, 7 fichiers** (Vitest + Testing Library) — 41/41 au vert, exécutés le 29/08/2026 |
| Tests E2E | **5 tests Playwright** (`e2e/auth.spec.ts`) |
| **Total** | **≈ 193 tests** |

> ⚠️ **Point à vérifier** — Devant un jury, annoncer « 65 tests Jest » alors que le projet
> utilise `node:test` et en contient près de 200 est le genre d'écart qui décrédibilise
> l'ensemble du dossier si un examinateur ouvre le dépôt. C'est d'autant plus dommage que
> **la réalité est nettement meilleure que ce qui est annoncé**.

**Nuance à documenter honnêtement :** les 105 tests d'intégration exigent une base
PostgreSQL *et* le serveur lancé sur le port 5001. Sur ma machine, ils échouent pour une
raison d'identifiants PostgreSQL locaux, pas de régression de code. En CI, le workflow
provisionne un service `postgres:15`, mais ne lance pas le serveur applicatif avant
`npm test`.

> ⚠️ **Point à vérifier** — Le workflow backend exécute `npm test` sans démarrer
> `src/server.js`. Si les tests d'intégration ont besoin du serveur HTTP, la CI backend
> échoue probablement. **Vérifie le dernier run GitHub Actions avant de citer la CI comme
> une preuve.** Si elle est rouge, c'est à corriger dans le projet (§ D).

### ✅ Écart 2 — La CI/CD existe (en ta faveur)

**Le dossier écrit (p. 22) :** « CI manuelle sur PR (pas de pipeline CI/CD configuré pour la v1) ».

**Le code dit :** deux workflows GitHub Actions réels.

| Dépôt | Fichier | Contenu |
| --- | --- | --- |
| `backend-coach-app` | `.github/workflows/ci.yml` | Service PostgreSQL 15, Node 20, `npm ci`, rebuild bcrypt, `prisma generate`, `prisma db push`, `npm test` |
| `fitflow-dashboard` | `.github/workflows/ci.yml` | Job 1 : lint → tests → build. Job 2 (`needs: test`) : Playwright E2E sur Chromium |

C'est une **compétence entière du bloc 3** que le dossier passe sous silence. À documenter
en priorité.

### ✅ Écart 3 — La conteneurisation existe (en ta faveur)

`backend-coach-app` contient un `Dockerfile` **et** un `docker-compose.yml`. Le dossier
n'en parle pas, alors que la section déploiement en a besoin.

### ⚠️ Écart 4 — Versions et volumétrie

| Affirmation du dossier | Réalité vérifiée |
| --- | --- |
| « Next.js 15 (App Router, Turbopack) » (p. 20, 61) | **Next.js 16.1.6**, React 19.2.3 |
| « 17 controllers » (p. 25) | **24 controllers** |
| « 22 modules de routes » (p. 26) | **22** ✅ correct |
| « 8 utilisateurs de démo » (p. 62) | Le seed contient **35 comptes** |
| « 390 exercices » | Non recomptés — **[À COMPLÉTER : confirme le nombre exact]** |
| Modèles Prisma | **32 modèles**, 10 enums, 4 index |

### ⚠️ Écart 5 — Le design system est obsolète

Voir §5.

### ⚠️ Écart 6 — Performance non mesurée

**Le dossier écrit (p. 21, T6.2) :** « Réponses API < 300 ms en p95 sur les endpoints principaux ».

Aucune campagne de mesure n'est documentée nulle part dans le projet.

> ⚠️ **Point à vérifier** — Un jury peut demander « comment avez-vous mesuré ce p95 ? ».
> Soit tu produis la mesure (§ D), soit tu reformules en **objectif de conception** et non
> en résultat constaté.

---

## 4. Ce qui manque totalement

Ces sections sont exigées ou fortement attendues au RNCP 37873 et sont absentes du dossier
actuel :

| Section absente | Enjeu RNCP | Matériau disponible dans le projet |
| --- | --- | --- |
| Gestion de projet | BC01 — gestion de projet | Historique Git réel, branches, commits conventionnels sur le dashboard |
| Déploiement | BC03 — préparer le déploiement | Dockerfile, docker-compose, `.env` multi-OS, scripts `switch-env.sh` |
| DevOps / CI-CD | BC03 — mise en production DevOps | Les deux `ci.yml` |
| Plan de tests structuré | BC03 — plans de tests | ≈ 193 tests réels |
| RGPD | Transverse | Données de santé collectées, `onDelete: Cascade` (35 occurrences) |
| Accessibilité / RGAA | BC01 — interfaces utilisateur | Faible : 16 `aria-label`, 4 `htmlFor` |
| Éco-conception | Transverse | 7 `take:` (limitation de volume), polling maîtrisé, pas de pagination complète |
| Veille technologique | BC01 | **[À COMPLÉTER : aucune trace dans le projet]** |
| Difficultés structurées | Transverse | Matériau p. 45-46, 49 à restructurer |
| Bilan personnel | Transverse | Rien |
| Cartographie des compétences | **Indispensable pour le jury** | Rien |

---

## 5. La nouvelle direction artistique

Le design system du dossier (p. 31-32) décrit une palette **indigo `#6366f1`**. Le code du
dashboard, sur la branche `experiment/rendu-visuel` fusionnée dans `main` le 29/08/2026,
utilise autre chose :

| Élément | Valeur réelle (`app/globals.css`) |
| --- | --- |
| Thème clair — primaire | Bleu ciel, échelle `--color-primary-*`, base `#0ea5e9`, action `#0284c7` |
| Thème sombre | Activé par `data-theme="lime"` sur `<body>` |
| Fond de page | `#272727` |
| Cartes | `#323232` |
| Navigation | `#1f1f1f` |
| Élévation interne | `#3d3d3d` |
| Filets | `rgba(255,255,255,0.11)` |
| Accent | **`#85e859`** (vert lime) |
| Texte sur accent | `#1c1c1c` (le blanc y est illisible) |
| Rayon des cartes | `20px` |
| Police | **Geist Sans / Geist Mono** (`next/font`) |

La méthode employée dans le code mérite d'être racontée au jury : plutôt que de remapper
243 utilitaires Tailwind un par un, tu surcharges les **96 variables `--color-*`** que tous
les utilitaires consomment, avec deux rampes de clarté OKLCH distinctes selon l'usage
(fonds vs texte). C'est une décision technique justifiée et défendable — exactement le type
de matériau que le RNCP valorise.

**Choix retenu pour le nouveau dossier :** identité lime/graphite sur la page de garde, les
titres de partie et les encadrés ; **corps de texte sur fond clair**. Un dossier de jury est
imprimé et annoté ; un fond `#272727` sur 60 pages est illisible sur papier et vide une
cartouche d'encre. La DA est donc *portée*, pas *appliquée littéralement*.

---

## 6. Cartographie des compétences — état actuel du dossier

> Rappel : découpage reconstitué de mémoire, **à confronter au référentiel officiel**.

| Compétence RNCP (BC) | Preuve actuellement présente | Page | Niveau | Action nécessaire |
| --- | --- | ---: | --- | --- |
| **BC01.1** Installer et configurer son environnement | Commandes d'install, `.env`, Docker DB | 62 | 🟠 Partiellement démontré | Ajouter les scripts `switch-env.sh` multi-OS et la justification |
| **BC01.2** Développer des interfaces utilisateur | Drag-and-drop dnd-kit, BodyMap SVG, bottom-sheets | 36, 44, 48 | 🟢 Démontré | Ajouter les **captures réelles** — sans image, la preuve reste déclarative |
| **BC01.3** Développer des composants métier | Cron H-1 idempotent, règle d'acceptation RDV, SetCompletion | 45-46, 50 | 🟢 Très bien démontré | Restructurer en Besoin/Solution/Preuve |
| **BC01.4** Contribuer à la gestion d'un projet | Conventions de commit (p. 63) | 63 | 🔴 Non démontré | Section entière à écrire : jalons, Git, périmètre, décisions |
| **BC02.5** Analyser les besoins et maquetter | CDC F1→F16, personas, parcours | 2-17 | 🟠 Partiellement démontré | **Les maquettes sont décrites, pas montrées.** Bloquant. |
| **BC02.6** Définir l'architecture logicielle | Architecture 3-tier décrite, API stateless | 19, 25 | 🟠 Partiellement démontré | Produire le schéma ; ajouter alternatives et justification |
| **BC02.7** Concevoir une base de données relationnelle | Schéma Prisma, 32 modèles, index | 28-29 | 🟢 Démontré | **MCD/MPD manquants** — le schéma Prisma n'en tient pas lieu |
| **BC02.8** Composants d'accès aux données **SQL et NoSQL** | Prisma, requêtes relationnelles | 26-52 | 🟠 SQL démontré / 🔴 NoSQL absent | Voir l'encadré ci-dessous |
| **BC03.9** Préparer et exécuter les plans de tests | « 65 tests Jest » | 22 | ⚠️ À vérifier | Chiffre faux. Reconstruire sur les ≈193 tests réels + matrice |
| **BC03.10** Préparer et documenter le déploiement | Aucune | — | 🔴 Non démontré | Dockerfile et compose existent mais ne sont pas documentés |
| **BC03.11** Contribuer à la mise en production DevOps | Nié par le dossier (« pas de CI/CD ») | 22 | 🔴 Non démontré **à tort** | Les deux `ci.yml` sont une preuve directe |

### 🔴 Compétence NoSQL

**[COMPÉTENCE NOSQL NON DÉMONTRÉE DANS LE PROJET ACTUEL — À COUVRIR OU À JUSTIFIER AVEC UN AUTRE PROJET]**

FitFlow est exclusivement PostgreSQL via Prisma. Trois options, par ordre de préférence :

1. **Justifier par un autre projet** — si tu as une réalisation MongoDB/Redis/Firestore
   ailleurs, elle a sa place en annexe du dossier.
2. **Ajouter un usage NoSQL réellement utile** — le cas le plus honnête ici serait Redis
   pour le cache du compteur de notifications non-lues ou la limitation de débit. Ce n'est
   défendable que si tu l'implémentes vraiment.
3. **Assumer le manque** et l'expliquer au jury.

**Ce qu'il ne faut pas faire :** ajouter MongoDB pour cocher la case. Un jury demande
toujours « pourquoi ce choix ? », et une réponse cosmétique s'effondre en deux questions.

> Note : le champ `data Json?` du modèle `Notification` est un stockage semi-structuré
> dans PostgreSQL. C'est intéressant à mentionner, mais **ce n'est pas du NoSQL** et il ne
> faut pas le présenter comme tel.

---

## 7. Corrections à apporter, par priorité

### Priorité 1 — bloquant pour le jury

1. Corriger le chiffre des tests (« 65 Jest » → réalité vérifiée) et construire la matrice.
2. Produire les **captures d'écran réelles** — 16 maquettes décrites, zéro image.
3. Produire les 3 figures structurantes : architecture, MCD, séquence d'authentification.
4. Documenter la CI/CD existante et le déploiement.
5. Écrire la cartographie des compétences RNCP.
6. Trancher la question NoSQL.

### Priorité 2 — crédibilité

7. Corriger Next.js 15 → 16, 17 → 24 controllers, 8 → 35 comptes de seed.
8. Mettre à jour le design system avec la DA lime/graphite.
9. Requalifier les hypothèses de conception (personas, problème marché).
10. Reformuler ou mesurer le « p95 < 300 ms ».
11. Ajouter les sections gestion de projet, RGPD, RGAA, éco-conception, bilan.

### Priorité 3 — lisibilité

12. Déplacer en annexe : table complète des endpoints, détail des CDC, extraits > 20 lignes.
13. Alléger les CDC de leurs détails cosmétiques.
14. Réduire les pistes v2 à 4 entrées justifiées.

---

## 8. Ce que tu dois me fournir

| # | Élément | Pourquoi |
| --- | --- | --- |
| 1 | **Le référentiel officiel RNCP 37873** (PDF France Compétences) | Réaligner la cartographie sur les libellés exacts |
| 2 | **Captures d'écran** : dashboard coach, éditeur de séance, agenda, messagerie, analytics + BodyMap, accueil mobile, détail séance, chrono de repos | Remplacer les 16 descriptions textuelles |
| 3 | **Statut du dernier run GitHub Actions** (vert ou rouge, sur les 2 dépôts) | Ne citer la CI comme preuve que si elle passe |
| 4 | **Dates réelles du projet** : début, fin, jalons | Section gestion de projet |
| 5 | **Sources de veille** réellement consultées (URL, dates, sujets) | Section veille — je n'inventerai rien |
| 6 | Nom complet, session d'examen, organisme de formation | Page de garde |
| 7 | Nombre exact d'exercices seedés | Corriger le « 390+ » |
| 8 | Réponse sur le NoSQL (autre projet ? implémentation ? assumé ?) | Section base de données |
| 9 | Une application est-elle **hébergée quelque part** ? | Section déploiement — sinon je documente le déploiement préparé, pas réalisé |

---

## 9. À modifier dans le projet lui-même (pas seulement dans le PDF)

| Chantier | Effort | Gain RNCP |
| --- | --- | --- |
| Vérifier / réparer la CI backend (serveur non lancé avant `npm test`) | Faible | Élevé — BC03 |
| Route de suppression de compte (aucune n'existe) | Moyen | Élevé — RGPD, droit à l'effacement |
| Accessibilité : `htmlFor` sur tous les champs, focus visible, contrastes | Moyen | Élevé — BC01.2 |
| Déployer ne serait-ce qu'une préproduction | Moyen | Très élevé — BC03.10 |
| Mesurer réellement les temps de réponse | Faible | Moyen — étaye le CDC |
| Trancher le NoSQL | Variable | Élevé — BC02.8 |
| Rate limiting sur `/auth/login` | Faible | Moyen — sécurité |
| Pagination des listes (7 `take:` seulement) | Moyen | Moyen — éco-conception |

---

## 10. Checklist avant impression

- [ ] Pagination continue et correcte
- [ ] Sommaire avec numéros de pages à jour
- [ ] Toutes les figures présentes (aucun `[INSÉRER FIGURE]` résiduel)
- [ ] Toutes les figures légendées et numérotées
- [ ] Renvois de pages vérifiés
- [ ] Aucune donnée personnelle réelle (⚠️ le seed contient des adresses type `sarah.martin@fitflow-seed.com` — vérifier qu'aucune capture ne montre de vraie personne)
- [ ] Aucun secret : `JWT_SECRET`, mots de passe, `DATABASE_URL` avec identifiants réels
- [ ] Cohérence des technologies annoncées vs. code
- [ ] Cohérence des versions (Next 16, React 19, Expo 54, Prisma 5)
- [ ] Cohérence entre le texte et l'application réellement démontrable
- [ ] Chaque compétence RNCP pointe vers une preuve paginée
- [ ] Annexes référencées depuis le corps
- [ ] Aucune fonctionnalité inventée
- [ ] Aucun `[À COMPLÉTER]` résiduel
