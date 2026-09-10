# Script de soutenance — FitFlow, 40 minutes

À dire, pas à lire. Les phrases en **gras** portent le propos : apprends celles-là mot
pour mot, le reste peut varier. Les `→` sont des transitions — c'est ce qui fait la
différence entre un exposé et une suite de diapositives.

**Débit visé : 150 mots par minute.** Chaque section indique son budget. Si tu montes à
180, tu récupères cinq minutes — mais c'est le signe que tu récites au lieu de parler.

**Les sept minutes de démonstration ne sont pas ici** : leur déroulé est dans
[demo.md](demo.md). Ce script couvre les 34 minutes parlées, soit environ 5 000 mots.

---

## Avant de commencer — diapositives 1 et 2 · 40 s

*Titre affiché pendant qu'ils s'installent.*

> Bonjour. Je suis Marc Yrius, et je vais vous présenter FitFlow : une application de
> coaching sportif que j'ai conçue et développée seul, du besoin jusqu'à la mise en
> production.

*[diapositive 2 — le sommaire]*

> Je procéderai en neuf temps. D'où vient le besoin, comment je l'ai traduit en
> conception, ce que j'ai réalisé — avec une démonstration en direct au milieu. Puis
> comment j'ai conduit le projet, la base de données, la sécurité, les tests et le
> déploiement. **Et je terminerai par le bilan : c'est là que je vous dirai ce que je
> referais autrement.**

→ *Ne détaille pas le sommaire, annonce-le. Vingt secondes maximum.*

---

# 1 · CONTEXTE — 4 min

*[intercalaire]* > Commençons par le contexte : ce projet ne vient pas d'une idée, il vient
> d'une observation.

## 1.1 Le problème — diapositive 4 · 1 min

> Tout part d'une observation. J'ai démarché des coachs sportifs dans les salles que je
> fréquente, et je leur ai posé une question simple : comment suivez-vous vos clients ?
>
> La réponse est toujours la même, et elle n'est pas celle qu'on attend. **Un coach ne
> manque pas d'outils : il en a trop.**
>
> Excel pour les séances, les charges, la progression. Son téléphone personnel pour les
> échanges, les rappels, les photos. Les réseaux sociaux, parce que certains clients ne
> passent que par là. Et Google Agenda pour les rendez-vous, séparé de tout le reste.
>
> Quatre outils pour suivre un seul client. **Et aucun ne parle aux autres.**
>
> Concrètement, ça veut dire que le coach ressaisit. Il recopie une séance d'un fichier
> vers un message, relit une conversation pour retrouver un poids, cherche dans trois
> endroits ce qu'un seul devrait contenir.
>
> Et il y a un second perdant, moins visible : **le client ne voit jamais sa progression.**
> Ses charges sont dans le fichier du coach, ses sensations dans une conversation, ses
> photos dans une galerie. Personne ne peut lui montrer une courbe, parce que la donnée
> n'existe nulle part sous une forme exploitable.

→ *« Le plus gênant, ce n'est pas la dispersion elle-même. C'est qui la subit. »*

## 1.2 Les utilisateurs — diapositive 5 · 1 min

> FitFlow a deux utilisateurs, et c'est ce qui commande toute l'architecture.
>
> **Le coach prépare, distribue, suit et analyse.** Il travaille *entre* les séances,
> souvent le soir, chez lui, sur un ordinateur. Il a du temps, un grand écran, un clavier.
>
> **Le client, lui, exécute et saisit.** Il travaille *pendant* la séance. Debout, sur un
> téléphone, entre deux séries, avec les mains moites et trente secondes devant lui.
>
> **Ce sont deux contextes d'usage qui n'ont rien en commun.** Ce n'est donc pas un
> caprice d'avoir développé deux interfaces : c'en est la conséquence directe. Un même
> écran qui servirait les deux servirait mal les deux.

→ *« Reste à dire ce que j'ai voulu en faire. »*

## 1.3 L'objectif — diapositive 6 · 1 min

> Il y a un principe que j'ai gardé du début à la fin : **le coach n'est pas un
> professionnel de la tech.** C'est à l'outil de se simplifier, pas à lui de s'adapter.
>
> Ça a une conséquence directe : **un outil de plus n'aurait rien réglé.** Ajouter une
> quatrième application à trois applications qui ne se parlent pas, c'est aggraver le
> problème en croyant le résoudre.
>
> Ce qu'il fallait, c'est **un seul endroit**. Et un endroit qui tienne sans formation,
> sans mode d'emploi, sans qu'on ait à expliquer quoi que ce soit.
>
> L'objectif de FitFlow, c'est donc de centraliser dans une seule application ce qui est
> aujourd'hui éparpillé, et de le rendre **assez simple pour qu'il n'y ait rien à
> apprendre.**

→ *« Tout cela se résume en une question. »*

## 1.4 La problématique — diapositive 7 · 1 min

