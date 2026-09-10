/**
 * URL d'affichage d'un fichier uploadé.
 *
 * POURQUOI UNE URL RELATIVE
 * Les huit pages qui affichaient un avatar définissaient chacune leur propre
 * helper, préfixant le chemin par `http://localhost:5001`. Deux conséquences :
 *
 *   1. `next/image` REFUSE cette URL. L'optimiseur n'accepte un hôte distant que
 *      s'il figure dans `images.remotePatterns`, et il répondait
 *      « "url" parameter is not allowed » en HTTP 400 — l'avatar restait cassé,
 *      remplacé par son texte alternatif.
 *   2. L'hôte était codé en dur : en production, l'API n'est pas sur localhost:5001.
 *
 * En restant relatif, le fichier est demandé au même domaine que la page. La
 * réécriture `/uploads/:path*` de next.config.ts le route vers le backend, ce qui
 * règle du même coup l'optimisation d'image, le CORS et le déploiement.
 */
export function getMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Une URL déjà absolue (stockage externe, avatar d'un fournisseur tiers) est
  // laissée intacte : elle ne concerne pas la réécriture locale.
  if (/^https?:\/\//i.test(url)) return url;
  // Chemins historiques sans préfixe : « photo.jpg » plutôt que « /uploads/photo.jpg ».
  if (!url.startsWith("/")) return `/uploads/${url}`;
  return url;
}
