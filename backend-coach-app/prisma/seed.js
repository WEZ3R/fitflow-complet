/**
 * Seed FitFlow – données de test complètes
 *
 * Crée : 5 coachs, 30 clients (6 par coach), 30 programmes, ~1300 séances avec
 *        exercices, ~2700 stats quotidiennes, ~2500 repas et ~20 000 séries
 *        réalisées reliées au catalogue d'exercices.
 *
 * 15 des 30 clients suivent un plan de musculation relié aux ExerciseReference :
 * c'est ce qui alimente les 8 sections de l'onglet Musculation des analytics
 * (1RM estimé, volume par muscle, INOL, standards de force, volume landmarks…).
 * Les 15 autres n'en ont pas, volontairement : l'état vide doit aussi être testable.
 *
 * Mot de passe de tous les comptes : 123456
 *
 * Prérequis : npm run seed:exercises (le catalogue ff_* doit exister, sinon aucun
 * exercice ne sera relié et les analytics musculation resteront vides).
 *
 * Usage : npm run seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

// Construire DATABASE_URL depuis les variables individuelles si absent
if (!process.env.DATABASE_URL) {
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = process.env;
  process.env.DATABASE_URL = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
}

const prisma = new PrismaClient();

/** Profondeur d'historique, en jours : 12 semaines de séances. */
const HISTORY_WEEKS_START = 84;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const round1 = (n) => Math.round(n * 10) / 10;
const roundNearest = (n, step) => Math.round(n / step) * step;

/** Parse "8-10" → [8,10], "5" → [5,5], sinon [8,10] */
function parseRepsRange(repsStr) {
  const range = String(repsStr ?? '').match(/^(\d+)[-–](\d+)$/);
  if (range) return [parseInt(range[1]), parseInt(range[2])];
  const single = String(repsStr ?? '').match(/^(\d+)/);
  if (single) { const n = parseInt(single[1]); return [n, n]; }
  return [8, 10];
}

/** Date à N jours en arrière, à minuit. N négatif = date future. */
const dayAt = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
};

// ─── Données coachs ───────────────────────────────────────────────────────────

const COACHES = [
  {
    firstName: 'Thomas', lastName: 'Dupont',
    email: 'thomas.dupont@fitflow-seed.com',
    bio: 'Coach spécialisé musculation et force. 8 ans d\'expérience, certifié BPJEPS.',
    experience: '8 ans', city: 'Paris', isRemote: false,
    specialty: 'musculation',
  },
  {
    firstName: 'Sarah', lastName: 'Martin',
    email: 'sarah.martin@fitflow-seed.com',
    bio: 'Experte cardio-training et endurance. Diplômée STAPS, ancienne athlète.',
    experience: '6 ans', city: 'Lyon', isRemote: true,
    specialty: 'cardio',
  },
  {
    firstName: 'Nicolas', lastName: 'Bernard',
    email: 'nicolas.bernard@fitflow-seed.com',
    bio: 'Coach CrossFit et HIIT. Ancien militaire reconverti dans le coaching haute intensité.',
    experience: '5 ans', city: 'Bordeaux', isRemote: false,
    specialty: 'crossfit',
  },
  {
    firstName: 'Emma', lastName: 'Leroy',
    email: 'emma.leroy@fitflow-seed.com',
    bio: 'Yoga et mobilité. Approche holistique du bien-être, certifiée 500h RYT.',
    experience: '10 ans', city: 'Marseille', isRemote: true,
    specialty: 'yoga',
  },
  {
    firstName: 'Julien', lastName: 'Petit',
    email: 'julien.petit@fitflow-seed.com',
    bio: 'Spécialiste perte de poids et nutrition sportive. Diététicien DE + coach fitness.',
    experience: '7 ans', city: 'Toulouse', isRemote: true,
    specialty: 'nutrition',
  },
];

// ─── Données clients (6 par coach, coachIndex 0-4) ───────────────────────────

