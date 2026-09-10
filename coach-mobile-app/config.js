import Constants from 'expo-constants';

/**
 * Adresse de l'API.
 *
 * L'application doit fonctionner dans trois situations, et c'est la troisième qui a
 * longtemps manqué :
 *
 *   1. développement, téléphone et machine sur le même réseau local ;
 *   2. développement à travers un tunnel Expo, depuis n'importe quel réseau ;
 *   3. application installée, sans serveur de développement du tout.
 *
 * Le choix se fait sur la nature de l'hôte Expo, pas sur `__DEV__`. Un bundle servi par
 * Metro à travers un tunnel a bien `__DEV__ === true`, mais son hôte est un nom de
 * domaine (`xxx.exp.direct`) : construire `http://<ce nom>:5001/api` donne une adresse
 * qui n'existe pas, et l'application attend indéfiniment une réponse qui ne viendra
 * jamais. Seule une adresse IP privée désigne réellement une machine de développement
 * joignable.
 */

const PRODUCTION_URL = 'https://fitflow-api.fly.dev/api';

/** 10.x, 192.168.x, 172.16-31.x : les plages privées, donc une machine du réseau local. */
const EST_IP_PRIVEE = (hote) =>
  /^10\.\d+\.\d+\.\d+$/.test(hote) ||
  /^192\.168\.\d+\.\d+$/.test(hote) ||
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hote);

const hoteDeDev = () => {
  // hostUri vaut « 192.168.1.40:8081 » en réseau local, « xxx.exp.direct » en tunnel.
  const hostUri = Constants.expoConfig?.hostUri;
  return hostUri ? hostUri.split(':')[0] : null;
};

const resoudre = () => {
  // Priorité à la variable d'environnement, quand elle est réellement injectée.
  const fournie = process.env.EXPO_PUBLIC_API_URL;
  if (fournie) return fournie;

  const hote = hoteDeDev();
  if (hote && EST_IP_PRIVEE(hote)) return `http://${hote}:5001/api`;

  return PRODUCTION_URL;
};

export const API_URL = resoudre();
