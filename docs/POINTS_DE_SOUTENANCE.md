# Points de soutenance — FitFlow

Ce document ne fait pas partie du dossier. Il rassemble les arbitrages qui demandent une
réponse construite si le jury les soulève, avec les arguments et les contre-arguments.
Le dossier expose les décisions ; ce fichier prépare leur défense.

---

## 1. La lecture intégrale d'une conversation signalée

### La question qui peut venir

> « Un modérateur lit toute la conversation dès qu'un signalement est déposé. Sur quel
> fondement ? N'est-ce pas disproportionné ? »

C'est, à mon sens, **le point le plus attaquable de la fonctionnalité de modération**. Il
faut y aller franchement plutôt que d'attendre la question.

### Ce que fait le dispositif

Quand un signalement part d'une conversation, l'administrateur voit le **fil complet**, et
non le seul message visé.

### Pourquoi ce choix

Deux raisons de fond, et elles sont bonnes :

1. **Un message isolé est souvent inintelligible.** « Alors, on se voit ce soir ? » ne dit
   rien hors contexte : ce peut être une proposition de séance ou l'aboutissement d'une
   insistance. Modérer sur un extrait, c'est modérer à l'aveugle.
2. **Le harcèlement se démontre par la répétition, pas par une phrase.** Un dispositif qui
   ne montre qu'un message rend structurellement indémontrable le comportement qu'il est
   censé sanctionner.

### L'objection, telle que je la formulerais à la place du jury

Lire l'intégralité d'une correspondance privée sur **simple** signalement est *a priori*
disproportionné au sens de l'**article 5.1.c** (minimisation). N'importe qui peut déclencher
cette lecture en cliquant « Signaler ». Le déclencheur est unilatéral, gratuit, et donne
accès à des données qui concernent **deux** personnes — dont celle qui n'a rien demandé.

C'est une objection sérieuse. Il ne faut pas la minimiser, il faut montrer ce qui l'encadre.

### La réponse : trois garde-fous, et ils sont indissociables

| Garde-fou | Effet |
| --- | --- |
| L'accès n'existe **que depuis un signalement ouvert** (`PENDING` ou `REVIEWING`) | Il n'y a pas de droit de lecture général : il y a un droit de lecture *pendant l'instruction d'un signalement précis* |
| Une `ModerationAccessLog` est écrite **avant** que le contenu ne soit renvoyé | Aucune consultation n'est invisible. Un modérateur curieux laisse une trace, comme pour tout accès à des données sensibles |
| L'accès **cesse dès que le signalement est clos** | Le droit expire avec le motif qui le justifiait. Un signalement traité ne rouvre pas la porte |

**La formule à retenir :** ce n'est pas un droit de lecture sur les conversations, c'est un
droit de lecture *pendant une instruction*, et il est journalisé. C'est ce qui sépare un
outil de modération d'une surveillance.

Ajouter aussi : **l'utilisateur en est informé au moment même où il signale**, dans la boîte
de dialogue — pas enfoui dans des conditions d'utilisation :

> « Un modérateur pourra consulter cette conversation pour instruire le signalement. Chaque
> consultation est journalisée, et l'accès cesse dès le signalement traité. »

### Si le jury insiste

Ne pas défendre l'indéfendable. Ce qu'on peut concéder honnêtement :

- **Une revue à deux niveaux serait plus proportionnée** : n'ouvrir le fil complet qu'après
  un premier examen sur le message signalé seul, quand celui-ci ne suffit pas à trancher.
  C'est la vraie amélioration, et elle n'est pas implémentée.
- **Une fenêtre glissante** — les vingt messages autour du message visé plutôt que tout
  l'historique — répondrait à l'essentiel du besoin en réduisant l'emprise.
- **Rien n'empêche aujourd'hui un signalement abusif** déposé pour faire lire une
  conversation. Le journal permet de le constater *après coup*, pas de l'empêcher. La
  contrainte d'unicité sur les signalements en attente limite l'empilement, pas l'intention.

Concéder ces trois points renforce la position au lieu de l'affaiblir : ils montrent que
l'arbitrage a été pensé, pas subi.

### Le fond, en une phrase

