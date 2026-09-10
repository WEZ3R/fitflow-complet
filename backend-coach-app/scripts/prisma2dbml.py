# -*- coding: utf-8 -*-
"""Génère un fichier DBML (dbdiagram.io) à partir du schéma Prisma.

Le schéma Prisma fait autorité : c'est lui qui produit la base réellement déployée.
Dériver le diagramme du schéma plutôt que l'inverse garantit qu'ils ne divergent pas.
"""
import io
import re
import sys

SRC = sys.argv[1] if len(sys.argv) > 1 else 'prisma/schema.prisma'
DST = sys.argv[2] if len(sys.argv) > 2 else 'modele-donnees.dbml'

texte = io.open(SRC, encoding='utf-8').read()

# ── Collecte des enums et des modèles ────────────────────────────────────────
enums = {}
for m in re.finditer(r'^enum\s+(\w+)\s*\{(.*?)^\}', texte, re.S | re.M):
    nom, corps = m.group(1), m.group(2)
    valeurs = [l.split('//')[0].strip() for l in corps.splitlines()]
    enums[nom] = [v for v in valeurs if v]

modeles = {}
for m in re.finditer(r'^model\s+(\w+)\s*\{(.*?)^\}', texte, re.S | re.M):
    modeles[m.group(1)] = m.group(2)

# nom Prisma → nom de table SQL
table_de = {}
for nom, corps in modeles.items():
    mm = re.search(r'@@map\("([^"]+)"\)', corps)
    table_de[nom] = mm.group(1) if mm else nom

TYPES = {
    'String': 'varchar', 'Int': 'int', 'Float': 'float',
    'Boolean': 'boolean', 'DateTime': 'timestamp', 'Json': 'json',
    'BigInt': 'bigint', 'Decimal': 'decimal', 'Bytes': 'bytes',
}

sortie = [
    "// FitFlow — modèle physique de données",
    "// Généré depuis prisma/schema.prisma : le schéma applicatif fait autorité.",
    "// Toute divergence entre ce diagramme et la base vient d'une régénération oubliée.",
    "",
    "// ============================================================",
    "// ÉNUMÉRATIONS",
    "// ============================================================",
    "",
]

for nom, valeurs in enums.items():
    sortie.append('Enum %s {' % nom)
    for v in valeurs:
        sortie.append('  %s' % v)
    sortie.append('}')
    sortie.append('')

sortie += [
    "// ============================================================",
    "// TABLES",
    "// ============================================================",
    "",
]

refs = []

for nom, corps in modeles.items():
    table = table_de[nom]
    lignes_table = []
    index_lignes = []

    for brute in corps.splitlines():
        ligne = brute.split('//')[0].strip()
        if not ligne or ligne.startswith('@@'):
            continue

        parties = ligne.split()
        if len(parties) < 2:
            continue
        champ, typ = parties[0], parties[1]
        reste = ligne[ligne.index(typ) + len(typ):]

        liste = typ.endswith('[]')
        base = typ.rstrip('[]?')
        optionnel = typ.endswith('?')

        # Relation vers un autre modèle : on en tire un Ref, pas une colonne.
        if base in modeles:
            rel = re.search(r'@relation\([^)]*fields:\s*\[([^\]]+)\][^)]*references:\s*\[([^\]]+)\]', reste)
            if rel:
                local = rel.group(1).strip()
                distant = rel.group(2).strip()
                cible = table_de[base]
                # > = plusieurs vers un ; - = un vers un
                fleche = '-' if re.search(r'@unique', corps.split(local)[0].splitlines()[-1] if local in corps else '') else '>'
                refs.append('Ref: %s.%s %s %s.%s' % (table, local, fleche, cible, distant))
            continue

        if base not in TYPES and base not in enums:
            continue

        dbml_type = TYPES.get(base, base)
        if liste:
            dbml_type += '[]'

        attributs = []
        if '@id' in reste:
            attributs.append('pk')
        if '@unique' in reste:
            attributs.append('unique')
        if not optionnel and not liste:
            attributs.append('not null')
        # @default(uuid()) contient des parenthèses imbriquées : on les équilibre
        # plutôt que de s'arrêter à la première fermante.
        i = reste.find('@default(')
        if i >= 0:
            profondeur, j = 0, i + len('@default(') - 1
            for j in range(i + len('@default(') - 1, len(reste)):
                if reste[j] == '(':
                    profondeur += 1
                elif reste[j] == ')':
                    profondeur -= 1
                    if profondeur == 0:
                        break
            v = reste[i + len('@default('):j]
            attributs.append("default: `%s`" % v)

        suffixe = ' [%s]' % ', '.join(attributs) if attributs else ''
        lignes_table.append('  %s %s%s' % (champ, dbml_type, suffixe))

    # index et contraintes composites
    for u in re.finditer(r'@@unique\(\[([^\]]+)\]\)', corps):
        index_lignes.append('    (%s) [unique]' % u.group(1).strip())
    for i in re.finditer(r'@@index\(\[([^\]]+)\]\)', corps):
        index_lignes.append('    (%s)' % i.group(1).strip())

    sortie.append('Table %s {' % table)
    sortie += lignes_table
    if index_lignes:
        sortie.append('')
        sortie.append('  indexes {')
        sortie += index_lignes
        sortie.append('  }')
    sortie.append('}')
    sortie.append('')

sortie += [
    "// ============================================================",
    "// RELATIONS",
    "// ============================================================",
    "",
]
sortie += sorted(set(refs))
sortie.append('')

io.open(DST, 'w', encoding='utf-8', newline='\n').write('\n'.join(sortie))
print('DBML généré : %d tables, %d énumérations, %d relations' % (len(modeles), len(enums), len(set(refs))))
