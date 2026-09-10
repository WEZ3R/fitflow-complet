# FitFlow — dépôt complet

Copie intégrale du projet FitFlow : les trois applications, la documentation et les
supports de soutenance, réunis en un seul dépôt pour être clonés d'un coup sur une
autre machine.

> Ce dépôt est une **copie de travail**. Les dépôts d'origine, avec leur historique
> Git complet, restent la référence : `backend-coach-app`, `fitflow-dashboard`,
> `coach-mobile-app`.

## Ce que contient le dépôt

| Dossier | Contenu |
| --- | --- |
| `backend-coach-app/` | API Node.js / Express / Prisma — 133 points d'entrée, 36 modèles |
| `fitflow-dashboard/` | Tableau de bord coach — Next.js 16 |
| `coach-mobile-app/` | Application client — React Native / Expo SDK 57 |
| `docs/` | Dossier professionnel, documentation technique, supports de soutenance |
| `outils/` | Outil de dictée utilisé pour rédiger le dossier |

## La présentation

**Rien à installer.** Ouvrir [`docs/soutenance/support.html`](docs/soutenance/support.html)
dans un navigateur : le fichier est autonome, images comprises, et fonctionne hors ligne.

| Touche | Effet |
| --- | --- |
| `→` `←` | Diapositive suivante / précédente |
| `1` … `9` | Sauter à une partie |
| `N` | Panneau de notes |
| `S` | Basculer points clés ↔ script complet |
| `P` | Fenêtre présentateur (second écran) |
| `T` | Chronomètre |
| `F` | Plein écran |
| `?` | Aide |

`docs/soutenance/support.pdf` est la même présentation sans JavaScript — le filet de
sécurité si le navigateur de la salle fait des siennes.

## Faire tourner les applications

Les fichiers `.env` ne sont pas versionnés : ils contiennent des secrets. Chaque
application a son modèle à recopier.

### API

```bash
cd backend-coach-app
cp .env.example .env        # puis renseigner DATABASE_URL et JWT_SECRET
docker compose up -d        # PostgreSQL et Redis en conteneurs
npm install
npx prisma migrate deploy
npm run dev                 # http://localhost:5001
```

### Tableau de bord

```bash
cd fitflow-dashboard
echo "NEXT_PUBLIC_API_URL=https://<api>/api" > .env.local
npm install
npm run dev                 # http://localhost:3000
```

### Application mobile

```bash
cd coach-mobile-app
npm install
npx expo start              # scanner le QR code avec Expo Go
```

Pour pointer l'application mobile vers l'API de production plutôt que vers une API
locale, définir `EXPO_PUBLIC_API_URL` avant de lancer Expo.

## Les tests

```bash
cd backend-coach-app  && npm test    # intégration, sur une base PostgreSQL dédiée
cd fitflow-dashboard  && npm test    # composants (Vitest) et bout en bout (Playwright)
```

## Prérequis

Node.js 22, Docker (pour PostgreSQL et Redis en local), et l'application Expo Go sur
un téléphone pour la partie mobile.