> Le dossier que vous avez lu part d'une question, et je la redis parce que c'est elle
> qui a arbitré tout le reste.
>
> ! **Comment concevoir une application unique qui réponde aux besoins de deux
> utilisateurs aux usages opposés, sans qu'aucun des deux n'ait à s'adapter à l'outil ?**
>
> Trois exigences tiennent dans cette phrase. **Unique** : un seul produit, une seule
> source de vérité, sinon les deux côtés divergent. **Répondre aux besoins des deux** :
> pas un outil de coach auquel le client accède, ni l'inverse — les deux doivent y
> trouver leur compte. Et **opposés** : je l'ai dit, ces deux contextes n'ont rien en
> commun.
>
> Cette question n'est pas restée sur le papier. **Elle m'a servi de critère de décision
> à chaque arbitrage.** Si une fonctionnalité ne servait ni le coach entre les séances,
> ni le client entre deux séries, elle n'était pas développée. C'est comme ça que j'ai
> écarté des idées auxquelles je tenais.

→ *« Voyons comment ce constat s'est traduit en conception. »*

---

# 2 · BESOIN ET CONCEPTION — 5 min

*[intercalaire]* > On passe du constat à la conception.

## 2.1 Les personas — diapositive 9 · 2 min

> J'ai construit deux personas à partir de ces échanges. Ce ne sont pas des portraits
> décoratifs : ils m'ont servi d'outil d'arbitrage tout au long du projet.
>
> **Thomas**, coach en salle à son compte, une douzaine de clients. Son problème n'est pas
> le manque de compétence, c'est le temps : **il passe plus de temps à recopier qu'à
> programmer.** Chaque séance qu'il conçoit, il la retape pour le client suivant. Ce qu'il
> veut tient en une phrase : **ne plus ressaisir la même séance dix fois.**
>
> **Camille**, cliente débutante. Peu de repères en musculation. Elle a deux craintes :
> se blesser, et travailler pour rien. Elle veut progresser sans se faire mal, et savoir
> si ce qu'elle fait sert à quelque chose. Ce qu'elle veut : **qu'on lui dise quoi faire,
> et voir que ça avance.**
>
> Ces deux personnes n'attendent pas la même chose du produit. Thomas veut de la
> puissance : réutiliser, dupliquer, analyser. Camille veut de la simplicité : ouvrir,
> faire, cocher.
>
> **Et c'est là qu'ils m'ont servi.** Chaque fois que j'hésitais sur une fonctionnalité,
> je me demandais laquelle des deux en avait besoin. Si la réponse était « ni l'un ni
> l'autre », la fonctionnalité ne se faisait pas. Ça a tranché plus d'un arbitrage, et
> ça m'a évité d'en développer plusieurs qui ne servaient qu'à moi.

## 2.2 Les besoins — diapositive 10 · 1 min

> Ces personas se traduisent en exigences concrètes.
>
> Côté coach : créer et réutiliser des séances, suivre une progression chiffrée, échanger
> avec ses clients via FitFlow, et récupérer ses données — j'y reviendrai, parce que ce
> dernier point est un choix.
>
> Côté client : **saisir une série en trois gestes**, trouver un coach par salle ou par
> ville, suivre son poids, son sommeil et ses repas, et être rassuré : les coachs sont
> notés.
>
> **Chaque fonctionnalité que je vais vous montrer se rattache à l'un de ces besoins.**
> C'est ce qui m'a servi à trancher : ce qui n'en servait aucun n'a pas été développé.
>
> Je m'arrête une seconde sur « récupérer ses données », parce que c'est contre-intuitif.
> **J'ai développé un export tableur alors que mon produit vise à remplacer Excel.** Un
> coach qui a dix ans d'historique ne va pas confier son activité à un outil dont il ne
> peut rien ressortir. **Rendre la sortie facile est ce qui rend l'entrée possible** —
> et c'est aussi une exigence du RGPD, la portabilité des données.

## 2.3 Les maquettes — diapositive 11 · 1 min

> Un point de transparence avant de montrer des écrans. **Il y a bien eu une phase de
> maquettage** : les écrans clés ont été dessinés avant d'être codés, et ils m'ont servi à
> fixer la structure des pages et le parcours.
>
> **Mais le produit s'en est éloigné.** L'interface a été reprise par itérations
> successives — je construisais un écran, je le regardais à l'usage, je le refaisais. Au
> bout de quelques semaines, l'écart avec les maquettes était tel que les mettre à jour
> serait devenu un travail à part entière.
>
> **J'ai fait un choix : ne pas maintenir deux référentiels.** Les maquettes ont servi de
> point de départ, pas de contrat. Deux vérités qui divergent valent moins qu'une seule qui
> est juste.
>
> Ce que vous voyez ici ne sont donc pas des maquettes, **ce sont des captures de
> l'application réelle, en production.**
>
> Voici le poste de travail du coach : son portefeuille en un coup d'œil. Ses clients, ses
> programmes actifs, ses messages non lus, ses prochains rendez-vous.

## 2.4 L'architecture — diapositive 12 · 1 min

