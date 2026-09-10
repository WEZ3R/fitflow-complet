/**
 * Création d'un compte administrateur.
 *
 * Il n'existe volontairement AUCUNE route HTTP pour créer ou promouvoir un
 * administrateur. `authController.register` refuse tout rôle autre que COACH ou
 * CLIENT, et cette garde doit le rester : une élévation de privilège exposée sur
 * le réseau est une surface d'attaque permanente, pour un besoin qui se produit
 * deux ou trois fois dans la vie d'un projet.
 *
 * L'accès à la base est donc le seul chemin — ce qui revient à dire que seul
 * quelqu'un qui détient déjà les secrets de production peut créer un administrateur.
 *
 * Usage :
 *   node scripts/create-admin.js --email admin@exemple.fr --password "…" \
 *        --firstName Marc --lastName Yrius
 *
 * Sans --password, un mot de passe fort est tiré au hasard et affiché une seule fois.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
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

const arg = (nom) => {
  const i = process.argv.indexOf(`--${nom}`);
  return i > -1 ? process.argv[i + 1] : null;
};

const motDePasseFort = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  return [...randomBytes(20)].map((o) => alphabet[o % alphabet.length]).join('');
};

async function main() {
  const email = arg('email');
  const firstName = arg('firstName') || 'Admin';
  const lastName = arg('lastName') || 'FitFlow';

  if (!email) {
    console.error('✖ --email est obligatoire.');
    process.exit(1);
  }

  const fourni = arg('password');
  const motDePasse = fourni || motDePasseFort();

  const existant = await prisma.user.findUnique({ where: { email } });

  if (existant) {
    // Promouvoir un compte existant plutôt que d'échouer : c'est le cas courant
    // quand on veut donner les droits à un compte déjà créé.
    if (existant.role === 'ADMIN') {
      console.log(`ℹ  ${email} est déjà administrateur.`);
    } else {
      await prisma.user.update({
        where: { id: existant.id },
        data: { role: 'ADMIN' },
      });
      console.log(`✅ ${email} promu administrateur (était ${existant.role}).`);
      console.warn(
        "⚠️  Ce compte conserve son profil coach ou client. Un compte d'administration " +
        'dédié, sans profil métier, est préférable.'
      );
    }
    return;
  }

  const admin = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(motDePasse, 10),
      role: 'ADMIN',
      firstName,
      lastName,
      status: 'ACTIVE',
    },
    select: { id: true, email: true, role: true },
  });

  console.log('✅ Administrateur créé');
  console.log(`   email : ${admin.email}`);
  if (!fourni) {
    console.log(`   mot de passe : ${motDePasse}`);
    console.log('   (affiché une seule fois — conservez-le hors du dépôt)');
  }
  console.log(
    "\nCe compte n'a ni profil coach ni profil client : il ne peut pas s'attribuer\n" +
    'de clients, créer de programmes, ni accéder aux données de santé.'
  );
}

main()
  .catch((e) => {
    console.error('✖ Échec :', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
