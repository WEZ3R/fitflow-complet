/**
 * Ajoute une séance de musculation exploitable par l'analyse d'intensité (INOL).
 *
 * Utile pour tester les rapports sur un client qui n'a que du cardio ou du yoga :
 * l'INOL exige des exercices reliés au catalogue ExerciseReference, avec des charges
 * et des répétitions réellement saisies.
 *
 * Le 1RM de référence est cherché sur les 8 semaines précédant la période demandée,
 * mais la séance créée fait elle-même partie de cette fenêtre : ses propres séries
 * établissent donc la référence. Une seule séance suffit pour obtenir un INOL.
 *
 * Usage :
 *   node scripts/add-strength-session.js jade.mercier@fitflow-seed.com 2026-08-14
 *   DRY_RUN=1 node scripts/add-strength-session.js <email> <YYYY-MM-DD>
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === '1';

/**
 * Séance complète : échauffement sans référence, puis mouvements reliés au catalogue.
 * `ratio` = 1RM en multiple du poids de corps pour un homme intermédiaire, pondéré
 * ensuite par le niveau et le sexe — mêmes conventions que prisma/seed.js.
 */
const WARMUP = { name: 'Échauffement articulaire', category: 'WARMUP', sets: 1, reps: '10min', rest: '0' };

const LIFTS = [
  { ref: 'ff_qua_01', name: 'Squat barre haute',        ratio: 1.40, reps: '5',     sets: 5, rest: '4min' },
  { ref: 'ff_pec_01', name: 'Développé couché barre',   ratio: 1.00, reps: '6-8',   sets: 4, rest: '3min' },
  { ref: 'ff_dos_10', name: 'Soulevé de terre',         ratio: 1.75, reps: '5',     sets: 3, rest: '4min' },
  { ref: 'ff_epa_01', name: 'Développé militaire',      ratio: 0.65, reps: '8-10',  sets: 4, rest: '2min' },
  { ref: 'ff_dos_06', name: 'Rowing barre',             ratio: 0.95, reps: '8-10',  sets: 4, rest: '2min' },
  { ref: 'ff_bic_01', name: 'Curl barre droite',        ratio: 0.40, reps: '10-12', sets: 3, rest: '90s' },
  { ref: 'ff_abd_04', name: 'Gainage planche',          ratio: null, reps: '60s',   sets: 3, rest: '60s' },
];

const LEVEL_FACTOR = { BEGINNER: 0.72, INTERMEDIATE: 1.0, ADVANCED: 1.28 };
const GENDER_FACTOR = { male: 1.0, female: 0.68 };

const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const roundNearest = (n, step) => Math.round(n / step) * step;

const parseReps = (r) => {
  const m = String(r).match(/^(\d+)[-–](\d+)$/);
  if (m) return [+m[1], +m[2]];
  const one = String(r).match(/^(\d+)/);
  return one ? [+one[1], +one[1]] : [8, 10];
};

