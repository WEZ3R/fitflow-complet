/**
 * Nettoyage de la base des salles : positions douteuses et doublons entre sources.
 *
 * DEUX PROBLÈMES DISTINCTS, MESURÉS SUR LES DONNÉES RÉELLES
 *
 * 1. Positions au mauvais endroit. SIRENE fournit l'adresse ADMINISTRATIVE de
 *    l'établissement. Pour un réseau de franchise, c'est souvent le siège du
 *    franchiseur : « Kc Euralille » et « Kc Malakoff » se retrouvent tous deux
 *    à Ventabren (13), à des centaines de kilomètres de leur ville. Le symptôme
 *    observable est l'empilement : 11 fiches sur des coordonnées identiques.
 *    Un point au mauvais endroit est pire qu'un point absent — on les marque
 *    `approxPosition` et la carte les écarte.
 *
 * 2. Doublons entre sources. La même salle existe côté SIRENE et côté OSM, ce qui
 *    donne deux épingles au même endroit. On garde une seule fiche, en prenant à
 *    chaque source ce qu'elle fait de mieux : la position d'OSM (un POI cartographié
 *    est sur le bâtiment), l'adresse de SIRENE (renseignée à 100 %), et l'enseigne
 *    de celle qui l'a.
 *
 * Sans argument, le script ne fait que MESURER. `--apply` écrit.
 *
 * Usage :
 *   node scripts/clean-gyms.js            # rapport seul
 *   node scripts/clean-gyms.js --apply    # applique
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
// Les fusions suppriment des lignes. Le marquage, lui, s'annule d'un UPDATE : on
// peut donc l'appliquer seul, sans engager la partie destructive.
const FLAGS_ONLY = process.argv.includes('--flags-only');

/** Au-delà de ce nombre de fiches sur des coordonnées identiques, on suspecte un siège. */
const STACK_THRESHOLD = 3;
/** Distance en dessous de laquelle deux fiches peuvent désigner la même salle. */
const DUP_METERS = 150;
/**
 * Seuil resserré pour les paires qui ne portent QUE le nom d'une enseigne.
 *
 * « Fitness Park » face à « Fitness Park » à 138 m peut être une seule salle
 * géocodée de deux façons, ou deux clubs distincts. Sans élément distinctif dans
 * le nom, rien ne permet de trancher — et fusionner à tort fait disparaître une
 * salle que personne ne pourra plus sélectionner. On s'abstient donc au-delà de
 * 80 m : un doublon visible est moins grave qu'une salle perdue.
 */
const DUP_METERS_SAME_BRAND = 80;

/** Normalise un nom pour la comparaison : casse, accents, ponctuation, articles. */
const normalize = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(le|la|les|de|du|des|the|salle|sport|fitness|club|gym)\b/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

/**
 * Deux noms désignent-ils la même salle ?
 * L'inclusion couvre « Keep Cool » vs « Keep Cool Bordeaux ». Le recouvrement de
 * mots couvre « Kepp Cool » (faute de frappe dans SIRENE) vs « KeepCool ».
 */
function sameName(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(' ').filter((w) => w.length > 2));
  const tb = new Set(nb.split(' ').filter((w) => w.length > 2));
  if (!ta.size || !tb.size) return false;
  const common = [...ta].filter((w) => tb.has(w)).length;
  return common / Math.min(ta.size, tb.size) >= 0.6;
}

