# -*- coding: utf-8 -*-
"""Prépare le texte à coller dans Gamma, à partir de `support.html`.

Rien n'est envoyé nulle part : le script se contente de convertir le support en un
Markdown que Gamma sait découper, et d'écrire à côté les consignes à lui donner.

    python gamma.py

Produit deux fichiers :

    gamma-a-coller.md       le contenu — à coller dans « Paste in text »
    gamma-consignes.txt     la charte et les interdits — à coller dans les instructions

Le support fait autorité sur le contenu ; Gamma n'apporte que la mise en forme et les
illustrations. D'où le mode « Preserve » recommandé plus bas : Gamma ne doit ni résumer,
ni compléter, ni inventer de chiffres.
"""
import html
import io
import os
import re
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
SUPPORT = os.path.join(ICI, 'support.html')
CONTENU = os.path.join(ICI, 'gamma-a-coller.md')
CONSIGNES = os.path.join(ICI, 'gamma-consignes.txt')

# La charte du support, reprise de `globals.css` du dashboard.
PALETTE = ('fond graphite très sombre #272727, cartes et encadrés #323232, '
           'accent vert lime #85e859 réservé aux titres et aux chiffres clés, '
           'texte blanc #ffffff, texte secondaire gris clair #a8a8a8')

TEXTE_CONSIGNES = """Support de soutenance orale, en français, pour le titre professionnel
de Concepteur Développeur d'Applications. Public : un jury de professionnels.

CHARTE GRAPHIQUE — à respecter strictement :
%s
Fond sombre sur toutes les cartes, jamais de fond clair.

CONTENU — contraintes impératives :
- Ne rien inventer. N'ajoute aucun chiffre, aucune métrique, aucune date, aucun nom de
  technologie qui ne figure pas dans le texte fourni. Les chiffres présents sont des
  mesures réelles : ne les arrondis pas, ne les modifie pas.
- Conserve l'ordre des cartes et le découpage fourni. Chaque bloc séparé par --- est une
  carte. Les huit cartes en titre de niveau 1 sont des séparateurs de partie et doivent
  garder ce rôle visuel.
- Conserve le ton : sobre, factuel, technique, sans superlatif ni vocabulaire commercial.
- Reste en français, y compris dans les légendes.

ILLUSTRATIONS :
Sobres et abstraites, sur fond sombre #272727, avec un accent vert lime #85e859. Style
éditorial technique et géométrique. Pas de texte incrusté, pas de personnage
photoréaliste, pas de logo. Sujets : le coaching sportif, l'architecture logicielle, les
bases de données, la sécurité, les tests, le déploiement.
""" % PALETTE


def _texte(fragment):
    """Réduit un fragment HTML au texte, en gardant le gras du Markdown."""
    t = re.sub(r'<br\s*/?>', ' ', fragment)
    t = re.sub(r'</?(strong|b)>', '**', t)
    # `.cle` marque les mots-clés : le gras est ce qui s'en rapproche le plus.
    t = re.sub(r'<span class="cle">(.*?)</span>', r'**\1**', t, flags=re.S)
    t = re.sub(r'<code>(.*?)</code>', r'`\1`', t, flags=re.S)
    t = re.sub(r'<[^>]+>', ' ', t)
    t = html.unescape(t)
    # Le gras vide apparaît quand une balise ouvrante et sa fermante se suivent.
    t = t.replace('****', '')
    return re.sub(r'\s+', ' ', t).strip()


def _carte(bloc):
    """Convertit une `.carte` : son h3 devient un intitulé, le reste du texte suit."""
    titre = re.search(r'<h3>(.*?)</h3>', bloc, re.S)
    corps = _texte(re.sub(r'<h3>.*?</h3>', '', bloc, flags=re.S))
    if titre and corps:
        return '- **%s** — %s' % (_texte(titre.group(1)), corps)
    if titre:
        return '- **%s**' % _texte(titre.group(1))
    return '- %s' % corps if corps else ''


