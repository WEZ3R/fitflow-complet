# Points clés — appuis pour l'oral

Pas des phrases : des appuis. Chaque ligne est un mot-déclencheur, à développer avec tes
mots. C'est ce qui s'affiche dans la fenêtre présentateur par défaut ; le script complet
reste accessible d'une touche si tu perds le fil.

**Convention.** Une ligne commençant par `!` est une phrase à dire **mot pour mot** — les
seules du document. Une ligne entre parenthèses est une indication de régie.

---

## diapositive 1 — Titre

- Marc Yrius, seul, du besoin à la production
- 9 temps, démonstration en direct au milieu
- (laisser afficher pendant qu'ils s'installent)

## diapositive 2 — Sommaire

- Annoncer, ne pas détailler — 20 secondes
- ! Je terminerai par le bilan : ce que je referais autrement

## diapositive 3 — Partie 1

- ! Commençons par le contexte : pas une idée, une observation

## diapositive 4 — Le problème

- Démarchage réel, salles où je m'entraîne
- ! Un coach ne manque pas d'outils : il en a trop
- Excel · téléphone perso · réseaux sociaux · Google Agenda
- ! Et aucun ne parle aux autres
- Conséquence 1 : le coach ressaisit
- Conséquence 2 : le client ne voit jamais sa progression

## diapositive 5 — Les utilisateurs

- Coach : **entre** les séances, le soir, ordinateur
- Client : **pendant** la séance, debout, téléphone, mains moites
- ! Deux contextes qui n'ont rien en commun
- Donc deux interfaces — conséquence, pas caprice

## diapositive 6 — L'objectif

- ! Le coach n'est pas un professionnel de la tech
- Un outil de plus n'aurait rien réglé — il aurait aggravé
- Un seul endroit, qui tienne sans formation
- ! Assez simple pour qu'il n'y ait rien à apprendre

## diapositive 7 — La problématique

- ! Une application unique pour deux utilisateurs aux usages opposés, sans qu'aucun des deux ne s'adapte
- Trois exigences : **unique** · **répondre aux deux** · **opposés**
- Pas un outil de coach où le client entre, ni l'inverse
- Pas restée sur le papier : critère de décision à chaque arbitrage
- Ni le coach entre les séances, ni le client entre deux séries → pas développé

## diapositive 8 — Partie 2

- Du constat à la conception — enchaîner vite

## diapositive 9 — Les personas

- Thomas : 12 clients, recopie plus qu'il ne programme
- Veut : ne plus ressaisir la même séance dix fois
- Camille : débutante, deux craintes — se blesser, travailler pour rien
- Veut : qu'on lui dise quoi faire, et voir que ça avance
- ! Outil d'arbitrage : laquelle des deux en a besoin ?
- Si ni l'une ni l'autre → pas développé

## diapositive 10 — Les besoins

- Coach : réutiliser · progression chiffrée · échanger · exporter
- Client : 3 gestes · trouver un coach · suivi quotidien · avis
- L'export : contre-intuitif, j'y viens
- ! Rendre la sortie facile est ce qui rend l'entrée possible
- Aussi une exigence RGPD — portabilité

## diapositive 11 — Les maquettes

- Il y a **bien eu** une phase de maquettage — écrans clés avant de coder
- Le produit s'en est éloigné : itérations successives sur l'usage
- Choix : **ne pas maintenir deux référentiels**
- ! Les maquettes ont servi de point de départ, pas de contrat
- Ce que vous voyez est l'application réelle, en production
- (si on demande à les voir : dire dans quel état elles sont restées)

## diapositive 12 — L'architecture

- Trois tiers : 2 clients · API REST · PostgreSQL
- ! Aucun client n'accède directement à la base
- Sinon les deux clients divergent — et une divergence de sécurité s'exploite
- REST plutôt que GraphQL : opérations classiques, pas de complexité de cache
- React Native : seul, deux natifs n'étaient pas réalistes
- Même langage de bout en bout — pas de changement de contexte mental

## diapositive 13 — Partie 3

- La plus longue. Du serveur vers l'écran, puis démonstration

## diapositive 14 — Backend

- Node · Express · Prisma
- 25 modules · 133 points d'entrée · 27 contrôleurs
- Prisma : requêtes paramétrées · migrations versionnées · typage généré
- ! Si je renomme une colonne, le code ne compile plus
- Réponses uniformes : succès / message / données
- ! Un seul intercepteur d'erreur, au lieu d'un par appel
- Fichiers en stockage objet — le disque de Fly est réinitialisé à chaque déploiement

## diapositive 15 — Les trois clients