async function main() {
  const email = process.argv[2];
  const dateArg = process.argv[3];
  if (!email || !dateArg) {
    console.error('Usage : node scripts/add-strength-session.js <email client> <YYYY-MM-DD>');
    process.exit(1);
  }

  const [y, m, d] = dateArg.split('-').map(Number);
  // Minuit LOCAL, comme le reste du seed : c'est ce qui fait apparaître la séance
  // au bon jour dans le calendrier, qui affiche des dates locales.
  const sessionDate = new Date(y, m - 1, d, 0, 0, 0, 0);

  const client = await prisma.clientProfile.findFirst({
    where: { user: { email } },
    select: { id: true, weight: true, gender: true, level: true,
              user: { select: { firstName: true, lastName: true } } },
  });
  if (!client) throw new Error(`Client introuvable : ${email}`);

  const program = await prisma.program.findFirst({
    where: { clientId: client.id, isActive: true },
    select: { id: true, title: true },
  });
  if (!program) throw new Error(`Aucun programme actif pour ${email}`);

  const existing = await prisma.session.findFirst({
    where: {
      programId: program.id,
      date: { gte: sessionDate, lt: new Date(sessionDate.getTime() + 86400000) },
    },
    select: { id: true, date: true },
  });

  const refs = await prisma.exerciseReference.findMany({
    where: { exerciseDbId: { in: LIFTS.map((l) => l.ref) } },
    select: { id: true, exerciseDbId: true, name: true },
  });
  const refMap = new Map(refs.map((r) => [r.exerciseDbId, r.id]));
  const missing = LIFTS.filter((l) => !refMap.has(l.ref));
  if (missing.length) {
    throw new Error(
      `Références absentes du catalogue : ${missing.map((l) => l.ref).join(', ')}\n` +
      `→ Lancez d'abord « npm run seed:exercises ».`,
    );
  }

  const bw = client.weight ?? 70;
  const factor = (LEVEL_FACTOR[client.level] ?? 0.85) * (GENDER_FACTOR[client.gender] ?? 0.9);

  console.log('');
  console.log(`  Client   : ${client.user.firstName} ${client.user.lastName} (${bw} kg, ${client.gender}, ${client.level})`);
  console.log(`  Programme: ${program.title}`);
  console.log(`  Date     : ${sessionDate.toLocaleDateString('fr-FR')} (local)`);
  if (existing) console.log(`  ⚠️  Une séance existe déjà ce jour (${existing.id}) — elle sera remplacée.`);
  console.log('');

  // Construction des exercices et des séries, pour pouvoir les afficher avant écriture.
  const rows = [];
  let order = 0;
  rows.push({ ...WARMUP, order: order++, refId: null, weight: null, sets_: [] });

  for (const lift of LIFTS) {
    const [lo, hi] = parseReps(lift.reps);
    const oneRM = lift.ratio == null ? null : bw * lift.ratio * factor;
    // Epley inversé : la charge de travail correspondant aux répétitions visées.
    const base = oneRM == null ? null : oneRM / (1 + (lo + hi) / 2 / 30);

    const sets_ = [];
    for (let n = 1; n <= lift.sets; n++) {
      const drop = n > 2 ? randInt(0, 1) : 0;
      sets_.push({
        setNumber: n,
        repsAchieved: String(Math.max(1, randInt(lo, hi) - drop)),
        weightUsed: base == null ? null : String(roundNearest(base * rand(0.97, 1.03), 2.5)),
        completed: Math.random() > 0.05,
      });
    }

    rows.push({
      name: lift.name, category: 'MAIN', sets: lift.sets, reps: lift.reps, rest: lift.rest,
      order: order++, refId: refMap.get(lift.ref),
      weight: base == null ? null : String(roundNearest(base, 2.5)),
      sets_,
    });
  }

  for (const r of rows) {
    const w = r.weight ? `${r.weight} kg` : '—';
    console.log(`  ${String(r.order).padStart(2)}. ${r.name.padEnd(26)} ${r.category.padEnd(7)} ${String(r.sets).padStart(2)}×${String(r.reps).padEnd(6)} ${w.padStart(9)}  ${r.refId ? 'catalogue ✓' : ''}`);
  }
  const totalSets = rows.reduce((s, r) => s + r.sets_.length, 0);
  console.log(`\n  ${rows.length} exercices, ${totalSets} séries`);

  if (DRY_RUN) {
    console.log('\n  [DRY RUN] rien écrit.\n');
    return;
  }

  if (existing) await prisma.session.delete({ where: { id: existing.id } });

  const created = await prisma.session.create({
    data: {
      programId: program.id,
      date: sessionDate,
      status: 'DONE',
      // Les deux sont nécessaires : l'analyse filtre sur completedByClient, le
      // calendrier colore la case d'après status.
      completedByClient: true,
      isRestDay: false,
      name: 'Séance force — test intensité',
      exercises: {
        create: rows.map((r) => ({
          name: r.name, category: r.category, sets: r.sets, reps: r.reps,
          weight: r.weight, restTime: r.rest, order: r.order, exerciseRefId: r.refId,
        })),
      },
    },
    include: { exercises: { select: { id: true, order: true } } },
  });

  const byOrder = new Map(created.exercises.map((e) => [e.order, e.id]));
  const setRows = rows.flatMap((r) =>
    r.sets_.map((s) => ({ exerciseId: byOrder.get(r.order), ...s })),
  );
  if (setRows.length) await prisma.setCompletion.createMany({ data: setRows });

  console.log(`\n  ✅ Séance créée : ${created.id}`);
  console.log(`     ${created.exercises.length} exercices, ${setRows.length} séries enregistrées\n`);
}

main()
  .catch((e) => {
    console.error('\n❌', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