> L'architecture est en trois tiers.
>
> **Deux clients** : un dashboard web et une application mobile. **Une API REST au
> centre**, en Node.js avec Express. **Une base PostgreSQL** derrière, plus un stockage
> objet pour les fichiers.
>
> Le point qui compte est celui-ci : **aucun client n'accède directement à la base.**
> Toute règle métier vit dans l'API.
>
> Ce n'est pas une préférence esthétique. Si je dupliquais une règle — par exemple « un
> coach ne voit que ses clients » — dans le web et dans le mobile, **les deux
> divergeraient.** Pas tout de suite : le jour où j'en corrige une et j'oublie l'autre. Et
> une divergence de règle de sécurité entre deux clients, ça ne se voit pas, ça
> s'exploite.
>
> Deux mots sur les technologies, parce qu'on me demandera pourquoi celles-là.
>
> **Une API REST plutôt que GraphQL** : mes besoins sont des opérations classiques sur des
> ressources bien identifiées. GraphQL aurait apporté de la souplesse côté client au prix
> d'une complexité de cache et d'autorisation que rien ne justifiait ici.
>
> **React Native plutôt que deux applications natives** : seul, sur un projet de cette
> durée, écrire deux fois la même application en Swift et en Kotlin n'était pas
> réaliste. J'ai échangé un peu de performance contre une base de code unique — et
> l'application n'a aucun besoin de calcul intensif.
>
> **Et le même langage de bout en bout**, JavaScript et TypeScript. Ça n'a l'air de rien,
> mais quand on est seul, ne pas changer de contexte mental entre le serveur et l'écran
> fait gagner un temps considérable.

→ *« Passons à ce que j'ai construit, couche par couche. »*

---

# 3 · RÉALISATION — 10 min

*[intercalaire]* > C'est la partie la plus longue. Je vais du serveur vers l'écran, puis
> je vous montre le résultat en direct.

## 3.1 Backend — diapositive 14 · 2 min

> Le backend est en Node.js avec Express, et Prisma comme ORM.
>
> En volume : **25 modules de routes, 133 points d'entrée, 27 contrôleurs.** La séparation
> est stricte — une route déclare le rôle qu'elle exige, le contrôleur vérifie la
> propriété de la ressource. J'y reviendrai dans la partie sécurité, parce que c'est cette
> séparation en deux niveaux qui fait tout le travail.
>
> Deux choix méritent d'être expliqués.
>
> **Prisma d'abord.** Il m'apporte trois choses. Les requêtes sont paramétrées, donc
> l'injection SQL est structurellement impossible. Les migrations sont versionnées, donc
> le schéma de production correspond au code. Et le typage est généré depuis le schéma :
> **si je renomme une colonne, le code qui l'utilise ne compile plus.** L'erreur remonte
> pendant que j'écris, pas la nuit en production.
>
> **Le format de réponse ensuite.** Toutes mes réponses ont exactement la même forme : un
> booléen de succès, un message, et les données. Ça paraît anodin, presque cosmétique.
>
> **En réalité, c'est ce qui m'a permis d'écrire un seul intercepteur d'erreur côté
> client, au lieu d'un par appel.** Quand le serveur renvoie une erreur d'authentification,
> une seule ligne, écrite une fois, déconnecte l'utilisateur et le renvoie vers l'écran de
> connexion — depuis n'importe quel écran de l'application. Une convention tenue vaut
> mieux qu'une abstraction élégante.
>
> Un troisième point, appris en production. **Les fichiers déposés — photos de profil,
> images de repas — ne sont pas stockés sur le disque du serveur.** Ils vont dans un
> stockage objet, chez Supabase.
>
> Ce n'était pas le cas au départ, et ça marchait très bien en développement. Puis j'ai
> déployé : **le disque d'une machine Fly est réinitialisé à chaque déploiement.** Toutes
> les photos disparaissaient à la mise en ligne suivante. Le code choisit maintenant son
> mode de stockage par une variable d'environnement — disque local en développement,
> stockage objet en production.

## 3.2 Les trois clients — diapositive 15 · 1 min

> Le dashboard est en Next.js 16, avec React 19 et TypeScript. C'est le poste de travail
> du coach, et il offre aussi un accès client allégé.
>
> L'application mobile est en React Native avec Expo. C'est le client en salle — **et le
> coach aussi**, avec onze écrans qui lui sont dédiés.
>
> Ce n'est pas une redite du dashboard. **Un coach en salle a besoin de ses outils sur
> place**, avec son client devant lui : consulter une fiche, ajuster une séance, répondre
> à un message entre deux exercices. Le dashboard répond au travail du soir ; le mobile
> répond au travail du terrain.
>
> Un détail de sécurité au passage : sur mobile, le jeton d'authentification est conservé
> dans le trousseau système, chiffré par l'OS, et non dans un stockage ordinaire.

→ *« Plutôt que de vous décrire les écrans un par un, je vais vous montrer un parcours
complet. »*

## 3.3 Démonstration — diapositive 16 · 7 min

> Je vais suivre une boucle : ce que le coach prépare, ce que la cliente en fait en salle,
> et comment la donnée lui revient. Six étapes, sept minutes.

**Bascule sur l'application. Le déroulé détaillé est dans [demo.md](demo.md).**

| | Étape | Écran | Durée |
| --- | --- | --- | --- |
| 1 | Le coach prépare | Dashboard → fiche Camille → séance du jour | 1 min 30 |
| 2 | Il capitalise | Séance → template → appliqué à un autre client | 1 min 30 |
| 3 | Il fixe un rendez-vous | Messagerie → proposition | 1 min |
| 4 | La cliente s'entraîne | **Mobile** → validation de série, chrono, gainage | 2 min |
| 5 | Elle saisit son suivi | Mobile → poids, hydratation | 30 s |
| 6 | La donnée revient | Dashboard → séance validée, analyse | 30 s |