const CLIENTS = [
  // ── Thomas (musculation)
  { firstName: 'Antoine',   lastName: 'Moreau',     email: 'antoine.moreau@fitflow-seed.com',     gender: 'male',   birthYear: 1996, weight: 85,  height: 178, level: 'intermédiaire', goals: 'Prise de masse musculaire',            coachIndex: 0, program: 'Prise de masse – Phase 1',         weightTrend: 'gain' },
  { firstName: 'Lucas',     lastName: 'Girard',     email: 'lucas.girard@fitflow-seed.com',       gender: 'male',   birthYear: 1992, weight: 92,  height: 181, level: 'avancé',         goals: 'Force maximale et hypertrophie',       coachIndex: 0, program: 'Force maximale – Powerlifting',    weightTrend: 'gain' },
  { firstName: 'Maxime',    lastName: 'Roux',       email: 'maxime.roux@fitflow-seed.com',         gender: 'male',   birthYear: 2000, weight: 70,  height: 175, level: 'débutant',       goals: 'Prendre du muscle, se renforcer',      coachIndex: 0, program: 'Prise de masse – Débutant',        weightTrend: 'gain' },
  { firstName: 'Laura',     lastName: 'Blanc',      email: 'laura.blanc@fitflow-seed.com',         gender: 'female', birthYear: 1997, weight: 58,  height: 165, level: 'intermédiaire', goals: 'Tonification et galbe musculaire',     coachIndex: 0, program: 'Tonification Corps Entier',        weightTrend: 'stable' },
  { firstName: 'Hugo',      lastName: 'Faure',      email: 'hugo.faure@fitflow-seed.com',           gender: 'male',   birthYear: 1989, weight: 100, height: 185, level: 'avancé',         goals: 'Force et hypertrophie – niveau élite', coachIndex: 0, program: 'Force maximale – Powerlifting',    weightTrend: 'gain' },
  { firstName: 'Camille',   lastName: 'Dubois',     email: 'camille.dubois@fitflow-seed.com',     gender: 'female', birthYear: 1995, weight: 62,  height: 168, level: 'débutant',       goals: 'Remise en forme générale',             coachIndex: 0, program: 'Remise en forme – 12 semaines',    weightTrend: 'stable' },

  // ── Sarah (cardio)
  { firstName: 'Marie',     lastName: 'Rousseau',   email: 'marie.rousseau@fitflow-seed.com',     gender: 'female', birthYear: 1991, weight: 65,  height: 167, level: 'intermédiaire', goals: 'Améliorer mon endurance cardiovasculaire', coachIndex: 1, program: 'Cardio Endurance – 10km',          weightTrend: 'stable' },
  { firstName: 'Pauline',   lastName: 'Garnier',    email: 'pauline.garnier@fitflow-seed.com',   gender: 'female', birthYear: 1999, weight: 55,  height: 160, level: 'débutant',       goals: 'Perdre du poids et commencer à courir',   coachIndex: 1, program: 'Perte de poids – Cardio',          weightTrend: 'loss' },
  { firstName: 'Théo',      lastName: 'Morin',      email: 'theo.morin@fitflow-seed.com',         gender: 'male',   birthYear: 1983, weight: 78,  height: 176, level: 'intermédiaire', goals: 'Préparer un semi-marathon en 4 mois',      coachIndex: 1, program: 'Cardio Endurance – Semi-marathon',  weightTrend: 'stable' },
  { firstName: 'Inès',      lastName: 'Lemaire',    email: 'ines.lemaire@fitflow-seed.com',       gender: 'female', birthYear: 1986, weight: 72,  height: 169, level: 'intermédiaire', goals: 'Retrouver la forme après grossesse',       coachIndex: 1, program: 'Remise en forme – Post-natal',      weightTrend: 'loss', exerciseSpecialty: 'musculation' },
  { firstName: 'Raphaël',   lastName: 'Simon',      email: 'raphael.simon@fitflow-seed.com',     gender: 'male',   birthYear: 1995, weight: 80,  height: 179, level: 'débutant',       goals: 'Perdre 10 kg en 6 mois',                  coachIndex: 1, program: 'Perte de poids – Cardio',          weightTrend: 'loss' },
  { firstName: 'Jade',      lastName: 'Mercier',    email: 'jade.mercier@fitflow-seed.com',       gender: 'female', birthYear: 2002, weight: 52,  height: 162, level: 'avancé',         goals: 'Performance cardio – compétition',         coachIndex: 1, program: 'Performance – Compétition',        weightTrend: 'stable' },

  // ── Nicolas (crossfit)
  { firstName: 'Baptiste',  lastName: 'Laurent',    email: 'baptiste.laurent@fitflow-seed.com',   gender: 'male',   birthYear: 1998, weight: 82,  height: 180, level: 'intermédiaire', goals: 'CrossFit et conditionnement physique',  coachIndex: 2, program: 'CrossFit Fondamentaux',            weightTrend: 'stable' },
  { firstName: 'Alexis',    lastName: 'Bonnet',     email: 'alexis.bonnet@fitflow-seed.com',       gender: 'male',   birthYear: 1994, weight: 88,  height: 183, level: 'avancé',         goals: 'Performance CrossFit – WOD élite',      coachIndex: 2, program: 'CrossFit Performance',            weightTrend: 'gain' },
  { firstName: 'Chloé',     lastName: 'Perrin',     email: 'chloe.perrin@fitflow-seed.com',       gender: 'female', birthYear: 1997, weight: 60,  height: 166, level: 'intermédiaire', goals: 'CrossFit et tonification',               coachIndex: 2, program: 'CrossFit Fondamentaux',            weightTrend: 'stable' },
  { firstName: 'Nicolas',   lastName: 'Fontaine',   email: 'nicolas.fontaine@fitflow-seed.com',   gender: 'male',   birthYear: 1990, weight: 95,  height: 188, level: 'débutant',       goals: 'Se remettre au sport sérieusement',      coachIndex: 2, program: 'HIIT & Force – Débutant',         weightTrend: 'loss' },
  { firstName: 'Manon',     lastName: 'Chevalier',  email: 'manon.chevalier@fitflow-seed.com',   gender: 'female', birthYear: 2001, weight: 57,  height: 163, level: 'débutant',       goals: 'Perdre du gras et se muscler',           coachIndex: 2, program: 'HIIT & Force – Débutant',         weightTrend: 'stable' },
  { firstName: 'Kévin',     lastName: 'Arnaud',     email: 'kevin.arnaud@fitflow-seed.com',       gender: 'male',   birthYear: 1993, weight: 91,  height: 182, level: 'avancé',         goals: 'CrossFit compétition régionale',         coachIndex: 2, program: 'CrossFit Performance',            weightTrend: 'gain' },

  // ── Emma (yoga)
  { firstName: 'Sophie',    lastName: 'Renard',     email: 'sophie.renard@fitflow-seed.com',       gender: 'female', birthYear: 1979, weight: 63,  height: 164, level: 'intermédiaire', goals: 'Réduire le stress et améliorer la flexibilité', coachIndex: 3, program: 'Yoga & Bien-être',               weightTrend: 'stable' },
  { firstName: 'Julie',     lastName: 'Legrand',    email: 'julie.legrand@fitflow-seed.com',       gender: 'female', birthYear: 1972, weight: 67,  height: 166, level: 'débutant',       goals: 'Découvrir le yoga, assouplissement',           coachIndex: 3, program: 'Yoga Débutant – Flexibilité',    weightTrend: 'stable' },
  { firstName: 'Claire',    lastName: 'Muller',     email: 'claire.muller@fitflow-seed.com',       gender: 'female', birthYear: 1986, weight: 58,  height: 160, level: 'avancé',         goals: 'Yoga avancé et pratique de méditation',        coachIndex: 3, program: 'Yoga Avancé',                    weightTrend: 'stable' },
  { firstName: 'Pierre',    lastName: 'Dupuis',     email: 'pierre.dupuis@fitflow-seed.com',       gender: 'male',   birthYear: 1976, weight: 82,  height: 177, level: 'débutant',       goals: 'Mobilité et gestion du stress au travail',     coachIndex: 3, program: 'Mobilité & Yoga Doux',           weightTrend: 'stable' },
  { firstName: 'Nathalie',  lastName: 'Giraud',     email: 'nathalie.giraud@fitflow-seed.com',   gender: 'female', birthYear: 1969, weight: 70,  height: 163, level: 'débutant',       goals: 'Bien-être, souplesse et relaxation',           coachIndex: 3, program: 'Yoga Débutant – Flexibilité',    weightTrend: 'stable' },
  { firstName: 'Valentin',  lastName: 'Roussel',    email: 'valentin.roussel@fitflow-seed.com',   gender: null,     birthYear: 1988, weight: null, height: null, level: null,            goals: 'Améliorer ma mobilité et récupération',        coachIndex: 3, program: 'Mobilité & Yoga Doux',           weightTrend: 'stable' },

  // ── Julien (nutrition)
  { firstName: 'Mathieu',   lastName: 'Guerin',     email: 'mathieu.guerin@fitflow-seed.com',     gender: 'male',   birthYear: 1985, weight: 105, height: 180, level: 'débutant',       goals: 'Perdre 20 kg, retrouver de l\'énergie',   coachIndex: 4, program: 'Perte de poids – Plan Nutrition',  weightTrend: 'loss' },
  { firstName: 'Amélie',    lastName: 'Bernard',    email: 'amelie.bernard@fitflow-seed.com',     gender: 'female', birthYear: 1993, weight: 75,  height: 168, level: 'intermédiaire', goals: 'Perdre 10 kg durablement sans frustration', coachIndex: 4, program: 'Perte de poids – Plan Nutrition',  weightTrend: 'loss' },
  { firstName: 'Thomas',    lastName: 'Martin',     email: 'thomas.martin@fitflow-seed.com',       gender: 'male',   birthYear: 1980, weight: 98,  height: 183, level: 'débutant',       goals: 'Rééquilibrage alimentaire complet',         coachIndex: 4, program: 'Rééquilibrage Alimentaire',        weightTrend: 'loss' },
  { firstName: 'Lucie',     lastName: 'Fournier',   email: 'lucie.fournier@fitflow-seed.com',     gender: 'female', birthYear: 1996, weight: 68,  height: 165, level: 'intermédiaire', goals: 'Optimiser la nutrition sportive',            coachIndex: 4, program: 'Rééquilibrage Alimentaire',        weightTrend: 'stable' },
  { firstName: 'Sébastien', lastName: 'Leroux',     email: 'sebastien.leroux@fitflow-seed.com',   gender: 'male',   birthYear: 1982, weight: 112, height: 178, level: 'débutant',       goals: 'Perdre du poids et retrouver de l\'énergie', coachIndex: 4, program: 'Perte de poids – Plan Nutrition',  weightTrend: 'loss' },
  { firstName: 'Noémie',    lastName: 'Carpentier', email: 'noemie.carpentier@fitflow-seed.com',   gender: null,     birthYear: 1998, weight: 61,  height: null, level: 'débutant',       goals: 'Manger mieux et perdre quelques kilos',      coachIndex: 4, program: 'Perte de poids – Plan Nutrition',  weightTrend: 'loss' },
];

