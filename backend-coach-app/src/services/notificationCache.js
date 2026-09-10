/**
 * Cache du compteur de notifications non lues.
 *
 * Stratégie : lecture au travers du cache (« read-through ») avec invalidation à
 * l'écriture. La valeur porte aussi une expiration courte, qui sert de filet : si une
 * invalidation était oubliée quelque part, l'écart se résorberait de lui-même en une
 * minute au lieu de persister indéfiniment.
 *
 * Le compromis assumé : entre le moment où une notification est créée et celui où le
 * cache est invalidé, un client peut lire une valeur périmée pendant quelques
 * millisecondes. Pour un badge de cloche, c'est sans conséquence — on ne mettrait pas
 * un solde bancaire derrière ce mécanisme.
 */

import { getRedis } from '../config/redis.js';

/** Une clé par utilisateur : l'invalidation ne touche jamais le compteur d'un autre. */
const keyFor = (userId) => `notif:unread:${userId}`;

/** Filet de sécurité en cas d'invalidation manquante. */
const TTL_SECONDS = 60;

/**
 * Valeur en cache, ou null s'il n'y a rien — ou si Redis est indisponible.
 * Un défaut de cache et un cache absent se traitent pareil : on retourne à PostgreSQL.
 */
export const getCachedUnreadCount = async (userId) => {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const value = await redis.get(keyFor(userId));
    if (value === null) return null;

    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
};

export const setCachedUnreadCount = async (userId, count) => {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(keyFor(userId), String(count), { EX: TTL_SECONDS });
  } catch {
    // Un cache qu'on ne peut pas écrire ne doit pas faire échouer la requête.
  }
};

/**
 * À appeler dès que le nombre de non-lues change : création d'une notification,
 * marquage comme lue, marquage global. Supprimer la clé plutôt que la recalculer évite
 * de dupliquer ici la requête de comptage : la prochaine lecture s'en chargera.
 */
export const invalidateUnreadCount = async (userId) => {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(keyFor(userId));
  } catch {
    // Idem : l'invalidation est un confort, la TTL couvre l'échec.
  }
};

/** Invalidation groupée, pour les traitements qui notifient plusieurs personnes. */
export const invalidateManyUnreadCounts = async (userIds) => {
  await Promise.all([...new Set(userIds)].map(invalidateUnreadCount));
};
