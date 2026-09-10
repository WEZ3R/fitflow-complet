/**
 * Import des salles de sport depuis SIRENE, via l'API Recherche d'entreprises.
 *
 * Source : https://recherche-entreprises.api.gouv.fr — gratuite, sans clé.
 * Filtre : code NAF 93.13Z « Activités des centres de culture physique ».
 *
 * POURQUOI UN DÉCOUPAGE PAR DÉPARTEMENT
 * L'API renvoie des unités légales, et la liste `matching_etablissements` qu'elle
 * attache à chacune plafonne à 100 entrées. Or Basic-Fit France déclare 917
 * établissements ouverts : une requête nationale en perdrait les neuf dixièmes.
 * En filtrant par département, la liste se restreint aux établissements de ce
 * département et repasse sous le plafond. Le script détecte quand même les cas
 * où le plafond est atteint et le signale, plutôt que de tronquer en silence.
 *
 * Les enseignes nationales n'ont pas de champ « marque » dans SIRENE : on la
 * déduit du nom de l'unité légale (BASIC FIT II → Basic-Fit).
 *
 * Usage :
 *   node scripts/import-gyms-sirene.js              # France entière
 *   node scripts/import-gyms-sirene.js 75 69 13     # départements choisis
 *   DRY_RUN=1 node scripts/import-gyms-sirene.js 75 # sans écrire en base
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const API = 'https://recherche-entreprises.api.gouv.fr/search';
const NAF = '93.13Z';
const PER_PAGE = 25;      // maximum accepté par l'API
const MATCH_LIMIT = 100;  // maximum accepté pour matching_etablissements
const THROTTLE_MS = 180;  // ~5,5 req/s : sous la limite de l'API (7/s)
const DRY_RUN = process.env.DRY_RUN === '1';

/** 96 départements métropolitains + Corse + outre-mer. */
const DEPARTEMENTS = [
  ...Array.from({ length: 95 }, (_, i) => String(i + 1).padStart(2, '0')).filter((d) => d !== '20'),
  '2A', '2B',
  '971', '972', '973', '974', '976',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Enseignes nationales reconnues dans la dénomination légale. */
const BRANDS = [
  [/basic\s*-?\s*fit/i, 'Basic-Fit'],
  [/fitness\s*park/i, 'Fitness Park'],
  [/keep\s*cool/i, 'Keep Cool'],
  [/orange\s*bleue/i, "L'Orange Bleue"],
  [/neoness/i, 'Neoness'],
  [/gigagym/i, 'Gigagym'],
  [/\bcmg\b|cercles?\s+de\s+la\s+forme/i, 'CMG Sports Club'],
  [/forest\s*hill/i, 'Forest Hill'],
  [/on\s*air/i, 'On Air'],
  [/vita\s*liberté/i, 'Vita Liberté'],
  [/l['’ ]?appart\s*fitness/i, "L'Appart Fitness"],
  [/curves/i, 'Curves'],
  [/wellness\s*sport\s*club/i, 'Wellness Sport Club'],
  [/interval/i, 'Interval'],
  [/liberty\s*gym/i, 'Liberty Gym'],
  [/moving/i, 'Moving'],
];

/**
 * Cherche l'enseigne dans tout ce qui peut la porter.
 *
 * La dénomination légale seule ne suffit pas : un franchisé Basic-Fit s'appelle
 * « SARL MARTIN », et l'enseigne n'apparaît que dans `liste_enseignes`. En ne
 * regardant que la raison sociale, l'enseigne n'était trouvée que sur 9 % des
 * fiches — donc surtout les succursales des groupes, pas les franchises.
 */
const detectBrand = (...candidats) => {
  const haystack = candidats.filter(Boolean).join(' | ');
  for (const [re, label] of BRANDS) if (re.test(haystack)) return label;
  return null;
};

/**
 * Nom lisible d'un établissement.
 * L'enseigne locale est plus parlante que la dénomination légale quand elle existe
 * (« BASIC FIT II » → « Basic-Fit Rue Froment » n'existe pas dans SIRENE, mais
 * `enseigne` porte souvent le nom d'exploitation réel).
 */
const displayName = (etab, uniteLegale, brand) => {
  // Enseigne reconnue : on impose le libellé canonique. SIRENE écrit la même
  // enseigne de dix façons (« BASIC FIT », « BASIC-FIT », « BASIC FIT II »), et
  // c'est l'adresse qui distingue les établissements, pas le nom.
  if (brand) return brand;
  const enseigne = (etab.liste_enseignes ?? []).find(Boolean);
  if (enseigne) return titleCase(enseigne);
  if (etab.nom_commercial) return titleCase(etab.nom_commercial);
  return titleCase(uniteLegale.nom_complet ?? 'Salle de sport');
};

/** MAJUSCULES ADMINISTRATIVES → Casse Lisible, en préservant sigles et numéros romains. */
const titleCase = (s) =>
  String(s)
    .toLowerCase()
    .replace(/\b([a-zà-ÿ])([a-zà-ÿ'’-]*)/g, (_, a, b) => a.toUpperCase() + b)
    .replace(/\b(Sas|Sarl|Sasu|Eurl|Snc|Cmg|Ucpa)\b/g, (m) => m.toUpperCase())
    // « Basic Fit Ii » : les numéros romains ressortent en casse de mot.
    .replace(/\b(I{1,3}|IV|VI{0,3}|IX|XI{0,2})\b/gi, (m) => m.toUpperCase())
    .trim();

/**
 * Décompose « 6 RUE FROMENT 75011 PARIS » en rue / code postal / ville.
 * L'API ne fournit pas ces champs séparément dans matching_etablissements.
 */
const splitAddress = (adresse) => {
  const m = String(adresse ?? '').match(/^(.*?)\s(\d{5})\s(.+)$/);
  if (!m) return { street: adresse || null, postalCode: null, city: '' };
  // SIRENE concatène le complément et le numéro, ce qui répète la borne basse
  // d'une plage : « 15-17 15 RUE CROZATIER » → « 15-17 RUE CROZATIER ».
  const street = m[1].replace(/^(\d+)\s*-\s*(\d+)\s+\1\s+/, '$1-$2 ');
  return {
    street: titleCase(street),
    postalCode: m[2],
    // « PARIS 11 » → « Paris » : l'arrondissement est déjà dans le code postal.
    city: titleCase(m[3].replace(/\s+\d+$/, '')),
  };
};

async function fetchPage(departement, page) {
  const qs = new URLSearchParams({
    activite_principale: NAF,
    departement,
    etat_administratif: 'A', // établissements actifs uniquement
    per_page: String(PER_PAGE),
    page: String(page),
    limite_matching_etablissements: String(MATCH_LIMIT),
  });

  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`${API}?${qs}`, { headers: { Accept: 'application/json' } });
    if (res.ok) return res.json();
    // 429 = quota momentané, 5xx = incident passager : on réessaie en s'espaçant.
    if (res.status === 429 || res.status >= 500) {
      await sleep(THROTTLE_MS * 4 * attempt);
      continue;
    }
    throw new Error(`HTTP ${res.status} sur ${departement} page ${page}`);
  }
  throw new Error(`échec après 4 tentatives : ${departement} page ${page}`);
}

async function main() {
  const wanted = process.argv.slice(2);
  const departements = wanted.length ? wanted : DEPARTEMENTS;

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  🏋  Import SIRENE — NAF ${NAF}${DRY_RUN ? '   [DRY RUN]' : ''}`);
  console.log(`      ${departements.length} département(s)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const seen = new Map();       // siret → fiche
  let requests = 0;
  let truncated = [];           // départements où le plafond de 100 a été atteint
  let sansCoord = 0;

  for (const dep of departements) {
    let page = 1;
    let totalPages = 1;
    let depCount = 0;

    do {
      const json = await fetchPage(dep, page);
      requests++;
      totalPages = Math.min(json.total_pages ?? 1, 400); // l'API refuse au-delà

      for (const ul of json.results ?? []) {
        const etabs = ul.matching_etablissements ?? [];
        if (etabs.length >= MATCH_LIMIT) truncated.push(`${dep}/${ul.siren}`);

        for (const et of etabs) {
          if (!et.siret) continue;
          if (et.etat_administratif && et.etat_administratif !== 'A') continue;

          const brand = detectBrand(
            ul.nom_complet,
            et.nom_commercial,
            ...(et.liste_enseignes ?? []),
          );

          const lat = et.latitude != null ? parseFloat(et.latitude) : null;
          const lng = et.longitude != null ? parseFloat(et.longitude) : null;
          // latitude/longitude sont obligatoires dans le modèle Gym : sans elles
          // la fiche ne peut ni être cartographiée ni cherchée par rayon.
          if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
            sansCoord++;
            continue;
          }

          const { street, postalCode, city } = splitAddress(et.adresse);
          seen.set(et.siret, {
            source: 'sirene',
            sourceId: et.siret,
            name: displayName(et, ul, brand),
            brand,
            address: street,
            city,
            postalCode,
            country: 'FR',
            latitude: lat,
            longitude: lng,
          });
          depCount++;
        }
      }

      page++;
      await sleep(THROTTLE_MS);
    } while (page <= totalPages);

    process.stdout.write(`   ${dep.padEnd(4)} ${String(depCount).padStart(4)} établissement(s)\n`);
  }

  const rows = [...seen.values()];
  console.log(`\n   ${requests} requêtes API, ${rows.length} établissements géolocalisés`);
  if (sansCoord) console.log(`   ${sansCoord} écartés faute de coordonnées`);
  if (truncated.length) {
    console.log(`   ⚠️  plafond de ${MATCH_LIMIT} établissements atteint pour : ${truncated.join(', ')}`);
    console.log('      → ces unités légales sont incomplètes, découper par code postal pour elles');
  }

  if (DRY_RUN) {
    console.log('\n   [DRY RUN] rien n\'a été écrit. Échantillon :');
    rows.slice(0, 8).forEach((g) =>
      console.log(`     ${g.name.slice(0, 30).padEnd(32)} ${(g.address ?? '—').slice(0, 34).padEnd(36)} ${g.postalCode ?? '—'}  ${g.brand ?? ''}`));
    return;
  }

  // Upsert par (source, sourceId) : relancer l'import met à jour sans dupliquer.
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
    console.error('\n❌ Import SIRENE :', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