async function main() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  🧹  Nettoyage des salles${APPLY ? '' : '   [MESURE SEULE — ajoutez --apply]'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const total = await prisma.gym.count();
  console.log(`   ${total} fiches en base\n`);

  // ── 1. Positions empilées ─────────────────────────────────────────────────
  const stacks = await prisma.$queryRaw`
    SELECT latitude, longitude, COUNT(*)::int AS n
    FROM gyms
    GROUP BY latitude, longitude
    HAVING COUNT(*) >= ${STACK_THRESHOLD}`;

  const stackedCount = stacks.reduce((s, r) => s + r.n, 0);
  console.log(`── Positions douteuses`);
  console.log(`   ${stacks.length} groupe(s) de coordonnées portant ${stackedCount} fiches`);

  if (stacks.length) {
    const worst = [...stacks].sort((a, b) => b.n - a.n).slice(0, 3);
    for (const s of worst) {
      const sample = await prisma.gym.findMany({
        where: { latitude: s.latitude, longitude: s.longitude },
        select: { name: true, city: true },
        take: 3,
      });
      console.log(`     ${String(s.n).padStart(3)} fiches à ${s.latitude.toFixed(4)},${s.longitude.toFixed(4)} (${sample[0]?.city}) : ${sample.map((x) => x.name).join(', ')}…`);
    }
  }

  if ((APPLY || FLAGS_ONLY) && stacks.length) {
    let flagged = 0;
    for (const s of stacks) {
      const r = await prisma.gym.updateMany({
        where: { latitude: s.latitude, longitude: s.longitude },
        data: { approxPosition: true },
      });
      flagged += r.count;
    }
    console.log(`   ✅ ${flagged} fiches marquées approxPosition`);
  }

  // ── 2. Doublons entre sources ─────────────────────────────────────────────
  const pairs = await prisma.$queryRaw`
    SELECT a.id AS a_id, b.id AS b_id, a.name AS a_name, b.name AS b_name,
           a.brand AS a_brand, b.brand AS b_brand,
           a.source AS a_source, b.source AS b_source,
           ROUND((6371000 * acos(LEAST(1,
             cos(radians(a.latitude)) * cos(radians(b.latitude)) *
             cos(radians(b.longitude) - radians(a.longitude)) +
             sin(radians(a.latitude)) * sin(radians(b.latitude)))))::numeric, 0)::int AS d
    FROM gyms a
    JOIN gyms b ON a.id < b.id
    WHERE abs(a.latitude - b.latitude) < 0.0015
      AND abs(a.longitude - b.longitude) < 0.0022
      AND a.source <> b.source`;

  const dups = pairs.filter((p) => {
    if (p.d > DUP_METERS || !sameName(p.a_name, p.b_name)) return false;
    // Paire sans élément distinctif : les deux noms se réduisent à l'enseigne.
    const bare =
      p.a_brand && p.a_brand === p.b_brand &&
      normalize(p.a_name) === normalize(p.a_brand) &&
      normalize(p.b_name) === normalize(p.b_brand);
    return bare ? p.d <= DUP_METERS_SAME_BRAND : true;
  });
  console.log(`\n── Doublons entre sources`);
  console.log(`   ${pairs.length} paire(s) proches, ${dups.length} retenue(s) comme doublons`);
  dups.slice(0, 6).forEach((p) =>
    console.log(`     ${String(p.d).padStart(4)} m  [${p.a_source}] ${p.a_name.slice(0, 24)}  ⇔  [${p.b_source}] ${p.b_name.slice(0, 24)}`));

  if (APPLY && dups.length) {
    let merged = 0;
    const gone = new Set();

    for (const p of dups) {
      if (gone.has(p.a_id) || gone.has(p.b_id)) continue; // déjà traité en chaîne

      const [a, b] = await Promise.all([
        prisma.gym.findUnique({ where: { id: p.a_id } }),
        prisma.gym.findUnique({ where: { id: p.b_id } }),
      ]);
      if (!a || !b) continue;

      const osm = a.source === 'osm' ? a : b;
      const sirene = a.source === 'sirene' ? a : b;
      // On garde la fiche SIRENE — son adresse est fiable et son SIRET est un
      // identifiant stable — mais on lui donne la position d'OSM, qui pointe le
      // bâtiment et non l'adresse administrative.
      const keep = sirene;
      const drop = osm;

      await prisma.gym.update({
        where: { id: keep.id },
        data: {
          latitude: osm.latitude,
          longitude: osm.longitude,
          brand: keep.brand ?? osm.brand,
          name: keep.brand ?? keep.name, // le libellé d'enseigne reste prioritaire
          approxPosition: false,         // la position vient d'un POI cartographié
        },
      });

      // Les rattachements client/coach doivent survivre à la fusion.
      await prisma.clientGym.updateMany({ where: { gymId: drop.id }, data: { gymId: keep.id } }).catch(() => {});
      await prisma.coachGym.updateMany({ where: { gymId: drop.id }, data: { gymId: keep.id } }).catch(() => {});
      await prisma.gym.delete({ where: { id: drop.id } });

      gone.add(drop.id);
      merged++;
    }
    console.log(`   ✅ ${merged} fiche(s) fusionnée(s)`);
  }

  // ── Résumé ────────────────────────────────────────────────────────────────
  const after = await prisma.gym.count();
  const approx = await prisma.gym.count({ where: { approxPosition: true } });
  const bySource = await prisma.gym.groupBy({ by: ['source'], _count: { _all: true } });
  console.log(`\n── État final`);
  console.log(`   ${after} fiches  (${bySource.map((s) => `${s.source}=${s._count._all}`).join(', ')})`);
  console.log(`   ${approx} à position douteuse, écartées de la carte`);
  console.log(`   ${after - approx} affichables\n`);

  if (FLAGS_ONLY) console.log('   Marquage appliqué. Les fusions attendent --apply.\n');
  else if (!APPLY) console.log('   Rien n\'a été modifié. --flags-only marque, --apply fusionne aussi.\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Nettoyage :', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