- Dashboard : Next.js 16, React 19, TypeScript
- Mobile : React Native, Expo
- Le coach a **sa propre application** : 11 écrans dédiés
- ! Un coach en salle a besoin de ses outils sur place, pas seulement le soir
- Dashboard = travail du soir · mobile = travail du terrain
- Jeton dans le trousseau système, pas un stockage ordinaire

## diapositive 16 — Démonstration

- Annoncer les 6 étapes en 10 secondes, puis basculer
- 1 prépare · 2 capitalise · 3 rendez-vous · 4 s'entraîne · 5 suivi · 6 retour
- (déroulé exact : demo.md — ne jamais déboguer devant le jury)
- (si ça échoue : diapositives de secours, fin du support)

## diapositive 17 — Ce que la démo a montré

- Boucle fermée — **sans ressaisie**
- Template : répondre au cas courant sans empêcher le cas particulier
- 3 gestes par série — pensé pour la salle
- Renforcement en **temps tenu**, pas en répétitions
- ! 45 secondes comptées comme 45 répétitions : faux d'un facteur 60
- Analyse : volume · 1RM · INOL · cartographie · export tableur

## diapositive 18 — Partie 4

- Neuf mois, seul — et ce qui a bougé depuis le dossier

## diapositive 19 — Les jalons

- Tirés de l'historique Git, pas de mémoire
- Janv.–févr. : socle — 1er commit le 13 janvier, API + mobile le même jour
- Mars–avril : le métier — séances, analytics, RDV, premiers tests, première CI
- Mai–juillet : **creux**, 3 commits. Ne pas l'habiller
- Août–sept. : durcissement puis exploitation — mise en production
- 110 commits, un tiers sur le seul mois d'août

## diapositive 20 — Depuis le dossier

- (le jury a lu un dossier du printemps — le dire avant qu'il n'interroge du périmé)
- Modération complète : signalement, sanctions, recours, suppression différée
- Écran d'analyse sans clients : champ hérité d'avant le multi-coach
- Corrigé **+ 4 tests de non-régression** — une correction sans test se refait
- 225 exercices reclassés en production, aucune séance perdue
- Messagerie en temps réel, cette semaine

## diapositive 21 — La méthode

- A tenu : une fonctionnalité à la fois, jusqu'au bout sur les 3 clients
- A tenu : décisions écrites dans le dépôt, à côté du code
- A manqué : **aucun suivi formel**, ni tableau ni jalons
- ! Le creux de l'été, je ne l'ai vu qu'après coup
- Referais : dépôt unique + jalons écrits
- ! Ce qui n'est pas planifié se découvre en retard

## diapositive 22 — Partie 5

- On descend vers les données

## diapositive 23 — PostgreSQL

- Relationnel : données fortement liées, contraintes d'intégrité
- PostgreSQL : énumérés natifs, contraintes composites, managé gratuit
- Exception : cache Redis pour le compteur de notifications
- Appel le plus fréquent de l'API, valeur qui bouge peu
- ! Si Redis tombe, ça ralentit, ça ne s'arrête pas

## diapositive 24 — Le modèle

- 36 entités — n'en commenter qu'une
- Coach ↔ client : au départ **un** coach par client. Faux, j'y reviens
- 3 grappes : prescription · exécution · relation
- ! Ce qui est prescrit et ce qui est réalisé sont deux choses distinctes
- C'est l'écart entre les deux qui a de la valeur
- 16 énumérés · 13 index, posés là où une requête les justifie

## diapositive 25 — L'accès aux données

- Requêtes paramétrées → injection SQL **structurellement** impossible
- Projections explicites → un email absent de la projection ne peut pas fuir
- Choix de conception, pas contrainte technique
- 37 cascades → droit à l'effacement réellement applicable

## diapositive 26 — Partie 6

- Quatre points, rythme soutenu, rien sous silence

## diapositive 27 — Mots de passe

- Jamais stockés — empreintes bcrypt
- Sel intégré : même mot de passe, empreintes différentes
- Volontairement lent → force brute coûteuse
- ! Une fuite de la base ne livre pas les mots de passe
- Empreinte **exclue de l'export RGPD** — exporter une cible n'a pas de sens

## diapositive 28 — Jetons JWT

- Identifiant + rôle, signés. Aucune session serveur
- Trousseau système sur mobile · localStorage sur le web — faiblesse assumée
- ! 30 jours, non révocable — la déconnexion n'invalide rien côté serveur
- Correctif identifié : jeton court + rafraîchissement, ou liste de révocation
- Pas implémenté — le dire avant qu'on me le demande

## diapositive 29 — Rôles

