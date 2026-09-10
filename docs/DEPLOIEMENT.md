# FitFlow — déploiement, intégration continue et exploitation

Document de référence pour la soutenance RNCP 37873. Il décrit ce qui est **réellement en
place** au 30 août 2026, les décisions prises et pourquoi, les limites assumées, et les
questions auxquelles il faut savoir répondre.

Aucun secret ici : ils sont dans `C:\Users\marcy\Documents\fitflow-acces-et-secrets.md`,
hors dépôt.

---

## 1. L'architecture en une image

```
                    fitflow.marcyrius.com
                              │
                    ┌─────────▼─────────┐
   Cloudflare ─────►│      VERCEL       │   Dashboard Next.js 16
   (DNS only)       │   build + CDN     │   déploiement AUTOMATIQUE
                    └─────────┬─────────┘
                              │  HTTPS + Authorization: Bearer <JWT>
                              ▼
                    ┌───────────────────┐
   Mobile Expo ────►│      FLY.IO       │   API Express (Docker)
                    │  Paris · 2 VM     │   déploiement MANUEL
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │     SUPABASE      │   PostgreSQL (pooler 6543)
                    │     Irlande       │   Bucket « uploads »
                    └───────────────────┘
```

Trois fournisseurs, **0 € par mois**.

---

## 2. Ce qui se déploie tout seul, et ce qui ne se déploie pas

C'est **la** chose à savoir, parce qu'un jury peut la demander et parce que s'y tromper
met la production en incohérence.

| Composant | Sur `git push origin main` | Pourquoi |
| --- | --- | --- |
| **Dashboard** (Vercel) | ✅ **Se déploie automatiquement** | Vercel est branché sur le dépôt GitHub. Il construit et publie à chaque poussée. |
| **Backend** (Fly.io) | ❌ **Rien ne se passe** | Aucun workflow de déploiement n'existe. Il faut lancer `flyctl deploy` à la main. |
| **Base de données** | ❌ **Rien ne se passe** | Les migrations ne sont jamais jouées automatiquement. |

### Conséquence pratique

Après un commit backend, **le code sur GitHub et le code en production divergent** jusqu'à
ce que tu lances le déploiement. Vérifier l'écart :

```bash
flyctl releases --app fitflow-api      # date de la dernière version déployée
git log -1 --format="%h %ad %s"        # date du dernier commit
```

### Mettre à jour l'API

```bash
C:\Users\marcy\.fly\bin\flyctl.exe deploy --remote-only --app fitflow-api
```

`--remote-only` fait construire l'image par Fly, pas par ta machine : pas besoin de Docker
en local, et le résultat ne dépend pas de ton poste.

---

## 3. L'ordre des opérations — la règle à ne pas oublier

> **Les migrations d'abord, le code ensuite. Jamais l'inverse.**

Le déploiement Fly ne joue **pas** les migrations. Si tu déploies du code qui attend une
colonne absente de la base, Prisma renvoie une erreur `P2022` et **plus personne ne peut se
connecter** — la requête de login charge des relations, elle échoue en entier.

Ce n'est pas théorique : c'est exactement la panne rencontrée en développement le 29 août.
La base locale avait quatre migrations de retard, `gyms.source` n'existait pas, et toute
connexion échouait.

```bash
# 1 — Schéma (voir le fichier de secrets pour les URL)
DATABASE_URL="<pooler 6543>" DIRECT_URL="<session 5432>" npx prisma migrate deploy

# 2 — Code
flyctl deploy --remote-only --app fitflow-api
```

### Pourquoi deux URL de base

| Variable | Port | Usage | Raison |
| --- | --- | --- | --- |
| `DATABASE_URL` | 6543 | L'application | Pooler en mode transaction. `pgbouncer=true` est obligatoire : sans lui, Prisma émet des requêtes préparées que ce mode rejette. |
| `DIRECT_URL` | 5432 | `prisma migrate` | Les migrations ont besoin d'une session persistante, que le mode transaction n'accorde pas. |

Déclaré dans `prisma/schema.prisma` par `directUrl = env("DIRECT_URL")`.

### Le déploiement de la modération — 30 août 2026, dans cet ordre

Cas d'école de la règle ci-dessus : la migration ajoute quatre tables, une énumération
`UserRole` étendue à `ADMIN` et cinq colonnes sur `users`. Le code déployé avant la
migration aurait cassé toutes les connexions.