**Si la démonstration échoue** : cinq diapositives de secours sont à la fin du support,
hors minutage. Ne débogue jamais devant le jury — passe aux captures et continue.

## 3.4 Ce que la démo a montré — diapositive 17 · 1 min

> Je reprends quatre points, parce que ce sont des décisions de conception, pas des
> effets d'interface.
>
> **La boucle est fermée.** Ce que le coach prépare, la cliente l'exécute, et la donnée
> lui revient — **sans aucune ressaisie**. C'est exactement ce que les quatre outils du
> début ne savaient pas faire.
>
> **Le template capitalise, sans enfermer.** Il répond vite au cas courant : une séance
> réutilisée en un geste. Mais **une séance reste créable de toutes pièces**. Répondre au
> cas courant sans empêcher le cas particulier, c'est la ligne que j'ai tenue partout.
>
> **La saisie est pensée pour la salle.** Trois gestes par série : poids, répétitions,
> validation. Et le renforcement se saisit en **temps tenu**, pas en répétitions.
>
> Ce n'est pas un détail d'affichage. Un gainage de 45 secondes enregistré dans le champ
> « répétitions » serait compté comme **45 répétitions** dans le calcul du volume — le
> volume valant poids fois répétitions. La statistique serait fausse d'un facteur soixante.
> **Les deux champs sont donc exclusifs, à l'écran comme en base.**
>
> **Et l'analyse suit** : volume, 1RM estimé, INOL, cartographie musculaire, et un export
> tableur.

→ *« Descendons d'un cran, vers les données. »*

---

# 4 · CONDUITE DE PROJET — 3 min

*[intercalaire]* > Neuf mois, seul. Comment j'ai tenu le cap, et ce qui a bougé depuis le
> dossier que vous avez lu.

## 4.1 Les jalons — diapositive 19 · 1 min

> Le projet tient en **quatre phases**, et je les tire de l'historique Git, pas de
> mémoire.
>
> **Janvier et février : le socle.** Premier commit le 13 janvier — l'API et
> l'application mobile le même jour, le dashboard un mois plus tard. Modèle de données,
> authentification, premiers écrans.
>
> **Mars et avril : le métier.** Les séances, les analyses de musculation, les
> rendez-vous, l'onboarding. C'est aussi là que j'écris mes premiers tests d'intégration
> et ma première chaîne d'intégration continue.
>
> **Mai à juillet : un creux.** Trois commits en trois mois. Je ne vais pas l'habiller :
> le projet n'a pas avancé pendant l'été.
>
> **Août et septembre : le durcissement, puis l'exploitation.** La sécurité, la
> conteneurisation, la modération, et la mise en production. **110 commits au
> total**, dont un tiers sur le seul mois d'août.

## 4.2 Ce qui a changé depuis le dossier — diapositive 20 · 1 min

> Vous avez lu un dossier rendu au printemps. Le produit a continué de vivre, et je
> préfère vous dire tout de suite ce qui a bougé — plutôt que de vous laisser
> m'interroger sur un état périmé.
>
> **La modération est arrivée en entier** : signalement, sanctions graduées, recours,
> suppression différée. Elle a été conçue à partir de la contrainte RGPD, pas ajoutée
> par-dessus.
>
> **Un écran d'analyse ne trouvait plus aucun client.** Une requête était restée sur le
> champ hérité d'avant le passage au multi-coach. Corrigée, et couverte par quatre tests
> de non-régression — parce qu'une correction sans test se refait.
>
> **225 exercices ont été reclassés en production.** Des gainages comptés en répétitions
> faussaient le volume. Requalifiés en renforcement, sans perdre une seule séance validée.
>
> Et **la messagerie est passée en temps réel** cette semaine.

## 4.3 La méthode — diapositive 21 · 1 min

> Un mot sur la façon de travailler, avec ce qui a tenu et ce qui a manqué.
>
> **Ce qui a tenu** : une fonctionnalité à la fois, menée jusqu'au bout sur les trois
> clients avant de passer à la suivante. Et les décisions structurantes écrites dans le
> dépôt, à côté du code — c'est ce qui m'a permis, six mois plus tard, de retrouver
> *pourquoi* j'avais fait un choix.
>
> **Ce qui a manqué** : aucun suivi formel. Pas de tableau, pas de jalons planifiés.
> **Le creux de l'été, je ne l'ai vu qu'après coup**, en regardant l'historique pour
> préparer cette soutenance.
>
> Sur les trois dépôts, j'y reviendrai dans le bilan : le choix se défend, le report
> manuel entre eux m'a coûté cher.
>
> Ce que je referais : un dépôt unique, et des jalons écrits même sommaires. **Ce qui
> n'est pas planifié se découvre en retard.**

→ *« Descendons maintenant vers les données. »*

# 5 · BASE DE DONNÉES — 3 min

*[intercalaire]* > Tout ce que je viens de montrer repose sur un modèle. Parlons-en.

## 5.1 PostgreSQL — diapositive 23 · 1 min