// ─── Exercices par spécialité ─────────────────────────────────────────────────

const EXERCISES = {
  musculation: [
    { name: 'Échauffement articulaire',  category: 'WARMUP',     sets: 1, restTime: '0', duration: '10min' },
    { name: 'Développé couché barre',    category: 'MAIN',       sets: 4, reps: '8-10',   restTime: '3min', weight: '80',  refDbId: 'bench-press-barre-001' },
    { name: 'Squat barre',               category: 'MAIN',       sets: 4, reps: '5',      restTime: '4min', weight: '100', refDbId: 'squat-barre-001' },
    { name: 'Soulevé de terre',          category: 'MAIN',       sets: 3, reps: '5',      restTime: '4min', weight: '120', refDbId: 'deadlift-barre-001' },
    { name: 'Tractions lestées',         category: 'MAIN',       sets: 4, reps: '6-8',    restTime: '2min', weight: '10',  refDbId: 'rowing-barre-001' },
    { name: 'Développé militaire',       category: 'MAIN',       sets: 3, reps: '10-12',  restTime: '2min', weight: '50',  refDbId: 'ohp-barre-001' },
    { name: 'Gainage planche',           category: 'RENFORCEMENT',       sets: 3, restTime: '1min', duration: '60s' },
    { name: 'Étirements quadriceps',     category: 'STRETCHING', sets: 2, restTime: '0', duration: '45s' },
    { name: 'Étirements pectoraux',      category: 'STRETCHING', sets: 2, restTime: '0', duration: '45s' },
  ],
  cardio: [
    { name: 'Marche rapide 10min',       category: 'WARMUP',     sets: 1, restTime: '0',    duration: '10min' },
    { name: 'Course à pied',             category: 'CARDIO',     sets: 1, restTime: '0',    duration: '30min' },
    { name: 'Vélo elliptique',           category: 'CARDIO',     sets: 1, restTime: '0',    duration: '20min' },
    { name: 'HIIT – Sprints 30/90',      category: 'CARDIO',     sets: 8, restTime: '90s', duration: '30s' },
    { name: 'Gainage latéral',           category: 'RENFORCEMENT',       sets: 3, restTime: '1min', duration: '45s' },
    { name: 'Montées de genoux',         category: 'WARMUP',     sets: 3, reps: '20',     restTime: '30s' },
    { name: 'Étirements dynamiques',     category: 'STRETCHING', sets: 1, restTime: '0',    duration: '10min' },
  ],
  crossfit: [
    { name: 'Corde à sauter double under', category: 'WARMUP',  sets: 3, reps: '50',     restTime: '1min' },
    { name: 'Burpees',                   category: 'MAIN',       sets: 5, reps: '10',     restTime: '1min' },
    { name: 'Clean & Jerk',              category: 'MAIN',       sets: 4, reps: '5',      restTime: '2min', weight: '60kg' },
    { name: 'Box Jump',                  category: 'CARDIO',     sets: 4, reps: '10',     restTime: '1min' },
    { name: 'Tractions kipping',         category: 'MAIN',       sets: 4, reps: '12',     restTime: '2min' },
    { name: 'Kettlebell Swing',          category: 'MAIN',       sets: 4, reps: '15',     restTime: '1min', weight: '24kg' },
    { name: 'Thrusters',                 category: 'MAIN',       sets: 3, reps: '10',     restTime: '2min', weight: '40kg' },
    { name: 'Foam rolling',              category: 'STRETCHING', sets: 1, restTime: '0',    duration: '10min' },
  ],
  yoga: [
    { name: 'Salutation au soleil',      category: 'WARMUP',     sets: 3, restTime: '0', duration: '5min' },
    { name: 'Posture du guerrier I',     category: 'RENFORCEMENT',       sets: 1, restTime: '0',  duration: '5min' },
    { name: 'Posture du guerrier II',    category: 'RENFORCEMENT',       sets: 1, restTime: '0',  duration: '5min' },
    { name: 'Posture de l\'arbre',       category: 'RENFORCEMENT',       sets: 1, restTime: '0', duration: '3min' },
    { name: 'Posture du chien tête en bas', category: 'RENFORCEMENT',   sets: 2, restTime: '0', duration: '2min' },
    { name: 'Torsion spinale',           category: 'STRETCHING', sets: 2, restTime: '0', duration: '2min' },
    { name: 'Méditation assise',         category: 'STRETCHING', sets: 1, restTime: '0',  duration: '10min' },
  ],
  nutrition: [
    { name: 'Marche active',             category: 'CARDIO',     sets: 1, restTime: '0',  duration: '45min' },
    { name: 'Squats poids du corps',     category: 'MAIN',       sets: 3, reps: '15',     restTime: '1min' },
    { name: 'Pompes',                    category: 'MAIN',       sets: 3, reps: '10',     restTime: '1min' },
    { name: 'Vélo stationnaire',         category: 'CARDIO',     sets: 1, restTime: '0',  duration: '30min' },
    { name: 'Fentes avant',              category: 'MAIN',       sets: 3, reps: '12',     restTime: '1min' },
    { name: 'Étirements dos complet',    category: 'STRETCHING', sets: 2, restTime: '0', duration: '1min' },
  ],
};