```bash
# 1 — Schéma. Migration purement additive : aucun DROP, aucune perte.
DATABASE_URL="<pooler>" DIRECT_URL="<directe>" npx prisma migrate deploy
#   → 20260830143244_moderation appliquée ; 33 tables → 37

# 2 — Code
flyctl deploy --remote-only --app fitflow-api

# 3 — Administrateur de production. Aucune route HTTP ne le permet.
DATABASE_URL="<directe>" node scripts/create-admin.js   --email admin@fitflow.marcyrius.com --firstName Marc --lastName Yrius
```

**Vérification préalable qui a évité une mauvaise surprise.** Une note d'audit indiquait que
la production avait été initialisée par `prisma db push` — auquel cas `migrate deploy` aurait
tenté de rejouer la migration initiale sur des tables existantes, et échoué. J'ai donc lu
`_prisma_migrations` avant d'écrire quoi que ce soit : les quatre migrations y figuraient,
toutes achevées, aucune en rollback. La note était périmée. **Interroger la table d'historique
avant une migration de production coûte trente secondes ; s'en passer coûte une restauration.**

### Recette de bout en bout jouée sur la production

| # | Cas | Résultat |
| --- | --- | --- |
| 1 | Un client en signale un autre | 201, signalement créé |
| 2 | Se signaler soi-même | 400 |
| 3 | L'administrateur consulte le signalement | 200 |
| 4 | Suspension **sans motif** | 400 |
| 5 | Suspension motivée | 200 |
| 6 | Le compte suspendu se connecte | 403, avec motif, échéance et voie de recours |
| 7 | Le compte suspendu appelle une route ordinaire | 403 |
| 8 | Le compte suspendu dépose un recours | **201 — la route reste ouverte** |
| 9 | Traces en base | `ModerationAction`, `ModerationAccessLog`, `Appeal`, `Report` écrites |
| 10 | Un client appelle `/api/admin/*` | 403 |

Les données de recette ont ensuite été **retirées de la production** : laisser une sanction
sur un compte de démonstration fausserait la présentation. Vérifié après nettoyage : les
42 comptes sont `ACTIVE`, et le compte concerné se reconnecte en 200.

---

## 4. Intégration continue — l'état réel

Deux workflows GitHub Actions, un par dépôt applicatif.

### `backend-coach-app/.github/workflows/ci.yml`

Service PostgreSQL 15 conteneurisé avec sonde de disponibilité, Node 20, `npm ci`,
recompilation de bcrypt, génération du client Prisma, application du schéma, puis tests.

### `fitflow-dashboard/.github/workflows/ci.yml`

Deux jobs enchaînés : lint → tests → build, puis tests E2E Playwright (`needs: test`).
Les E2E ne démarrent que si le reste passe : on ne dépense pas le temps d'installation d'un
navigateur pour une base déjà cassée.

### ⚠️ Ce qu'il faut savoir dire

**Les deux chaînes ont échoué sur la totalité de leurs exécutions, de mai à août 2026.**
Je les avais mises en place puis je n'étais jamais allé lire leurs résultats. Une chaîne
rouge en permanence ne protège de rien : je continuais à fusionner comme si elle passait.

Les deux causes racines, diagnostiquées et corrigées le 29 août :

| Chaîne | Cause | Correctif |
| --- | --- | --- |
| Backend | `npm test` lance `test-isolated.sh`, qui administre PostgreSQL par `docker exec fitflow-db`. En CI, PostgreSQL est un *service container* GitHub : ce conteneur nommé n'existe pas. | Le script détecte ce qui est disponible et choisit sa voie : `docker exec` en local, client `psql` direct en CI. |
| Dashboard | Échec au lint sur 3 erreurs : lecture d'horloge pendant le rendu, et deux `setState` synchrones dans un effet. | Corrigées. La troisième, un chargement de données au montage, a fait l'objet d'une levée de règle **ponctuelle et justifiée en commentaire** plutôt que d'une désactivation globale. |

**La leçon, et c'est celle qu'il faut assumer :** une porte de qualité qu'on n'observe pas
n'est pas une porte de qualité. Mettre en place une CI ne suffit pas, il faut en lire les
résultats.

### Déploiement continu

Le **dashboard** en bénéficie déjà, via Vercel. L'**API** non : c'est la dernière marche.
Elle n'est pas franchie, et il ne faut pas prétendre le contraire.

Ce qu'il faudrait pour la franchir :

