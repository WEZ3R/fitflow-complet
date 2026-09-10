/**
 * Liaison temps réel avec l'API, pour la messagerie.
 *
 * Ce n'est pas le canal de vérité : le sondage HTTP reste en place, simplement ralenti
 * quand la socket est ouverte. L'API tourne sur plusieurs machines Fly sans bus partagé,
 * donc un message écrit sur une machine où notre socket n'est pas connectée n'arrive pas
 * par ici — le sondage le rattrape. Le WebSocket accélère le cas courant, il ne garantit
 * rien à lui seul.
 *
 * Rien dans ce module ne doit pouvoir casser un écran : toute erreur est avalée, et
 * l'absence de socket est un état normal.
 */

type Evenement = { type: string; coachId?: string; clientId?: string };
type Auditeur = (evenement: Evenement) => void;

/** Reconnexion par paliers, pour ne pas marteler une machine en veille. */
const ATTENTES_MS = [1000, 2000, 5000, 10000, 30000];

let socket: WebSocket | null = null;
let tentative = 0;
let fermeeVolontairement = false;
let minuteur: ReturnType<typeof setTimeout> | null = null;

const auditeurs = new Set<Auditeur>();

/**
 * `https://host/api` → `wss://host/ws`. L'adresse est dérivée de celle de l'API plutôt
 * que configurée à part : deux réglages qui doivent rester cohérents finissent toujours
 * par diverger.
 *
 * Cas particulier du repli `/api` : sans hôte, on prend celui de la page.
 */
const adresseSocket = (): string => {
  const base = process.env.NEXT_PUBLIC_API_URL || "/api";
  if (/^https?:\/\//i.test(base)) {
    return base.replace(/^http/i, "ws").replace(/\/api\/?$/, "") + "/ws";
  }
  const protocole = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocole}//${window.location.host}/ws`;
};

const planifierReconnexion = () => {
  if (fermeeVolontairement) return;
  const attente = ATTENTES_MS[Math.min(tentative, ATTENTES_MS.length - 1)];
  tentative += 1;
  if (minuteur) clearTimeout(minuteur);
  minuteur = setTimeout(connecter, attente);
};

export const connecter = () => {
  if (typeof window === "undefined") return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  fermeeVolontairement = false;

  const jeton = localStorage.getItem("token");
  if (!jeton) return;

  try {
    socket = new WebSocket(`${adresseSocket()}?token=${encodeURIComponent(jeton)}`);
  } catch {
    planifierReconnexion();
    return;
  }

  socket.onopen = () => {
    tentative = 0;
  };

  socket.onmessage = (evenement) => {
    let message: Evenement;
    try {
      message = JSON.parse(evenement.data);
    } catch {
      return;
    }
    for (const auditeur of auditeurs) {
      try {
        auditeur(message);
      } catch {
        // Un abonné en échec ne doit pas priver les autres de l'événement.
      }
    }
  };

  // 1008 = jeton refusé : réessayer serait une boucle. Tout autre code — réseau coupé,
  // machine Fly qui s'endort — mérite une reconnexion.
  socket.onclose = (evenement) => {
    socket = null;
    if (evenement.code === 1008) return;
    planifierReconnexion();
  };

  socket.onerror = () => {
    /* onclose suivra et décidera */
  };
};

export const deconnecter = () => {
  fermeeVolontairement = true;
  if (minuteur) clearTimeout(minuteur);
  tentative = 0;
  try {
    socket?.close();
  } catch {
    /* déjà fermée */
  }
  socket = null;
};

/** true quand la liaison est établie — sert à choisir le rythme du sondage. */
export const estConnecte = () => socket?.readyState === WebSocket.OPEN;

/** Abonnement ; rend la fonction de désabonnement. */
export const ecouter = (auditeur: Auditeur) => {
  auditeurs.add(auditeur);
  return () => {
    auditeurs.delete(auditeur);
  };
};