// ─── Musculation : catalogue relié aux VRAIES références de la base ───────────
//
// Les anciens `refDbId` ('bench-press-barre-001'…) n'existaient pas : refMap.get()
// renvoyait undefined, aucun Exercise n'était relié à une ExerciseReference, et
// comme le seed sautait les exercices sans référence, aucune SetCompletion n'était
// créée non plus. Les 8 sections de l'onglet Musculation étaient donc vides depuis
// le début. Les identifiants ff_* ci-dessous sont ceux de seed-fitflow-exercises.js.
//
// `ratio` = 1RM exprimé en multiple du poids de corps, pour un homme intermédiaire.
// C'est lui qui rend les charges cohérentes d'un gabarit à l'autre et qui fait
// tomber les standards de force ExRx dans des niveaux plausibles.
const LIFTS = {
  bench:    { ref: 'ff_pec_01', name: 'Développé couché barre',  part: 'CHEST',      ratio: 1.00, reps: '6-8',   rest: '3min' },
  incline:  { ref: 'ff_pec_02', name: 'Développé incliné barre', part: 'CHEST',      ratio: 0.82, reps: '8-10',  rest: '2min' },
  dbPress:  { ref: 'ff_pec_04', name: 'Développé couché haltères', part: 'CHEST',    ratio: 0.78, reps: '10-12', rest: '2min' },
  deadlift: { ref: 'ff_dos_10', name: 'Soulevé de terre',        part: 'BACK',       ratio: 1.75, reps: '5',     rest: '4min' },
  row:      { ref: 'ff_dos_06', name: 'Rowing barre',            part: 'BACK',       ratio: 0.95, reps: '8-10',  rest: '2min' },
  latPull:  { ref: 'ff_dos_03', name: 'Tirage vertical',         part: 'BACK',       ratio: 0.85, reps: '10-12', rest: '90s' },
  ohp:      { ref: 'ff_epa_01', name: 'Développé militaire',     part: 'SHOULDERS',  ratio: 0.65, reps: '8-10',  rest: '2min' },
  lateral:  { ref: 'ff_epa_04', name: 'Élévations latérales',    part: 'SHOULDERS',  ratio: 0.16, reps: '12-15', rest: '60s' },
  squat:    { ref: 'ff_qua_01', name: 'Squat barre haute',       part: 'UPPER_LEGS', ratio: 1.40, reps: '5',     rest: '4min' },
  legPress: { ref: 'ff_qua_04', name: 'Presse à cuisses',        part: 'UPPER_LEGS', ratio: 2.20, reps: '10-12', rest: '2min' },
  rdl:      { ref: 'ff_isf_01', name: 'Soulevé de terre roumain', part: 'UPPER_LEGS', ratio: 1.15, reps: '8-10',  rest: '3min' },
  legCurl:  { ref: 'ff_isf_02', name: 'Leg curl allongé',        part: 'UPPER_LEGS', ratio: 0.45, reps: '12-15', rest: '90s' },
  calf:     { ref: 'ff_mol_01', name: 'Mollets debout barre',    part: 'LOWER_LEGS', ratio: 1.20, reps: '12-15', rest: '60s' },
  curl:     { ref: 'ff_bic_01', name: 'Curl barre droite',       part: 'UPPER_ARMS', ratio: 0.40, reps: '10-12', rest: '90s' },
  skull:    { ref: 'ff_tri_04', name: 'Barre au front',          part: 'UPPER_ARMS', ratio: 0.42, reps: '10-12', rest: '90s' },
  // Poids de corps : `ratio: null` → weightUsed reste nul. Le volume (kg × reps)
  // les ignore, mais les volume landmarks comptent les SÉRIES : ils apparaissent
  // donc bien dans la section RP, et seulement là. C'est voulu.
  // `timed` → catégorie RENFORCEMENT : le gainage se prescrit en TEMPS, et le temps
  // tenu va dans durationAchieved, jamais dans repsAchieved.
  plank:    { ref: 'ff_abd_04', name: 'Gainage planche',         part: 'WAIST',      ratio: null, reps: '60s',   rest: '60s', timed: true },
  crunch:   { ref: 'ff_abd_01', name: 'Crunch classique',        part: 'WAIST',      ratio: null, reps: '20',    rest: '45s' },
};