> La base est PostgreSQL, hébergée sur Supabase.
>
> **Pourquoi relationnel ?** Parce que les données sont fortement liées : un client, ses
> coachs, ses programmes, ses séances, ses exercices, ses séries. Ce sont des relations
> strictes, et les contraintes d'intégrité font le travail à ma place — une séance ne peut
> pas exister sans programme, la base le refuse.
>
> **Pourquoi PostgreSQL en particulier ?** Types énumérés natifs, contraintes composites,
> et un service managé gratuit avec sauvegardes.
>
> **Une exception assumée : un cache Redis.** Le compteur de notifications est interrogé
> toutes les 30 secondes par chaque application ouverte. C'est l'appel le plus fréquent de
> toute l'API, pour une valeur qui change rarement. Lecture traversante, invalidation à
> l'écriture. Et surtout **une dégradation propre : si Redis tombe, l'application ralentit,
> elle ne s'arrête pas.** Un cache indisponible ne doit jamais interrompre un service.

## 5.2 Le modèle — diapositive 24 · 1 min

> Voici le modèle : **36 entités.** Je ne vais pas les parcourir, je vais en commenter une
> seule, parce que c'est la décision structurante du projet.
>
> Au centre, la relation entre le coach et le client. Au départ, je l'avais modélisée de
> la façon la plus évidente : **un client appartient à un coach.** Une simple clé
> étrangère.
>
> C'était faux, et j'y reviendrai dans le bilan.
>
> Autour, trois grappes : **prescription** — ce que le coach construit —, **exécution** —
> ce que le client produit —, et **relation**. Les deux premières sont volontairement
> séparées : **ce qui est prescrit et ce qui est réalisé sont deux choses distinctes**, et
> c'est leur écart qui a de la valeur.
>
> Le modèle porte aussi 16 types énumérés et 13 index, posés là où une requête les
> justifiait — un index n'est pas gratuit.

## 5.3 L'accès aux données — diapositive 25 · 1 min

> Trois points sur la façon dont on accède à ces données.
>
> **Les requêtes sont paramétrées.** Prisma ne concatène jamais de chaîne SQL : les
> valeurs passent en paramètres. **L'injection SQL est structurellement impossible** — pas
> évitée par vigilance, empêchée par construction.
>
> **Les projections sont explicites.** Chaque requête déclare les champs qu'elle retourne.
> Un profil public de coach ne peut pas laisser fuir un email par inadvertance : **le
> champ n'est pas dans la projection.** C'est un choix de conception, pas une contrainte
> technique — j'aurais pu tout retourner et filtrer à l'affichage. Ç'aurait été une fuite,
> invisible à l'écran mais bien présente dans la réponse réseau.
>
> Enfin, **37 relations en cascade** : supprimer un compte emporte ses données liées. Pas
> de script de nettoyage à maintenir, pas d'orphelins qui traînent. C'est aussi ce qui
> rend le droit à l'effacement réellement applicable.

→ *« Ce qui m'amène naturellement à la sécurité. »*

---

# 6 · SÉCURITÉ — 4 min

*[intercalaire]* > Quatre points. Je vais vite, mais je ne passe rien sous silence.

## 6.1 Les mots de passe — diapositive 27 · 1 min

> **Les mots de passe ne sont jamais stockés.** Ce qui est en base, ce sont des empreintes
> bcrypt.
>
> bcrypt a deux propriétés qui comptent. Le sel est intégré : **deux comptes avec le même
> mot de passe ont des empreintes différentes**, ce qui interdit les tables
> pré-calculées. Et le coût est paramétrable : l'algorithme est **volontairement lent**.
> C'est un défaut pour un algorithme ordinaire, c'est la qualité recherchée ici — chaque
> essai d'une attaque par force brute coûte cher à l'attaquant.
>
> Ce qui en découle : **une fuite de la base ne livre pas les mots de passe.**
>
> Un dernier point, qui montre que la sécurité a été pensée jusque dans les
> fonctionnalités réglementaires : **l'empreinte est exclue de l'export RGPD.** Ce n'est
> pas une donnée fournie par la personne, et l'exporter reviendrait à distribuer une cible
> à quiconque intercepte le fichier.

## 6.2 Les jetons — diapositive 28 · 1 min

> L'authentification se fait par jeton JWT. Il porte l'identifiant et le rôle, signés par
> le serveur. **Le serveur ne garde aucune session** : il vérifie la signature à chaque
> appel. C'est ce qui permet de faire tourner plusieurs machines sans les synchroniser.
>
> Où sont-ils rangés ? Dans le **trousseau système** sur mobile, chiffré par l'OS. Dans le
> `localStorage` sur le web — **et c'est une faiblesse que j'assume** : une injection de
> script pourrait le lire.
>
> Et je préfère annoncer la limite avant qu'on me la demande. **Mon jeton est valable
> 30 jours et il n'est pas révocable.** La déconnexion l'efface côté client, mais ne
> l'invalide pas côté serveur : un jeton volé reste valide jusqu'à son expiration.
>
> **Le correctif est identifié** — un jeton court accompagné d'un jeton de
> rafraîchissement, ou une liste de révocation. Il n'est pas implémenté, et je ne vais pas
> prétendre le contraire.

