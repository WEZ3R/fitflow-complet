// Seed des aliments Ciqual en base de données
// Usage : node scripts/seed-ciqual.js

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, '..', 'prisma', 'data', 'ciqual.json');

const prisma = new PrismaClient();

async function main() {
  const foods = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
  console.log(`📦 ${foods.length} aliments à importer...`);

  // Insérer par lots de 500
  const BATCH = 500;
  let inserted = 0;

  for (let i = 0; i < foods.length; i += BATCH) {
    const batch = foods.slice(i, i + BATCH);
    const result = await prisma.ciqualFood.createMany({
      data: batch,
      skipDuplicates: true,
    });
    inserted += result.count;
    console.log(`  ✓ Lot ${Math.floor(i / BATCH) + 1} : ${result.count} insérés`);
  }

  console.log(`✅ Import terminé : ${inserted} aliments insérés`);
}

main()
  .catch((e) => {
    console.error('Erreur lors du seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