// ─── Plans hebdomadaires ──────────────────────────────────────────────────────
//
// Les séries par semaine sont calibrées sur les volume landmarks RP (MEV/MAV/MRV)
// pour que chaque zone soit représentée quelque part dans le jeu de données :
// sans ça, la section « Volume landmarks » afficherait la même couleur partout et
// ne prouverait rien.
//
// Les chiffres sont le volume PRESCRIT. Le volume réalisé tombe ~18 % en dessous
// (jours de repos, séances manquées, séries échouées) : les valeurs sont calibrées
// un cran au-dessus de la zone visée pour qu'elle soit atteinte à l'arrivée.
// C'est mesuré, pas estimé : 14 séries prescrites donnaient 11,5 réalisées.
//
//   plan            zones visées
//   ─────────────── ─────────────────────────────────────────────────────────────
//   full            tout dans le MAV (zone optimale) — le cas nominal
//   upper_focus     haut du corps en mav_to_mrv / above_mrv, jambes below_mev
//   lower_focus     jambes très above_mrv, pecs et dos below_mev
//   overreaching    surentraînement franc — presque tout above_mrv
//   minimalist      tout below_mev — le cas « pas assez de volume »
//   crossfit        polyarticulaire modéré, réparti
const PLANS = {
  full: [
    { day: 1, lifts: [['squat', 6], ['bench', 6], ['row', 6], ['lateral', 7], ['plank', 4]] },
    { day: 3, lifts: [['deadlift', 5], ['dbPress', 5], ['ohp', 6], ['curl', 5], ['calf', 6], ['plank', 4]] },
    { day: 5, lifts: [['incline', 6], ['legPress', 6], ['rdl', 5], ['latPull', 6], ['lateral', 6], ['curl', 5], ['skull', 5], ['crunch', 5], ['calf', 5]] },
  ],
  upper_focus: [
    { day: 1, lifts: [['bench', 7], ['incline', 6], ['ohp', 6], ['lateral', 7], ['curl', 6], ['skull', 6]] },
    { day: 3, lifts: [['dbPress', 6], ['latPull', 6], ['row', 6], ['lateral', 6], ['curl', 5], ['skull', 5], ['crunch', 5]] },
    { day: 5, lifts: [['bench', 6], ['ohp', 6], ['lateral', 6], ['skull', 5], ['curl', 5], ['plank', 4], ['squat', 4]] },
  ],
  lower_focus: [
    { day: 1, lifts: [['squat', 7], ['legPress', 6], ['rdl', 6], ['calf', 6], ['plank', 4]] },
    { day: 3, lifts: [['deadlift', 6], ['legCurl', 6], ['squat', 6], ['calf', 6], ['crunch', 5]] },
    { day: 5, lifts: [['legPress', 6], ['rdl', 6], ['legCurl', 5], ['calf', 5], ['bench', 4], ['row', 4]] },
  ],
  overreaching: [
    { day: 1, lifts: [['bench', 7], ['incline', 7], ['dbPress', 7], ['ohp', 7], ['lateral', 7], ['curl', 7], ['skull', 7]] },
    { day: 3, lifts: [['squat', 8], ['legPress', 7], ['rdl', 7], ['deadlift', 6], ['calf', 7], ['crunch', 6]] },
    { day: 5, lifts: [['bench', 7], ['row', 7], ['latPull', 7], ['ohp', 7], ['lateral', 7], ['curl', 6], ['plank', 6]] },
  ],
  minimalist: [
    { day: 2, lifts: [['bench', 3], ['squat', 3], ['row', 3]] },
    { day: 5, lifts: [['ohp', 3], ['deadlift', 2], ['plank', 2]] },
  ],
  crossfit: [
    { day: 1, lifts: [['deadlift', 5], ['ohp', 5], ['squat', 5], ['plank', 4]] },
    { day: 3, lifts: [['bench', 5], ['row', 5], ['legPress', 5], ['crunch', 4]] },
    { day: 6, lifts: [['squat', 5], ['incline', 5], ['latPull', 5], ['calf', 5]] },
  ],
};

// ─── Modèles de progression sur 12 semaines ───────────────────────────────────
//
// Sans modèle de progression, les charges oscillaient autour d'une base fixe :
// les courbes de 1RM estimé et de progression de charge montraient du bruit, pas
// une tendance. Ces quatre profils donnent des formes de courbe distinctes et
// reconnaissables à l'œil sur les graphiques.
const PROGRESSIONS = {
  linear:     (w) => 1 + 0.011 * w,                                    // progression régulière
  plateau:    (w) => 1 + 0.011 * Math.min(w, 6),                       // stagne à partir de la 7ᵉ semaine
  deload:     (w) => (w === 8 ? 1 + 0.012 * 7 - 0.18 : 1 + 0.012 * w), // semaine 8 allégée puis reprise
  regression: (w) => (w <= 7 ? 1 + 0.013 * w : 1 + 0.013 * 7 - 0.045 * (w - 7)), // blessure en fin de cycle
};

// ─── Réglages d'entraînement par client ───────────────────────────────────────
//
// Clé = partie locale de l'email. Un client absent de cette table n'a pas de
// données de musculation : c'est volontaire, l'onglet Musculation doit aussi être
// testable sur un client qui n'a rien à montrer.
//
// `adherence` = probabilité qu'une séance passée soit marquée faite. C'est ce qui
// fait varier le taux de complétion et les séries de séances consécutives.
const TRAINING = {
  // Thomas — musculation, tout l'éventail des cas
  'antoine.moreau':     { plan: 'full',         progression: 'linear',     adherence: 0.93 },
  'lucas.girard':       { plan: 'lower_focus',  progression: 'plateau',    adherence: 0.97 },
  'maxime.roux':        { plan: 'minimalist',   progression: 'linear',     adherence: 0.62 },
  'laura.blanc':        { plan: 'upper_focus',  progression: 'linear',     adherence: 0.88 },
  'hugo.faure':         { plan: 'overreaching', progression: 'regression', adherence: 0.95 },
  'camille.dubois':     { plan: 'full',         progression: 'deload',     adherence: 0.74 },
  // Inès — suivie par une coach cardio mais programme musculation
  'ines.lemaire':       { plan: 'full',         progression: 'linear',     adherence: 0.85 },
  // Nicolas — crossfit
  'baptiste.laurent':   { plan: 'crossfit',     progression: 'linear',     adherence: 0.90 },
  'alexis.bonnet':      { plan: 'overreaching', progression: 'plateau',    adherence: 0.98 },
  'chloe.perrin':       { plan: 'crossfit',     progression: 'deload',     adherence: 0.81 },
  'nicolas.fontaine':   { plan: 'minimalist',   progression: 'linear',     adherence: 0.55 },
  'manon.chevalier':    { plan: 'crossfit',     progression: 'linear',     adherence: 0.79 },
  'kevin.arnaud':       { plan: 'lower_focus',  progression: 'linear',     adherence: 0.94 },
  // Julien — nutrition, avec un peu de renforcement
  'mathieu.guerin':     { plan: 'minimalist',   progression: 'linear',     adherence: 0.68 },
  'lucie.fournier':     { plan: 'full',         progression: 'plateau',    adherence: 0.86 },
};

const LEVEL_FACTOR  = { BEGINNER: 0.72, INTERMEDIATE: 1.0, ADVANCED: 1.28 };
const GENDER_FACTOR = { male: 1.0, female: 0.68 };

/** 1RM cible d'un client sur un mouvement, avant progression hebdomadaire. */
function target1RM(lift, client, levelCode) {
  if (lift.ratio == null) return null;
  const bw = client.weight ?? 75;
  return bw * lift.ratio * (LEVEL_FACTOR[levelCode] ?? 0.85) * (GENDER_FACTOR[client.gender] ?? 0.9);
}

