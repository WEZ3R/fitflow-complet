# Réexporter le dossier en PDF

Note destinée à une autre session Claude. Elle répond à une seule question :
**comment régénérer `DOSSIER_PROJET_V2.pdf` sans casser le livrable.**

## La source de vérité, c'est le HTML

`docs/DOSSIER_PROJET_V2.html` est **autonome** : styles en ligne, figures encodées en
base64 dans le fichier. Aucune ressource externe, aucun dossier joint. Le PDF n'en est
qu'un rendu — on ne le modifie jamais directement, on modifie le HTML et on réexporte.

## La commande

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" \
  --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="C:\Users\marcy\Documents\projet persos github\fitflow-v2\docs\DOSSIER_PROJET_V2.pdf" \
  --virtual-time-budget=60000 \
  "file:///C:/Users/marcy/Documents/projet%20persos%20github/fitflow-v2/docs/DOSSIER_PROJET_V2.html"
```

Le chemin `file://` doit être **encodé** : les espaces de « projet persos github » deviennent
`%20`, sinon Chrome charge une page vide et produit un PDF d'une page sans le dire.

Chrome écrit `N bytes written to file …` sur la sortie d'erreur. Des lignes `ERROR` sur
`device_event_log` ou `externally_managed_app_manager` sont du bruit normal et n'indiquent
aucun échec.

### Les trois options, et pourquoi

| Option | Rôle |
| --- | --- |
| `--no-pdf-header-footer` | **Indispensable.** Sans elle, Chrome imprime l'URL du fichier et la date en tête et pied de chaque page, par-dessus la mise en page |
| `--virtual-time-budget=60000` | Laisse le rendu se terminer avant l'impression. Le document fait ~2,9 Mo avec les figures |
| `--disable-gpu` | Évite les aléas de rendu en headless sous Windows |

Ne pas ajouter de marges en ligne de commande : **elles sont dans le CSS du document.**

```css
@page       { size: A4; margin: 16mm 16mm 14mm; }
@page :first{ margin: 0; }               /* couverture pleine page, sans marge */
```

## Ce qu'il ne faut pas utiliser

- **pandoc, wkhtmltopdf, weasyprint** — le document s'appuie sur `@page`, sur des
  `page-break-after: avoid` et sur des images en base64 volumineuses. Ces outils les
  gèrent mal ou pas du tout, et la couverture pleine page saute.
- **Impression manuelle depuis un navigateur** — les marges et l'échelle ne seront pas
  celles du CSS.

## Vérifier après export

Toujours, et pas seulement quand on doute :

```python
from pypdf import PdfReader
r = PdfReader('DOSSIER_PROJET_V2.pdf')
print('pages :', len(r.pages))
t = ''.join((p.extract_text() or '') for p in r.pages)
print('8.8 Modération' in t, '10b.1' in t, 'Annexe I' in t)
```

- **Le nombre de pages** est le meilleur indicateur : il tourne autour de **73**. Un écart
  de plus de deux pages sans modification correspondante signale un problème.
- **La taille du fichier** doit rester autour de **5,6 Mo**. Une chute brutale signifie
  qu'un bloc ou des figures ont disparu du HTML.
- Le document contient 22 parties (`<h2>`) et **14 figures**, sous trois formes — compter
  les trois, pas seulement le PNG :

```bash
grep -c 'data:image/png;base64,'  DOSSIER_PROJET_V2.html  # 9  — captures
grep -c 'data:image/jpeg;base64,' DOSSIER_PROJET_V2.html  # 1  — figure 3, éditeur de séance
grep -o '<svg viewBox' DOSSIER_PROJET_V2.html | wc -l     # 4  — figures 1, 10, 11 et 14, vectorielles
grep -c '<div class="part">'      DOSSIER_PROJET_V2.html  # 22 — parties
```

### Une figure haute ne tient pas sur une page

`page-break-inside: avoid` est sans effet sur un bloc plus haut qu'une page : Chrome le
coupe quand même, et c'est la **légende qui part seule sur la page suivante**. La figure 3
(capture en portrait, 1922×2817) l'a fait. La parade est de borner la hauteur de l'image
pour que l'image *et* sa légende tiennent dans les 267 mm utiles :

```html
<img src="data:image/jpeg;base64,…" style="max-height:228mm;width:auto;max-width:100%;margin:0 auto;…">
```

Après export, vérifier que la légende est sur la même page que sa figure — c'est le
symptôme le plus discret de tous.

### Lire le nombre de pages dans une commande séparée

Chrome écrit `N bytes written` sur la sortie d'erreur **avant** que le fichier ne soit
entièrement remplacé. Compter les pages dans la même commande que l'export a déjà donné
72 pages là où le PDF final en fait 74 : la lecture portait sur le fichier précédent.
Toujours exporter, **puis** vérifier dans un second appel.

### La pagination du sommaire se recalcule après coup