- Niveau 1 : `authorize('COACH')` sur la route
- Niveau 2 : propriété vérifiée dans le contrôleur
- ! Deux coachs ont le même rôle mais pas les mêmes clients
- Sans le niveau 2 : lire le programme d'un confrère en devinant un identifiant
- ! C'est la différence entre authentification et autorisation

## diapositive 30 — Validation

- ! La validation est le maillon faible, et je le sais
- Écrite à la main, sans bibliothèque → couverture inégale
- Il reste des 500 là où il faudrait des 400
- Correctif : un schéma par route
- En place : helmet · 10 tentatives ratées / IP / 15 min
- Seuls les **échecs** comptent — l'usage normal n'est jamais gêné

## diapositive 31 — Partie 7

- Chiffres vérifiés, donnés sans hésiter

## diapositive 32 — Volume et niveaux

- 220 tests · 4 niveaux
- 132 intégration · 42 unitaires · 41 composants · 5 bout en bout
- `node:test` natif · Vitest · Playwright
- (si on creuse) 132 intégration sur base PostgreSQL réelle, appelés en HTTP

## diapositive 33 — Intégration

- Base dédiée, recréée vierge · serveur en NODE_ENV=test · appels **HTTP**
- Traverse toute la pile : route, middleware, contrôleur, ORM, base
- ! Un faux Prisma ne teste que mes hypothèses sur Prisma
- Contrainte d'unicité oubliée : visible seulement sur une vraie base

## diapositive 34 — Cas de sécurité

- Deux écosystèmes complets et indépendants — coach A, coach B
- B n'atteint **aucune** ressource de A
- Programme d'autrui → 403 · conversation → 403 · route coach → 403
- Table de cas : protéger un endpoint = ajouter une ligne
- ! Données de santé — le cloisonnement se teste, il ne se suppose pas
- Non testé : le mobile n'a **aucun** test automatisé

## diapositive 35 — Partie 8

- Reconnaître d'emblée : abordé le plus tard

## diapositive 36 — Environnement

- Docker Compose : PostgreSQL + Redis, rien à installer
- 3 dépôts Git — conseil du formateur, et un coût (bilan)
- Secrets en variables d'environnement, **jamais versionnés**

## diapositive 37 — Intégration continue

- 2 chaînes GitHub Actions
- ! Elles étaient rouges sur la totalité de leurs exécutions, depuis des mois
- Je ne le savais pas parce que je ne les regardais pas
- ! Une alerte permanente cesse d'alerter
- 3 causes racines corrigées — mauvaise base, variable manquante, version de Node
- ! Premières exécutions vertes de tout l'historique

## diapositive 38 — Mise en production

- Vercel (dashboard) · Fly.io (API, 2 machines, Paris) · Supabase (base, Irlande)
- ! Migrations d'abord, code ensuite
- Sinon ce n'est pas une page qui casse, c'est toute la base
- En ligne, **0 € par mois** — veille et réveil automatiques
- Manques : pas de supervision · retour arrière manuel
- ! Je croyais que déployer voulait dire arrêter de développer. C'est l'inverse

## diapositive 39 — Partie 9

- Changer de ton : on quitte la démonstration pour le recul

## diapositive 40 — La difficulté

- Pas technique : **une erreur de modélisation**
- Au départ : un client → un coach. Une clé étrangère
- Réel : musculation avec l'un, nutrition avec l'autre
- ! Mon modèle interdisait un besoin réel
- Table de liaison, coach principal, tout le code repris — tard
- ! Une erreur de modélisation se paie plus tard, et le prix monte

## diapositive 41 — Les solutions

- 3 dépôts : j'oubliais le mobile, il cassait
- Parade **disciplinaire**, pas technique — reporter immédiatement
- Lenteur d'API : explication cohérente, la distance Paris–Irlande
- ! Elle était fausse. 30 secondes de mesure l'ont réfutée
- Mode de connexion, pas distance — 512 ms → 245 ms
- ! Une cause plausible n'est pas une cause démontrée

## diapositive 42 — Les limites

- Qualité des données = dépend de l'humain. Saisie fausse → analyse fausse
- ! Aucun test utilisateur réel — ma faiblesse principale
- iPhone : distribution bloquée sans licence développeur
- Imbrication partielle avec les outils existants

## diapositive 43 — Évolutions et conclusion

- Facturation : au centre de l'idée, pas en place
- Écartées **volontairement** : analyse de repas par photo (coût/valeur)
- Écartée : séances créées par le client — ne pas mélanger les rôles
- ! FitFlow répond à un problème observé, pas imaginé
- ! Merci de votre attention