## 6.3 Les rôles — diapositive 29 · 1 min

> L'autorisation se joue **à deux niveaux**, et c'est le point que je tiens le plus à
> faire passer.
>
> **Premier niveau, par rôle, sur la route.** Un middleware `authorize('COACH')` écarte
> immédiatement un client qui appellerait une route réservée au coach. C'est du filtrage
> grossier, et il ne suffit pas.
>
> **Deuxième niveau, par propriété, dans le contrôleur.** On vérifie que la ressource
> demandée appartient bien à celui qui la demande. Si l'identifiant du coach du programme
> ne correspond pas à celui de l'appelant, c'est 403.
>
> **Pourquoi le rôle ne suffit pas ?** Parce que **deux coachs ont le même rôle, mais pas
> les mêmes clients.** Sans ce second niveau, n'importe quel coach pourrait lire le
> programme d'un confrère en devinant un identifiant dans l'URL. Le rôle dit ce que vous
> avez le droit de faire ; la propriété dit sur quoi.
>
> **C'est la différence entre authentification et autorisation**, et c'est la faille la
> plus courante dans les applications de ce type.

## 6.4 La validation — diapositive 30 · 1 min

> **La validation des entrées est le maillon faible de mon projet, et je le sais.**
>
> Elle est écrite à la main, dans les contrôleurs, sans bibliothèque. Résultat : **la
> couverture est inégale.** Certaines routes vérifient tout, d'autres se contentent du
> minimum. Il reste des endroits où une donnée mal formée produit une erreur 500 au lieu
> d'un 400 explicite.
>
> Le correctif est clair : un schéma de validation déclaré par route, et un 400
> systématique. Ce n'est pas fait.
>
> En revanche, deux défenses de surface sont en place au niveau du serveur. **helmet**,
> qui pose les en-têtes de sécurité sur toutes les réponses. Et une **limitation de
> débit** : dix tentatives ratées par adresse IP et par quart d'heure sur la connexion.
> **Seuls les échecs sont comptés** — un utilisateur normal n'est jamais gêné, un
> attaquant l'est immédiatement.

→ *« Tout cela ne vaut que si c'est vérifié. Parlons des tests. »*

---

# 7 · TESTS — 3 min

*[intercalaire]* > Les chiffres qui suivent sont vérifiés, et je peux les faire tourner
> devant vous.

## 7.1 Volume et niveaux — diapositive 32 · 1 min

> **220 tests, répartis sur quatre niveaux.**
>
> **132 tests d'intégration**, qui tournent sur une base réelle. C'est le gros du volume,
> et j'explique pourquoi juste après.
>
> **42 tests unitaires**, sur la logique pure : le calcul du 1RM estimé, l'analyse des
> temps de repos, la comparaison entre prévu et réalisé.
>
> **41 tests de composants d'interface** et **5 tests de bout en bout** dans un vrai
> navigateur.
>
> Trois niveaux, trois outils : le runner natif de Node côté backend, Vitest pour les
> composants, Playwright pour le navigateur.

## 7.2 L'intégration — diapositive 33 · 1 min

> Les tests d'intégration tournent sur **une vraie base de données**.
>
> Concrètement : une base PostgreSQL dédiée, recréée vierge à chaque exécution, et un
> serveur lancé en environnement de test sur un port séparé. Les tests appellent l'API
> **en HTTP**, comme le ferait un vrai client. Ils traversent donc toute la pile : la
> route, le middleware d'authentification, le contrôleur, l'ORM, la base.
>
> **Pourquoi pas un simulacre de base ?** Parce qu'**un faux Prisma ne teste que mes
> hypothèses sur Prisma.** Si je me trompe sur le comportement de l'ORM, le simulacre se
> trompe avec moi, et le test passe au vert en confirmant mon erreur.
>
> Une contrainte d'unicité oubliée, une cascade mal déclarée : **ça ne se voit que sur une
> vraie base.**

## 7.3 Les cas de sécurité — diapositive 34 · 1 min

> Enfin, **le cloisonnement entre coachs est testé, pas supposé.**
>
> La suite construit **deux écosystèmes complets et indépendants** : un coach A avec ses
> clients, ses programmes, ses conversations — et un coach B avec les siens. Puis elle
> vérifie systématiquement que B n'atteint **aucune** ressource de A.
>
> Lire le programme d'autrui : 403. Lire une conversation d'autrui : 403. Un client qui
> appelle une route de coach : 403.
>
> C'est écrit sous forme de **table de cas** plutôt qu'un test par situation : protéger un
> nouvel endpoint revient à ajouter une ligne. Le coût de bien faire doit être plus faible
> que celui de mal faire, sinon on finit par mal faire.
>
> Je dois dire aussi **ce qui n'est pas testé**, parce que 220 tests peuvent donner
> l'illusion d'une couverture complète.
>
> **L'application mobile n'a aucun test automatisé.** Sa vérification est entièrement
> manuelle, écran par écran. C'est le trou le plus large de ma stratégie de test, et il
> s'explique mal — sinon par le fait que le mobile est arrivé en dernier, et que j'ai
> continué à le traiter comme un client secondaire alors qu'il porte la moitié de l'usage.
>
> Les analyses statistiques ne sont pas non plus couvertes au niveau que je voudrais : le
> calcul du volume et du 1RM est testé, la cartographie musculaire ne l'est pas.
>
> **Pourquoi cet effort là précisément ?** Parce que ce sont des données de santé : le
> poids d'une personne, ses mensurations, son sommeil. Le cloisonnement est la règle métier
> la plus critique du produit. Elle mérite d'être testée, pas supposée.

