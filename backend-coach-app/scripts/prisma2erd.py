# -*- coding: utf-8 -*-
"""Produit un diagramme entité-relation Mermaid depuis le schéma Prisma.

Deux vues, parce qu'une seule ne peut pas servir les deux usages :
  - « coeur »  : les entités structurantes, lisibles sur une page de dossier ;
  - « complet »: les 32 tables, pour l'annexe.
"""
import io
import re
import sys

SRC = sys.argv[1]
VUE = sys.argv[2] if len(sys.argv) > 2 else 'coeur'
DST = sys.argv[3]

texte = io.open(SRC, encoding='utf-8').read()

enums = set(re.findall(r'^enum\s+(\w+)', texte, re.M))
modeles = {m.group(1): m.group(2)
           for m in re.finditer(r'^model\s+(\w+)\s*\{(.*?)^\}', texte, re.S | re.M)}

table_de = {}
for nom, corps in modeles.items():
    mm = re.search(r'@@map\("([^"]+)"\)', corps)
    table_de[nom] = mm.group(1) if mm else nom

# Entités structurantes : celles qui portent le métier du produit.
COEUR = [
    'User', 'CoachProfile', 'ClientProfile', 'ClientCoach',
    'Program', 'Session', 'Exercise', 'SetCompletion',
    'Appointment', 'Message', 'Notification',
    'DailyStat', 'Meal', 'Review', 'Gym', 'ExerciseReference',
]

retenus = COEUR if VUE == 'coeur' else list(modeles)

TYPES = {'String': 'string', 'Int': 'int', 'Float': 'float',
         'Boolean': 'bool', 'DateTime': 'datetime', 'Json': 'json'}

# Colonnes mises en avant par entité : identifiants, clés, et ce qui porte le sens.
INTERESSANTES = re.compile(
    r'^(id|email|role|name|title|date|startAt|endAt|status|category|'
    r'isPrimary|isActive|weight|reps|rpe|setNumber|type|content|rating|'
    r'city|level|goalCategory|sets|completed|isRead|source)$'
)

lignes = ['erDiagram']
relations = []

for nom in retenus:
    if nom not in modeles:
        continue
    corps = modeles[nom]
    table = table_de[nom]
    champs = []

    for brute in corps.splitlines():
        ligne = brute.split('//')[0].strip()
        if not ligne or ligne.startswith('@@'):
            continue
        p = ligne.split()
        if len(p) < 2:
            continue
        champ, typ = p[0], p[1]
        reste = ligne[ligne.index(typ) + len(typ):]
        base = typ.rstrip('[]?')

        if base in modeles:
            rel = re.search(r'fields:\s*\[([^\]]+)\]', reste)
            if rel and base in retenus:
                local = rel.group(1).strip()
                obligatoire = not typ.endswith('?')
                # ||--o{ : un vers plusieurs ; }o--|| lu dans l'autre sens
                card = '}o--||' if obligatoire else '}o--o|'
                relations.append('  %s %s %s : "%s"' % (table, card, table_de[base], local))
            continue

        if base not in TYPES and base not in enums:
            continue
        if not INTERESSANTES.match(champ):
            continue

        t = TYPES.get(base, base)
        marque = ''
        if '@id' in reste:
            marque = ' PK'
        elif '@unique' in reste:
            marque = ' UK'
        champs.append('    %s %s%s' % (t, champ, marque))

    lignes.append('  %s {' % table)
    lignes += champs[:9]          # au-delà, le diagramme devient illisible
    lignes.append('  }')

lignes += sorted(set(relations))

io.open(DST, 'w', encoding='utf-8', newline='\n').write('\n'.join(lignes))
print('%s : %d entités, %d relations' % (VUE, len([n for n in retenus if n in modeles]), len(set(relations))))
