/**
 * Import des salles de sport depuis OpenStreetMap (Overpass).
 *
 * POURQUOI UNE SECONDE SOURCE
 * SIRENE recense des ENTREPRISES. Les clubs de franchise sont exploités par des
 * sociétés au nom quelconque, et l'enseigne n'est presque jamais renseignée : les
 * trois On Air de Bordeaux sont absents des 6 388 lignes SIRENE, et absents aussi
 * du recensement Data ES du ministère. OpenStreetMap, renseigné par les pratiquants,
 * en connaît deux — sous le nom que tout le monde utilise.
 *
 * Les deux sources sont donc complémentaires, et le sont dans des directions
 * opposées :
 *   SIRENE  adresse et code postal à 100 %, enseignes de franchise manquantes
 *   OSM     enseignes présentes, adresse renseignée dans 20 % des cas seulement
 *
 * Le découpage en cellules de 2° évite les requêtes nationales, que l'instance
 * publique refuse (504). Chaque cellule est réessayée, et les miroirs sont
 * essayés à tour de rôle.
 *
 * Usage :
 *   node scripts/import-gyms-osm.js                    # France métropolitaine
 *   node scripts/import-gyms-osm.js 44.2,-1.1,45.4,0.2 # une emprise précise
 *   DRY_RUN=1 node scripts/import-gyms-osm.js ...
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
const USER_AGENT = 'FitFlow/1.0 (contact@fitflow.app)';
const DRY_RUN = process.env.DRY_RUN === '1';
const CELL = 2; // degrés
const PAUSE_MS = 1500; // courtoisie envers une instance publique et gratuite

/** France métropolitaine, corse comprise. */
const METROPOLE = { minLat: 41.3, maxLat: 51.2, minLng: -5.3, maxLng: 9.7 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cells(box) {
  const out = [];
  for (let lat = box.minLat; lat < box.maxLat; lat += CELL) {
    for (let lng = box.minLng; lng < box.maxLng; lng += CELL) {
      out.push({
        minLat: lat,
        maxLat: Math.min(lat + CELL, box.maxLat),
        minLng: lng,
        maxLng: Math.min(lng + CELL, box.maxLng),
      });
    }
  }
  return out;
}

async function overpass(cell) {
  // `nwr` couvre nodes, ways et relations en un mot-clé. `out center` donne un
  // point unique même pour un bâtiment tracé en polygone.
  const query = `[out:json][timeout:120];
(
  nwr["leisure"="fitness_centre"](${cell.minLat},${cell.minLng},${cell.maxLat},${cell.maxLng});
  nwr["sport"="fitness"](${cell.minLat},${cell.minLng},${cell.maxLat},${cell.maxLng});
);
out center;`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    for (const url of MIRRORS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
        });
        if (res.ok) {
          const json = await res.json();
          // Overpass répond 200 avec un résultat PARTIEL quand il atteint sa
          // propre limite de temps ou de mémoire : la coupure est annoncée dans
          // `remark`, pas dans le code HTTP. Sans ce test, une cellule tronquée
          // passe pour une cellule vide et le trou est invisible.
          if (json.remark && /timed out|out of memory|runtime error/i.test(json.remark)) {
            await sleep(4000 * attempt);
            continue;
          }
          return json.elements ?? [];
        }
        // 429 et 504 sont la norme sur les instances publiques : on patiente.
        if (res.status === 429 || res.status >= 500) await sleep(4000 * attempt);
      } catch {
        await sleep(2000 * attempt);
      }
    }
  }
  return null; // échec de la cellule, signalé à l'appelant
}

