# Démonstration en direct — parcours utilisateur type

**7 minutes**, à l'intérieur de la partie 3. Six étapes qui suivent une même boucle :
ce que le coach prépare, la cliente l'exécute, et la donnée lui revient.

> Le fil à ne jamais perdre : **on ne montre pas des écrans, on suit une personne.**
> Si tu te perds, reviens à la diapositive « Parcours utilisateur type » et reprends au
> numéro d'étape.

---

## Avant d'entrer dans la salle

| # | Vérification | Pourquoi |
| --- | --- | --- |
| 1 | Ouvrir **https://fitflow-api.fly.dev/api/health** et attendre la réponse | Les machines Fly se mettent en veille. Le premier appel les réveille en ~10 s — pas devant le jury |
| 2 | Vérifier que le projet **Supabase** n'est pas suspendu | Il se met en pause après inactivité prolongée |
| 3 | Se connecter au dashboard **et** à l'application mobile, puis laisser les deux ouverts | La connexion mange 30 secondes et n'apprend rien à personne |
| 4 | Couper les notifications système sur les deux appareils | |
| 5 | Vérifier que la séance du jour existe *(voir plus bas)* | Sans elle, l'étape 4 tombe à plat |

**Comptes :** `thomas@test.com` (coach) et `camille@test.com` (cliente),
mot de passe commun — voir le fichier de secrets hors dépôt.

### La séance du jour dépend du jour de la semaine

Le jeu de démonstration place des séances les **lundi, mardi, jeudi et vendredi**.
**Mercredi et week-end sont des jours de repos** : il n'y aura aucune séance du jour, et
l'étape 4 n'aura rien à montrer.

Si ta soutenance tombe un mercredi ou un week-end, préviens-moi : il faut recaler le jeu de
données avec `seed-demo.js --until`.

---

## Le déroulé, étape par étape

### 1 — Le coach prépare · 1 min 30

**Écran : dashboard, connecté en Thomas.**

> Voici ce que voit le coach en arrivant. Son portefeuille : ses clientes, les programmes
> actifs, les messages non lus, les prochains rendez-vous.

*Clique sur **Camille Dubois**.*

> J'ouvre la fiche de Camille. Son programme en cours, son historique de séances, ses
> statistiques. **Tout est au même endroit** — c'est le point de départ du projet.

*Ouvre la séance du jour, « Haut du corps ».*

> Et voici la séance qu'elle doit faire aujourd'hui. Sept exercices : un échauffement,
> quatre exercices de musculation, un exercice de renforcement, des étirements.
>
> Regardez le gainage : il est en catégorie **Renforcement**. J'y reviens dans un instant,
> parce que ça change la façon dont on le saisit.

---

### 2 — Il capitalise · 1 min 30

> Le problème de Thomas, c'est qu'il recopie. Cette séance « Haut du corps », il va la
> refaire pour d'autres clients, et pour Camille dans deux semaines.

*Transforme la séance en template.*

> Je la transforme en **template**. Elle est maintenant réutilisable telle quelle.

*Applique le template au programme d'un autre client — Lucas, Sarah ou Maxime.*

> Et je l'applique au programme de Lucas. **La séance est créée d'un coup.**
>
> Mais attention — et c'est un choix de conception : **rien n'est imposé.** Le coach peut
> toujours créer une séance de toutes pièces. Les templates répondent vite au cas courant ;
> ils n'empêchent jamais le cas particulier.

> ⚠️ **Il n'existe aucun template en base au moment où j'écris.** Tu en crées donc un en
> direct, ce qui est plus démonstratif — mais répète ce geste au moins trois fois avant le
> jour J. Si tu préfères un filet de sécurité, demande-moi d'en pré-créer deux.

---

### 3 — Il fixe un rendez-vous · 1 min

*Ouvre la messagerie, conversation avec Camille — il y a déjà 5 messages.*

> Voici la messagerie. **C'est la réponse directe au problème que je posais en ouverture :**
> Thomas échange avec ses clientes sans donner son numéro personnel.

*Depuis l'en-tête de la conversation, propose un rendez-vous.*

> Et je propose un rendez-vous **sans quitter la conversation**. La proposition apparaît
> dans le fil ; Camille l'accepte ou la refuse, et l'agenda se met à jour tout seul.
>
> **C'est la fonctionnalité la plus transverse du projet** : elle touche la messagerie,
> l'agenda et les notifications d'un coup.

