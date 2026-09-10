# Dossier professionnel — AT1, exemple supplémentaire

À reporter dans `dossier_professionnel_v2.docx`, activité-type 1 « Développer une
application sécurisée ». Le format suit celui des exemples déjà rédigés : un titre, un
paragraphe par compétence introduit par « Compétence – … : j'ai … », puis le contexte et
l'organisme.

> **Ce document ne contient que ce qui a été vérifié.** Les chiffres proviennent d'une
> comparaison du HTML servi par `definima.com` et `dev.definima.net` le 3 septembre 2026.
> Les passages marqués `[À CONFIRMER]` attendent une information que je ne peux pas
> constater depuis l'extérieur : ne les reporter qu'après les avoir vérifiés.

---

## Exemple n°3 ►

**Refonte de pages du site de l'agence Definima — Bolt CMS, ContentTypes et gabarits Twig**

---

### Corps de l'exemple

Dans le cadre de mon activité chez Definima, agence digitale bordelaise, j'ai pris en charge
la refonte de plusieurs pages du site institutionnel de l'agence, développé sous **Bolt CMS**
(CMS PHP bâti sur Symfony, gabarits Twig). Le travail a été mené sur un environnement de
recette accessible sur un domaine distinct, `dev.definima.net`, avant reprise en production
sur `definima.com`.

**Compétence – Développer des interfaces utilisateur :** j'ai développé les gabarits Twig de
trois pages. J'ai **créé la page d'offre de maintenance WordPress** (`/offre/maintenance`),
absente du site en production : présentation de l'offre, grille tarifaire, comparateur
d'offres, section de témoignages clients, foire aux questions de cinq entrées et formulaire
de contact — soit onze sections et soixante visuels. J'ai **repris la page de présentation
de l'agence** (`/agence-definima`), portée de cinq à huit sections avec l'ajout des blocs
« Ce qui nous anime », « Le mot de Charles », « Agence engagée pour un monde meilleur » et
d'un formulaire d'inscription à la lettre d'information. J'ai enfin **refondu la page des
équipes** (`/equipes`), qui en production n'affichait aucun collaborateur : j'y ai intégré
une grille responsive de **vingt et une fiches**, chacune portant la photo, le prénom et la
fonction — directeur d'agence, responsable administrative, directeur clientèle, directeur
stratégie digitale, chefs de projet, chargée webmarketing, administrateurs systèmes et
réseaux, développeurs back-end, développeuse, intégrateur front-end, graphiste, traffic
manager. J'ai porté une attention particulière à
l'accessibilité : **les cent trente-trois images des pages que j'ai réalisées portent toutes
un attribut `alt`**, là où la version en production de la page agence en comptait neuf sans
aucun texte alternatif ; le nombre d'attributs ARIA a été doublé sur chacune des pages
reprises (de 13 à 26 sur la page agence, de 13 à 35 sur la page équipes).

`[À CONFIRMER — Compétence : Installer et configurer son environnement de travail]`
*À ne rédiger que si tu as effectivement installé ou paramétré l'environnement : instance
Bolt locale, configuration de la base, thème, outillage. Si l'environnement t'a été fourni
prêt à l'emploi, ne pas revendiquer cette compétence.*

`[À CONFIRMER — Compétence : Développer des composants métier]`
*Cette compétence attend une logique métier, pas de la mise en page. Elle n'est défendable
que si tu as écrit du traitement côté serveur : requêtes `setcontent` avec filtres et
relations, traitement du formulaire de contact, extension PHP, filtre Twig personnalisé.
Fournir un extrait de code, sinon retirer ce paragraphe.*

`[À CONFIRMER — Compétence : Contribuer à la gestion d'un projet informatique]`
*Défendable si le travail a été suivi par un outil de gestion (tickets, jalons), s'il y a
eu des points de validation avec l'agence ou le client, ou si tu as travaillé sous
versionnement. À décrire tel que ça s'est passé, sans l'embellir.*

---

### Précisions sur le contexte

`[À CONFIRMER]` — Indiquer si le travail a été mené **seul ou en équipe**, et à quel titre :
salarié, alternant, stagiaire, prestataire. Le dossier demande cette précision, et c'est la
première chose qu'un jury vérifie.

### Nom de l'entreprise, organisme ou association ►

**Definima** — agence digitale, Gradignan (Bordeaux)

---

## Ce qui rend cet exemple utile au dossier

**C'est le seul exemple en contexte professionnel réel.** Les trois autres — Cook'US,
Drunk-Santa, init-stripe — sont des projets de formation ou personnels. Un jury de titre
professionnel y est attentif.

**L'angle accessibilité est mesurable et vérifiable.** N'importe qui peut ouvrir le code
source des trois pages et compter les attributs `alt`. C'est le genre d'affirmation qui
résiste à la question « comment le savez-vous ? », contrairement à une déclaration
d'intention sur la qualité du code.

---

## Pièces justificatives

Le dossier prévoit une rubrique « Documents illustrant la pratique professionnelle ».

### Déjà produites — `docs/captures-definima/`

Les deux environnements étant publics, l'avant et l'après ont pu être capturés sans accès
au poste de développement.

| Fichier | Contenu |
| --- | --- |
| `definima-equipes-AVANT.png` | Page équipes en production : bandeau, intro, **puis une zone vide** — aucun collaborateur affiché |
| `definima-equipes-APRES.png` | Grille de 21 fiches, photo, prénom et fonction |
| `definima-agence-AVANT.png` | Page agence en production, 5 sections |
| `definima-agence-APRES.png` | Page agence reprise, 8 sections, formulaire d'inscription |
| `definima-maintenance-404-prod.png` | **Page 404 de la production** — preuve que la page n'existait pas |
| `definima-maintenance-CREEE.png` | La page d'offre de maintenance telle que réalisée |

Le couple 404 / page complète est la pièce la plus parlante : elle établit une création,
pas une retouche.

### Restent à produire, depuis le poste de développement

1. **Un extrait de gabarit Twig** que tu as écrit, avec ses boucles et ses conditions.
2. **La déclaration des ContentTypes** (`contenttypes.yaml` ou équivalent) montrant la
   hiérarchie *expertise → métier → sous-métier* et le type *offre*.

La seconde sert aussi l'activité-type 2 : elle documente un modèle à six types de contenu,
dont une hiérarchie à trois niveaux — soixante-sept sous-métiers rattachés à vingt métiers,
eux-mêmes rattachés à dix expertises.

---

## Relevé de la comparaison, pour mémoire

Mesures faites sur le HTML servi par les deux environnements le 3 septembre 2026.

| Page | | Production | Recette |
| --- | --- | --- | --- |
| `/offre/maintenance` | existence | **404** | page complète |
| | sections | — | 11 |
| | images / sans `alt` | — | 60 / **0** |
| | formulaires | — | 1 |
| `/agence-definima` | sections | 5 | 8 |
| | images / sans `alt` | 9 / **9** | 26 / **0** |
| | attributs ARIA | 13 | 26 |
| `/equipes` | titres | 4 | 25 |
| | images / sans `alt` | 0 | 47 / **0** |
| | attributs ARIA | 13 | 35 |
