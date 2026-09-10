#!/usr/bin/env node
/**
 * Détecte l'IP locale active et met à jour DB_HOST dans .env
 * Usage : npm run db:host
 */

import { networkInterfaces } from 'os';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');

function getLocalIPs() {
  const nets = networkInterfaces();
  const results = [];

  for (const [name, addrs] of Object.entries(nets)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        results.push({ name, address: addr.address });
      }
    }
  }
  return results;
}

const ips = getLocalIPs();

if (ips.length === 0) {
  console.log('Aucune IP externe détectée, utilisation de localhost');
  process.exit(0);
}

// Afficher les IPs disponibles
console.log('\nInterfaces réseau disponibles :');
ips.forEach((ip, i) => {
  console.log(`  ${i + 1}. ${ip.name.padEnd(12)} → ${ip.address}`);
});

// Prendre la première IP (généralement Wi-Fi en0 sur macOS)
const selected = ips[0];
console.log(`\n✅ IP sélectionnée : ${selected.address} (${selected.name})`);

// Mettre à jour DB_HOST dans .env
let envContent = readFileSync(envPath, 'utf-8');

if (envContent.includes('DB_HOST=')) {
  envContent = envContent.replace(/^DB_HOST=.*/m, `DB_HOST=${selected.address}`);
} else {
  envContent += `\nDB_HOST=${selected.address}`;
}

writeFileSync(envPath, envContent);
console.log(`📝 .env mis à jour : DB_HOST=${selected.address}`);
console.log('   Relancez le serveur pour appliquer le changement.\n');
