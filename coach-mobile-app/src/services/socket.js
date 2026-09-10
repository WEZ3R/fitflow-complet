/**
 * Liaison temps réel avec l'API, pour la messagerie.
 *
 * Ce n'est PAS le canal de vérité : le sondage HTTP reste en place, simplement ralenti
 * quand la socket est ouverte. L'API tourne sur plusieurs machines sans bus partagé, donc
 * un message peut très bien être écrit sur une machine où notre socket n'est pas
 * connectée — il arrivera alors par le sondage. Le WebSocket fait gagner du temps dans le
 * cas courant, il ne garantit rien à lui seul.
 *
 * Conséquence de conception : rien ici ne doit pouvoir casser l'écran. Toute erreur est
 * avalée, et l'absence de socket est un état normal, pas une panne.
 */

import { API_URL } from '../../config';
import { getToken } from './api';

/** Reconnexion : on remonte par paliers pour ne pas marteler un serveur en veille. */
const ATTENTES_MS = [1000, 2000, 5000, 10000, 30000];

let socket = null;
let tentative = 0;
let ferméeVolontairement = false;
let minuteur = null;

/** Abonnés aux événements reçus. */
const auditeurs = new Set();

/**
 * `https://host/api` → `wss://host/ws`. On dérive l'adresse de l'API plutôt que d'en
 * configurer une seconde : deux réglages qui doivent rester cohérents finissent toujours
 * par diverger.
 */
const adresseSocket = () =>
  API_URL.replace(/^http/, 'ws').replace(/\/api\/?$/, '') + '/ws';

const planifierReconnexion = () => {
  if (ferméeVolontairement) return;
  const attente = ATTENTES_MS[Math.min(tentative, ATTENTES_MS.length - 1)];
  tentative += 1;
  clearTimeout(minuteur);
  minuteur = setTimeout(connecter, attente);
};

export const connecter = async () => {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  ferméeVolontairement = false;

  let jeton = null;
  try {
    jeton = await getToken();
  } catch {
    return; // Jeton illisible : on reste sur le sondage.
  }
  if (!jeton) return;

  try {
    socket = new WebSocket(`${adresseSocket()}?token=${encodeURIComponent(jeton)}`);
  } catch {
    planifierReconnexion();
    return;
  }

  socket.onopen = () => { tentative = 0; };

  socket.onmessage = (evenement) => {
    let message;
    try {
      message = JSON.parse(evenement.data);
    } catch {
      return;
    }
    for (const auditeur of auditeurs) {
      try {
        auditeur(message);
      } catch {
        // Un abonné qui échoue ne doit pas empêcher les autres d'être servis.
      }
    }
  };

  // 1008 = jeton refusé : inutile de réessayer, ce serait une boucle. Tout autre code
  // (coupure réseau, machine Fly qui s'endort) mérite une reconnexion.
  socket.onclose = (evenement) => {
    socket = null;
    if (evenement?.code === 1008) return;
    planifierReconnexion();
  };

  socket.onerror = () => { /* onclose suivra et décidera */ };
};

export const deconnecter = () => {
  ferméeVolontairement = true;
  clearTimeout(minuteur);
  tentative = 0;
  try {
    socket?.close();
  } catch { /* déjà fermée */ }
  socket = null;
};

/** true quand la liaison est réellement établie — sert à choisir le rythme du sondage. */
export const estConnecte = () => socket?.readyState === WebSocket.OPEN;

/** Abonnement ; rend la fonction de désabonnement. */
export const ecouter = (auditeur) => {
  auditeurs.add(auditeur);
  return () => auditeurs.delete(auditeur);
};