/** Charge de travail déduite du 1RM par Epley inversé : w = 1RM / (1 + reps/30). */
function workingWeight(oneRM, reps) {
  if (oneRM == null) return null;
  return oneRM / (1 + reps / 30);
}

// ─── Génération des stats ─────────────────────────────────────────────────────

function buildStats(client, daysBack) {
  const isLoss   = client.weightTrend === 'loss';
  const isGain   = client.weightTrend === 'gain';
  const baseW    = client.weight ?? 70;

  // Tendance linéaire sur 90 jours : ±0.03 kg/jour
  const trendPerDay = isLoss ? -0.025 : isGain ? 0.018 : 0;
  const weight = round1(Math.max(40, baseW + trendPerDay * (90 - daysBack) + rand(-0.25, 0.25)));

  const calories = isLoss
    ? randInt(1400, 1850)
    : isGain
    ? randInt(2700, 3400)
    : randInt(1900, 2500);

  // Coucher / lever cohérents avec la durée de sommeil : ces deux colonnes
  // existaient dans le schéma et n'étaient jamais remplies.
  const sleepHours = round1(rand(5.5, 9.0));
  const bedHour    = rand(21.5, 25.5);            // 21h30 → 01h30
  const bed        = dayAt(daysBack);
  bed.setMinutes(Math.round(bedHour * 60));
  const wake       = new Date(bed.getTime() + sleepHours * 3600_000);

  const trained = Math.random() > 0.35;
  let workoutTime = null;
  if (trained) {
    workoutTime = dayAt(daysBack);
    workoutTime.setMinutes(Math.round(rand(7, 21) * 60));
  }

  return {
    sleepHours,
    bedTime:         bed,
    wakeTime:        wake,
    waterIntake:     round1(rand(1.2, 3.2)),
    weight,
    totalCalories:   calories,
    workoutTime,
    workoutDuration: trained ? randInt(30, 90) : null,
  };
}

/**
 * Répartit un total calorique sur les repas d'une journée.
 * Rend DailyStat.totalCalories cohérent avec la somme des Meal : mealController
 * recalcule ce total dès qu'un repas est modifié, donc un total posé sans repas
 * derrière lui se serait effacé à la première édition dans l'application.
 */