---

### 4 — La cliente s'entraîne · 2 min

**Bascule sur le téléphone, connecté en Camille.** *(Annonce la bascule : « je passe côté
cliente, en salle. »)*

> Camille est en salle. Elle ouvre l'application, et voici sa séance du jour — la même que
> celle que Thomas vient de me montrer.

*Ouvre la séance, valide une série du développé couché : poids, répétitions, RPE.*

> Elle valide sa série : le poids réellement soulevé, les répétitions réellement faites,
> et le **RPE** — la difficulté ressentie de 6 à 10.
>
> **Trois gestes.** C'est volontaire : on est debout, entre deux séries, avec les mains
> moites. Si la saisie prend trente secondes, personne ne la fait.

*Le chronomètre de repos démarre — 120 secondes sur cet exercice.*

> Et le chronomètre de repos démarre tout seul, avec la durée prévue par le coach.

*Descends jusqu'au gainage.*

> Regardez le gainage. **Il n'y a ni poids ni répétitions : il y a un temps tenu.**
>
> Ce n'est pas cosmétique. Le champ est distinct en base de données. Si j'avais enregistré
> « 45 » dans les répétitions, un gainage de 45 secondes aurait été compté comme
> **45 répétitions** dans le calcul du volume — et il aurait faussé toutes les statistiques
> d'un facteur soixante.

---

### 5 — Elle saisit son suivi · 30 s

*Retour à l'accueil mobile, saisis le poids et l'hydratation.*

> Elle renseigne aussi son suivi quotidien : poids, hydratation, sommeil, repas.
>
> **Il n'y a pas de bouton Enregistrer** — la saisie part toute seule après une pause de
> frappe. Une donnée saisie est une donnée conservée.

---

### 6 — La donnée revient au coach · 30 s

**Retour sur le dashboard.** *(Rafraîchis la page.)*

> Et on revient chez Thomas. La séance apparaît validée, avec les charges réelles.

*Ouvre l'écran d'analyse.*

> La progression est tracée, le 1RM estimé recalculé, et la cartographie musculaire montre
> les groupes sur-sollicités ou négligés.
>
> **La boucle est fermée. Aucune ressaisie nulle part** — et c'est exactement ce que les
> quatre outils du début ne savaient pas faire.

---

## Si ça tourne mal

**La règle : ne jamais déboguer devant le jury.** Une démonstration qui s'enlise coûte plus
cher que pas de démonstration du tout.

| Symptôme | Réaction |
| --- | --- |
| Le premier écran met du temps | « Les machines se réveillent, elles se mettent en veille pour ne rien coûter. » — et enchaîne, c'est vrai et ça se défend |
| Une page ne répond pas | Recharge **une** fois. Si ça ne revient pas, passe aux diapositives de secours |
| Le réseau est coupé | Diapositives de secours, en fin de support |
| Une fonctionnalité échoue | « Ce point ne fonctionne pas ici, je vous montre le résultat sur la capture. » Ne cherche pas la cause à voix haute |

**Les cinq diapositives de secours** sont à la fin du support, après la conclusion. Elles
couvrent les étapes 1, 3 et 6 et portent la légende du numéro d'étape correspondant. Elles
sont hors minutage : les afficher ne décale rien.

---

## Ce que la démonstration ne montre pas, et qu'il faut dire

La diapositive suivante (« Ce que ce parcours démontre ») sert à ça. Trois points valent
d'être ajoutés à l'oral si le temps le permet :

- **L'export tableur** — le coach récupère ses données pour travailler dans Excel s'il
  préfère. Je ne force personne à changer d'outil.
- **La recherche de coach** côté cliente — par salle ou par ville, avec les notes.
- **La modération** — signalement depuis un profil ou une conversation, sanctions graduées
  et recours, conçus à partir de la contrainte RGPD.

---

## Répétition

Chronomètre la démonstration seule, sans les diapositives :

```bash
cd outils/dictee
.venv/Scripts/python.exe dictee.py enregistrer --duree 420 --titre "Répétition démo"
```

Sept minutes, arrêt automatique. Si tu débordes, **coupe l'étape 2** : le template se
raconte très bien sans être montré, alors que les étapes 4 et 6 ne valent que si on les voit.