Un dispositif de modération incapable de lire ce qu'on lui signale ne protège personne ;
un dispositif qui lit tout sans trace ne protège pas les mêmes. Le choix retenu tranche du
côté de la protection des victimes, et paie cette décision par de la traçabilité.

---

## 2. Portabilité : l'export contient les messages de l'interlocuteur

**La question.** « Votre export RGPD restitue les conversations. Elles contiennent les
messages de l'autre personne. De quel droit ? »

**La réponse.** C'est la limite classique de la portabilité (art. 20) sur des données
relationnelles : **on ne peut pas restituer une conversation à une seule des deux parties
sans restituer une partie des données de l'autre.** Le choix retenu est d'inclure le fil,
parce qu'une conversation amputée de la moitié des messages n'est pas une donnée exploitable
pour la personne qui la demande.

**Ce qu'on peut concéder.** Une lecture plus stricte de la minimisation restituerait
uniquement les messages émis par le demandeur. C'est défendable juridiquement, et inutile en
pratique : la personne obtiendrait une liste de ses propres phrases sans les questions
auxquelles elles répondent.

**À dire aussi :** le mot de passe haché est explicitement **exclu** de l'export. Ce n'est pas
une donnée « fournie par la personne » au sens de l'article 20, et l'exporter reviendrait à
distribuer une empreinte à attaquer hors ligne.

---

## 3. Une personne supprimée peut recréer un compte

**La question.** « Vous supprimez le compte d'un utilisateur banni. Qu'est-ce qui l'empêche de
se réinscrire le lendemain ? »

**La réponse honnête : rien.** Et c'est délibéré.

Bloquer la réinscription suppose de **conserver une trace de la personne supprimée** — une
empreinte de son adresse email, au minimum. C'est exactement ce que l'**article 17** interdit :
le droit à l'effacement n'est pas un droit à l'effacement partiel avec une liste noire à côté.

J'ai retenu de **ne rien conserver**. C'est le choix conforme, et sa contrepartie assumée est
qu'un compte supprimé peut être recréé.

**Ce qu'il faudrait pour traiter le cas.** Une autre approche, pas une autre requête :
vérification d'identité à l'inscription, ou rattachement à un identifiant tiers vérifié. Cela
change la nature du produit et dépasse le périmètre du projet.

**L'argument à garder en tête :** la suppression n'est jamais immédiate — elle est programmée à
trente jours et suspendue par tout recours. Le dispositif privilégie la **suspension**, qui est
réversible et ne pose pas ce problème. La suppression est le dernier recours, pas l'outil
courant.

---

## 4. Accessibilité : aucun audit RGAA n'a été mené

**La question.** « Quel est votre niveau de conformité RGAA ? »

**La réponse : je n'en revendique aucun.** Aucun audit n'a été réalisé, ni par moi ni par un
tiers. La partie 11 du dossier ne contient pas une évaluation de conformité mais un **relevé du
code** : nombre d'attributs `aria-label`, `aria-hidden`, `aria-pressed`, associations `htmlFor`.

**Pourquoi c'est une position tenable.** Annoncer « conforme AA » sans audit serait une
affirmation invérifiable — exactement le genre de chiffre qu'un jury peut demander à voir et
qu'on ne peut pas produire. Un relevé factuel, lui, se vérifie en ouvrant le code.

**Ce que je sais manquer**, et qu'il vaut mieux dire avant qu'on le trouve :

- 4 associations `htmlFor` seulement, alors que tous les champs devraient en avoir une ;
- aucun `accessibilityLabel` sur mobile ;
- le BodyMap encode le volume par la **couleur seule** — une légende nomme les paliers, mais la
  lecture d'ensemble reste inaccessible à une personne daltonienne.

**Les trois relevés à faire**, chiffrables et rapides : ajouter une étiquette à chaque champ,
parcourir le dashboard entièrement au clavier en notant ce qui bloque, passer les contrastes du
thème sombre à un vérificateur.

---

## 5. « 65 tests Jest » : le chiffre de la version précédente était faux

**Le contexte.** Une version antérieure du dossier annonçait « 65 tests Jest ». C'est inexact
sur les deux termes.

