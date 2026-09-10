/**
 * Purge les comptes laissés par la suite de tests dans une base de travail.
 *
 * Origine du problème : `npm test` visait le serveur de développement, donc la base
 * de développement. Chaque exécution y semait des comptes @test.com. C'est corrigé
 * à la racine (npm test monte une base isolée, et __tests__/helpers.js refuse toute
 * instance qui n'est pas en NODE_ENV=test), mais les comptes déjà créés restent.
 *
 * La suppression cascade depuis User vers les profils, programmes, séances, messages.
 *
 * Sans argument, le script ne fait que COMPTER. `--apply` supprime.
 *
 * Usage :
 *   node scripts/purge-test-accounts.js
 *   node scripts/purge-test-accounts.js --apply
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

/**
 * Motifs des comptes générés par les tests.
 *
 * Volontairement étroits : `@test.com` et `@fitflow.test` sont les domaines produits
 * par __tests__/helpers.js. On ne touche ni aux comptes du seed (@fitflow-seed.com),
 * ni à quoi que ce soit d'autre.
 */
const PATTERNS = ['@test.com', '@fitflow.test'];

async function main() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  🧽  Purge des comptes de test${APPLY ? '' : '   [COMPTAGE SEUL — ajoutez --apply]'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const where = { OR: PATTERNS.map((p) => ({ email: { endsWith: p } })) };

  const total = await prisma.user.count();
  const victims = await prisma.user.findMany({
    where,
    select: { id: true, email: true, role: true },
  });

  console.log(`   ${total} comptes en base, dont ${victims.length} issus des tests\n`);
  if (victims.length === 0) {
    console.log('   Rien à purger.\n');
    return;
  }

  const byRole = victims.reduce((acc, u) => ({ ...acc, [u.role]: (acc[u.role] ?? 0) + 1 }), {});
  console.log('   par rôle :', Object.entries(byRole).map(([r, n]) => `${r}=${n}`).join(', '));

  // Ce que la cascade emportera, pour que le volume soit connu AVANT de supprimer.
  const ids = victims.map((u) => u.id);

  // Program n'a PAS de relation `client` déclarée : `clientId` est une colonne nue,
  // sans clé étrangère en base. On passe donc par la liste des identifiants de
  // profils clients, faute de pouvoir traverser la relation.
  const clientProfiles = await prisma.clientProfile.findMany({
    where: { userId: { in: ids } }, select: { id: true },
  });
  const clientIds = clientProfiles.map((c) => c.id);

  const [profilesK, programs, sessions, messages] = await Promise.all([
    prisma.coachProfile.count({ where: { userId: { in: ids } } }),
    prisma.program.count({ where: { OR: [
      { coach: { userId: { in: ids } } },
      { clientId: { in: clientIds } },
    ] } }),
    prisma.session.count({ where: { program: { OR: [
      { coach: { userId: { in: ids } } },
      { clientId: { in: clientIds } },
    ] } } }),
    prisma.message.count({ where: { OR: [
      { coach: { userId: { in: ids } } },
      { client: { userId: { in: ids } } },
    ] } }),
  ]);
  const profilesC = clientProfiles.length;

  console.log('\n   emporté par la cascade :');
  console.log(`     ${profilesK} profils coach, ${profilesC} profils client`);
  console.log(`     ${programs} programmes, ${sessions} séances, ${messages} messages`);

  // `programs.clientId` n'a pas de contrainte : supprimer un profil client laisse
  // ses programmes derrière lui. On les retire explicitement.
  const orphanRisk = await prisma.program.count({ where: { clientId: { in: clientIds } } });
  if (orphanRisk > 0) {
    console.log(`     ⚠️  ${orphanRisk} programme(s) ne seraient PAS emportés (clientId sans clé étrangère)`);
  }

  console.log('\n   échantillon :');
  victims.slice(0, 5).forEach((u) => console.log(`     ${u.email}`));
  if (victims.length > 5) console.log(`     … et ${victims.length - 5} autres`);

  const seedIntact = await prisma.user.count({ where: { email: { endsWith: '@fitflow-seed.com' } } });
  console.log(`\n   comptes du seed préservés : ${seedIntact} (jamais visés)`);

  if (!APPLY) {
    console.log('\n   Rien n\'a été supprimé. Relancez avec --apply.\n');
    return;
  }

  // Les programmes rattachés par `clientId` d'abord : aucune clé étrangère ne les
  // emportera, ils survivraient en orphelins.
  const prog = await prisma.program.deleteMany({ where: { clientId: { in: clientIds } } });
  const { count } = await prisma.user.deleteMany({ where });
  console.log(`\n   ✅ ${count} comptes supprimés, ${prog.count} programme(s) rattachés retirés`);
  console.log(`   reste en base : ${await prisma.user.count()} comptes\n`);
}

main()
  .catch((e) => {
    console.error('\n❌ Purge :', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
