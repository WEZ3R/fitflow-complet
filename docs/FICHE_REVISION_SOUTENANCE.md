# Fiche de révision — ce qui a été retiré du dossier

**Ce document ne fait pas partie du dossier.** Il consigne cinq passages d'autocritique
retirés de `DOSSIER_PROJET_V2.html` le 3 septembre 2026, pour que les sujets restent
révisables avant la présentation.

Complément de `POINTS_DE_SOUTENANCE.md`, qui prépare la défense des arbitrages **exposés**
dans le dossier. Cette fiche-ci porte sur ce qui n'y est plus écrit : le jury peut encore
poser la question, et la réponse ne doit pas s'improviser.

## Ce qu'il faut savoir avant d'entrer

| Sujet | Retiré de | Le dossier en dit encore | Tracé ailleurs |
| --- | --- | --- | --- |
| BodyMap lisible par la couleur seule | 8.7 | Partie 11 (RGAA) | — |
| Non-conformité RGPD assumée | tête de partie 10 | **Oui — tableau 10.4, trois 🔴** | — |
| Ordre migration avant déploiement | 15.5 | 15.5 décrit le déploiement manuel | **`DEPLOIEMENT.md`**, détaillé |
| Veille non formalisée | 16.1 | 16.2 montre les conséquences dans le code | — |
| Règle d'autorisation sans test | 17.x | 13.4 liste les tests manquants | — |

Deux de ces sujets restent donc **entièrement visibles** dans le dossier (RGPD, tests
manquants) : sur ceux-là, le retrait supprime l'aveu explicite, pas le fait. Ne pas se
laisser surprendre par une question qui s'appuie sur une autre partie du dossier.

---

## 1. BodyMap — l'information portée par la couleur seule

**Retiré de** la partie 8.7 (BodyMap analytique), après l'extrait 12.

> Accessibilité — limite reconnue. Le volume par groupe musculaire est porté par la
> **couleur seule** sur la silhouette. Une légende nomme les cinq paliers (« Aucun »,
> « Faible », « Moyen », « Élevé », « Très élevé ») et le survol donne la valeur, mais la
> lecture d'ensemble reste inaccessible à une personne daltonienne. Un motif de remplissage
> par palier, en plus de la teinte, lèverait la difficulté (partie 11).

**Si le jury demande.** C'est un manquement au critère RGAA **1.3 / 1.4** — l'information ne
doit pas être donnée par la couleur seule. Deux atténuations existent déjà : la légende
nomme les cinq paliers, et le survol donne la valeur numérique. Elles ne suffisent pas pour
la lecture d'ensemble, qui est précisément l'intérêt de la silhouette.

**Le correctif**, à annoncer comme tel : ajouter un **motif de remplissage** par palier
(hachures de densité croissante) en plus de la teinte. En SVG c'est un `<pattern>` par
palier, appliqué avec la couleur — une demi-journée, sans refonte. Une alternative textuelle
sous la silhouette (tableau groupe musculaire → palier) serait le complément naturel.

**À ne pas dire** : que c'est accessible parce qu'il y a une légende. Nommer les paliers ne
rend pas la silhouette lisible.

---

## 2. RGPD — la conformité n'est pas revendiquée

**Retiré de** la tête de la partie 10 (RGPD et données personnelles).

> Avertissement. Aucune analyse de conformité complète n'a été menée, et FitFlow **n'est pas
> déclaré conforme au RGPD**. Cette partie décrit les mesures effectivement prises dans la
> conception, puis liste ce qui reste à traiter. Aucun registre de traitement, aucune analyse
> d'impact et aucune politique de confidentialité n'existent à ce jour.

**Attention — le fait reste écrit.** Le tableau **10.4 « Points restant à traiter »** porte
trois 🔴 : *Consentement — aucune case, aucune politique de confidentialité*, *Registre des
traitements — inexistant*, *Analyse d'impact — inexistante, probablement requise : données de
santé et suivi systématique*. Un jury qui lit 10.4 a l'information ; ce qui a disparu, c'est
la phrase qui la résume en tête de partie.

**Si le jury demande, dire la phrase à voix haute** : « Je ne déclare pas FitFlow conforme.
Aucune analyse de conformité complète n'a été menée. » Puis enchaîner sur ce qui **est** fait,
et qui n'est pas rien : droit à l'effacement implémenté (`DELETE /api/auth/me`, confirmé par
mot de passe), droit d'accès et portabilité (`GET /api/auth/me/export`, export JSON complet),
rectification par l'édition de profil, purge automatisée à douze mois des données de
modération, aucun partage avec un tiers, aucun analytics, aucun traceur.

**Le point sensible à ne pas esquiver** : l'application traite des **données de santé** (poids,
mesures, RPE, repas) avec un suivi systématique. C'est le cas typique où l'AIPD est requise.
Le dire avant qu'on le demande vaut mieux que de le concéder après.

**Le correctif** : politique de confidentialité + case de consentement à l'inscription
(l'écran existe, c'est un champ à ajouter), registre des traitements, puis AIPD. Dans cet
ordre — le registre est le préalable de l'analyse.

---

## 3. Déploiement — migrer avant de déployer