```yaml
# .github/workflows/deploy.yml — NON EN PLACE
on:
  push:
    branches: [main]
jobs:
  deploy:
    needs: test                      # ne déploie que si la CI passe
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

Jeton à créer par `flyctl tokens create deploy`, puis à poser en secret GitHub.

**La question ouverte** : faut-il y ajouter `prisma migrate deploy` ? Automatiser les
migrations est pratique, mais cela applique une modification de schéma à une base de
**données de santé** sans relecture humaine. Une migration destructrice passerait sans
qu'on la voie. Le compromis raisonnable est d'automatiser le code et de garder les
migrations manuelles — c'est un arbitrage défendable, pas un oubli.

---

## 5. Les mesures — et l'exigence qui n'est pas tenue

Mesures du 30 août 2026, depuis une connexion française, 10 appels par endpoint.

| Endpoint | Médiane | p95 | Objectif T6.2 (< 300 ms) |
| --- | --- | --- | --- |
| `GET /api/health` | 62 ms | 66 ms | ✅ |
| `GET /notifications/unread-count` | 243 ms | 263 ms | ✅ |
| `GET /coaches/me` | 280 ms | 293 ms | ⚠️ à la limite |
| `GET /appointments` | 410 ms | **767 ms** | ❌ |
| `GET /clients/coach` | 500 ms | **688 ms** | ❌ |

### Le raisonnement à tenir devant le jury

L'exigence **n'est pas tenue** sur deux endpoints, et il faut le dire avant qu'on le
demande. La cause est identifiée :

> `/api/health` ne touche pas la base et répond en 62 ms. Dès qu'un endpoint interroge
> PostgreSQL, on passe à 280 ms au minimum. **L'écart entre 62 et 280 ms, c'est le trajet
> Paris → Irlande**, payé à chaque requête. Les endpoints de liste, qui enchaînent
> plusieurs requêtes, le paient plusieurs fois.

Trois correctifs, par ordre d'efficacité :

1. **Placer la base dans la même région que l'API.** Supprime le trajet. C'est le geste le
   plus efficace, et il est gratuit.
2. **Déployer Redis.** Le cache du compteur de notifications existe et fonctionne, mais
   Redis n'est **pas déployé en production** : cet endpoint, appelé toutes les 30 secondes
   par application ouverte, interroge donc PostgreSQL à chaque fois. L'économie prévue
   n'est pas réalisée.
3. **Réduire le nombre de requêtes** des endpoints de liste, qui enchaînent des allers-retours
   là où une requête imbriquée suffirait.

---

## 6. Exploitation

| Besoin | Commande |
| --- | --- |
| Journaux en direct | `flyctl logs --app fitflow-api` |
| État des machines | `flyctl status --app fitflow-api` |
| Historique des versions | `flyctl releases --app fitflow-api` |
| **Retour arrière** | `flyctl deploy --image <référence de la version précédente>` |
| Modifier un secret | `flyctl secrets set --app fitflow-api CLE="valeur"` |
| Redémarrer | `flyctl apps restart fitflow-api` |

### Retour arrière — le raisonnement

Chaque déploiement produit une image Docker versionnée et conservée. Revenir en arrière
consiste à redéployer une image antérieure, ce qui prend quelques secondes.

**Mais attention** : cela ne défait pas les migrations. Si la version fautive a modifié le
schéma, revenir au code précédent le confronte à une base plus récente — donc à des erreurs
`P2022` symétriques. C'est pourquoi une migration doit rester **additive** autant que
possible : ajouter une colonne est réversible, en supprimer une ne l'est pas.

### Supervision

**Il n'y en a pas.** Ni métriques applicatives, ni alertes. Une panne ne serait constatée
qu'en visitant le site. La seule surveillance en place est la sonde de disponibilité de Fly
sur `/api/health`, toutes les 30 secondes — elle redémarre une machine qui ne répond plus,
mais ne prévient personne.

C'est une limite réelle, à assumer telle quelle.

---

## 7. Les limites de l'hébergement gratuit

| Limite | Conséquence | Parade |
| --- | --- | --- |
| **Supabase suspend un projet inactif depuis 7 jours** | C'est déjà arrivé : le projet était en pause au moment du déploiement, il a fallu le restaurer. | **Le réveiller la veille de la soutenance.** |
| **Veille des machines Fly** | Le premier appel après inactivité met environ **10 secondes**. | Ouvrir `/api/health` avant la démonstration. Ou `min_machines_running = 1`, au prix de la facturation continue. |
| Base et API dans deux régions | Latence, voir §5. | Rapprocher les deux. |
| Redis absent de la production | Le cache ne sert qu'en développement. | Déployer un Redis managé. |

---

## 8. Questions probables du jury

**« Votre application est-elle déployée ? »**
Oui. Dashboard sur `fitflow.marcyrius.com`, API sur `fitflow-api.fly.dev`, base et stockage
sur Supabase. Je peux le montrer en direct.

**« Le déploiement est-il automatisé ? »**
Partiellement, et je préfère être précis. Le dashboard se déploie automatiquement à chaque
poussée, via Vercel. L'API se déploie manuellement par `flyctl deploy`. Le workflow qui
l'automatiserait tient en trente lignes ; je ne l'ai pas mis en place, et la vraie question
qu'il pose est celle des migrations — les automatiser reviendrait à modifier le schéma d'une
base de données de santé sans relecture.

**« Pourquoi ne pas avoir tout mis sur Vercel ? »**
J'ai étudié la question. Vercel exécute des fonctions déclenchées par requête, pas un
processus permanent. Or le rappel de rendez-vous H-1 repose sur une tâche `node-cron` qui
tourne toutes les 5 minutes. En serverless, il aurait fallu passer aux tâches planifiées de
la plateforme, dont le plan gratuit ne permet qu'un déclenchement par jour. J'aurais perdu
une fonctionnalité de mon cahier des charges pour une commodité d'hébergement.

**« Comment gérez-vous les secrets ? »**
Aucun secret n'est dans le dépôt. `.env` et ses variantes sont ignorés par Git, et
`.env.example` documente les variables sans valeur. En production, ils sont posés par
`flyctl secrets set` et injectés au démarrage. `src/config/env.js` **refuse de démarrer**
en production si `DATABASE_URL` ou `JWT_SECRET` manque : un repli silencieux mettrait en
ligne une application avec un secret par défaut, c'est-à-dire connu.

**« Que se passe-t-il si un déploiement casse la production ? »**
Chaque déploiement produit une image versionnée. `flyctl releases` les liste, et redéployer
la précédente prend quelques secondes. La réserve porte sur les migrations : un retour
arrière du code ne défait pas un changement de schéma, ce qui plaide pour des migrations
additives.

**« Vos temps de réponse tiennent-ils l'objectif annoncé ? »**
Non, et je l'ai mesuré. Deux endpoints dépassent nettement les 300 ms annoncés. La cause est
la distance entre l'API et la base ; le correctif principal est de les co-localiser. Je
préfère publier la mesure que laisser passer un chiffre que je ne tiens pas.

**« Les fichiers déposés survivent-ils à un déploiement ? »**
Oui, et je l'ai vérifié explicitement. Le disque d'une machine Fly est réinitialisé à chaque
déploiement — mon code écrivait initialement les photos dessus, elles auraient disparu. Elles
vont maintenant dans un bucket objet. Test : dépôt d'une photo, redéploiement, puis
rechargement — le fichier répond toujours (HTTP 200), alors que le même chemin sur le disque
de la machine renvoie 404. Le 404 est la preuve que le disque a bien été vidé.

**« Votre intégration continue est-elle verte ? »**
Elle ne l'était pas. Elle a échoué sur toutes ses exécutions de mai à août, et je ne m'en
étais pas aperçu parce que je n'allais pas lire les résultats. J'ai diagnostiqué les deux
causes racines et je les ai corrigées. C'est l'erreur de méthode que je retiens le plus de
ce projet : une porte de qualité qu'on n'observe pas ne protège de rien.

---

## 9. Rituel avant la soutenance

1. **Réveiller Supabase** — https://supabase.com/dashboard/project/vbvcsbcjzwhcixoytelh
   (bouton « Resume project » s'il est en pause).
2. **Réveiller l'API** — ouvrir https://fitflow-api.fly.dev/api/health et attendre la
   réponse. Environ 10 secondes la première fois.
3. **Vérifier le dashboard** — https://fitflow.marcyrius.com/login
4. **Se connecter** avec `thomas@test.com` (le mot de passe est dans le fichier de secrets).
5. **Recaler les données** si la date dépasse le 12/09/2026 : relancer `seed-demo.js` avec
   un `--until` plus lointain.
6. **Vérifier l'écart** entre le dernier commit et la dernière version déployée
   (`flyctl releases`), et déployer si nécessaire.
7. **Se connecter en administrateur** (`admin@fitflow.marcyrius.com`, mot de passe dans le
   fichier de secrets) et vérifier que `/admin/reports` et `/admin/appeals` répondent. Ce
   compte n'a ni profil coach ni profil client : il ne peut pas accéder aux données de santé.

> ⚠️ **Ne pas laisser de signalement de test en base.** Une sanction visible sur un compte de
> démonstration se remarque pendant une démonstration, et n'est pas ce qu'on veut expliquer.
