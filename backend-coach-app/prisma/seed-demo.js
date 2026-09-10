/**
 * Jeu de données de démonstration — 1 coach, 5 clients.
 *
 * Destiné à l'environnement en ligne, pour une démonstration devant jury. Il diffère de
 * `seed.js` sur deux points essentiels :
 *
 *   1. les mots de passe ne sont PAS en dur ici. Ils sont tirés au hasard à l'exécution
 *      et écrits dans un fichier hors dépôt, dont le chemin est passé en argument ;
 *   2. le calendrier est ancré sur la date d'exécution : des séances passées déjà
 *      validées, la séance du jour, et des séances à venir jusqu'à la date de fin.
 *      Une démonstration a besoin d'un « aujourd'hui » crédible, pas de dates figées.
 *
 * Usage :
 *   node prisma/seed-demo.js --credentials "C:/chemin/hors-depot/comptes.md"
 *   node prisma/seed-demo.js --credentials "..." --until 2026-09-12
 *
 * Le script est idempotent sur les comptes : si une adresse existe déjà, elle est
 * supprimée puis recréée (les cascades du schéma emportent les données liées).
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { writeFileSync } from 'fs';
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

// ─── Arguments ────────────────────────────────────────────────────────────────

const arg = (nom) => {
  const i = process.argv.indexOf(`--${nom}`);
  return i > -1 ? process.argv[i + 1] : null;
};

const CHEMIN_IDENTIFIANTS = arg('credentials');
const FIN = new Date(`${arg('until') || '2026-09-12'}T00:00:00.000Z`);

/**
 * Mot de passe commun à tous les comptes de démonstration.
 *
 * Fourni par --password, sinon tiré au hasard compte par compte. Un mot de passe unique
 * et retenable simplifie une démonstration en direct — on bascule de la vue coach à la
 * vue client sans consulter de fiche. C'est un choix acceptable ici parce que ces comptes
 * ne contiennent que des données fabriquées ; il ne le serait pas pour de vrais
 * utilisateurs, dont les données de santé sont en jeu.
 */
const MOT_DE_PASSE_IMPOSE = arg('password');

if (!CHEMIN_IDENTIFIANTS) {
  console.error("✖ --credentials est obligatoire : le fichier doit être écrit HORS du dépôt.");
  process.exit(1);
}

// ─── Dates ────────────────────────────────────────────────────────────────────

const AUJOURDHUI = new Date();
AUJOURDHUI.setUTCHours(0, 0, 0, 0);