| Affirmation | Réalité |
| --- | --- |
| « Jest » | Jest **n'est pas utilisé**. Le backend s'appuie sur le runner natif `node:test`, le dashboard sur Vitest, l'E2E sur Playwright |
| « 65 tests » | **220 tests** : 132 d'intégration, 42 unitaires, 41 composants, 5 bout en bout |

**Ce qu'il faut dire si on t'interroge sur l'écart.** Les chiffres du dossier actuel viennent
tous d'exécutions réelles, pas d'une estimation. J'ai préféré corriger un chiffre invérifiable
plutôt que le reconduire — et c'est ce qui m'a conduit à vérifier tous les autres.

---

## 6. Le blocage PostgreSQL local, et comment la suite passe malgré lui

**Le problème.** Un service **PostgreSQL 18 natif** occupe le port 5432 de la machine de
développement et masque le conteneur applicatif. Toute connexion depuis l'hôte atterrit sur le
mauvais serveur — d'où l'erreur `P1000: Authentication failed`.

C'est la raison pour laquelle une version antérieure du dossier annonçait « 105 tests
**écrits** » et non « passants » : la suite n'avait jamais été vue au vert sur cette machine.

**Le contournement, et c'est la partie intéressante.** La suite est exécutée **depuis
l'intérieur du conteneur**, où la base se joint par son nom de service `fitflow-db` sans jamais
passer par le port de l'hôte. Base de test recréée vierge, schéma synchronisé, serveur dédié en
`NODE_ENV=test` sur le port 5002 : **132 tests, 40 suites, 0 échec**.

**La leçon.** Le blocage n'était pas dans le code, et il n'exigeait pas non plus de désinstaller
quoi que ce soit — il suffisait de **ne plus passer par l'hôte**. Le réseau Docker rendait la
base joignable depuis le début.

**Ce qui reste à faire :** `Stop-Service postgresql-x64-18` en session élevée, puis passage du
service en démarrage manuel.

**Note :** ce blocage est purement local. En intégration continue, la suite tourne sans
contournement, sur un service PostgreSQL 15 conteneurisé.

---

## 7. Le bucket de fichiers est public

**La question.** « Vos photos de progression corporelle sont dans un bucket public ? »

**Oui, et voici pourquoi.** Les balises `<img>` du dashboard et du mobile **ne peuvent pas
porter d'en-tête `Authorization`**. Servir un fichier derrière une authentification classique
suppose donc soit un proxy applicatif, soit des URL signées.

**Ce qui protège aujourd'hui.** L'imprévisibilité du nom, généré par `randomUUID()`. C'est une
amélioration réelle : les noms étaient auparavant tirés par `Math.random()`, qui n'est pas
cryptographique — la suite est prédictible à partir de quelques tirages observés. Sur des photos
de progression corporelle, c'était une vraie exposition.

**Ce qu'il faut concéder franchement :** la protection reste **l'obscurité de l'URL, pas un
contrôle d'accès**. Quiconque obtient le lien accède au fichier, indéfiniment. La solution
complète est l'URL signée à durée limitée — Supabase Storage la propose, elle n'est pas
implémentée.

---

## 8. Le diagnostic de performance que j'avais posé était faux

**C'est le point que je mettrais en avant de moi-même** : il montre une démarche, pas seulement
un résultat.

**Ce que j'affirmais.** L'API est à Paris, la base en Irlande ; chaque requête paie un
aller-retour transfrontalier. L'explication était cohérente et compatible avec les mesures :
`/api/health`, qui ne touche pas la base, répondait en 62 ms contre 280 ms pour un endpoint à
une seule requête. L'écart de 220 ms semblait mesurer le trajet.

**Ce que la mesure a montré**, en interrogeant les deux URL de connexion depuis l'intérieur de
la machine Fly :

| Connexion | Aller-retour d'un `SELECT 1` |
| --- | --- |
| Port 5432, pooler en mode **session** | **19 ms** |
| Port 6543, pooler en mode **transaction** | **89 ms** |

Le trajet Paris–Irlande, ce sont les 19 ms. Les **70 ms** restants étaient le coût du pooler en
mode transaction, payés à chaque requête — donc trois fois sur un endpoint qui enchaîne trois
requêtes.