def extraire():
    """Une carte par diapositive, séparées par `---`, le séparateur que Gamma reconnaît.

    Sont retirés : les notes de l'orateur, le minutage, le fil d'Ariane et les captures
    d'écran. Les captures sont encodées dans le fichier : elles ne se collent pas, et
    une mention prend leur place pour que la carte garde un sens.
    """
    if not os.path.exists(SUPPORT):
        sys.exit('  Introuvable : %s' % SUPPORT)
    s = io.open(SUPPORT, encoding='utf-8').read()
    sections = re.findall(
        r'<section class="diapo( intercalaire)?"[^>]*>(.*?)</section>', s, re.S)
    if not sections:
        sys.exit('  Aucune diapositive trouvée dans %s' % SUPPORT)

    cartes = []
    for inter, bloc in sections:
        # Ce qui ne se lit pas à l'écran n'a rien à faire dans le support.
        for classe in ('notes', 'minutage', 'fil'):
            bloc = re.sub(r'<div class="%s".*?</div>' % classe, '', bloc, flags=re.S)

        lignes = []
        # Le sommaire et les intercalaires sont trop structurés pour la conversion
        # générique : sans traitement dédié, ils ressortent en une ligne illisible.
        entrees = re.findall(r'<div class="e">(.*?)</div>\s*(?=<div class="e"|</div>)',
                             bloc, re.S)
        if entrees:
            lignes.append('## %s' % _texte(
                re.search(r'<h2[^>]*>(.*?)</h2>', bloc, re.S).group(1)))
            for e in entrees:
                num = re.search(r'<span class="num">(.*?)</span>', e, re.S)
                lib = re.search(r'<span class="lib">(.*?)(?:<br>|<span class="det">)', e, re.S)
                det = re.search(r'<span class="det">(.*?)</span>', e, re.S)
                duree = re.search(r'<span class="duree">(.*?)</span>', e, re.S)
                lignes.append('%s. **%s** (%s) — %s' % (
                    _texte(num.group(1)) if num else '-',
                    _texte(lib.group(1)) if lib else '',
                    _texte(duree.group(1)) if duree else '',
                    _texte(det.group(1)) if det else ''))
            cartes.append('\n\n'.join(lignes))
            continue

        if inter:
            rom = re.search(r'<div class="rom">(.*?)</div>', bloc, re.S)
            h2 = re.search(r'<h2[^>]*>(.*?)</h2>', bloc, re.S)
            lignes.append('# %s' % _texte(h2.group(1)) if h2 else '# ?')
            if rom:
                lignes.append('*%s*' % _texte(rom.group(1)))
            for item in re.findall(r'<li[^>]*>(.*?)</li>', bloc, re.S):
                lignes.append('- %s' % _texte(item))
            cartes.append('\n\n'.join(lignes))
            continue

        titre = re.search(r'<h([12])[^>]*>(.*?)</h\1>', bloc, re.S)
        if titre:
            lignes.append('## %s' % _texte(titre.group(2)))
            bloc = bloc.replace(titre.group(0), '', 1)

        # Les cartes d'abord : elles portent l'essentiel et se prêtent bien à une liste.
        for c in re.findall(r'<div class="carte"[^>]*>(.*?)</div>\s*(?=<div|</div)',
                            bloc, re.S):
            ligne = _carte(c)
            if ligne:
                lignes.append(ligne)
        bloc = re.sub(r'<div class="carte"[^>]*>.*?</div>\s*(?=<div|</div)', '',
                      bloc, flags=re.S)

        for item in re.findall(r'<li[^>]*>(.*?)</li>', bloc, re.S):
            t = _texte(item)
            if t:
                lignes.append('- %s' % t)
        bloc = re.sub(r'<li[^>]*>.*?</li>', '', bloc, flags=re.S)

        for para in re.findall(r'<p[^>]*>(.*?)</p>', bloc, re.S):
            t = _texte(para)
            if t:
                lignes.append(t)
        bloc = re.sub(r'<p[^>]*>.*?</p>', '', bloc, flags=re.S)

        if '<img' in bloc:
            lignes.append("*(capture d'écran de l'application)*")

        # Ce qui reste hors des balises structurantes : chiffres, tableaux, encadrés.
        reste = _texte(re.sub(r'<img[^>]*>', '', bloc))
        if reste and reste not in ' '.join(lignes):
            lignes.append(reste)

        if lignes:
            cartes.append('\n\n'.join(lignes))
    return cartes


def main():
    cartes = extraire()
    md = '\n\n---\n\n'.join(cartes)
    io.open(CONTENU, 'w', encoding='utf-8', newline='\n').write(md + '\n')
    io.open(CONSIGNES, 'w', encoding='utf-8', newline='\n').write(TEXTE_CONSIGNES)

    print('  %d cartes, %d mots, %d caractères' % (len(cartes), len(md.split()), len(md)))
    print('  → %s' % CONTENU)
    print('  → %s' % CONSIGNES)
    # Gamma plafonne le collage : au-delà, il faut scinder en deux gammas.
    if len(md) > 400000:
        print("  ⚠ Très long : Gamma risque de tronquer. Scindez en deux.")
    print("""
  Marche à suivre dans Gamma :

    1. Create new  →  Paste in text
    2. Coller tout gamma-a-coller.md
    3. Choisir le mode « Preserve » — surtout pas « Generate », qui réécrirait
       le texte et inventerait des chiffres
    4. Coller gamma-consignes.txt dans le champ d'instructions, puis générer
    5. Export  →  PDF, à enregistrer en support-gamma.pdf

  Le code couleur passe par les consignes : Gamma l'approche sans le garantir.
  Pour un rendu exact, créer une fois un thème avec ces couleurs dans Gamma
  (Themes → New theme) et le sélectionner avant de générer.""")


if __name__ == '__main__':
    main()