**Retiré de** la partie 15.5 (Déploiement — aujourd'hui manuel).

> ⚠️ Ordre d'exécution à respecter. Le déploiement de l'API ne joue pas les migrations. Une
> modification de schéma impose donc de lancer `prisma migrate deploy` **avant**
> `flyctl deploy` : déployer d'abord le code produirait des erreurs `P2022` — colonne
> absente — jusqu'à ce que la base rattrape son retard.

**Ce n'est pas une faiblesse, c'est une procédure.** Et elle ne se perd pas : `DEPLOIEMENT.md`
la documente en détail, avec la commande complète (`DATABASE_URL` sur le pooler, `DIRECT_URL`
en connexion directe), la conséquence exacte du mauvais ordre — `P2022`, plus personne ne peut
se connecter — et la règle qui en découle : une migration doit rester **additive** autant que
possible, sinon l'ordre inverse casse aussi le déploiement précédent.

**Si le jury demande** « comment déployez-vous une évolution de schéma ? » : `prisma migrate
deploy` sur la base, **puis** `flyctl deploy --remote-only`. Le dashboard suit tout seul par
poussée sur `main`. Et la suite logique, à assumer comme non faite : un workflow GitHub
déclenché sur fusion, avec `FLY_API_TOKEN` en secret — l'API n'a pas encore de déploiement
continu, contrairement au dashboard.

**Pourquoi ne pas automatiser la migration dans le déploiement** (question probable) : une
migration jouée automatiquement sur deux machines Fly qui démarrent en parallèle, c'est deux
`migrate deploy` concurrents. La question est ouverte dans `DEPLOIEMENT.md` — répondre qu'elle
est identifiée, pas tranchée.

---

## 4. Veille — réelle mais non formalisée

**Retiré de** la partie 16.1 (Ma démarche de veille).

> Honnêteté sur la méthode. Cette veille est **réelle mais non formalisée** : pas de journal
> daté, pas d'abonnement documenté, pas de notes de lecture archivées. Je peux en décrire la
> démarche et en montrer les conséquences dans le code, mais je ne peux pas produire une trace
> horodatée source par source. C'est une lacune de méthode que j'assume, et le premier réflexe
> que je changerais sur un prochain projet.

**C'est le passage dont le retrait est le plus risqué.** La veille est une compétence évaluée,
et le jury demande souvent une trace. Sans l'aveu écrit, une question directe — « montrez-moi
votre journal de veille » — arrive sans filet.

**Si le jury demande.** Ne pas inventer de journal. Dire que la trace est dans le code, et la
montrer : la partie **16.2** liste les décisions issues de la veille, et plusieurs choix sont
commentés dans les sources avec leur justification — le pooler en mode session plutôt que
transaction, `auto_stop_machines` sur Fly, la dégradation volontaire du cache Redis,
`STORAGE_DRIVER` à deux pilotes. Ce sont des conséquences de veille **observables et datées
par les commits**, ce qui est plus solide qu'un fichier de liens.

**Le correctif**, si la question insiste : un journal daté source par source, tenu dès le
début du prochain projet. C'est la réponse honnête et elle est bien reçue — à condition de ne
pas prétendre l'avoir.

---

## 5. Règle d'autorisation relationnelle sans test automatisé

**Retiré de** la partie 17 (Difficultés et résolution de problèmes), après l'extrait 18.

> ⚠️ Faiblesse assumée. Cette règle est validée **manuellement** : aucun test automatisé ne la
> verrouille. C'est précisément le genre de règle qu'une refactorisation ultérieure peut casser
> silencieusement. Le test correspondant figure dans les manques identifiés en 13.4.

La règle en question : les deux rôles peuvent proposer et confirmer un rendez-vous, mais
**jamais leur propre proposition** — contrôlée dans le controller, parce que l'information
« qui a proposé » n'existe pas au niveau du routeur.

**Attention — le fait reste écrit.** La partie **13.4** liste les tests manquants, et ce test
en fait partie. La vérification manuelle des quatre combinaisons est, elle, toujours décrite
juste au-dessus du bloc retiré (« Validation. Vérification manuelle des quatre
combinaisons… »). Un jury attentif fera le rapprochement : une règle vérifiée à la main dans
un projet qui compte ~193 tests automatisés.

**Si le jury demande.** Assumer et donner l'enseignement, qui est bon et reste dans le
dossier : le contrôle d'accès **par rôle** se place au routeur, le contrôle d'accès **par
relation** doit descendre là où la donnée est disponible. Vouloir tout traiter dans un
middleware conduit soit à des trous, soit à des restrictions arbitraires.

**Le correctif** : quatre cas de test d'intégration — coach proposant / coach confirmant
(403), coach proposant / client confirmant (200), et les deux symétriques. Le harnais existe
déjà (`__tests__/helpers.js`, base réelle), c'est une heure de travail. C'est le test à écrire
en premier si un ajout est possible avant la présentation.

---

## Après la présentation

Si ces passages doivent revenir dans le dossier, la sauvegarde
`DOSSIER_PROJET_V2.html.bak` conserve l'état d'avant retrait, et les citations ci-dessus sont
intégrales — un copier-coller dans un `<div class="warn">` suffit à les rétablir.