→ *« Reste à mettre tout ça en ligne. »*

---

# 8 · DÉPLOIEMENT ET DEVOPS — 4 min

*[intercalaire]* > Je le dis d'emblée : c'est la partie que j'ai abordée le plus tard, et
> j'ai eu tort.

## 8.1 L'environnement — diapositive 36 · 1 min

> En développement, **Docker Compose** : PostgreSQL et Redis en conteneurs. Le même socle
> partout, **et rien à installer sur la machine**. C'est aussi ce qui m'a permis de faire
> tourner les tests d'intégration sur une base jetable.
>
> **Trois dépôts Git** : backend, dashboard, mobile. Un changement dans l'un ne casse pas
> les autres, et chacun a sa propre chaîne d'intégration. C'est un choix retenu sur les
> conseils de mon formateur — et il a eu un coût, dont je parle dans le bilan.
>
> Les secrets — chaînes de connexion, clés d'API, clé de signature des jetons — sont
> externalisés en variables d'environnement. **Jamais versionnés.** Aucun secret n'a
> transité par un dépôt Git de ce projet.

## 8.2 L'intégration continue — diapositive 37 · 2 min

> Deux chaînes GitHub Actions. Côté backend : un PostgreSQL conteneurisé, les migrations,
> puis la suite complète. Côté dashboard : lint, tests, build, puis les tests bout en bout.
>
> Et ici je dois raconter quelque chose qui n'est pas flatteur, mais qui est la leçon la
> plus utile de cette partie.
>
> **En préparant cette soutenance, j'ai regardé l'historique de ces chaînes. Elles étaient
> rouges sur la totalité de leurs exécutions. Depuis des mois.**
>
> Je ne le savais pas, pour une raison simple : **je ne les regardais pas.** Je recevais
> les notifications d'échec, je les ai vues si souvent qu'elles étaient devenues du bruit.
> **Une intégration continue qui échoue toujours finit par être ignorée — et à ce
> moment-là, elle ne protège plus rien.** Elle coûte du temps de calcul et donne une
> fausse impression de sérieux.
>
> J'ai diagnostiqué trois causes racines et je les ai corrigées. Le schéma de test partait
> dans la mauvaise base. Une variable de connexion manquait pour l'outil de migration. Et
> la version de Node du runner ne correspondait plus à celle du projet.
>
> **Les deux chaînes sont vertes aujourd'hui. Ce sont les premières exécutions réussies de
> tout l'historique du projet.**
>
> Ce que j'en retiens : une alerte permanente cesse d'alerter. Un signal qui est toujours
> rouge n'est plus un signal.

## 8.3 La mise en production — diapositive 38 · 1 min

> En production : **Vercel** pour le dashboard, avec un déploiement à chaque push.
> **Fly.io** pour l'API, deux machines en région Paris. **Supabase** pour PostgreSQL et le
> stockage de fichiers, en région Irlande.
>
> **L'ordre compte, et je l'ai appris en le ratant** : les migrations d'abord, le code
> ensuite. Déployer du code qui attend une colonne qui n'existe pas encore ne casse pas une
> page — ça casse toutes les connexions à la base, donc toute l'application.
>
> **L'application est en ligne, et elle coûte zéro euro par mois.** Les machines se mettent
> en veille sans trafic et se réveillent au premier appel.
>
> Un mot sur le retard que j'évoquais. **Je m'y suis mis tard parce que je croyais que
> déployer voulait dire arrêter de développer** — figer, livrer, passer à autre chose. J'ai
> compris en cours que c'est exactement l'inverse : déployer tôt, c'est se donner un endroit
> où vérifier que ce qu'on écrit fonctionne ailleurs que sur sa machine.
>
> Deux manques que j'assume sur cette partie.
>
> **Il n'y a pas de supervision.** Pas de tableau de bord d'erreurs, pas d'alerte. Si l'API
> tombe cette nuit, je l'apprendrai en ouvrant l'application demain, ou par un utilisateur.
> Une sonde de santé existe et Fly redémarre une machine qui ne répond plus, mais personne
> n'est prévenu.
>
> **Et le retour arrière est manuel.** Fly conserve les images précédentes, donc revenir
> est possible en une commande — mais il faut que je sois là pour la taper. Ce sont les
> deux choses que j'ajouterais en premier si ce projet devait accueillir de vrais
> utilisateurs.

→ *« Je termine par le recul. »*

---

# 9 · BILAN — 4 min

*[intercalaire]* > On quitte la démonstration pour le recul.

## 9.1 La difficulté principale — diapositive 40 · 1 min

