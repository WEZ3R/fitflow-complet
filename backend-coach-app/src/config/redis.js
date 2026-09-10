/**
 * Client Redis — magasin clé-valeur utilisé comme cache.
 *
 * Pourquoi une base non relationnelle ici : le compteur de notifications non lues est
 * interrogé par chaque application mobile toutes les 30 secondes. C'est une lecture
 * très fréquente, d'une seule valeur numérique, dont une version vieille de quelques
 * secondes ne gêne personne. La faire compter à PostgreSQL à chaque appel revient à
 * payer un parcours d'index pour une donnée qui ne bouge presque jamais. Un magasin
 * clé-valeur en mémoire répond à ce besoin sans rien changer au modèle relationnel :
 * PostgreSQL reste la source de vérité, Redis n'est qu'un raccourci devant.
 *
 * Dégradation volontaire : si Redis est absent ou tombe, toutes les opérations de cache
 * deviennent des non-opérations et l'application continue de répondre en interrogeant
 * PostgreSQL. Un cache indisponible doit ralentir le service, jamais l'interrompre —
 * c'est aussi ce qui permet aux tests et à l'intégration continue de tourner sans Redis.
 */

import { createClient } from 'redis';

const url = process.env.REDIS_URL || 'redis://localhost:6379';

/** null tant qu'aucune connexion n'a abouti : c'est le signal « cache indisponible ». */
let client = null;
let disabled = process.env.REDIS_DISABLED === '1' || process.env.NODE_ENV === 'test';

if (!disabled) {
  const candidate = createClient({
    url,
    socket: {
      // Sans plafond, node-redis retente indéfiniment et inonde la sortie d'erreurs
      // sur une machine sans Redis. Trois essais suffisent à distinguer un démarrage
      // un peu lent d'une absence réelle.
      reconnectStrategy: (retries) => (retries > 3 ? false : Math.min(retries * 200, 1000)),
    },
  });

  // L'écouteur d'erreur est obligatoire : sans lui, une erreur de connexion devient une
  // exception non capturée qui arrête le processus.
  candidate.on('error', () => {
    if (client) {
      console.warn('⚠️  Redis indisponible — le cache est contourné');
      client = null;
    }
  });

  candidate
    .connect()
    .then(() => {
      client = candidate;
      console.log('✅ Redis connecté — cache du compteur de notifications actif');
    })
    .catch(() => {
      disabled = true;
      console.warn('⚠️  Redis injoignable — l\'application fonctionne sans cache');
    });
}

/** Le client si la connexion est établie, null sinon. Les appelants doivent tester. */
export const getRedis = () => client;

export const closeRedis = async () => {
  if (client) {
    await client.quit().catch(() => {});
    client = null;
  }
};
