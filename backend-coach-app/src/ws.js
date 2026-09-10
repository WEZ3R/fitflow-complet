/**
 * Diffusion temps réel de la messagerie, par WebSocket.
 *
 * Pourquoi un accélérateur et non un remplacement
 * ------------------------------------------------
 * L'API tourne sur plusieurs machines Fly, sans bus partagé : les sockets vivent dans la
 * mémoire d'un seul processus. Une cliente connectée à la machine A ne verra donc pas un
 * message écrit par un coach dont la requête a atterri sur la machine B.
 *
 * Plutôt que de provisionner un Redis pour résoudre ce cas, on assume la faille : le
 * sondage HTTP est conservé côté client, simplement ralenti quand la socket est ouverte.
 * Le WebSocket accélère le cas courant — les deux interlocuteurs sur la même machine, ce
 * qui est le cas la plupart du temps avec deux machines et des sessions courtes — et le
 * sondage rattrape le reste. Aucun message ne peut être perdu : au pire il arrive avec la
 * latence du sondage, c'est-à-dire le comportement d'avant.
 *
 * Conséquence directe : ce module n'a pas le droit de faire échouer une requête HTTP.
 * Toute erreur de diffusion est avalée, jamais remontée à l'appelant.
 */

import { WebSocketServer } from 'ws';
import { verifyToken } from './utils/jwt.js';
import prisma from './config/database.js';

/** Sockets vivantes, indexées par identifiant d'utilisateur. */
const connexions = new Map();

/** Un client silencieux plus longtemps que cela est considéré comme mort. */
const INTERVALLE_PING_MS = 30000;

let serveur = null;

/**
 * Lit le jeton dans l'URL de connexion.
 *
 * Un navigateur ne peut pas poser d'en-tête `Authorization` sur une connexion WebSocket :
 * le jeton doit voyager dans l'URL. C'est acceptable ici parce que la liaison est en TLS
 * (`force_https` côté Fly) et que l'URL n'est pas journalisée par notre serveur — mais
 * c'est bien une exposition de plus que sur l'API REST, et il faut le savoir.
 */
const utilisateurDe = (requete) => {
  try {
    const url = new URL(requete.url, 'http://interne');
    const jeton = url.searchParams.get('token');
    if (!jeton) return null;
    return verifyToken(jeton)?.userId || null;
  } catch {
    return null;
  }
};

const enregistrer = (userId, socket) => {
  if (!connexions.has(userId)) connexions.set(userId, new Set());
  connexions.get(userId).add(socket);
};

const oublier = (userId, socket) => {
  const lot = connexions.get(userId);
  if (!lot) return;
  lot.delete(socket);
  if (lot.size === 0) connexions.delete(userId);
};

/**
 * Envoie un événement aux sockets ouvertes de ces utilisateurs, sur CETTE machine.
 *
 * Les destinataires absents sont ignorés sans bruit : c'est le cas normal, pas une erreur.
 */
export const diffuser = (userIds, evenement) => {
  if (!serveur) return;
  const charge = JSON.stringify(evenement);
  for (const userId of new Set(userIds.filter(Boolean))) {
    for (const socket of connexions.get(userId) || []) {
      if (socket.readyState !== socket.OPEN) continue;
      try {
        socket.send(charge);
      } catch {
        // Une socket qui refuse l'écriture sera fermée par le ping ; rien à faire ici.
      }
    }
  }
};

/**
 * Prévient les deux parties d'une conversation qu'elle a bougé.
 *
 * `coachId` et `clientId` sont des identifiants de PROFIL ; les sockets sont indexées par
 * identifiant d'UTILISATEUR. La résolution coûte une requête, faite en arrière-plan pour
 * ne pas retarder la réponse HTTP.
 */
export const notifierConversation = async (coachId, clientId, evenement) => {
  try {
    const [coach, client] = await Promise.all([
      prisma.coachProfile.findUnique({ where: { id: coachId }, select: { userId: true } }),
      prisma.clientProfile.findUnique({ where: { id: clientId }, select: { userId: true } }),
    ]);
    diffuser([coach?.userId, client?.userId], evenement);
  } catch (erreur) {
    console.error('[ws] diffusion impossible :', erreur.message);
  }
};

export const attacherWebSocket = (httpServer) => {
  serveur = new WebSocketServer({ server: httpServer, path: '/ws' });

  serveur.on('connection', (socket, requete) => {
    const userId = utilisateurDe(requete);
    if (!userId) {
      // 1008 : violation de politique. Le client ne doit pas retenter en boucle.
      socket.close(1008, 'Authentification requise');
      return;
    }

    socket.userId = userId;
    socket.vivant = true;
    enregistrer(userId, socket);

    socket.on('pong', () => { socket.vivant = true; });
    socket.on('close', () => oublier(userId, socket));
    socket.on('error', () => oublier(userId, socket));

    // Le client sait ainsi qu'il peut ralentir son sondage.
    try {
      socket.send(JSON.stringify({ type: 'pret' }));
    } catch { /* socket déjà fermée */ }
  });

  /**
   * Sans ce battement, une socket coupée sans FIN — coupure réseau, mise en veille du
   * téléphone — resterait indéfiniment dans la table et on croirait le destinataire
   * joignable.
   */
  const battement = setInterval(() => {
    for (const socket of serveur.clients) {
      if (!socket.vivant) {
        socket.terminate();
        continue;
      }
      socket.vivant = false;
      try {
        socket.ping();
      } catch { /* la prochaine passe la terminera */ }
    }
  }, INTERVALLE_PING_MS);

  serveur.on('close', () => clearInterval(battement));

  console.log('📡 WebSocket en écoute sur /ws');
  return serveur;
};