function buildMeals(totalCalories) {
  const split = [
    { mealType: 'breakfast', share: 0.25, options: ['Flocons d\'avoine, banane, lait', 'Œufs brouillés, pain complet', 'Skyr, fruits rouges, amandes'] },
    { mealType: 'lunch',     share: 0.35, options: ['Poulet, riz basmati, brocolis', 'Saumon, quinoa, haricots verts', 'Steak haché 5%, pommes de terre, salade'] },
    { mealType: 'dinner',    share: 0.30, options: ['Cabillaud, patate douce, épinards', 'Omelette, légumes rôtis', 'Dinde, lentilles, courgettes'] },
    { mealType: 'snack',     share: 0.10, options: ['Shaker whey, banane', 'Fromage blanc, miel', 'Poignée de noix'] },
  ];
  return split.map(({ mealType, share, options }) => {
    const calories = Math.round(totalCalories * share * rand(0.9, 1.1));
    // Répartition macro plausible : ~30% prot, ~40% gluc, ~30% lip en calories
    return {
      mealType,
      description: options[randInt(0, options.length - 1)],
      calories,
      protein: round1((calories * 0.30) / 4),
      carbs:   round1((calories * 0.40) / 4),
      fats:    round1((calories * 0.30) / 9),
    };
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🌱  FitFlow Seed – démarrage');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ── Nettoyage des comptes seed existants ──────────────────────────────────
  console.log('🧹 Nettoyage des données seed existantes...');
  const allSeedEmails = [
    ...COACHES.map(c => c.email),
    ...CLIENTS.map(c => c.email),
  ];
  // La suppression cascade depuis User → CoachProfile/ClientProfile → tout le reste
  const deleted = await prisma.user.deleteMany({
    where: { email: { in: allSeedEmails } },
  });
  console.log(`   ${deleted.count} compte(s) supprimé(s)\n`);

  const hashedPwd = await bcrypt.hash('123456', 10);

  // ── Créer les coachs ──────────────────────────────────────────────────────
  console.log('👔 Création des coachs...');
  const coachProfiles = [];

  for (const cd of COACHES) {
    const user = await prisma.user.create({
      data: {
        email:     cd.email,
        password:  hashedPwd,
        role:      'COACH',
        firstName: cd.firstName,
        lastName:  cd.lastName,
        coachProfile: {
          create: {
            bio:               cd.bio,
            experience:        cd.experience,
            city:              cd.city,
            isRemote:          cd.isRemote,
            rating:            round1(rand(4.1, 5.0)),
            ratingCount:       randInt(8, 45),
          },
        },
      },
      include: { coachProfile: true },
    });
    coachProfiles.push(user.coachProfile);
    console.log(`   ✓ ${cd.firstName} ${cd.lastName}  (${cd.email})`);
  }

  // ── Charger les références exercices (pour les liens exerciseRefId) ─────────
  const exRefs = await prisma.exerciseReference.findMany({
    select: { id: true, exerciseDbId: true },
  });
  const refMap = new Map(exRefs.map(r => [r.exerciseDbId, r.id]));
  if (refMap.size === 0) {
    console.warn('   ⚠️  Aucune ExerciseReference trouvée — exécutez d\'abord seed-fitflow-exercises.js\n');
  } else {
    console.log(`   ✓ ${refMap.size} références exercices chargées\n`);
  }

  // ── Créer les clients, programmes, séances et stats ───────────────────────
  console.log('\n👥 Création des clients + données...\n');

  let totalStats        = 0;
  let totalSessions     = 0;
  let totalSetCompletes = 0;
  let totalMeals        = 0;

  for (let i = 0; i < CLIENTS.length; i++) {
    const cd    = CLIENTS[i];
    const coach = coachProfiles[cd.coachIndex];
    const specialty = cd.exerciseSpecialty ?? COACHES[cd.coachIndex].specialty;

    const birthDate = cd.birthYear
      ? new Date(cd.birthYear, randInt(0, 11), randInt(1, 28))
      : null;

    // Créer user + profil client
    const user = await prisma.user.create({
      data: {
        email:     cd.email,
        password:  hashedPwd,
        role:      'CLIENT',
        firstName: cd.firstName,
        lastName:  cd.lastName,
        birthDate,
        clientProfile: {
          create: {
            coachId:           coach.id,
            weight:            cd.weight,
            height:            cd.height,
            dateOfBirth:       birthDate,
            gender:            cd.gender,
            customGoal:        cd.goals,
            level:             cd.level === 'débutant' ? 'BEGINNER' : cd.level === 'intermédiaire' ? 'INTERMEDIATE' : cd.level === 'avancé' ? 'ADVANCED' : null,
            city:              COACHES[cd.coachIndex].city,
          },
        },
      },
      include: { clientProfile: true },
    });

    const profile = user.clientProfile;

    // Relation ClientCoach
    await prisma.clientCoach.create({
      data: {
        clientId:  profile.id,
        coachId:   coach.id,
        isPrimary: true,
        isActive:  true,
      },
    });

    // ── Programme ─────────────────────────────────────────────────────────
    const progStart = dayAt(HISTORY_WEEKS_START);
    const program = await prisma.program.create({
      data: {
        coachId:              coach.id,
        clientId:             profile.id,
        title:                cd.program,
        description:          `Programme personnalisé — ${cd.goals}`,
        startDate:            progStart,
        isActive:             true,
        dietEnabled:          specialty === 'nutrition',
        dietType:             specialty === 'nutrition' ? 'calories' : null,
        targetCalories:       specialty === 'nutrition'
                                ? (cd.weight && cd.weight > 90 ? 1600 : 1900)
                                : null,
        waterTrackingEnabled: true,
        waterGoal:            2.5,
        sleepTrackingEnabled: true,
        weightTrackingEnabled: true,
      },
    });

    // ── Séances : 12 semaines d'historique + 2 semaines à venir ───────────
    //
    // 12 semaines et non 9 : les filtres de période du dashboard vont jusqu'à
    // 90 jours, et une fenêtre plus courte que le filtre donne des graphiques
    // qui se vident quand on élargit la période — l'inverse de l'attendu.
    const HISTORY_WEEKS = 12;
    const FUTURE_WEEKS  = 2;

    const training = TRAINING[cd.email.split('@')[0]] ?? null;
    const plan     = training ? PLANS[training.plan] : null;
    const progress = training ? PROGRESSIONS[training.progression] : null;
    const levelCode = cd.level === 'débutant' ? 'BEGINNER'
                    : cd.level === 'intermédiaire' ? 'INTERMEDIATE'
                    : cd.level === 'avancé' ? 'ADVANCED' : null;

    // Échauffement et étirement issus de la spécialité : ils portent la couleur du
    // programme sans référence d'exercice, donc sans peser sur les analytics.
    const flavour = EXERCISES[specialty] ?? [];
    const warmups = flavour.filter((e) => e.category === 'WARMUP');
    const cooldowns = flavour.filter((e) => e.category === 'STRETCHING');
    const pick = (arr) => (arr.length ? arr[randInt(0, arr.length - 1)] : null);

    // Clients sans plan de force (cardio, yoga) : on garde l'ancien tirage au sort
    // dans la liste de la spécialité. Ils n'auront pas de volume ni de 1RM, ce qui
    // est le bon comportement — et permet de tester l'état vide de l'onglet.
    const pickFlavourExercises = () => {
      const shuffled = [...flavour].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, Math.min(4, shuffled.length));
    };

    const weekDays = plan ? plan.map((p) => p.day) : [1, 3, 6];
    const usedDates = new Set();
    let clientSets = 0;
    let clientDone = 0;

    for (let week = 0; week < HISTORY_WEEKS + FUTURE_WEEKS; week++) {
      const isFutureWeek = week >= HISTORY_WEEKS;
      const factor = progress ? progress(Math.min(week, HISTORY_WEEKS - 1)) : 1;
      // Semaine de décharge : une série de moins sur chaque mouvement.
      const isDeloadWeek = training?.progression === 'deload' && week === 8;

      for (const dayIdx of weekDays) {
        const dAgo = (HISTORY_WEEKS - 1 - week) * 7 + (7 - dayIdx);
        const sessionDate = dayAt(dAgo);
        const key = sessionDate.toISOString().split('T')[0];
        if (usedDates.has(key)) continue;
        usedDates.add(key);

        const isPast = dAgo > 0;
        // Jour de repos : une semaine sur quatre, à la place de la 2ᵉ séance.
        const isRest = !isFutureWeek && dayIdx === weekDays[1] && week % 4 === 2;
        // L'assiduité pilote la complétion. Les deux dernières semaines sont
        // toujours faites pour les clients assidus, afin que la série en cours
        // (« streak ») soit non nulle et vérifiable à l'écran.
        const recent = week >= HISTORY_WEEKS - 2;
        const done = isPast && !isRest &&
          (training ? (recent && training.adherence >= 0.85 ? true : Math.random() < training.adherence)
                    : Math.random() < 0.8);

        let exerciseRows = [];

        if (plan && !isRest) {
          const session = plan.find((pp) => pp.day === dayIdx);
          const warm = pick(warmups);
          const cool = pick(cooldowns);
          let order = 0;

          if (warm) {
            exerciseRows.push({
              name: warm.name, category: 'WARMUP', sets: warm.sets, reps: warm.reps,
              weight: null, restTime: warm.restTime, duration: warm.duration ?? null,
              order: order++, exerciseRefId: null, _sets: null,
            });
          }

          for (const [liftKey, nbSets] of session.lifts) {
            const lift = LIFTS[liftKey];
            const sets = Math.max(1, isDeloadWeek ? nbSets - 1 : nbSets);
            const [rLo, rHi] = parseRepsRange(lift.reps);
            const oneRM = target1RM(lift, cd, levelCode);
            const base = workingWeight(oneRM == null ? null : oneRM * factor, (rLo + rHi) / 2);

            exerciseRows.push({
              name: lift.name,
              category: lift.timed ? 'RENFORCEMENT' : 'MAIN',
              sets,
              reps: lift.timed ? null : lift.reps,
              weight: base == null ? null : String(roundNearest(base, 2.5)),
              restTime: lift.rest,
              duration: lift.timed ? lift.reps : null,
              order: order++,
              exerciseRefId: refMap.get(lift.ref) ?? null,
              _sets: { rLo, rHi, base, timed: !!lift.timed },
            });
          }

          if (cool) {
            exerciseRows.push({
              name: cool.name, category: 'STRETCHING', sets: cool.sets, reps: cool.reps,
              weight: null, restTime: cool.restTime, duration: cool.duration ?? null,
              order: order++, exerciseRefId: null, _sets: null,
            });
          }
        } else if (!isRest) {
          exerciseRows = pickFlavourExercises().map((ex, order) => ({
            name: ex.name, category: ex.category, sets: ex.sets, reps: ex.reps,
            weight: ex.weight ?? null, restTime: ex.restTime, duration: ex.duration ?? null,
            order, exerciseRefId: null, _sets: null,
          }));
        }

        const createdSession = await prisma.session.create({
          data: {
            programId:         program.id,
            date:              sessionDate,
            status:            done ? 'DONE' : 'EMPTY',
            completedByClient: done,
            isRestDay:         isRest,
            notes:             isRest ? 'Récupération active' : null,
            exercises: exerciseRows.length
              ? { create: exerciseRows.map(({ _sets, ...row }) => row) }
              : undefined,
          },
          include: exerciseRows.length
            ? { exercises: { select: { id: true, order: true, exerciseRefId: true } } }
            : undefined,
        });
        totalSessions++;
        if (done) clientDone++;

        // ── SetCompletions ─────────────────────────────────────────────────
        if (done && createdSession.exercises?.length) {
          const byOrder = new Map(createdSession.exercises.map((e) => [e.order, e]));
          const setRows = [];

          for (const row of exerciseRows) {
            if (!row._sets || !row.exerciseRefId) continue;
            const created = byOrder.get(row.order);
            if (!created) continue;
            const { rLo, rHi, base } = row._sets;

            for (let sn = 1; sn <= row.sets; sn++) {
              // Fatigue intra-séance : les dernières séries perdent une répétition.
              const drop = sn > 2 ? randInt(0, 1) : 0;
              const reps = Math.max(1, randInt(rLo, rHi) - drop);
              // ~5 % de séries non terminées. Le volume et le 1RM ne comptent que
              // les séries `completed: true` : sans échecs, le taux de complétion
              // valait 100 % partout et ne prouvait rien.
              const failed = Math.random() < 0.05;
              setRows.push({
                exerciseId:   created.id,
                setNumber:    sn,
                // Un exercice chronométré remplit durationAchieved et LAISSE
                // repsAchieved vide : le volume et le 1RM lisent les répétitions,
                // un « 60 » y serait compté comme 60 répétitions.
                repsAchieved: row._sets.timed ? null : String(reps),
                durationAchieved: row._sets.timed ? `${randInt(35, 75)}s` : null,
                weightUsed:   base == null ? null : String(roundNearest(base * rand(0.97, 1.03), 2.5)),
                completed:    !failed,
              });
            }
          }

          if (setRows.length) {
            await prisma.setCompletion.createMany({ data: setRows });
            totalSetCompletes += setRows.length;
            clientSets += setRows.length;
          }
        }
      }
    }

    // ── Stats quotidiennes (90 jours, ~85 % de remplissage) ───────────────
    const statsRows = [];
    const mealRows = [];
    // Repas seulement pour les programmes avec suivi diététique, et sur 30 jours :
    // 4 repas × 90 jours × 30 clients feraient 10 800 lignes pour rien.
    const withMeals = program.dietEnabled;

    for (let day = 90; day >= 0; day--) {
      if (Math.random() > 0.85) continue;
      const statDate = dayAt(day);
      const st = buildStats(cd, day);

      let dayCalories = st.totalCalories;
      if (withMeals && day <= 30) {
        const meals = buildMeals(st.totalCalories);
        // Le total de la journée devient la somme des repas : mealController
        // recalcule DailyStat.totalCalories à chaque modification de repas, donc
        // les deux doivent partir cohérents.
        dayCalories = meals.reduce((sum, m) => sum + m.calories, 0);
        for (const m of meals) {
          mealRows.push({ clientId: profile.id, date: statDate, ...m });
        }
      }

      statsRows.push({
        clientId:        profile.id,
        date:            statDate,
        sleepHours:      st.sleepHours,
        bedTime:         st.bedTime,
        wakeTime:        st.wakeTime,
        waterIntake:     st.waterIntake,
        weight:          st.weight,
        totalCalories:   dayCalories,
        workoutTime:     st.workoutTime,
        workoutDuration: st.workoutDuration,
      });
    }
    await prisma.dailyStat.createMany({ data: statsRows });
    totalStats += statsRows.length;

    if (mealRows.length) {
      await prisma.meal.createMany({ data: mealRows });
      totalMeals += mealRows.length;
    }

    const coachName = COACHES[cd.coachIndex].firstName;
    console.log(`   ✓ ${cd.firstName.padEnd(10)} ${cd.lastName.padEnd(12)}` +
      `  genre: ${(cd.gender ?? 'n/a').padEnd(7)}` +
      `  ${cd.birthYear ? new Date().getFullYear() - cd.birthYear + 'a' : 'n/a'}`.padEnd(5) +
      `  ${cd.weight ? cd.weight + 'kg' : 'n/a'}`.padEnd(7) +
      `  → ${coachName.padEnd(9)}` +
      `  ${training ? training.plan.padEnd(13) : '—'.padEnd(13)}` +
      `  ${statsRows.length} stats, ${usedDates.size} séances` +
      `${training ? `, ${clientDone} faites, ${clientSets} séries` : ''}` +
      `${mealRows.length ? `, ${mealRows.length} repas` : ''}`);
  }

  // ── Résumé ────────────────────────────────────────────────────────────────
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅  Seed terminée avec succès !');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  • 5 coachs créés`);
  console.log(`  • 30 clients créés (6 par coach)`);
  console.log(`  • 30 programmes actifs`);
  console.log(`  • ${totalSessions} séances avec exercices`);
  console.log(`  • ${totalStats} entrées de stats quotidiennes`);
  console.log(`  • ${totalMeals} repas (clients avec suivi diététique, 30 derniers jours)`);
  console.log(`  • ${totalSetCompletes} séries réalisées, reliées au catalogue d'exercices`);
  console.log(`  • ${Object.keys(TRAINING).length} clients avec plan de musculation → onglet Musculation alimenté`);
  console.log(`  • ${CLIENTS.length - Object.keys(TRAINING).length} clients sans plan de force → état vide testable`);
  console.log(`  • Mot de passe universel : 123456`);
  console.log('');
  console.log('  👔 Coachs :');
  COACHES.forEach(c => console.log(`     ${c.email}`));
  console.log('');
  console.log('  👥 Clients (extrait) :');
  CLIENTS.slice(0, 5).forEach(c => console.log(`     ${c.email}`));
  console.log(`     ... et ${CLIENTS.length - 5} autres`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Erreur seed :', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