/** Enseignes reconnues, pour renseigner `brand` quand OSM ne le fait pas. */
const BRANDS = [
  [/basic\s*-?\s*fit/i, 'Basic-Fit'],
  [/fitness\s*park/i, 'Fitness Park'],
  [/keep\s*-?\s*cool/i, 'Keep Cool'],
  [/orange\s*bleue/i, "L'Orange Bleue"],
  [/neoness/i, 'Neoness'],
  [/gigagym/i, 'Gigagym'],
  [/\bcmg\b|cercles?\s+de\s+la\s+forme/i, 'CMG Sports Club'],
  [/forest\s*hill/i, 'Forest Hill'],
  [/on\s*'?\s*air/i, 'On Air'],
  [/vita\s*liberté/i, 'Vita Liberté'],
  [/l['’ ]?appart\s*fitness/i, "L'Appart Fitness"],
  [/curves/i, 'Curves'],
  [/wellness\s*sport\s*club/i, 'Wellness Sport Club'],
  [/liberty\s*gym/i, 'Liberty Gym'],
  [/amazonia/i, 'Amazonia'],
  [/moving/i, 'Moving'],
  [/l['’ ]?usine/i, "L'Usine"],
  [/episod/i, 'Episod'],
];

const detectBrand = (...cands) => {
  const hay = cands.filter(Boolean).join(' | ');
  for (const [re, label] of BRANDS) if (re.test(hay)) return label;
  return null;
};

function toGym(el) {
  const lat = el.type === 'node' ? el.lat : el.center?.lat;
  const lng = el.type === 'node' ? el.lon : el.center?.lon;
  if (lat == null || lng == null) return null;

  const t = el.tags ?? {};
  const name = t.name || t['name:fr'] || t.brand || t.operator;
  // Un point sans nom n'aide personne à désigner sa salle : on l'écarte plutôt
  // que d'afficher « Salle de sport » sur la carte, comme le faisait l'ancien code.
  if (!name) return null;

  const street = t['addr:street']
    ? `${t['addr:housenumber'] ?? ''} ${t['addr:street']}`.trim()
    : null;

  return {
    source: 'osm',
    sourceId: `${el.type}/${el.id}`,
    osmId: `${el.type}/${el.id}`,
    name,
    brand: detectBrand(t.brand, t.operator, name),
    address: street,
    city: t['addr:city'] ?? '',
    postalCode: t['addr:postcode'] ?? null,
    country: 'FR',
    latitude: lat,
    longitude: lng,
  };
}

async function main() {
  const arg = process.argv[2];
  const box = arg
    ? (() => {
        const [a, b, c, d] = arg.split(',').map(Number);
        return { minLat: a, minLng: b, maxLat: c, maxLng: d };
      })()
    : METROPOLE;

  const grid = cells(box);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  🗺  Import OpenStreetMap${DRY_RUN ? '   [DRY RUN]' : ''}`);
  console.log(`      ${grid.length} cellule(s) de ${CELL}°`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const seen = new Map();
  const failed = [];
  let sansNom = 0;

  for (const [i, cell] of grid.entries()) {
    const els = await overpass(cell);
    if (els === null) {
      failed.push(`${cell.minLat},${cell.minLng}`);
      console.log(`   ${String(i + 1).padStart(3)}/${grid.length}  ${cell.minLat},${cell.minLng}  ÉCHEC`);
      continue;
    }
    let kept = 0;
    for (const el of els) {
      const g = toGym(el);
      if (!g) { sansNom++; continue; }
      seen.set(g.sourceId, g);
      kept++;
    }
    console.log(`   ${String(i + 1).padStart(3)}/${grid.length}  ${String(cell.minLat).padStart(5)},${String(cell.minLng).padStart(5)}  ${String(els.length).padStart(4)} objets → ${String(kept).padStart(4)} retenus`);
    await sleep(PAUSE_MS);
  }

  const rows = [...seen.values()];
  console.log(`\n   ${rows.length} salles nommées et géolocalisées`);
  console.log(`   ${sansNom} écartées faute de nom`);
  if (failed.length) console.log(`   ⚠️  ${failed.length} cellule(s) en échec : ${failed.join(' ')}`);

  if (DRY_RUN) {
    console.log('\n   [DRY RUN] rien écrit. Échantillon :');
    rows.slice(0, 10).forEach((g) =>
      console.log(`     ${g.name.slice(0, 28).padEnd(30)} ${(g.address ?? '—').slice(0, 28).padEnd(30)} ${g.postalCode ?? '—'}  ${g.brand ?? ''}`));
    return;
  }

  let created = 0;
  let updated = 0;
  for (const g of rows) {
    const { source, sourceId, ...data } = g;
    const before = await prisma.gym.findUnique({
      where: { source_sourceId: { source, sourceId } },
      select: { id: true },
    });
    await prisma.gym.upsert({
      where: { source_sourceId: { source, sourceId } },
      update: data,
      create: { source, sourceId, ...data },
    });
    before ? updated++ : created++;
  }

  console.log(`\n   ✅ ${created} créées, ${updated} mises à jour`);
}

main()
  .catch((e) => {
    console.error('\n❌ Import OSM :', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