const jourDecale = (n) => {
  const d = new Date(AUJOURDHUI);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

/** Date + heure, en UTC, pour les rendez-vous. */
const jourHeure = (n, heure, minute = 0) => {
  const d = jourDecale(n);
  d.setUTCHours(heure, minute, 0, 0);
  return d;
};

const JOURS_AVANT = 21;                                            // historique
const JOURS_APRES = Math.max(
  1,
  Math.round((FIN - AUJOURDHUI) / 86400000)
);                                                                 // jusqu'à --until

// ─── Mots de passe ────────────────────────────────────────────────────────────

/**
 * Mot de passe aléatoire lisible : quatre groupes de quatre caractères.
 * L'alphabet exclut les caractères ambigus (0/O, 1/l/I) — ces mots de passe seront
 * lus sur un écran puis retapés, éventuellement à la main devant un jury.
 */
const motDePasse = () => {
  if (MOT_DE_PASSE_IMPOSE) return MOT_DE_PASSE_IMPOSE;

  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const octets = randomBytes(16);
  const chars = [...octets].map((o) => alphabet[o % alphabet.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join('')).join('-');
};

// ─── Données des personnes ────────────────────────────────────────────────────

const COACH = {
  prenom: 'Thomas', nom: 'Bernard', email: 'thomas@test.com',
  bio: "Coach sportif diplômé, spécialisé en hypertrophie et remise en forme. "
     + "J'accompagne mes clients en salle comme à distance, avec un suivi hebdomadaire.",
  experience: '8 ans', city: 'Bordeaux',
  specialties: ['HYPERTROPHY', 'STRENGTH', 'WEIGHT_LOSS'],
};

const CLIENTS = [
  { prenom: 'Camille', nom: 'Dubois',  email: 'camille@test.com',
    gender: 'F', age: 28, height: 168, weight: 62,
    goalCategory: 'WEIGHT_LOSS', level: 'INTERMEDIATE', city: 'Bordeaux',
    programme: 'Remise en forme — 12 semaines', principal: true },
  { prenom: 'Lucas',   nom: 'Girard',  email: 'lucas@test.com',
    gender: 'H', age: 33, height: 181, weight: 92,
    goalCategory: 'MUSCLE_GAIN', level: 'ADVANCED', city: 'Bordeaux',
    programme: 'Force maximale — Powerlifting', principal: true },
  { prenom: 'Sarah',   nom: 'Lemoine', email: 'sarah@test.com',
    gender: 'F', age: 24, height: 165, weight: 58,
    goalCategory: 'FITNESS', level: 'BEGINNER', city: 'Mérignac',
    programme: 'Tonification corps entier', principal: true },
  { prenom: 'Maxime',  nom: 'Roux',    email: 'maxime@test.com',
    gender: 'H', age: 25, height: 175, weight: 70,
    goalCategory: 'MUSCLE_GAIN', level: 'BEGINNER', city: 'Bordeaux',
    programme: 'Prise de masse — Débutant', principal: true },
  { prenom: 'Inès',    nom: 'Faure',   email: 'ines@test.com',
    gender: 'F', age: 31, height: 170, weight: 65,
    goalCategory: 'ENDURANCE', level: 'INTERMEDIATE', city: 'Talence',
    programme: 'Préparation semi-marathon', principal: true },
];

// ─── Séances types ────────────────────────────────────────────────────────────

const SEANCES = {
  haut: {
    nom: 'Haut du corps',
    exercices: [
      { name: 'Rameur',                category: 'WARMUP', duration: '8 min', order: 0 },
      { name: 'Développé couché',      category: 'MAIN', sets: 4, reps: '8',  weight: '60', restTime: '120s', order: 1 },
      { name: 'Tirage vertical',       category: 'MAIN', sets: 4, reps: '10', weight: '50', restTime: '90s',  order: 2 },
      { name: 'Développé militaire',   category: 'MAIN', sets: 3, reps: '10', weight: '30', restTime: '90s',  order: 3 },
      { name: 'Curl haltères',         category: 'MAIN', sets: 3, reps: '12', weight: '12', restTime: '60s',  order: 4 },
      { name: 'Gainage planche',       category: 'RENFORCEMENT', sets: 3, duration: '45s', restTime: '30s',   order: 5 },
      { name: 'Étirements pectoraux',  category: 'STRETCHING', duration: '5 min', order: 6 },
    ],
  },
  bas: {
    nom: 'Bas du corps',
    exercices: [
      { name: 'Vélo',                  category: 'WARMUP', duration: '10 min', order: 0 },
      { name: 'Squat barre',           category: 'MAIN', sets: 5, reps: '5',  weight: '80', restTime: '180s', order: 1 },
      { name: 'Presse à cuisses',      category: 'MAIN', sets: 4, reps: '10', weight: '120', restTime: '120s', order: 2 },
      { name: 'Soulevé de terre roumain', category: 'MAIN', sets: 3, reps: '10', weight: '70', restTime: '120s', order: 3 },
      { name: 'Mollets debout',        category: 'MAIN', sets: 4, reps: '15', weight: '40', restTime: '60s',  order: 4 },
      { name: 'Chaise contre le mur',  category: 'RENFORCEMENT', sets: 3, duration: '60s', restTime: '45s',   order: 5 },
      { name: 'Étirements ischios',    category: 'STRETCHING', duration: '5 min', order: 6 },
    ],
  },
  cardio: {
    nom: 'Cardio & renforcement',
    exercices: [
      { name: 'Corde à sauter',        category: 'WARMUP', duration: '5 min', order: 0 },
      { name: 'Course fractionnée',    category: 'CARDIO', duration: '25 min', order: 1 },
      { name: 'Burpees',               category: 'MAIN', sets: 4, reps: '12', restTime: '60s', order: 2 },
      { name: 'Gainage latéral',       category: 'RENFORCEMENT', sets: 4, duration: '40s', restTime: '30s', order: 3 },
      { name: 'Étirements complets',   category: 'STRETCHING', duration: '8 min', order: 4 },
    ],
  },
};

/** Rotation hebdomadaire : lundi haut, mardi bas, jeudi cardio, vendredi haut. */
const planning = (date) => {
  switch (date.getUTCDay()) {
    case 1: return SEANCES.haut;
    case 2: return SEANCES.bas;
    case 4: return SEANCES.cardio;
    case 5: return SEANCES.haut;
    default: return null;                     // jour de repos
  }
};

// ─── Utilitaires ──────────────────────────────────────────────────────────────

const entre = (min, max) => Math.round((min + Math.random() * (max - min)) * 10) / 10;

async function purgerCompte(email) {
  const existant = await prisma.user.findUnique({ where: { email } });
  if (existant) await prisma.user.delete({ where: { id: existant.id } });
}

// ─── Programme principal ──────────────────────────────────────────────────────

async function main() {
  console.log(`▸ Aujourd'hui : ${AUJOURDHUI.toISOString().slice(0, 10)}`);
  console.log(`▸ Séances générées de J-${JOURS_AVANT} à J+${JOURS_APRES} (${FIN.toISOString().slice(0, 10)})`);

  const identifiants = [];

  // ── Coach ──
  await purgerCompte(COACH.email);
  const mdpCoach = motDePasse();
  const coachUser = await prisma.user.create({
    data: {
      email: COACH.email,
      password: await bcrypt.hash(mdpCoach, 10),
      role: 'COACH',
      firstName: COACH.prenom,
      lastName: COACH.nom,
    },
  });
  const coach = await prisma.coachProfile.create({
    data: {
      userId: coachUser.id,
      bio: COACH.bio,
      experience: COACH.experience,
      city: COACH.city,
      isRemote: true,
      specialties: COACH.specialties,
      onboardingCompletedAt: new Date(),
    },
  });
  identifiants.push({ role: 'Coach', nom: `${COACH.prenom} ${COACH.nom}`, email: COACH.email, motDePasse: mdpCoach });
  console.log(`  ✓ coach ${COACH.email}`);

  // ── Clients ──
  for (const c of CLIENTS) {
    await purgerCompte(c.email);
    const mdp = motDePasse();

    const user = await prisma.user.create({
      data: {
        email: c.email,
        password: await bcrypt.hash(mdp, 10),
        role: 'CLIENT',
        firstName: c.prenom,
        lastName: c.nom,
      },
    });

    const naissance = new Date();
    naissance.setUTCFullYear(naissance.getUTCFullYear() - c.age);

    const client = await prisma.clientProfile.create({
      data: {
        userId: user.id,
        weight: c.weight,
        height: c.height,
        dateOfBirth: naissance,
        gender: c.gender,
        goalCategory: c.goalCategory,
        level: c.level,
        city: c.city,
        onboardingCompletedAt: new Date(),
      },
    });

    await prisma.clientCoach.create({
      data: {
        clientId: client.id,
        coachId: coach.id,
        isPrimary: c.principal,
        isActive: true,
        startDate: jourDecale(-60),
      },
    });

    // ── Programme et séances ──
    const programme = await prisma.program.create({
      data: {
        coachId: coach.id,
        clientId: client.id,
        title: c.programme,
        description: `Programme personnalisé pour ${c.prenom}.`,
        startDate: jourDecale(-JOURS_AVANT),
        endDate: FIN,
        isActive: true,
        weightTrackingEnabled: true,
        waterTrackingEnabled: true,
        sleepTrackingEnabled: true,
      },
    });

    let faites = 0;
    for (let j = -JOURS_AVANT; j <= JOURS_APRES; j++) {
      const date = jourDecale(j);
      const modele = planning(date);
      if (!modele) continue;

      // Passé : la séance a été faite. Aujourd'hui et après : elle reste à faire.
      const passee = j < 0;
      const session = await prisma.session.create({
        data: {
          programId: programme.id,
          date,
          name: modele.nom,
          status: passee ? 'DONE' : 'DRAFT',
          completedByClient: passee,
          durationSeconds: passee ? 60 * (50 + Math.round(Math.random() * 25)) : null,
          exercises: {
            create: modele.exercices.map((e) => ({
              name: e.name,
              category: e.category,
              sets: e.sets ?? null,
              reps: e.reps ?? null,
              weight: e.weight ?? null,
              duration: e.duration ?? null,
              restTime: e.restTime ?? null,
              order: e.order,
            })),
          },
        },
        include: { exercises: true },
      });

      if (!passee) continue;
      faites++;

      // Séries réellement effectuées : la charge progresse légèrement d'une semaine
      // à l'autre, et le ressenti d'effort varie — c'est ce qui rend les courbes
      // d'analytics lisibles plutôt que plates.
      const progression = 1 + (JOURS_AVANT + j) / 400;
      for (const ex of session.exercises) {
        if (!ex.sets) continue;
        for (let s = 1; s <= ex.sets; s++) {
          await prisma.setCompletion.create({
            data: {
              exerciseId: ex.id,
              setNumber: s,
              repsAchieved: ex.reps ?? null,
              durationAchieved: ex.duration ?? null,
              weightUsed: ex.weight
                ? String(Math.round(Number(ex.weight) * progression))
                : null,
              rpe: entre(6, 9),
              completed: true,
            },
          });
        }
      }
    }

    // ── Statistiques quotidiennes ──
    for (let j = -JOURS_AVANT; j <= 0; j++) {
      const perte = c.goalCategory === 'WEIGHT_LOSS' ? (JOURS_AVANT + j) * 0.02 : 0;
      await prisma.dailyStat.create({
        data: {
          clientId: client.id,
          date: jourDecale(j),
          weight: Math.round((c.weight - perte) * 10) / 10,
          waterIntake: entre(1.2, 2.8),
          sleepHours: entre(6, 8.5),
          totalCalories: Math.round(1700 + Math.random() * 700),
        },
      });
    }

    identifiants.push({ role: 'Client', nom: `${c.prenom} ${c.nom}`, email: c.email, motDePasse: mdp });
    console.log(`  ✓ client ${c.email} — ${faites} séances validées`);
  }

  // ── Rendez-vous à venir ──────────────────────────────────────────────────────
  // Étalés sur les jours qui viennent, avec les trois statuts représentés pour que
  // l'agenda ne soit pas monochrome pendant la démonstration.
  const clients = await prisma.clientProfile.findMany({
    where: { user: { email: { in: CLIENTS.map((c) => c.email) } } },
    include: { user: true },
  });

  const rdv = [
    { i: 0, j: 1, h: 10, statut: 'CONFIRMED', titre: 'Séance coaching' },
    { i: 1, j: 1, h: 14, statut: 'CONFIRMED', titre: 'Bilan de progression' },
    { i: 2, j: 2, h: 9,  statut: 'PROPOSED',  titre: 'Première séance' },
    { i: 3, j: 3, h: 18, statut: 'CONFIRMED', titre: 'Séance coaching' },
    { i: 4, j: 5, h: 11, statut: 'PROPOSED',  titre: 'Point nutrition' },
    { i: 0, j: 8, h: 10, statut: 'CONFIRMED', titre: 'Séance coaching' },
  ];

  for (const r of rdv) {
    const client = clients[r.i];
    if (!client) continue;
    const debut = jourHeure(r.j, r.h);
    const appointment = await prisma.appointment.create({
      data: {
        title: r.titre,
        coachId: coach.id,
        clientId: client.id,
        startAt: debut,
        endAt: new Date(debut.getTime() + 60 * 60000),
        durationMinutes: 60,
        locationType: 'GYM',
        locationDetail: 'Salle Basic-Fit Bordeaux Lac',
        status: r.statut,
      },
    });

    // Une proposition sans son message serait invisible dans la conversation.
    if (r.statut === 'PROPOSED') {
      await prisma.message.create({
        data: {
          coachId: coach.id,
          clientId: client.id,
          content: `Nouvelle proposition de RDV : « ${r.titre} » le ${debut.toLocaleDateString('fr-FR')}.`,
          type: 'APPOINTMENT_PROPOSAL',
          isSentByCoach: true,
          appointmentId: appointment.id,
        },
      });
    }
  }
  console.log(`  ✓ ${rdv.length} rendez-vous`);

  // ── Conversations ────────────────────────────────────────────────────────────
  const echanges = [
    { coach: true,  texte: "Bonjour ! J'ai mis à jour ton programme pour les deux prochaines semaines." },
    { coach: false, texte: "Super, merci ! J'ai fait la séance d'hier, les jambes ont pris cher 😅" },
    { coach: true,  texte: "C'est bon signe. Pense bien à t'hydrater et à dormir 7 h minimum." },
    { coach: false, texte: "Reçu. Je peux décaler la séance de jeudi ?" },
  ];

  for (const client of clients.slice(0, 3)) {
    let i = 0;
    for (const e of echanges) {
      await prisma.message.create({
        data: {
          coachId: coach.id,
          clientId: client.id,
          content: e.texte,
          type: 'CHAT',
          isSentByCoach: e.coach,
          isRead: e.coach,
          createdAt: new Date(Date.now() - (echanges.length - i) * 3600_000),
        },
      });
      i++;
    }
  }

  // Un conseil du coach, pour illustrer le type TIP
  await prisma.message.create({
    data: {
      coachId: coach.id,
      clientId: clients[0].id,
      content: "Conseil de la semaine : augmente ta charge de 2,5 kg seulement quand tu "
             + "réussis toutes tes séries à l'aise. La progression régulière bat la progression rapide.",
      type: 'TIP',
      isSentByCoach: true,
    },
  });
  console.log('  ✓ conversations');

  // ── Fichier d'identifiants, hors dépôt ───────────────────────────────────────
  const lignes = [
    '# FitFlow — comptes de démonstration',
    '',
    `Générés le ${new Date().toLocaleString('fr-FR')}.`,
    '',
    '**Ce fichier ne doit jamais être versionné ni transmis.**',
    MOT_DE_PASSE_IMPOSE
      ? 'Mot de passe commun à tous les comptes, imposé au lancement du script.'
      : 'Les mots de passe sont tirés au hasard à chaque exécution : relancer le script les remplace tous.',
    '',
    '| Rôle | Nom | Email | Mot de passe |',
    '| --- | --- | --- | --- |',
    ...identifiants.map((i) => `| ${i.role} | ${i.nom} | \`${i.email}\` | \`${i.motDePasse}\` |`),
    '',
    '## Contenu généré',
    '',
    `- Historique de séances validées sur ${JOURS_AVANT} jours, avec séries, charges et RPE`,
    `- Séances à venir jusqu'au ${FIN.toISOString().slice(0, 10)}`,
    '- Statistiques quotidiennes : poids, hydratation, sommeil, calories',
    '- Rendez-vous confirmés et propositions en attente',
    '- Conversations, dont un conseil de type TIP',
    '',
  ];
  writeFileSync(CHEMIN_IDENTIFIANTS, lignes.join('\n'), 'utf8');
  console.log(`\n✅ Identifiants écrits dans ${CHEMIN_IDENTIFIANTS}`);
}

main()
  .catch((e) => {
    console.error('✖ Échec du seed de démonstration :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