> Ma difficulté principale n'a pas été technique. **C'est une erreur de modélisation.**
>
> Au départ, j'avais modélisé la relation de la façon la plus évidente : **un client
> appartient à un coach.** Une clé étrangère, rien de plus. Simple, rapide, et ça
> fonctionnait.
>
> Puis un cas réel est arrivé : **un client peut vouloir un coach pour la musculation et un
> autre pour la nutrition.** Ce n'est pas un cas exotique, c'est courant.
>
> **Mon modèle interdisait un besoin réel.** Il a fallu introduire une table de liaison,
> une notion de coach principal, des spécialités distinctes — et reprendre tout le code qui
> supposait un coach unique. Tard.
>
> **Une erreur de modélisation ne se voit pas au début : elle se paie plus tard, et le prix
> monte avec le temps.** C'est la leçon la plus utile que je retire de ce projet.

## 9.2 Les solutions — diapositive 41 · 1 min

> Deux enseignements concrets.
>
> **Le premier concerne les trois dépôts.** Je modifiais le dashboard et le backend
> ensemble, puis j'oubliais le mobile. Le format d'envoi changeait, et l'application mobile
> cassait — parfois plusieurs jours avant que je m'en aperçoive. **La parade a été
> disciplinaire, pas technique** : reporter sur le mobile immédiatement, avant de passer à
> autre chose. Un monodépôt aurait rendu l'oubli impossible ; c'est l'arbitrage que je
> referais différemment.
>
> **Le second est le plus important.** Sur une lenteur d'API, j'avais une explication
> parfaitement cohérente : la distance entre l'API à Paris et la base en Irlande.
> **Elle était fausse.** Trente secondes de mesure l'ont réfutée — le coût venait du mode
> de connexion à la base, pas de la distance. Une fois corrigé, le temps de réponse est
> passé de 512 à 245 millisecondes.
>
> **Une cause plausible n'est pas une cause démontrée.** Si vous ne deviez retenir qu'une
> phrase de cette soutenance, ce serait celle-là.

## 9.3 Les limites — diapositive 42 · 1 min

> Les limites, telles qu'elles sont.
>
> **La qualité des données dépend de l'humain.** Si le client saisit mal ses charges,
> l'analyse est fausse. Je peux contraindre les formats, je ne peux pas garantir
> l'honnêteté de la saisie.
>
> **Il n'y a eu aucun test utilisateur réel, et c'est ma faiblesse principale.** J'ai eu des
> contacts avec des coachs, mais pas de phase de test structurée. Sur iPhone, la
> distribution était bloquée sans licence développeur payante, ce qui a fermé la moitié du
> terrain.
>
> **L'imbrication avec les outils existants reste partielle**, faute d'accès à tout ce que
> les coachs utilisent déjà.
>

## 9.4 Les évolutions et la conclusion — diapositive 43 · 1 min

> Ce qui suivrait.
>
> **La facturation.** Elle était au centre de l'idée de départ, elle n'est pas en place.
> C'est ce qui transformerait FitFlow d'un outil de suivi en un outil de travail complet.
>
> Deux idées que j'ai **écartées volontairement**, et je tiens à le dire parce qu'écarter
> est aussi une décision de conception. **L'analyse des repas par photo** : trop coûteuse en
> développement pour la valeur rendue. **Les séances créées par le client lui-même** :
> écartée pour ne pas mélanger les rôles — si le client se prescrit ses séances, le coach ne
> sait plus ce qu'il suit.
>
> Je termine là où j'ai commencé. Ce projet n'est pas parti d'une idée que j'ai eue devant
> mon écran. Il est parti de coachs que je suis allé voir dans les salles où je
> m'entraîne, et d'une question que je leur ai posée.
>
> **FitFlow répond à un problème que j'ai observé, pas à un problème que j'ai imaginé.**
>
> Merci de votre attention.

---

## Repères de minutage

Si tu décroches, voici où tu devrais être. Le chronomètre du support l'affiche en direct :
il passe au rouge dès que tu dépasses de plus de 30 secondes.

| À | Tu devrais être à |
| --- | --- |
| 4 min | fin du contexte, début des personas |
| 9 min | fin de la conception, début du backend |
| 12 min | début de la démonstration |
| 19 min | fin de la partie réalisation |
| 22 min | fin de la conduite de projet |
| 25 min | fin de la base de données |
| 29 min | fin de la sécurité |
| 32 min | fin des tests |
| 36 min | fin du déploiement, début du bilan |
| 40 min | « Merci de votre attention » |

**Si tu es en retard**, le plus simple à couper est la partie 5.2 sur le modèle : les
grappes se résument en une phrase. **Ne coupe jamais** la démonstration, ni le bilan — ce
sont les deux moments où le jury forme son jugement.

## Ce qui n'est pas dans le support

⚠️ **La messagerie a reçu une diffusion temps réel par WebSocket, déployée en production
après la création de ces diapositives.** Le support n'en parle pas.

Si on te pose la question du temps réel, la réponse honnête est celle-ci : le sondage HTTP
reste le canal de vérité — l'API tourne sur deux machines sans bus partagé — et le
WebSocket accélère le cas courant sans qu'aucun message ne puisse être perdu. Ça évite un
Redis à dix dollars par mois et la fin de la mise en veille des machines.

Dis-moi si tu veux que je l'ajoute au support : ce serait une diapositive dans la partie 3
ou une ligne dans les évolutions.