Ajouter du contenu **à la fin** du document déplace la pagination **en amont** : l'insertion de
la matrice de l'annexe D a fait passer le dossier de 74 à 70 pages et décalé les parties 4 à 21
de une à douze pages, alors que leur HTML n'avait pas changé d'un octet. Les blocs
`page-break-inside: avoid` ne se répartissent pas de la même façon selon ce qui suit.

Conséquence pratique : le sommaire ne peut pas être écrit à la main. Le relever sur le PDF,
corriger le HTML, réexporter, puis **vérifier que plus rien ne bouge** — deux tours suffisent en
général. Les ancres à utiliser sont les premières sous-sections (`5.1 Besoins fonctionnels`,
`14.1 Architecture déployée`, `Annexe A — Stack technique`…) et non les titres de partie, qui
apparaissent aussi dans le sommaire lui-même.

### Vérifier qu'aucun bloc n'a disparu — le contrôle qui manquait

Le 3 septembre 2026, une série d'éditions par script a fait disparaître **l'annexe H en entier**
(journal des vérifications, dont le récit de l'exigence T6.2), six encadrés `.warn` et un `.todo`
— sans qu'aucune assertion ne s'en aperçoive : chaque script vérifiait *sa* substitution, aucun
ne vérifiait le document. Le symptôme visible était un dossier passé de 74 à 70 pages *alors
qu'on venait d'y ajouter douze pages*.

D'où ce contrôle, à faire avant chaque export, contre la version précédente du HTML :

```python
import re
def phrases(s):
    s = re.sub(r'<svg.*?</svg>|<style>.*?</style>', '', s, flags=re.S)
    s = re.sub(r'<img[^>]*>', '', s)
    t = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', s))
    return [p.strip() for p in re.split(r'(?<=[.:!?])\s+', t) if len(p.strip()) > 25]

avant, apres = phrases(open('ref.html', encoding='utf-8').read()), set(phrases(open('DOSSIER_PROJET_V2.html', encoding='utf-8').read()))
perdues = [p for p in avant if p not in apres]
```

Toute phrase perdue doit être **voulue et explicable**. En complément, deux compteurs qui
signalent le même genre d'accident : `grep -c '<div class="warn"'` et
`grep -c '<div class="todo"'`. Enfin, **garder une copie du HTML avant chaque série
d'éditions** : c'est elle qui a permis de tout restaurer par ancrage textuel.

## Si les figures ont été régénérées

Les figures 12 et 13 (modèle de données) sont produites depuis le schéma Prisma, puis
**réinjectées en base64 dans le HTML**. Elles ne sont pas référencées par un chemin.

```python
import base64, io, re
b64 = base64.b64encode(io.open('captures/fig13-modele-donnees.png','rb').read()).decode()
lignes = io.open('DOSSIER_PROJET_V2.html', encoding='utf-8').read().split('\n')
lignes[i] = re.sub(r'(data:image/png;base64,)[A-Za-z0-9+/=]+',
                   lambda m: m.group(1) + b64, lignes[i], count=1)
```

Repérer la bonne ligne par son contenu (`grep -n 'data:image/png;base64,'`), **jamais par
un numéro noté ailleurs** : il bouge à chaque édition du document.

## Le piège qui a déjà détruit onze pages

Pour supprimer un bloc `<div class="warn">…</div>` par script, **ne jamais** chercher la
fermeture avec `texte.index('</div>', i)`. Deux raisons :

1. la chaîne recherchée peut apparaître **plusieurs fois** dans le document — `index()`
   trouve la première, qui n'est pas forcément celle du bloc visé ;
2. un `</div>` trouvé par simple recherche peut appartenir à un div imbriqué, ou être
   très loin en aval.

La combinaison des deux a déjà supprimé les parties 6, 7 et 8.1 à 8.6 d'un seul coup, sans
la moindre erreur à l'exécution. Utiliser un compteur de profondeur :

```python
def bloc_warn(texte, cle):
    i = texte.index(cle)
    d = texte.rindex('<div class="warn"', 0, i)
    prof = 0
    for m in re.finditer(r'<div\b|</div>', texte[d:]):
        prof += 1 if m.group(0).startswith('<div') else -1
        if prof == 0:
            f = d + m.end()
            assert d < i < f, 'la clé doit être DANS le bloc'
            return d, f
    raise AssertionError('fermeture introuvable')
```

L'`assert` est ce qui aurait évité l'incident. **Le vérifier avant toute suppression, et
comparer `<div` / `</div>` avant et après** — l'écart doit rester constant (il vaut +1
dans ce document, une anomalie d'origine et sans conséquence au rendu).

**Sauvegarder le HTML avant toute édition par script**, et ne réexporter le PDF qu'après
avoir contrôlé le nombre de pages.

## Après suppression d'un bloc

Deux effets de bord se produisent régulièrement :

- **un titre reste sans contenu** — chercher les `<h3>` immédiatement suivis d'un autre
  titre de même niveau ;
- **un renvoi pointe dans le vide** — chercher « ci-dessous », « ci-dessus », « voir 15.3 »
  et vérifier que la cible existe encore.
