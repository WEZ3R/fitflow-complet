/**
 * Seed des exercices FitFlow — référentiel maison en français
 *
 * Groupes musculaires : Pectoraux, Dos, Épaules, Biceps, Triceps,
 *                       Quadriceps, Ischios/Fessiers, Mollets, Cardio,
 *                       Abdos/Gainage
 *
 * Usage : node prisma/seed-fitflow-exercises.js
 * Option : node prisma/seed-fitflow-exercises.js --reset  (vide la table avant)
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

if (!process.env.DATABASE_URL) {
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = process.env;
  process.env.DATABASE_URL = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
}

const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// Mapping groupe → bodyParts / targetMuscles / type
// ─────────────────────────────────────────────
const GROUP_META = {
  ff_pec: { bodyParts: ['CHEST'],       targetMuscles: ['Pectoraux'],        exerciseType: 'STRENGTH' },
  ff_dos: { bodyParts: ['BACK'],        targetMuscles: ['Dos'],              exerciseType: 'STRENGTH' },
  ff_epa: { bodyParts: ['SHOULDERS'],   targetMuscles: ['Épaules'],          exerciseType: 'STRENGTH' },
  ff_bic: { bodyParts: ['UPPER_ARMS'],  targetMuscles: ['Biceps'],           exerciseType: 'STRENGTH' },
  ff_tri: { bodyParts: ['UPPER_ARMS'],  targetMuscles: ['Triceps'],          exerciseType: 'STRENGTH' },
  ff_qua: { bodyParts: ['UPPER_LEGS'],  targetMuscles: ['Quadriceps'],       exerciseType: 'STRENGTH' },
  ff_isf: { bodyParts: ['UPPER_LEGS'],  targetMuscles: ['Ischios-Fessiers'], exerciseType: 'STRENGTH' },
  ff_mol: { bodyParts: ['LOWER_LEGS'],  targetMuscles: ['Mollets'],          exerciseType: 'STRENGTH' },
  ff_car: { bodyParts: ['CARDIO'],      targetMuscles: ['Cardio'],           exerciseType: 'CARDIO'   },
  ff_abd: { bodyParts: ['WAIST'],       targetMuscles: ['Abdominaux'],       exerciseType: 'STRENGTH' },
};

// ─────────────────────────────────────────────
// Données brutes
// Format : [id, nom, sous_muscles, matériel, description]
// ─────────────────────────────────────────────
const RAW = [

  // ══════════════════════════════════════════════
  //  PECTORAUX (52)
  // ══════════════════════════════════════════════
  ['ff_pec_01', 'DC Barre',                  'Moyen, Triceps, Deltoïde ant.',     'Barre, Banc plat',       'Allongé, pieds au sol. Descendre la barre au milieu de la poitrine. Pousser sans verrouiller les coudes.'],
  ['ff_pec_02', 'DI Barre',                  'Haut (claviculaire), Deltoïde ant.','Barre, Banc incliné',    'Banc à 30-45°. Descendre la barre sur le haut de la poitrine. Pousser verticalement.'],
  ['ff_pec_03', 'DD Barre',                  'Bas (abdominal), Triceps',          'Barre, Banc décliné',    'Banc décliné. Descendre la barre sur le bas des pectoraux. Pousser en gardant le buste stable.'],
  ['ff_pec_04', 'DC Haltères',               'Moyen, Stabilisateurs',             'Haltères',               'Descendre les haltères sur les côtés de la poitrine. Pousser en les rapprochant légèrement en haut.'],
  ['ff_pec_05', 'DI Haltères',               'Haut, Deltoïde ant.',               'Haltères',               'Banc incliné. Mouvement fluide, étirer le haut des pectoraux en bas, contracter fort en haut.'],
  ['ff_pec_06', 'DD Haltères',               'Bas, Triceps',                      'Haltères',               'Banc décliné. Permet une plus grande amplitude que la barre pour cibler le bas du pec.'],
  ['ff_pec_07', 'Écarté couché',             'Externe, Coraco-brachial',          'Haltères',               'Bras quasi tendus, ouvrir en arc de cercle. Sentir l\'étirement. Refermer sans entrechoquer.'],
  ['ff_pec_08', 'Écarté incliné',            'Haut/Externe',                      'Haltères',               'Même mouvement sur banc incliné. Focus sur l\'étirement de la partie supérieure.'],
  ['ff_pec_09', 'Pull-over',                 'Bas, Grand dentelé',                'Haltère',                'Allongé, descendre l\'haltère derrière la tête bras tendus. Remonter au niveau du front.'],
  ['ff_pec_10', 'Dips Pectoraux',            'Bas, Petit pectoral',               'Barres //',              'Pencher le buste en avant, écarter les coudes. Descendre bas et remonter puissamment.'],
  ['ff_pec_11', 'Pompes classiques',         'Global',                            'Poids de corps',         'Mains largeur d\'épaules. Corps droit. Poitrine frôle le sol.'],
  ['ff_pec_12', 'Pompes larges',             'Externe',                           'Poids de corps',         'Mains très écartées pour limiter l\'action des triceps et isoler les pectoraux.'],
  ['ff_pec_13', 'Pompes inclinées',          'Bas',                               'Banc',                   'Mains sur un banc. Cible la partie inférieure du grand pectoral.'],
  ['ff_pec_14', 'Pompes déclinées',          'Haut',                              'Support pieds',          'Pieds surélevés sur banc. Cible le haut des pectoraux et les épaules.'],
  ['ff_pec_15', 'Écarté poulie haute',       'Bas, Interne',                      'Poulies',                'Bras partent du haut et se rejoignent vers le bas. Contracter le bas des pecs.'],
  ['ff_pec_16', 'Écarté poulie basse',       'Haut, Interne',                     'Poulies',                'Bras partent du bas et se rejoignent au niveau du visage. Focus haut des pecs.'],
  ['ff_pec_17', 'Écarté vis-à-vis',          'Milieu, Interne',                   'Poulies',                'Poulies à hauteur d\'épaules. Croiser légèrement les mains en fin de mouvement.'],
  ['ff_pec_18', 'Chest Press assis',         'Global',                            'Machine',                'S\'asseoir, dos plaqué. Pousser les poignées. Idéal pour l\'échec musculaire sécurisé.'],
  ['ff_pec_19', 'Pec Deck',                  'Interne',                           'Machine',                'Coudes à 90°. Ramener les supports devant soi. Focus sur la contraction interne.'],
  ['ff_pec_20', 'DC Convergent',             'Milieu, Interne',                   'Machine',                'Trajectoire en arc de cercle qui rapproche les mains en fin de poussée.'],
  ['ff_pec_21', 'Pompes diamant',            'Interne, Triceps',                  'Poids de corps',         'Mains jointes (index/pouces formant un diamant). Focus triceps et milieu des pecs.'],
  ['ff_pec_22', 'Écarté unilatéral',         'Interne',                           'Machine/Poulie',         'Un seul bras à la fois. Permet une meilleure amplitude et connexion muscle-cerveau.'],
  ['ff_pec_23', 'DC prise serrée',           'Interne, Triceps',                  'Barre',                  'Mains espacées de 20cm. Coudes le long du corps. Focus triceps et sillon sternal.'],
  ['ff_pec_24', 'Pull-over Barre',           'Bas, Grand dorsal',                 'Barre',                  'Même mouvement que l\'haltère mais avec une barre EZ ou droite.'],
  ['ff_pec_25', 'DI Convergent',             'Haut',                              'Machine',                'Version machine pour le haut des pecs. Trajectoire sécurisée.'],
  ['ff_pec_26', 'Floor Press DB',            'Moyen, Triceps',                    'Haltères',               'Allongé au sol. Les coudes touchent le sol avant de remonter. Explose la force.'],
  ['ff_pec_27', 'Pompes claquées',           'Puissance',                         'Poids de corps',         'Pousser assez fort pour décoller les mains et claquer dans ses mains.'],
  ['ff_pec_28', 'Pompes Archer',             'Unilatéral',                        'Poids de corps',         'Descendre sur un bras pendant que l\'autre reste tendu sur le côté.'],
  ['ff_pec_29', 'Svend Press',               'Interne',                           'Disque',                 'Serrer un disque entre ses mains devant soi. Tendre les bras et revenir en serrant fort.'],
  ['ff_pec_30', 'DC Guillotine',             'Haut (étirement)',                  'Barre',                  'Barre descendue au niveau du cou (attention poids léger). Étirement maximal.'],
  ['ff_pec_31', 'Landmine Press',            'Haut, Interne',                     'Barre T',                'Barre dans un angle. Pousser la barre vers le haut et l\'avant d\'un bras ou deux.'],
  ['ff_pec_32', 'Écarté poulie 1 bras',      'Interne',                           'Poulie',                 'Debout, amener la poulie au-delà de la ligne médiane du corps.'],
  ['ff_pec_33', 'Pompes décl. serrées',      'Haut, Triceps',                     'Banc',                   'Pieds surélevés, mains serrées. Très difficile, focus haut pec/triceps.'],
  ['ff_pec_34', 'DC Smith Machine',          'Global',                            'Cadre guidé',            'Permet de se concentrer uniquement sur la poussée sans stabiliser la charge.'],
  ['ff_pec_35', 'DI Smith Machine',          'Haut',                              'Cadre guidé',            'Idéal pour travailler l\'explosivité sur le haut des pectoraux.'],
  ['ff_pec_36', 'Écarté anneaux',            'Profond',                           'Anneaux',                'Pompes ou écartés sur anneaux de gym. Demande une stabilité énorme.'],
  ['ff_pec_37', 'Pompes TRX',                'Stabilisateurs',                    'TRX',                    'Mains dans les sangles. L\'instabilité recrute les muscles profonds.'],
  ['ff_pec_38', 'Pompes Spiderman',          'Global, Abdos',                     'Poids de corps',         'Ramener un genou vers le coude pendant la descente en pompe.'],
  ['ff_pec_39', 'Incline Machine',           'Haut',                              'Machine',                'Machine spécifique avec angle de poussée vers le haut.'],
  ['ff_pec_40', 'Écarté DB décliné',         'Bas, Externe',                      'Haltères',               'Écartés classiques sur banc décliné. Cible le "V" du bas des pecs.'],
  ['ff_pec_41', 'Pompes Medball',            'Équilibre',                         'Ballon',                 'Une main sur le ballon, une au sol. Alterner à chaque répétition.'],
  ['ff_pec_42', 'DC Prise neutre',           'Triceps, Interne',                  'Haltères',               'Paumes face à face. Moins de stress sur les épaules.'],
  ['ff_pec_43', 'Pompes Hindu',              'Global, Souplesse',                 'Poids de corps',         'Mouvement de vague du corps, fesses en l\'air puis rasant le sol.'],
  ['ff_pec_44', 'Floor Press Barre',         'Moyen, Triceps',                    'Barre',                  'DC au sol avec barre. Amplitude réduite, focus sur la fin de poussée.'],
  ['ff_pec_45', 'Cable Crossover',           'Bas, Interne, Petit pectoral',      'Poulies hautes',         'Poulies hautes, bras tendus. Croiser les mains devant les hanches en pinçant les pecs. Tension constante.'],
  ['ff_pec_46', 'Cable Fly debout incliné',  'Haut, Interne, Deltoïde ant.',      'Poulies basses',         'Poulies basses, monter les bras en arc devant le visage. Cible la portion claviculaire.'],
  ['ff_pec_47', 'Cable Fly décliné',         'Bas, Externe, Grand pectoral',      'Poulies hautes',         'Buste légèrement penché en avant, descendre les mains vers les cuisses. Pic du "V" inférieur.'],
  ['ff_pec_48', 'Cable Press debout',        'Moyen, Triceps, Deltoïde ant.',     'Poulies milieu',         'Poulies à hauteur d\'épaules, pousser horizontalement. Travail fonctionnel des pecs.'],
  ['ff_pec_49', 'Cable Press incliné',       'Haut, Triceps, Deltoïde ant.',      'Poulies basses + banc', 'Banc incliné devant poulies basses, pousser vers le haut. Tension continue sur le haut des pecs.'],
  ['ff_pec_50', 'Cable Squeeze Press',       'Interne, Sillon sternal',           'Poulies milieu',         'Mains poignées qui se touchent, pousser devant en serrant les pecs. Focus sur la contraction.'],
  ['ff_pec_51', 'Cable Fly 1 bras décliné',  'Bas, Externe, Unilatéral',          'Poulie haute',           'Un bras à la fois, descendre la poignée en diagonale vers la hanche opposée.'],
  ['ff_pec_52', 'Cable Press unilatéral',    'Moyen, Stabilisateurs, Obliques',   'Poulie milieu',          'Un bras à la fois, debout dos à la poulie. Engage le core anti-rotation.'],

  // ══════════════════════════════════════════════
  //  DOS (42)
  // ══════════════════════════════════════════════
  ['ff_dos_01', 'Tractions (Pull-ups)',       'Grand dorsal, Grand rond',          'Barre fixe',             'Prise large pronation. Monter le menton au-dessus de la barre.'],
  ['ff_dos_02', 'Chin-ups',                  'Dorsaux, Biceps',                   'Barre fixe',             'Prise supination (paumes vers soi). Engage plus les biceps.'],
  ['ff_dos_03', 'Tirage vertical',           'Grand dorsal',                      'Poulie haute',           'Assis, tirer la barre à la poitrine en resserrant les omoplates.'],
  ['ff_dos_04', 'Tirage nuque',              'Haut du dos',                       'Poulie haute',           'Tirer la barre derrière la tête. Attention à la mobilité d\'épaule.'],
  ['ff_dos_05', 'Tirage prise serrée',       'Dorsaux (bas)',                     'Poulie, Triangle',       'Tirer le triangle au bas de la poitrine. Focus épaisseur.'],
  ['ff_dos_06', 'Rowing barre',              'Épaisseur global',                  'Barre',                  'Buste penché à 45°. Tirer la barre vers le nombril.'],
  ['ff_dos_07', 'Rowing haltère',            'Unilatéral, Dorsal',                'Haltère',                'Un genou sur banc. Tirer l\'haltère à la hanche (pas à l\'épaule).'],
  ['ff_dos_08', 'Rowing T-Bar',              'Trapèzes, Rhomboïdes',              'Barre T',                'Tirage entre les jambes. Focus milieu du dos (épaisseur).'],
  ['ff_dos_09', 'Tirage horizontal',         'Épaisseur, Trapèzes',               'Poulie basse',           'Assis, jambes calées. Tirer la poignée au ventre.'],
  ['ff_dos_10', 'Soulevé de terre',          'Global, Lombaires',                 'Barre',                  'Soulever la charge du sol. Dos droit, poussée des jambes.'],
  ['ff_dos_11', 'Rack Pull',                 'Trapèzes, Lombaires',               'Barre, Rack',            'SDT partiel partant des genoux. Focus haut du dos.'],
  ['ff_dos_12', 'Extensions banc 45°',       'Lombaires',                         'Banc',                   'Relever le buste jusqu\'à l\'alignement avec les jambes.'],
  ['ff_dos_13', 'Good Morning',              'Lombaires, Ischios',                'Barre',                  'Barre sur épaules, s\'incliner en avant dos droit, fesses en arrière.'],
  ['ff_dos_14', 'Shrugs barre',              'Trapèzes sup.',                     'Barre',                  'Hausser les épaules vers les oreilles. Ne pas rouler les épaules.'],
  ['ff_dos_15', 'Shrugs haltères',           'Trapèzes sup.',                     'Haltères',               'Plus de liberté de mouvement pour les trapèzes supérieurs.'],
  ['ff_dos_16', 'Facepull',                  'Trapèzes moy, Delto. post',         'Poulie, Corde',          'Tirer la corde vers le front en écartant les mains.'],
  ['ff_dos_17', 'Tirage bras tendus',        'Grand dorsal, Triceps',             'Poulie haute',           'Debout, tirer la barre aux cuisses sans plier les coudes.'],
  ['ff_dos_18', 'Rowing assis machine',      'Rhomboïdes',                        'Machine',                'Tirage horizontal assisté. Très stable.'],
  ['ff_dos_19', 'Pull-over poulie',          'Grand dorsal',                      'Poulie haute',           'Version poulie du pull-over. Tension continue.'],
  ['ff_dos_20', 'Rowing inversé',            'Dos global',                        'Barre / TRX',            'Allongé sous une barre, se tirer vers le haut (poids de corps).'],
  ['ff_dos_21', 'Superman',                  'Lombaires',                         'Poids de corps',         'Allongé sur le ventre, décoller bras et jambes simultanément.'],
  ['ff_dos_22', 'Hyperextensions sol',       'Lombaires',                         'Poids de corps',         'Mains derrière la tête, décoller le buste du sol.'],
  ['ff_dos_23', 'Rowing Yates',              'Trapèzes, Dorsaux',                 'Barre',                  'Buste moins penché (30°), prise supination. Focus épaisseur.'],
  ['ff_dos_24', 'Tirage unilatéral',         'Dorsal (isolation)',                'Poulie haute',           'Tirer une poignée d\'un seul bras pour étirement maximal.'],
  ['ff_dos_25', 'High Row Machine',          'Trapèzes, Dorsaux',                 'Machine',                'Tirage venant du haut vers l\'arrière. Focus largeur/épaisseur.'],
  ['ff_dos_26', 'Seal Row',                  'Milieu du dos',                     'Barre, Banc',            'Allongé face au banc, tirer la barre sans élan possible.'],
  ['ff_dos_27', 'Rowing haltères incliné',   'Rhomboïdes',                        'Haltères, Banc',         'Poitrine contre le banc incliné, tirer les haltères.'],
  ['ff_dos_28', 'Meadows Row',               'Grand dorsal',                      'Barre T',                'Rowing latéral à une main sur une barre en T.'],
  ['ff_dos_29', 'Renegade Row',              'Global, Gainage',                   'Haltères',               'Position pompe, tirer un haltère puis l\'autre en restant stable.'],
  ['ff_dos_30', 'Shrugs poulie basse',       'Trapèzes sup.',                     'Poulie basse',           'Tension constante sur les trapèzes.'],
  ['ff_dos_31', 'Tirage Archer',             'Dorsal, Delto post',                'Barre fixe',             'Monter en se tirant plus d\'un côté, bras opposé tendu.'],
  ['ff_dos_32', 'Kelso Shrugs',              'Trapèzes moy.',                     'Haltères',               'Buste penché, rétraction pure des omoplates.'],
  ['ff_dos_33', 'Rowing coudes ouverts',     'Trapèzes moy.',                     'Haltères',               'Tirer les coudes vers l\'extérieur (90°). Focus épaisseur haute.'],
  ['ff_dos_34', 'Tirage convergent',         'Largeur',                           'Machine',                'Machine mimant le tirage vertical mais avec mains convergentes.'],
  ['ff_dos_35', 'SDT Jambes tendues',        'Lombaires, Ischios',                'Barre',                  'Descendre la barre le long des jambes avec genoux quasi fixes.'],
  ['ff_dos_36', 'Rowing 1 bras poulie',      'Dorsal',                            'Poulie basse',           'Permet une rotation du buste pour finir la contraction.'],
  ['ff_dos_37', 'Lat Pulldown large',        'Grand dorsal (largeur)',            'Poulie haute',           'Prise très large pour focus sur le "V".'],
  ['ff_dos_38', 'Rowing assis 1 bras',       'Rhomboïdes',                        'Machine',                'Isolation du milieu du dos.'],
  ['ff_dos_39', 'Bird Dog',                  'Lombaires, Stabilisateurs',         'Poids de corps',         'À quatre pattes, tendre bras et jambe opposés.'],
  ['ff_dos_40', 'Tirage vertical TRX',       'Largeur',                           'TRX',                    'Se laisser pendre et se tirer vers le haut.'],
  ['ff_dos_41', 'Rowing vertical barre',     'Trapèzes sup, Épaules',             'Barre',                  'Tirer la barre au menton, coudes haut.'],
  ['ff_dos_42', 'Jefferson Curl',            'Mobilité vertébrale',               'Poids de corps',         'Enrouler le dos vertèbre par vertèbre vers le bas.'],

  // ══════════════════════════════════════════════
  //  ÉPAULES (47)
  // ══════════════════════════════════════════════
  ['ff_epa_01', 'Développé militaire',       'Antérieur, Latéral',                'Barre',                  'Debout, pousser la barre au-dessus de la tête. Gainage fort, ne pas cambrer.'],
  ['ff_epa_02', 'Développé haltères',        'Antérieur, Latéral',                'Haltères',               'Assis ou debout. Pousser les haltères vers le haut sans les entrechoquer.'],
  ['ff_epa_03', 'Développé Arnold',          'Antérieur (focus)',                 'Haltères',               'Rotation des poignets pendant la poussée. Sollicite fortement le faisceau avant.'],
  ['ff_epa_04', 'Élévations latérales',      'Latéral (moyen)',                   'Haltères',               'Bras légèrement fléchis, monter les mains à hauteur d\'épaules sur les côtés.'],
  ['ff_epa_05', 'Élévations frontales',      'Antérieur',                         'Haltères',               'Monter l\'haltère devant soi jusqu\'à l\'horizontale. Alterné ou simultané.'],
  ['ff_epa_06', 'Oiseau (Bent-over)',         'Postérieur',                        'Haltères',               'Buste penché à l\'horizontale, ouvrir les bras comme des ailes. Focus arrière épaule.'],
  ['ff_epa_07', 'Facepull épaules',          'Postérieur, Trapèzes',              'Poulie, Corde',          'Tirer la corde vers le visage en écartant les mains. Crucial pour la posture.'],
  ['ff_epa_08', 'Tirage menton',             'Latéral, Trapèzes',                 'Barre',                  'Tirer la barre le long du corps jusqu\'au menton, coudes pointant vers le haut.'],
  ['ff_epa_09', 'Latérales poulie',          'Latéral (isolation)',               'Poulie basse',           'Passer le câble derrière ou devant soi. Tension continue tout au long du mouvement.'],
  ['ff_epa_10', 'Frontales barre',           'Antérieur',                         'Barre',                  'Saisir la barre en pronation, la monter devant soi à hauteur d\'yeux.'],
  ['ff_epa_11', 'Shoulder Press machine',    'Antérieur, Latéral',                'Machine',                'Version guidée et sécurisée du développé pour travailler l\'explosivité.'],
  ['ff_epa_12', 'Reverse Pec Deck',          'Postérieur',                        'Machine',                'Assis face à la machine, écarter les bras vers l\'arrière. Isolation parfaite.'],
  ['ff_epa_13', 'Frontales disque',          'Antérieur',                         'Disque',                 'Tenir un disque comme un volant, le monter devant soi. Engage aussi le dentelé.'],
  ['ff_epa_14', 'Latérales machine',         'Latéral',                           'Machine',                'Coudes calés contre les supports. Supprime l\'aide des trapèzes.'],
  ['ff_epa_15', 'Tirage coudes ouverts',     'Postérieur',                        'Poulie haute',           'Tirage horizontal, mains hautes, coudes bien écartés. Cible l\'arrière d\'épaule.'],
  ['ff_epa_16', 'Rotations externes',        'Coiffe des rotateurs',              'Poulie / DB',            'Coude au corps à 90°, pivoter l\'avant-bras vers l\'extérieur. Santé de l\'épaule.'],
  ['ff_epa_17', 'Rotations internes',        'Coiffe des rotateurs',              'Poulie / DB',            'Coude au corps, pivoter l\'avant-bras vers le ventre contre la résistance.'],
  ['ff_epa_18', 'Développé nuque',           'Antérieur, Latéral',                'Barre',                  'Barre descendue derrière la tête. Demande une excellente mobilité.'],
  ['ff_epa_19', 'Oiseau assis',              'Postérieur',                        'Haltères',               'Assis, buste sur les genoux. Supprime toute triche avec le bas du dos.'],
  ['ff_epa_20', 'Bradford Press',            'Antérieur, Latéral',                'Barre',                  'Alterner un développé devant et un développé derrière la tête sans verrouiller.'],
  ['ff_epa_21', 'Landmine Press 1 bras',     'Antérieur',                         'Barre T',                'Pousser la barre dans un angle. Trajectoire diagonale douce pour l\'articulation.'],
  ['ff_epa_22', 'Pike Push-ups',             'Antérieur',                         'Poids de corps',         'Position pompe, fesses en l\'air. Descendre la tête vers le sol.'],
  ['ff_epa_23', 'Handstand Push-ups',        'Global (puissance)',                'Poids de corps',         'Pompes en équilibre contre un mur. Niveau expert.'],
  ['ff_epa_24', 'Latérales inclinées',       'Latéral (bas)',                     'Haltère, Banc',          'Allongé sur le côté sur banc incliné. Étirement maximal du deltoïde latéral.'],
  ['ff_epa_25', 'Frontales poulie',          'Antérieur',                         'Poulie basse',           'Dos à la poulie, poignée entre les jambes. Tension constante.'],
  ['ff_epa_26', 'Facepull assis',            'Postérieur',                        'Poulie basse',           'Version plus stable du facepull pour charger davantage.'],
  ['ff_epa_27', 'W-Press',                   'Latéral, Postérieur',               'Haltères',               'Partir haltères aux oreilles, pousser en formant un "W". Travaille la posture.'],
  ['ff_epa_28', 'Z-Press',                   'Antérieur, Gainage',                'Barre / DB',             'Développé assis au sol, jambes tendues. Force le dos à rester droit.'],
  ['ff_epa_29', 'Push Press',                'Antérieur',                         'Barre',                  'Développé militaire avec une légère impulsion des jambes (explosif).'],
  ['ff_epa_30', 'Latérales leaning',         'Latéral',                           'Haltère, Poteau',        'Se tenir à un poteau et s\'incliner vers l\'extérieur pour augmenter l\'amplitude.'],
  ['ff_epa_31', 'Cuban Press',               'Coiffe, Global',                    'Haltères',               'Tirage menton + rotation externe + développé. Complet pour la santé.'],
  ['ff_epa_32', 'Y-Raises',                  'Postérieur, Trap moy',              'Haltères / Banc',        'Allongé face au banc incliné, monter les bras en forme de "Y".'],
  ['ff_epa_33', 'Bus Driver',                'Antérieur, Rotation',               'Disque',                 'Tenir le disque bras tendus devant soi et tourner comme un volant.'],
  ['ff_epa_34', 'Lu Raises',                 'Latéral, Mobilité',                 'Haltères légers',        'Élévations latérales qui montent jusqu\'au-dessus de la tête (amplitude 180°).'],
  ['ff_epa_35', 'Clean and Press',           'Global (Puissance)',                'Barre / DB',             'Épaulé depuis le sol puis développé au-dessus de la tête.'],
  ['ff_epa_36', 'L-Fly haltère',             'Coiffe des rotateurs',              'Haltère',                'Allongé sur le côté ou assis, rotation externe de l\'épaule.'],
  ['ff_epa_37', 'Latérales 1 bras banc',     'Latéral',                           'Haltère, Banc',          'Buste incliné sur le côté pour isoler le faisceau moyen.'],
  ['ff_epa_38', 'Rowing menton poulie',      'Latéral, Trapèzes',                 'Poulie basse',           'Plus fluide que la barre, permet de mieux ajuster la trajectoire.'],
  ['ff_epa_39', 'Rear delt row barre',       'Postérieur',                        'Barre',                  'Rowing buste penché, mains larges, coudes vers l\'extérieur.'],
  ['ff_epa_40', 'High Pull DB',              'Latéral, Puissance',                'Haltère',                'Tirage explosif d\'un bras en montant le coude très haut.'],
  ['ff_epa_41', 'Scapular Shrugs',           'Stabilité',                         'Barre fixe',             'Suspendu, hausser le corps sans plier les bras (mouvement d\'omoplates).'],
  ['ff_epa_42', 'DC neutre épaules',         'Antérieur',                         'Haltères',               'Paumes face à face. Moins de frottements dans l\'articulation.'],
  ['ff_epa_43', 'Front raises TRX',          'Antérieur',                         'TRX',                    'Penché en arrière, monter les bras devant soi pour redresser le corps.'],
  ['ff_epa_44', 'T-Raises (sol)',            'Postérieur',                        'Poids de corps',         'Allongé ventre au sol, lever les bras en "T" pour renforcer l\'arrière d\'épaule.'],
  ['ff_epa_45', 'Reverse Fly poulie',        'Postérieur, Rhomboïdes, Trapèzes moy.','Poulies hautes',       'Poulies croisées, écarter les bras horizontalement. Isolation pure du deltoïde postérieur.'],
  ['ff_epa_46', 'Élévation Y poulie',        'Postérieur, Trapèzes inf.',         'Poulies basses',         'Poulies basses croisées, monter en "Y" au-dessus de la tête. Cible l\'arrière et le bas du trapèze.'],
  ['ff_epa_47', 'Latérale crossbody poulie', 'Latéral (étirement complet)',       'Poulie basse',           'Poulie de l\'autre côté, lever le bras de profil. Amplitude maximale grâce au croisement.'],

  // ══════════════════════════════════════════════
  //  BICEPS (44)
  // ══════════════════════════════════════════════
  ['ff_bic_01', 'Curl barre droite',         'Global, Courte portion',            'Barre',                  'Debout, mains largeur d\'épaules, monter la barre sans balancer le buste.'],
  ['ff_bic_02', 'Curl barre EZ',             'Global (confort poignets)',          'Barre EZ',               'La forme coudée réduit la tension sur les poignets. Travail global.'],
  ['ff_bic_03', 'Curl haltères alterné',     'Global, Longue portion',            'Haltères',               'Rotation du poignet (supination) pendant la montée.'],
  ['ff_bic_04', 'Curl incliné',              'Longue portion (étirement)',         'Haltères, Banc',         'Assis à 45°, bras ballants. Focus sur l\'étirement maximal.'],
  ['ff_bic_05', 'Curl pupitre (Preacher)',   'Courte portion (bas)',               'Barre EZ, Banc',         'Coudes calés sur le pupitre. Empêche toute triche.'],
  ['ff_bic_06', 'Curl marteau (Hammer)',     'Brachial, Supinateur',              'Haltères',               'Prise neutre (pouces vers le haut). Travaille l\'épaisseur du bras.'],
  ['ff_bic_07', 'Curl concentration',        'Courte portion (pic)',               'Haltère',                'Assis, coude calé contre l\'intérieur de la cuisse. Isolation pure.'],
  ['ff_bic_08', 'Curl poulie basse (barre)', 'Global',                            'Poulie',                 'Tension continue sur tout le mouvement grâce au câble.'],
  ['ff_bic_09', 'Curl poulie haute (Hercules)', 'Courte portion, Pic',            'Poulies',                'Bras en croix, ramener les poignées vers les oreilles.'],
  ['ff_bic_10', 'Curl inversé',              'Supinateur, Brachial',              'Barre',                  'Prise en pronation (paumes vers le bas). Focus avant-bras.'],
  ['ff_bic_11', 'Spider Curl',               'Courte portion',                    'Barre/DB, Banc',         'Poitrine contre le banc incliné, bras tombant devant. Pic de contraction.'],
  ['ff_bic_12', 'Drag Curl',                 'Longue portion',                    'Barre',                  'Monter la barre le long du corps en reculant les coudes.'],
  ['ff_bic_13', 'Curl Zottman',              'Global + Avant-bras',               'Haltères',               'Montée en supination, rotation, descente en pronation.'],
  ['ff_bic_14', 'Curl marteau corde',        'Brachial, Supinateur',              'Poulie basse',           'Utilisation de la corde pour une plus grande liberté de mouvement.'],
  ['ff_bic_15', 'Curl pupitre 1 bras',       'Courte portion',                    'Haltère',                'Isolation maximale d\'un bras sur banc Larry Scott.'],
  ['ff_bic_16', 'Curl incliné marteau',      'Brachial',                          'Haltères, Banc',         'Version marteau sur banc incliné pour l\'épaisseur.'],
  ['ff_bic_17', 'Curl barre EZ prise large', 'Courte portion (interne)',          'Barre EZ',               'Mains plus larges que les épaules pour cibler l\'intérieur.'],
  ['ff_bic_18', 'Curl barre EZ prise serrée','Longue portion (externe)',          'Barre EZ',               'Mains serrées pour cibler l\'extérieur du bras.'],
  ['ff_bic_19', 'Curl assis',                'Global',                            'Haltères',               'Supprime l\'élan des jambes. Focus sur la contraction.'],
  ['ff_bic_20', 'Curl pupitre machine',      'Global',                            'Machine',                'Trajectoire guidée idéale pour les séries longues/dropsets.'],
  ['ff_bic_21', 'Curl TRX',                  'Global',                            'TRX',                    'Se laisser pencher en arrière, ramener les mains au front.'],
  ['ff_bic_22', 'Curl 21',                   'Endurance, Global',                 'Barre',                  '7 reps bas, 7 reps haut, 7 reps complètes.'],
  ['ff_bic_23', 'Curl marteau alterné',      'Brachial',                          'Haltères',               'Un bras après l\'autre pour plus de lourdeur.'],
  ['ff_bic_24', 'Curl à la poulie 1 bras',   'Isolation',                         'Poulie basse',           'Permet de se placer légèrement devant la poulie pour l\'étirement.'],
  ['ff_bic_25', 'Curl inversé poulie',       'Supinateur',                        'Poulie basse',           'Version fluide du curl inversé barre.'],
  ['ff_bic_26', 'Waiter Curl',               'Courte portion (pic)',               'Haltère',                'Tenir l\'haltère par le disque, paumes vers le plafond.'],
  ['ff_bic_27', 'Curl incliné poulie',       'Longue portion',                    'Poulies',                'Dos à la poulie, bras en arrière. Tension maximale en étirement.'],
  ['ff_bic_28', 'Curl barre au front allongé','Courte portion',                   'Barre EZ',               'Allongé sur banc, ramener la barre au front (variante du spider).'],
  ['ff_bic_29', 'Curl à genoux',             'Global',                            'Haltères',               'Limite drastiquement la triche du bassin.'],
  ['ff_bic_30', 'Cheat Curl',                'Puissance',                         'Barre',                  'Utiliser un léger élan contrôlé pour charger plus lourd (expert).'],
  ['ff_bic_31', 'Curl sur banc horizontal',  'Isolation',                         'Haltères',               'Allongé face au sol sur banc plat, bras pendus.'],
  ['ff_bic_32', 'Curl marteau traversé',     'Brachial',                          'Haltères',               'Ramener l\'haltère vers l\'épaule opposée devant le buste.'],
  ['ff_bic_33', 'Curl pupitre inversé',      'Supinateur',                        'Barre EZ',               'Curl inversé sur pupitre Larry Scott. Brûlure garantie.'],
  ['ff_bic_34', 'Curl poignets (Flexion)',   'Avant-bras',                        'Barre/DB',               'Poser les bras sur un banc, fléchir les poignets vers le haut.'],
  ['ff_bic_35', 'Curl poignets inversé',     'Avant-bras (extens.)',               'Barre/DB',               'Extension des poignets vers le haut.'],
  ['ff_bic_36', 'Curl corde 1 bras',         'Brachial',                          'Poulie basse',           'Travail unilatéral avec rotation du poignet possible.'],
  ['ff_bic_37', 'Pinwheel Curl',             'Brachial',                          'Haltères',               'Curl marteau lourd avec trajectoire vers l\'intérieur.'],
  ['ff_bic_38', 'Curl élastique',            'Global',                            'Élastique',              'Résistance progressive (plus dur en haut du mouvement).'],
  ['ff_bic_39', 'Curl haltère prise décentrée','Supinateur',                      'Haltère',                'Tenir l\'haltère vers l\'extérieur pour forcer la supination.'],
  ['ff_bic_40', 'Curl unilatéral poulie haute','Pic',                             'Poulie haute',           'Tirer la poignée vers la tempe, bras à l\'horizontale.'],
  ['ff_bic_41', 'Pompes biceps',             'Biceps (poids corps)',               'Poids de corps',         'Mains orientées vers l\'arrière, buste porté vers l\'avant.'],
  ['ff_bic_42', 'Tractions supination (Chin)','Biceps, Dorsaux',                  'Barre fixe',             'Prise serrée paumes vers soi. Très efficace pour la masse.'],
  ['ff_bic_43', 'Curl kettlebell',           'Global',                            'Kettlebell',             'La répartition du poids change la tension en haut du curl.'],
  ['ff_bic_44', 'Curl 1 bras pupitre machine','Isolation',                        'Machine',                'Travail unilatéral assisté par machine.'],

  // ══════════════════════════════════════════════
  //  TRICEPS (44)
  // ══════════════════════════════════════════════
  ['ff_tri_01', 'DC Prise serrée',           'Vaste ext/int',                     'Barre',                  'Allongé, mains écartées de 20cm. Descendre au bas des pecs.'],
  ['ff_tri_02', 'Dips barres parallèles',    'Global, Vaste ext.',                'Barres //',               'Rester bien vertical pour ne pas engager les pectoraux.'],
  ['ff_tri_03', 'Dips entre deux bancs',     'Global',                            'Bancs',                  'Pieds sur un banc, mains sur l\'autre. Descendre les fesses au sol.'],
  ['ff_tri_04', 'Barre au front (Skullcrusher)','Longue portion',                 'Barre EZ',               'Allongé, descendre la barre vers le front ou derrière la tête.'],
  ['ff_tri_05', 'Extension poulie haute (Barre)','Vaste ext/int',                 'Poulie haute',           'Pousser la barre vers le bas, coudes collés au buste.'],
  ['ff_tri_06', 'Extension poulie corde',    'Vaste externe',                     'Poulie haute',           'Écarter la corde en bas du mouvement pour contracter l\'externe.'],
  ['ff_tri_07', 'Extension au-dessus tête DB','Longue portion',                   'Haltère',                'Tenir un haltère à deux mains derrière la nuque, bras verticaux.'],
  ['ff_tri_08', 'Kickback haltère',          'Vaste externe',                     'Haltère',                'Buste penché, tendre le bras vers l\'arrière. Isolation pure.'],
  ['ff_tri_09', 'Extension poulie 1 bras',   'Isolation',                         'Poulie haute',           'Utiliser la poignée ou directement le câble.'],
  ['ff_tri_10', 'JM Press',                  'Global, Vaste ext.',                'Barre',                  'Mix entre DC serré et barre au front. Très efficace pour la force.'],
  ['ff_tri_11', 'Extension poulie corde (dos)','Longue portion',                  'Poulie haute',           'Dos à la poulie, tirer la corde vers l\'avant au-dessus du crâne.'],
  ['ff_tri_12', 'Tate Press',                'Vaste externe',                     'Haltères',               'Allongé, haltères se touchent sur la poitrine, pivot vers le haut.'],
  ['ff_tri_13', 'Kickback poulie',           'Vaste externe',                     'Poulie basse',           'Tension continue contrairement à la version haltère.'],
  ['ff_tri_14', 'Pompes diamant triceps',    'Global',                            'Poids de corps',         'Mains en triangle sous la poitrine. Très difficile pour les triceps.'],
  ['ff_tri_15', 'Extension barre EZ assis',  'Longue portion',                    'Barre EZ',               'Bras verticaux, descendre la barre derrière la nuque.'],
  ['ff_tri_16', 'Extension unilatérale haltère','Longue portion',                 'Haltère',                'Un bras à la verticale, descendre l\'haltère derrière l\'épaule.'],
  ['ff_tri_17', 'Triceps Press machine',     'Global',                            'Machine',                'S\'asseoir et pousser les leviers vers le bas.'],
  ['ff_tri_18', 'Extension barre droite sous','Vaste interne',                    'Poulie haute',           'Tirage en supination (paumes vers le haut) vers le bas.'],
  ['ff_tri_19', 'Floor Press serré',         'Vaste externe',                     'Barre',                  'DC serré au sol. Amplitude réduite pour focus triceps.'],
  ['ff_tri_20', 'Extension haltères allongé','Longue portion',                    'Haltères',               'Barre au front version haltères pour plus d\'amplitude.'],
  ['ff_tri_21', 'Extension incliné barre EZ','Longue portion ++',                 'Barre EZ',               'Allongé sur banc incliné à 30°, descendre la barre derrière la tête.'],
  ['ff_tri_22', 'Dips machine',              'Global',                            'Machine',                'Dips assis, permet de charger très lourd en sécurité.'],
  ['ff_tri_23', 'Extension poulie basse (dos)','Longue portion',                  'Poulie basse',           'Tirer le câble derrière la tête en étant debout dos à la machine.'],
  ['ff_tri_24', 'California Press',          'Global',                            'Barre',                  'Variante du JM Press, hybride poussée/extension.'],
  ['ff_tri_25', 'Extension TRX',             'Global',                            'TRX',                    'Mains dans les sangles, descendre le front vers les mains.'],
  ['ff_tri_26', 'Pompes mains surélevées',   'Vaste ext/int',                     'Support',                'Mains sur un banc, corps incliné. Focus triceps.'],
  ['ff_tri_27', 'Bench Dip lesté',           'Global',                            'Banc + Poids',           'Dips entre deux bancs avec un disque sur les cuisses.'],
  ['ff_tri_28', 'Extension 1 bras poulie lat','Vaste externe',                    'Poulie haute',           'Tirage latéral unilatéral pour l\'externe.'],
  ['ff_tri_29', 'Skullcrusher décliné',      'Longue portion',                    'Barre EZ',               'Accentue l\'étirement grâce à l\'angle décliné.'],
  ['ff_tri_30', 'Extension haltère au sol',  'Isolation',                         'Haltère',                'Allongé au sol, extension 1 bras (Dead Stop).'],
  ['ff_tri_31', 'Close grip Smith Machine',  'Global',                            'Cadre guidé',            'DC serré sécurisé pour travailler l\'explosivité.'],
  ['ff_tri_32', 'Katana Extension',          'Longue portion',                    'Poulie',                 'Extension croisée derrière la tête (unilatérale ou bilatérale).'],
  ['ff_tri_33', 'Extension corde unilatérale','Vaste externe',                    'Poulie haute',           'Meilleure contraction finale du vaste externe.'],
  ['ff_tri_34', 'Bodyweight Skullcrusher',   'Global',                            'Barre basse',            'Mains sur une barre fixe basse, descendre la tête sous la barre.'],
  ['ff_tri_35', 'Extension coudes ouverts',  'Vaste interne',                     'Poulie haute',           'Pousser vers le bas avec coudes vers l\'extérieur.'],
  ['ff_tri_36', 'Extension élastique',       'Global',                            'Élastique',              'Fixé en haut, extension vers le bas.'],
  ['ff_tri_37', 'Tiger Bend Push-ups',       'Global (expert)',                   'Poids de corps',         'Passer de la position planche sur avant-bras à bras tendus.'],
  ['ff_tri_38', 'Extension haltère prise neutre','Vaste externe',                 'Haltère',                'Allongé, extension avec paume face au visage.'],
  ['ff_tri_39', 'Board Press (DC serré)',     'Puissance',                         'Barre + Cale',           'DC serré avec une cale sur la poitrine pour réduire l\'amplitude.'],
  ['ff_tri_40', 'Extension poulie haute V-Bar','Global',                          'Poulie, V-Bar',          'La barre en V offre une prise intermédiaire idéale.'],
  ['ff_tri_41', 'Reverse Grip Smith Machine','Vaste interne',                     'Cadre guidé',            'DC prise inversée guidée. Très ciblé triceps.'],
  ['ff_tri_42', 'Extension medball',         'Puissance',                         'Ballon lesté',           'Lancer de medball au-dessus de la tête ou contre un mur.'],
  ['ff_tri_43', 'Dips anneaux',              'Stabilisateurs',                    'Anneaux',                'Version la plus instable et difficile des dips.'],
  ['ff_tri_44', 'Kickback 2 bras simultanés','Vaste externe',                     'Haltères',               'Buste penché, extension des deux bras en même temps.'],

  // ══════════════════════════════════════════════
  //  QUADRICEPS (47)
  // ══════════════════════════════════════════════
  ['ff_qua_01', 'Squat Barre Haute',         'Global, Quads',                     'Barre',                  'Barre posée sur les trapèzes. Descente profonde, buste le plus vertical possible.'],
  ['ff_qua_02', 'Squat Barre Basse',         'Global, Chaîne post.',              'Barre',                  'Barre sur les deltoïdes postérieurs. Permet de charger plus lourd.'],
  ['ff_qua_03', 'Front Squat',               'Quads, Gainage',                    'Barre',                  'Barre sur l\'avant des épaules. Focus maximal sur les quadriceps.'],
  ['ff_qua_04', 'Leg Press (Presse)',         'Quads, Vaste interne',              'Machine',                'Pieds bas sur la plateforme pour isoler les quadriceps.'],
  ['ff_qua_05', 'Leg Extension',             'Quads (isolation)',                  'Machine',                'Assis, tendre les jambes. Seul exercice qui isole le droit fémoral.'],
  ['ff_qua_06', 'Hack Squat',                'Quads, Vaste externe',              'Machine',                'Dos calé sur la machine. Pieds bas. Très efficace pour la masse.'],
  ['ff_qua_07', 'Fentes marchées',           'Quads, Fessiers',                   'Haltères/Barre',         'Faire des pas en avant en fléchissant le genou à 90°.'],
  ['ff_qua_08', 'Fentes arrière quads',      'Quads, Équilibre',                  'Haltères',               'Faire un pas en arrière. Plus doux pour les genoux que les fentes avant.'],
  ['ff_qua_09', 'Squat Bulgare',             'Quads, Fessiers',                   'Haltère, Banc',          'Un pied surélevé sur le banc derrière. Focus jambe avant.'],
  ['ff_qua_10', 'Sissy Squat',               'Vaste interne, Droit fém.',         'Poids de corps',         'S\'incliner en arrière en pliant les genoux. Étirement extrême.'],
  ['ff_qua_11', 'Goblet Squat',              'Quads, Gainage',                    'Haltère/KB',             'Tenir un poids contre la poitrine. Idéal pour apprendre la technique.'],
  ['ff_qua_12', 'Step-up quads',             'Quads, Fessiers',                   'Banc, Haltères',         'Monter sur un banc d\'une seule jambe. Explosion.'],
  ['ff_qua_13', 'Belt Squat',                'Quads (sans dos)',                  'Machine / Ceinture',     'Charge suspendue à la taille. Supprime la pression sur les vertèbres.'],
  ['ff_qua_14', 'Smith Machine Squat',       'Quads',                             'Cadre guidé',            'Pieds légèrement avancés pour isoler les quadriceps.'],
  ['ff_qua_15', 'Squat Cycliste',            'Vaste interne',                     'Haltère, Cale',          'Talons surélevés sur une cale, pieds serrés. Focus "goutte d\'eau".'],
  ['ff_qua_16', 'Presse incliné 45°',        'Quads (global)',                    'Machine',                'Position classique pour la force pure des jambes.'],
  ['ff_qua_17', 'Presse horizontale',        'Quads',                             'Machine',                'Idéal pour les séries longues et la brûlure musculaire.'],
  ['ff_qua_18', 'Presse unilatérale',        'Quads (isolation)',                 'Machine',                'Une jambe à la fois pour corriger les déséquilibres.'],
  ['ff_qua_19', 'Squat Sumo DB',             'Quads (interne), Adducteurs',       'Haltère',                'Pieds larges, pointes vers l\'extérieur. Focus adducteurs.'],
  ['ff_qua_20', 'Pistol Squat',              'Quads, Équilibre',                  'Poids de corps',         'Squat sur une seule jambe, l\'autre tendue devant. Expert.'],
  ['ff_qua_21', 'Fentes latérales',          'Quads, Adducteurs',                 'Haltères',               'Pas sur le côté, jambe tendue d\'un côté, pliée de l\'autre.'],
  ['ff_qua_22', 'Squat Pendulum',            'Quads (amplitude)',                 'Machine',                'Trajectoire en arc de cercle. Étirement massif.'],
  ['ff_qua_23', 'Zercher Squat',             'Quads, Gainage',                    'Barre',                  'Barre tenue dans le creux des coudes. Très rude, gainage d\'acier.'],
  ['ff_qua_24', 'Squat aux élastiques',      'Quads (puissance)',                 'Élastiques',             'Résistance qui augmente au fur et à mesure de la montée.'],
  ['ff_qua_25', 'Squat sauté (Jump)',        'Puissance',                         'Poids de corps',         'Squat explosif avec saut vertical.'],
  ['ff_qua_26', 'Box Squat',                 'Quads, Force',                      'Barre, Box',             'S\'asseoir brièvement sur une caisse avant de remonter.'],
  ['ff_qua_27', 'Landmine Squat',            'Quads',                             'Barre T',                'Tenir l\'extrémité de la barre. Trajectoire sécurisante.'],
  ['ff_qua_28', 'Fentes bulgares DB',        'Quads',                             'Haltères',               'Version classique avec haltères pour plus de stabilité que la barre.'],
  ['ff_qua_29', 'Step-up latéral',           'Quads, Moyen fessier',              'Banc',                   'Monter sur le banc par le côté.'],
  ['ff_qua_30', 'Jefferson Squat',           'Quads, Adducteurs',                 'Barre',                  'Barre entre les jambes, buste de profil. Vieux mouvement de force.'],
  ['ff_qua_31', 'Squat Anderson',            'Force pure',                        'Barre, Rack',            'Partir de la position basse (barre posée sur les sécurités).'],
  ['ff_qua_32', 'Leg extension 1 jambe',     'Vaste interne',                     'Machine',                'Focus sur la finition du muscle goutte d\'eau.'],
  ['ff_qua_33', 'Hack Squat inversé',        'Quads, Fessiers',                   'Machine',                'Face à la machine. Permet une flexion de hanche différente.'],
  ['ff_qua_34', 'Squat avec pause',          'Quads',                             'Barre',                  'Bloquer 2 secondes en bas du squat pour supprimer l\'élan.'],
  ['ff_qua_35', 'Wall Sit (Chaise)',          'Isométrie',                         'Mur',                    'Adossé au mur, jambes à 90°. Tenir le plus longtemps possible.'],
  ['ff_qua_36', 'Fentes croisées (Curtsy)',  'Quads, Fessiers',                   'Poids de corps',         'Croiser la jambe arrière derrière la jambe avant.'],
  ['ff_qua_37', 'Squat sur plateforme vibrante','Recrutement fibre',              'Machine',                'Squat statique ou dynamique sur Power Plate.'],
  ['ff_qua_38', 'Overhead Squat',            'Quads, Mobilité',                   'Barre',                  'Barre bras tendus au-dessus de la tête. Demande une mobilité énorme.'],
  ['ff_qua_39', 'Squat à la poulie basse',   'Quads',                             'Poulie',                 'Face à la poulie, tenir la barre et descendre en arrière.'],
  ['ff_qua_40', 'Fentes avec déficit',       'Quads (étirement)',                 'Step, Haltères',         'Pied avant surélevé pour descendre plus bas que le sol.'],
  ['ff_qua_41', 'Squat Kang',                'Quads, Ischios',                    'Barre',                  'Mix entre Good Morning et Squat. Technique complexe.'],
  ['ff_qua_42', 'Squat Cossack',             'Quads, Souplesse',                  'KB / DB',                'Fente latérale profonde avec pointe de pied opposée vers le haut.'],
  ['ff_qua_43', 'Presse à cuisse verticale', 'Quads',                             'Machine',                'Pousser la charge vers le plafond. Rare mais efficace.'],
  ['ff_qua_44', 'Squat 1/4 (Lockout)',       'Force maximale',                    'Barre',                  'Ne faire que le quart supérieur du mouvement pour habituer le corps au lourd.'],
  ['ff_qua_45', 'Fente arrière poulie',      'Quads, Fessiers, Stabilité',        'Poulie basse',           'Tenir la poignée devant soi, reculer une jambe en fente. Tension continue sur le quadriceps avant.'],
  ['ff_qua_46', 'Step-up poulie',            'Quads, Fessiers',                   'Poulie basse + caisse',  'Tenir la poignée, monter sur le step en poussant sur la jambe avant. Cible fortement le vaste interne.'],
  ['ff_qua_47', 'Cable Sissy Squat',         'Vaste interne, Droit fémoral',      'Poulie basse',           'Genoux qui dépassent loin devant, buste vers l\'arrière. Isolation extrême du quadriceps.'],

  // ══════════════════════════════════════════════
  //  ISCHIOS / FESSIERS (48)
  // ══════════════════════════════════════════════
  ['ff_isf_01', 'Soulevé de terre Roumain',  'Ischios, Fessiers',                 'Barre',                  'Jambes quasi tendues, descendre la barre en poussant les fesses en arrière.'],
  ['ff_isf_02', 'Leg Curl allongé',          'Ischios (global)',                  'Machine',                'Allongé sur le ventre, ramener les talons aux fesses.'],
  ['ff_isf_03', 'Leg Curl assis',            'Ischios (étirement)',               'Machine',                'Position assise, permet un meilleur étirement des ischios en haut.'],
  ['ff_isf_04', 'Hip Thrust',                'Grand fessier',                     'Barre, Banc',            'Dos contre le banc, barre sur les hanches, monter le bassin au plafond.'],
  ['ff_isf_05', 'SDT jambes tendues',        'Ischios (bas)',                     'Barre',                  'Similaire au Roumain mais avec une amplitude plus basse (dos très souple requis).'],
  ['ff_isf_06', 'Glute Ham Raise',           'Ischios, Fessiers',                 'Machine GHD',            'Relever le buste à la force des ischios. Très intense.'],
  ['ff_isf_07', 'Kickback poulie fessiers',  'Grand fessier',                     'Poulie basse',           'Envoyer la jambe vers l\'arrière en contractant la fesse.'],
  ['ff_isf_08', 'Abduction machine',         'Moyen fessier',                     'Machine',                'Écarter les jambes contre la résistance. Galbe le côté des fesses.'],
  ['ff_isf_09', 'Fentes arrière fessiers',   'Fessiers',                          'Haltères',               'Faire un grand pas en arrière et pencher légèrement le buste en avant.'],
  ['ff_isf_10', 'Leg Curl debout',           'Ischios (unilatéral)',              'Machine',                'Isolation d\'une jambe à la fois pour équilibrer la force.'],
  ['ff_isf_11', 'SDT Sumo',                  'Fessiers, Adducteurs',              'Barre',                  'Pieds très larges. Trajectoire courte, focus fessiers et intérieur cuisses.'],
  ['ff_isf_12', 'Pull-through poulie',       'Fessiers, Ischios',                 'Poulie basse',           'Dos à la poulie, tirer la corde entre ses jambes en redressant le bassin.'],
  ['ff_isf_13', 'Glute Bridge',              'Grand fessier',                     'Sol, Disque',            'Hip thrust au sol. Amplitude réduite, focus contraction finale.'],
  ['ff_isf_14', 'Nordic Curl',               'Ischios (excentrique)',             'Sol / Support',          'À genoux, descendre le buste vers le sol en freinant avec les ischios.'],
  ['ff_isf_15', 'Good Morning Ischios',      'Ischios, Lombaires',                'Barre',                  'Focus sur l\'étirement des ischios sans plier les genoux.'],
  ['ff_isf_16', 'SDT Roumain Haltères',      'Ischios',                           'Haltères',               'Plus de liberté de mouvement et de trajectoire que la barre.'],
  ['ff_isf_17', 'Abduction poulie',          'Moyen fessier',                     'Poulie basse',           'Debout de profil à la poulie, écarter la jambe vers l\'extérieur.'],
  ['ff_isf_18', 'Clamshell',                 'Petit/Moyen fessier',               'Élastique',              'Allongé sur le côté, ouvrir le genou comme un coquillage.'],
  ['ff_isf_19', 'Step-up fessiers',          'Fessiers',                          'Banc haut',              'Utiliser un banc haut pour augmenter la flexion de hanche.'],
  ['ff_isf_20', 'Presse pieds hauts',        'Ischios, Fessiers',                 'Machine',                'Placer les pieds en haut de la plateforme pour engager l\'arrière.'],
  ['ff_isf_21', 'SDT Unilatéral',            'Ischios, Équilibre',                'Haltère',                'Descendre sur une jambe, l\'autre jambe part en arrière.'],
  ['ff_isf_22', 'Leg Curl Swiss Ball',       'Ischios',                           'Ballon',                 'Pieds sur le ballon, ramener le ballon vers soi en levant les fesses.'],
  ['ff_isf_23', 'Frog Pump',                 'Grand fessier',                     'Sol',                    'Hip bridge avec les plantes de pieds l\'une contre l\'autre.'],
  ['ff_isf_24', 'Fire Hydrant',              'Moyen fessier',                     'Poids de corps',         'À quatre pattes, lever la jambe sur le côté (comme un chien).'],
  ['ff_isf_25', 'Hip Thrust machine',        'Grand fessier',                     'Machine',                'Version guidée pour mettre très lourd sur les fessiers.'],
  ['ff_isf_26', 'Reverse Hyper',             'Lombaires, Fessiers',               'Machine',                'Allongé sur le ventre, balancer les jambes vers le haut.'],
  ['ff_isf_27', 'SDT Roumain unilatéral poulie','Ischios',                        'Poulie basse',           'Travail de stabilité et tension continue sur l\'ischio.'],
  ['ff_isf_28', 'Marche du monstre',         'Moyen fessier',                     'Élastique',              'Élastique aux chevilles, marcher en crabe.'],
  ['ff_isf_29', 'Leg Curl haltère',          'Ischios',                           'Haltère',                'Allongé, serrer un haltère entre les pieds et monter.'],
  ['ff_isf_30', 'Donkey Kick',               'Grand fessier',                     'Poids de corps',         'À quatre pattes, pousser le talon vers le plafond.'],
  ['ff_isf_31', 'Kettlebell Swing',          'Fessiers (puissance)',              'Kettlebell',             'Mouvement de balancier explosif des hanches.'],
  ['ff_isf_32', 'Squat Sumo fessiers',       'Fessiers',                          'KB / DB',                'Descente très profonde pour étirer les fessiers.'],
  ['ff_isf_33', 'Sliders Leg Curl',          'Ischios',                           'Disques glissants',      'Allongé, faire glisser les talons au sol.'],
  ['ff_isf_34', 'Abduction au sol',          'Moyen fessier',                     'Poids de corps',         'Allongé sur le côté, lever la jambe tendue.'],
  ['ff_isf_35', 'Hip Thrust unilatéral',     'Fessiers',                          'Sol / Banc',             'Une seule jambe travaille, l\'autre est levée.'],
  ['ff_isf_36', 'Crossover Kickback',        'Moyen/Grand fessier',               'Poulie',                 'Envoyer la jambe vers l\'arrière et l\'extérieur en diagonale.'],
  ['ff_isf_37', 'Step-down fessiers',        'Fessiers, Ischios',                 'Banc',                   'Descendre doucement d\'un banc sur une jambe.'],
  ['ff_isf_38', 'Broad Jump',                'Fessiers (explosivité)',            'Poids de corps',         'Sauter le plus loin possible vers l\'avant.'],
  ['ff_isf_39', 'Jefferson Deadlift',        'Ischios, Fessiers',                 'Barre',                  'Version SDT du Jefferson Squat.'],
  ['ff_isf_40', 'Curtsy Lunge lesté',        'Fessiers',                          'Haltères',               'Fente croisée avec poids pour accentuer le galbe latéral.'],
  ['ff_isf_41', 'Leg Curl TRX',              'Ischios',                           'TRX',                    'Talons dans les sangles, ramener vers soi.'],
  ['ff_isf_42', 'GHD Sit-ups',               'Chaîne ant/post',                   'Machine GHD',            'Relevé de buste complet. Travaille la force globale.'],
  ['ff_isf_43', 'Hyperextension focus fessiers','Fessiers',                       'Banc 45°',               'Dos arrondi, pousser le bassin dans le boudin.'],
  ['ff_isf_44', 'Sprint (Démarrage)',         'Fessiers, Ischios',                 'Poids de corps',         'L\'accélération courte est l\'exercice le plus complet pour l\'arrière.'],
  ['ff_isf_45', 'Hip Thrust poulie',          'Grand fessier, Ischios',            'Poulie basse + banc',    'Dos appuyé sur le banc, sangle de la poulie autour des hanches. Tension constante au verrouillage.'],
  ['ff_isf_46', 'SDT roumain poulie',         'Ischios, Fessiers, Lombaires',      'Poulie basse + barre',   'Barre à la poulie basse, dos plat, charnière de hanche. Tension continue sur l\'allongement.'],
  ['ff_isf_47', 'Abduction assise poulie',    'Moyen fessier, Petit fessier',      'Poulie basse + banc',    'Assis sur banc, sangle à la cheville. Écarter la jambe latéralement. Isolation pure du moyen fessier.'],
  ['ff_isf_48', 'Reverse Hyper poulie',       'Fessiers, Ischios, Lombaires',      'Poulie basse',           'Penché à 90° tenu à la poulie, monter une jambe tendue derrière soi. Faible impact sur la colonne.'],

  // ══════════════════════════════════════════════
  //  MOLLETS (18)
  // ══════════════════════════════════════════════
  ['ff_mol_01', 'Mollets debout barre',      'Jumeaux (Gastrocnémiens)',          'Barre',                  'Debout, pointes de pieds sur une cale, monter le plus haut possible.'],
  ['ff_mol_02', 'Mollets debout haltères',   'Jumeaux',                           'Haltères',               'Tenir les haltères sur les côtés, monter sur les pointes.'],
  ['ff_mol_03', 'Mollets assis machine',     'Soléaire',                          'Machine',                'Assis, genoux fléchis. Indispensable pour l\'épaisseur du mollet.'],
  ['ff_mol_04', 'Mollets à la presse',       'Jumeaux',                           'Leg Press',              'Pousser la plateforme uniquement avec la pointe des pieds.'],
  ['ff_mol_05', 'Donkey Calf Raises',        'Jumeaux',                           'Machine / Partenaire',   'Buste penché à 90°, monter sur les pointes. Étirement maximal.'],
  ['ff_mol_06', 'Mollets debout machine',    'Jumeaux',                           'Machine',                'Version guidée pour mettre très lourd en sécurité.'],
  ['ff_mol_07', 'Mollets unilatéral',        'Jumeaux',                           'Poids de corps',         'Une seule jambe à la fois sur une marche. Focus sur la contraction.'],
  ['ff_mol_08', 'Mollets assis barre',       'Soléaire',                          'Barre, Banc',            'Assis, barre posée sur le bas des cuisses (avec protection).'],
  ['ff_mol_09', 'Mollets Smith Machine',     'Jumeaux',                           'Cadre guidé',            'Permet un équilibre parfait pour se concentrer sur la poussée.'],
  ['ff_mol_10', 'Tibialis Raises',           'Jambier antérieur',                 'Mur / Poids',            'Adossé au mur, lever les pointes de pieds. Prévient les blessures.'],
  ['ff_mol_11', 'Mollets Hack Squat',        'Jumeaux',                           'Machine',                'Dos contre la machine, monter sur la pointe des pieds.'],
  ['ff_mol_12', 'Marche sur les pointes',    'Global',                            'Haltères lourds',        'Marcher sur les pointes (Farmer\'s Walk) sur une distance donnée.'],
  ['ff_mol_13', 'Saut à la corde mollets',   'Global (Explosivité)',              'Corde à sauter',         'Excellent pour la tonicité et le recrutement des fibres rapides.'],
  ['ff_mol_14', 'Mollets unilatéral DB',     'Jumeaux',                           'Haltère',                'Un haltère dans une main (même côté que la jambe travaillée).'],
  ['ff_mol_15', 'Toe Press (Poulie basse)',  'Jumeaux',                           'Poulie basse',           'Assis au sol, tirer la poignée avec les pointes de pieds.'],
  ['ff_mol_16', 'Mollets debout poulie',     'Jumeaux, Soléaire',                 'Poulie basse + barre',   'Barre à la poulie basse, sur les épaules. Monter sur la pointe des pieds. Permet de charger sans machine dédiée.'],
  ['ff_mol_17', 'Mollets assis poulie',      'Soléaire',                          'Poulie basse + banc',    'Assis sur banc, sangle sous le genou. Pousser les pointes vers le bas. Cible le soléaire profond.'],
  ['ff_mol_18', 'Donkey Calf poulie',        'Jumeaux',                           'Poulie basse',           'Penché en avant 90°, sangle sur les hanches. Étirement maximal en bas grâce à la position penchée.'],

  // ══════════════════════════════════════════════
  //  CARDIO (25)
  // ══════════════════════════════════════════════
  ['ff_car_01', 'Burpees',                   'HIIT / Global',                     'Poids de corps',         'Enchaîner une pompe, un regroupement de jambes et un saut vertical.'],
  ['ff_car_02', 'Jumping Jacks',             'Échauffement',                      'Poids de corps',         'Sauter en écartant simultanément les bras et les jambes.'],
  ['ff_car_03', 'Mountain Climbers',         'HIIT / Abdos',                      'Poids de corps',         'En planche, ramener les genoux à la poitrine le plus vite possible.'],
  ['ff_car_04', 'Corde à sauter',            'Coordination',                      'Corde',                  'Sauter avec une rotation rapide des poignets. Travaille le souffle.'],
  ['ff_car_05', 'Rameur',                    'Endurance / Dos',                   'Machine',                'Tirage coordonné jambes-dos-bras. Très complet (85% des muscles).'],
  ['ff_car_06', 'Course sur tapis',          'LISS / HIIT',                       'Tapis roulant',          'Marche rapide, course de fond ou sprints fractionnés.'],
  ['ff_car_07', 'Vélo Assault (Air Bike)',   'HIIT (Extrême)',                    'Machine',                'Pédaler en poussant/tirant les poignées. Résistance à l\'air.'],
  ['ff_car_08', 'Battle Ropes',              'Puissance / Bras',                  'Cordes',                 'Créer des ondulations avec des cordes lourdes. Brûle énormément.'],
  ['ff_car_09', 'Box Jumps',                 'Puissance',                         'Caisse (Box)',           'Sauter à pieds joints sur une caisse et redescendre.'],
  ['ff_car_10', 'Skierg',                    'Endurance / Dos',                   'Machine',                'Simuler le mouvement du ski de fond (tirage vers le bas).'],
  ['ff_car_11', 'Stairmaster',               'LISS (Fessiers)',                   'Machine',                'Monter des marches d\'escalier en continu. Radical pour les jambes.'],
  ['ff_car_12', 'Sled Push',                 'Puissance',                         'Chariot lesté',          'Pousser une charge lourde sur une surface glissante.'],
  ['ff_car_13', 'Sled Pull',                 'Force / Cardio',                    'Chariot + Corde',        'Tirer la charge vers soi à l\'aide d\'une corde.'],
  ['ff_car_14', 'Kettlebell Swings cardio',  'Puissance / HIIT',                  'Kettlebell',             'Balancer le poids entre les jambes jusqu\'à hauteur d\'épaules.'],
  ['ff_car_15', 'Thrusters',                 'HIIT / Global',                     'Barre / DB',             'Combiner un front squat et un développé militaire fluide.'],
  ['ff_car_16', 'Skaters',                   'Agilité',                           'Poids de corps',         'Sauter d\'un pied sur l\'autre latéralement comme un patineur.'],
  ['ff_car_17', 'High Knees',                'HIIT',                              'Poids de corps',         'Courir sur place en montant les genoux très haut.'],
  ['ff_car_18', 'Butt Kicks',                'Échauffement',                      'Poids de corps',         'Courir sur place en frappant les fessiers avec les talons.'],
  ['ff_car_19', 'Vélo Elliptique',           'LISS (Zéro impact)',                'Machine',                'Mouvement fluide sans impact pour les articulations.'],
  ['ff_car_20', 'Sprawls',                   'HIIT / Lutte',                      'Poids de corps',         'Simuler une défense de lutte : poser les mains, projeter les jambes.'],
  ['ff_car_21', 'Shadow Boxing',             'Coordination',                      'Poids de corps',         'Boxer dans le vide avec des déplacements constants.'],
  ['ff_car_22', 'Bear Crawl',                'Global',                            'Poids de corps',         'Se déplacer à quatre pattes, genoux frôlant le sol.'],
  ['ff_car_23', 'Goblet Squat Jumps',        'Puissance',                         'KB / DB',                'Squat avec charge suivi d\'un saut explosif.'],
  ['ff_car_24', 'Vélo RPM',                  'Endurance',                         'Vélo de biking',         'Pédalage à haute intensité avec réglage de résistance.'],
  ['ff_car_25', 'Slams Ball',                'Puissance',                         'Medball',                'Lever un ballon lesté au-dessus de la tête et le fracasser au sol.'],

  // ══════════════════════════════════════════════
  //  ABDOS / GAINAGE (49)
  // ══════════════════════════════════════════════
  ['ff_abd_01', 'Crunch classique',          'Grand droit (haut)',                 'Sol',                    'Allongé, genoux pliés, décoller les épaules du sol en contractant les abdos.'],
  ['ff_abd_02', 'Sit-up',                    'Grand droit, Psoas',                'Sol',                    'Remonter le buste complet jusqu\'aux genoux.'],
  ['ff_abd_03', 'Relevé de jambes au sol',   'Grand droit (bas)',                  'Sol',                    'Allongé, monter les jambes tendues à la verticale puis descendre doucement.'],
  ['ff_abd_04', 'Gainage planche (Plank)',   'Transverse, Global',                'Poids de corps',         'En appui sur les avant-bras et pointes de pieds. Dos droit, ventre serré.'],
  ['ff_abd_05', 'Gainage latéral',           'Obliques, Transverse',              'Poids de corps',         'En appui sur un seul avant-bras, de profil. Maintenir l\'alignement.'],
  ['ff_abd_06', 'Roulette abdos (Ab Wheel)', 'Global (puissance)',                'Roulette',               'À genoux, faire rouler la roue devant soi le plus loin possible et revenir.'],
  ['ff_abd_07', 'Russian Twist',             'Obliques',                          'Poids de corps / DB',    'Assis, jambes décollées, pivoter le buste de gauche à droite.'],
  ['ff_abd_08', 'Dead Bug',                  'Transverse (profond)',               'Sol',                    'Allongé, bras et jambes levés, descendre bras/jambe opposés sans cambrer.'],
  ['ff_abd_09', 'Hollow Body Hold',          'Global, Transverse',                'Sol',                    'Dos plaqué, jambes et bras décollés de quelques cm. Position de "banane".'],
  ['ff_abd_10', 'Woodchopper poulie',        'Obliques, Dentelés',                'Poulie haute',           'Tirer le câble en diagonale du haut vers le bas avec rotation du buste.'],
  ['ff_abd_11', 'Mountain Climbers abdos',   'Global, Cardio',                    'Poids de corps',         'En position planche, ramener alternativement les genoux vers la poitrine.'],
  ['ff_abd_12', 'V-Ups (Portefeuille)',      'Grand droit (global)',              'Sol',                    'Relever simultanément le buste et les jambes pour former un "V".'],
  ['ff_abd_13', 'Ciseaux (Scissors)',        'Grand droit (bas)',                  'Sol',                    'Allongé, faire des battements de jambes verticaux rapides.'],
  ['ff_abd_14', 'Reverse Crunch',            'Grand droit (bas)',                  'Sol',                    'Ramener les genoux vers la poitrine en décollant le bassin.'],
  ['ff_abd_15', 'Relevé de jambes suspendu', 'Bas des abdos',                     'Barre fixe',             'Suspendu à la barre, monter les jambes tendues à l\'horizontale.'],
  ['ff_abd_16', 'Chaise romaine (Leg Raise)','Bas des abdos',                     'Machine',                'En appui sur les coudes, lever les jambes. Plus stable que la barre.'],
  ['ff_abd_17', 'Bicycle Crunch',            'Obliques, Grand droit',             'Sol',                    'Ramener le coude vers le genou opposé en alternant rapidement.'],
  ['ff_abd_18', 'Plank Shoulder Tap',        'Transverse, Stabilité',             'Poids de corps',         'En planche, toucher l\'épaule opposée sans bouger les hanches.'],
  ['ff_abd_19', 'Toes to Bar',               'Global (expert)',                   'Barre fixe',             'Suspendu, amener les pointes de pieds jusqu\'à toucher la barre.'],
  ['ff_abd_20', 'Windshield Wipers',         'Obliques',                          'Barre / Sol',            'Allongé, jambes à 90°, les basculer de gauche à droite sans toucher le sol.'],
  ['ff_abd_21', 'Cable Crunch',              'Grand droit (haut)',                 'Poulie haute',           'À genoux, enrouler le buste vers le bas en tenant la corde derrière la nuque.'],
  ['ff_abd_22', 'Flutter Kicks',             'Grand droit (bas)',                  'Sol',                    'Petits battements de jambes horizontaux, très rapide, dos plaqué.'],
  ['ff_abd_23', 'Heel Touches',              'Obliques',                          'Sol',                    'Allongé, genoux pliés, aller chercher les talons alternativement.'],
  ['ff_abd_24', 'Bird-Dog',                  'Transverse, Lombaires',             'Poids de corps',         'À quatre pattes, tendre bras et jambe opposés. Équilibre et dos.'],
  ['ff_abd_25', 'Pallof Press',              'Transverse, Anti-rotation',         'Poulie',                 'Tenir la poulie de côté, pousser devant soi sans se laisser entraîner.'],
  ['ff_abd_26', 'Knee to Elbow Plank',       'Obliques',                          'Poids de corps',         'En planche, ramener le genou vers le coude du même côté (Spider).'],
  ['ff_abd_27', 'L-Sit',                     'Global (force pure)',               'Barres //',               'Maintenir le corps à la force des bras, jambes tendues à l\'horizontale.'],
  ['ff_abd_28', 'Crunch sur Swiss Ball',     'Grand droit',                       'Ballon',                 'Permet une plus grande amplitude d\'étirement en bas du mouvement.'],
  ['ff_abd_29', 'Gainage commando',          'Global, Épaules',                   'Poids de corps',         'Passer de la position planche sur coudes à planche sur mains.'],
  ['ff_abd_30', 'Sit-up avec poids',         'Grand droit',                       'Disque',                 'Sit-up classique en tenant un disque contre la poitrine ou bras tendus.'],
  ['ff_abd_31', 'Obliques sur banc lombaires','Obliques',                         'Banc 45°',               'De profil sur le banc, effectuer des flexions latérales du buste.'],
  ['ff_abd_32', 'Plank Jacks',               'Cardio, Transverse',                'Poids de corps',         'En planche, écarter et resserrer les pieds en sautant.'],
  ['ff_abd_33', 'Jackknife TRX',             'Bas des abdos',                     'TRX',                    'Pieds dans les sangles, ramener les genoux vers la poitrine.'],
  ['ff_abd_34', 'Bear Crawl abdos',          'Global, Transverse',                'Poids de corps',         'Marcher à quatre pattes sans poser les genoux au sol.'],
  ['ff_abd_35', 'Plank Saw',                 'Transverse, Épaules',               'Poids de corps',         'En planche, basculer le corps d\'avant en arrière par les chevilles.'],
  ['ff_abd_36', 'Leg Raises lestés',         'Grand droit (bas)',                  'Haltère',                'Faire des relevés de jambes avec un petit haltère entre les pieds.'],
  ['ff_abd_37', 'Side Bend (Inclinaison)',   'Obliques',                          'Haltère',                'Debout, un haltère dans une main, s\'incliner sur le côté et remonter.'],
  ['ff_abd_38', 'Dragon Flag',               'Global (expert)',                   'Banc / Poteau',          'Relever tout le corps (sauf haut du dos) à la verticale.'],
  ['ff_abd_39', 'Knee Raises (Dips bar)',    'Bas des abdos',                     'Barres //',               'Monter les genoux à la poitrine en appui sur les barres.'],
  ['ff_abd_40', 'Crunch inversé incliné',    'Grand droit (bas)',                  'Banc incliné',           'Relevé de bassin sur banc incliné tête en haut pour plus de difficulté.'],
  ['ff_abd_41', 'Plank Superman',            'Transverse, Chaîne post',           'Poids de corps',         'En planche, lever simultanément bras et jambe opposés.'],
  ['ff_abd_42', 'Farmer\'s Carry (1 bras)', 'Transverse, Obliques',              'Haltère lourd',          'Marcher avec un poids lourd d\'un seul côté pour contrer le déséquilibre.'],
  ['ff_abd_43', 'Stir the Pot',              'Transverse, Stabilité',             'Swiss Ball',             'En planche coudes sur le ballon, faire des cercles avec les coudes.'],
  ['ff_abd_44', 'Stomach Vacuum',            'Transverse',                        'Poids de corps',         'Expirer tout l\'air et aspirer le nombril vers la colonne. À jeun.'],
  ['ff_abd_45', 'Woodchopper poulie haute',  'Obliques, Transverse, Grand droit', 'Poulie haute',           'Tirer la poignée en diagonale du haut vers la hanche opposée. Mouvement de bûcheron, rotation du tronc.'],
  ['ff_abd_46', 'Woodchopper poulie basse',  'Obliques, Transverse, Grand droit', 'Poulie basse',           'Inverse du woodchopper : tirer du bas vers l\'épaule opposée. Travail des obliques en extension.'],
  ['ff_abd_47', 'Russian Twist poulie',      'Obliques, Transverse',              'Poulie milieu',          'Assis ou debout, bras tendus, faire pivoter le tronc d\'un côté à l\'autre avec tension constante.'],
  ['ff_abd_48', 'Side Bend poulie',          'Obliques, Carré des lombes',        'Poulie basse',           'Debout de profil, tenir la poignée. Incliner le buste sur le côté opposé puis revenir.'],
  ['ff_abd_49', 'Reverse Crunch poulie',     'Grand droit (bas), Transverse',     'Poulie basse + sangle',  'Allongé, sangle aux pieds, ramener les genoux à la poitrine en enroulant le bassin.'],
];

// ─────────────────────────────────────────────
// Utilitaires
// ─────────────────────────────────────────────
const getGroupKey = (id) => id.substring(0, 6); // 'ff_pec', 'ff_dos', etc.

const toArray = (str) =>
  str ? str.split(',').map((s) => s.trim()).filter(Boolean) : [];

async function seed() {
  const resetMode = process.argv.includes('--reset');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🏋️  FitFlow Exercises Seed – démarrage');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (resetMode) {
    console.log('⚠️  Mode --reset : suppression des exercices existants...');
    await prisma.exerciseReference.deleteMany({});
    console.log('✅  Table vidée\n');
  }

  const existingCount = await prisma.exerciseReference.count();
  console.log(`📦 ${existingCount} exercices actuellement en base`);
  console.log(`📝 ${RAW.length} exercices à insérer/mettre à jour\n`);

  let inserted = 0;
  let skipped = 0;

  for (const [id, name, secondary, equipment, description] of RAW) {
    const groupKey = getGroupKey(id);
    const meta = GROUP_META[groupKey];

    if (!meta) {
      console.warn(`  ⚠️  Groupe inconnu pour : ${id}`);
      skipped++;
      continue;
    }

    const data = {
      name,
      bodyParts:        meta.bodyParts,
      targetMuscles:    meta.targetMuscles,
      secondaryMuscles: toArray(secondary),
      equipments:       toArray(equipment),
      exerciseType:     meta.exerciseType,
      gifUrl:           null,        // À renseigner quand les GIFs seront disponibles
      instructions:     description ? [description] : [],
    };

    try {
      await prisma.exerciseReference.upsert({
        where:  { exerciseDbId: id },
        update: data,
        create: { exerciseDbId: id, ...data },
      });
      inserted++;
    } catch (error) {
      console.error(`  ❌ ${name} (${id}) :`, error.message);
      skipped++;
    }
  }

  const total = await prisma.exerciseReference.count();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅  Seed terminé !');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  • ${inserted} exercices insérés/mis à jour`);
  console.log(`  • ${skipped} erreurs`);
  console.log(`  • ${total} exercices en base`);
  console.log('');
  console.log('  📋 Groupes couverts :');
  console.log('     Pectoraux (52) · Dos (42) · Épaules (47)');
  console.log('     Biceps (44) · Triceps (44) · Quadriceps (47)');
  console.log('     Ischios/Fessiers (48) · Mollets (18) · Cardio (25)');
  console.log('     Abdos/Gainage (49)');
  console.log('     Total : 416 exercices\n');
}

seed()
  .catch((error) => {
    console.error('\n❌ Erreur :', error.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
