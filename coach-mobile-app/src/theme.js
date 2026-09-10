/**
 * Jetons de la direction artistique.
 *
 * Source de vérité : `fitflow-dashboard/app/globals.css`, bloc `[data-theme="lime"]`.
 * Les valeurs sont reprises telles quelles — c'est ce qui garantit que les deux clients
 * du produit se ressemblent. Ne pas inventer de teinte ici sans l'ajouter d'abord côté
 * dashboard, sinon les deux repartent à la dérive comme précédemment.
 */

export const couleurs = {
  // ── Surfaces, de la plus enfoncée à la plus élevée ──
  fond: '#272727',
  carte: '#323232',
  nav: '#1f1f1f',
  eleve: '#3d3d3d',
  bord: 'rgba(255,255,255,0.11)',
  bordFort: 'rgba(255,255,255,0.20)',

  // ── Accent ──
  accent: '#85e859',
  /**
   * Le texte POSÉ SUR l'accent. Le lime est une couleur claire : du blanc dessus est
   * illisible. Toute surface `backgroundColor: couleurs.accent` doit porter du texte
   * `couleurs.accentEncre`.
   */
  accentEncre: '#1c1c1c',
  accentFonce: '#2d7e00',
  accentVoile: 'rgba(133,232,89,0.15)',
  accentVoileFort: 'rgba(133,232,89,0.26)',

  // ── Texte ──
  texte: '#ffffff',
  texteDoux: '#c9c9c9',
  texteFaible: '#a8a8a8',
  texteInverse: '#1c1c1c',

  /**
   * Couleurs d'état, volontairement éclaircies. Les teintes d'origine (#10b981, #ef4444,
   * #f59e0b, #3b82f6) sont calibrées pour du texte sur fond clair ; sur #272727 elles
   * passent sous le seuil de contraste. Les variantes 400 de la même famille gardent la
   * sémantique en restant lisibles.
   */
  succes: '#34d399',
  succesVoile: 'rgba(52,211,153,0.16)',
  danger: '#f87171',
  dangerVoile: 'rgba(248,113,113,0.16)',
  alerte: '#fbbf24',
  alerteVoile: 'rgba(251,191,36,0.16)',
  info: '#60a5fa',
  infoVoile: 'rgba(96,165,250,0.16)',
  /** Accent secondaire : sommeil, poids, étirements, superset. */
  violet: '#c084fc',
  violetDoux: '#a78bfa',

  /**
   * Une ombre noire ne se voit pas sur du graphite : la profondeur se rend par la surface
   * élevée et par les bordures. L'ombre est conservée à faible opacité pour ne pas casser
   * les élévations Android, qui ne savent pas faire autrement.
   */
  ombre: '#000000',
};

export const rayons = {
  carte: 20,
  controle: 12,
  pastille: 999,
};

/** Élévation d'une carte, à étaler dans un style. */
export const ombreCarte = {
  shadowColor: couleurs.ombre,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 8,
  elevation: 3,
};