**Pourquoi ce mode était là.** Le mode transaction rend une connexion serveur au pool à la fin
de chaque requête. Il est fait pour les environnements *sans serveur*. J'avais repris la
configuration recommandée par Supabase **sans interroger son hypothèse** : Fly exécute des
machines persistantes, qui gardent leur pool ouvert. L'application payait le prix d'un problème
qu'elle n'avait pas.

**La leçon, formulée pour l'oral :** mon explication était fausse parce qu'elle expliquait
*l'ordre de grandeur* sans avoir été vérifiée — je n'avais jamais mesuré la latence réseau, je
l'avais **déduite d'une soustraction**. Trente secondes de mesure ont suffi à la réfuter. **Une
cause plausible n'est pas une cause démontrée.**

**Le résultat :** un changement de port, pas une ligne de code, et l'exigence T6.2 (< 300 ms
p95) passe de non tenue à tenue sur les cinq endpoints mesurés.

---

## 9. Les deux chaînes d'intégration continue étaient rouges depuis mai

**Le constat.** En relevant l'historique (`gh run list`), j'ai découvert que **les deux chaînes
échouaient sur la totalité de leurs exécutions**, depuis mai 2026. Une intégration continue qui
échoue systématiquement finit par être ignorée : elle ne protège plus rien.

**Il a fallu trois correctifs, en deux jours.**

| # | Cause | Correctif |
| --- | --- | --- |
| 1 | Le script de test administrait PostgreSQL par `docker exec fitflow-db`. En CI, PostgreSQL est un *service container* : joignable sur `localhost`, mais aucun conteneur ne porte ce nom | Le script choisit sa voie d'administration selon ce qui est disponible |
| 2 | `Environment variable not found: DIRECT_URL` | Variable ajoutée au workflow, pointant sur le même service |
| 3 | `The table public.users does not exist` | **`prisma db push` se connecte via `directUrl` quand il est déclaré**, pas via `DATABASE_URL`. Le schéma partait dans la base applicative pendant que le serveur de test visait la base de test |

**Ce que ce bug m'a appris**, et c'est le point à raconter : ajouter `directUrl` au schéma était
une décision de **production** — contourner une limite du pooler Supabase. Elle a cassé
l'**intégration continue**, à deux endroits différents, **sans que rien ne le signale** : la
chaîne était déjà rouge pour une autre raison, et une chaîne rouge en permanence ne fait plus de
bruit quand elle casse davantage. C'est exactement le mécanisme par lequel une CI ignorée cesse
de protéger.

**État au 30 août 2026 : les deux chaînes sont vertes.** Backend : 132 tests, 40 suites,
0 échec. Dashboard : lint, 41 tests, build et 5 tests bout en bout. Ce sont les premières
exécutions réussies de l'historique des deux dépôts.

**La limite à mentionner soi-même :** aucune protection de branche n'est active. Un run rouge
n'empêche ni une fusion ni un push. La CI informe, elle ne protège pas — et c'est précisément ce
qui a permis à la situation de durer. Elle est activable sur le backend (dépôt public) mais pas
sur le dashboard : la protection de branche n'existe pas sur un dépôt privé en plan gratuit.

---

## 10. La règle de lint levée ponctuellement

**La question.** « Vous avez un `eslint-disable` dans votre code. »

**Le contexte.** Trois erreurs de lint bloquaient la chaîne du dashboard, dont deux venant des
règles du compilateur React. Deux ont été corrigées sur le fond. La troisième — `setState`
synchrone dans un effet, sur le chargement de données — est un cas où **la règle a tort** : le
rendu supplémentaire est *voulu*, c'est lui qui affiche les squelettes de chargement.

**Les trois options, et le choix.** Désactiver la règle pour tout le projet, tordre le code pour
satisfaire un analyseur statique, ou la lever ponctuellement en expliquant pourquoi. J'ai choisi
la troisième.

**L'argument :** une suppression localisée et documentée reste relisible — le prochain lecteur
voit la ligne, le commentaire et la raison. Une désactivation globale masque aussi tous les cas
où la règle aurait raison, et personne ne s'en aperçoit.
