import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import { geocodeCity, searchGymsOverpass } from '../services/overpass.js';

/**
 * Salles de la base locale dans un rayon donné, les plus proches d'abord.
 *
 * Haversine en SQL, précédé d'un filtre par boîte englobante : sans lui, chaque
 * requête calculerait la distance des 6 000+ lignes. Pas de PostGIS ici, la boîte
 * suffit largement à cette échelle.
 */
async function findNearbyInDb(lat, lng, radiusMeters, limit = 60) {
  const dLat = radiusMeters / 111_320;
  const dLng = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180) || 1);

  return prisma.$queryRaw`
    SELECT id, name, brand, address, city, "postalCode", country,
           latitude, longitude, source, "sourceId",
           ROUND((6371000 * acos(LEAST(1,
             cos(radians(${lat})) * cos(radians(latitude)) *
             cos(radians(longitude) - radians(${lng})) +
             sin(radians(${lat})) * sin(radians(latitude))
           )))::numeric, 0)::int AS distance
    FROM gyms
    WHERE latitude  BETWEEN ${lat - dLat} AND ${lat + dLat}
      AND longitude BETWEEN ${lng - dLng} AND ${lng + dLng}
      AND "approxPosition" = false
      AND (6371000 * acos(LEAST(1,
            cos(radians(${lat})) * cos(radians(latitude)) *
            cos(radians(longitude) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(latitude))
          ))) <= ${radiusMeters}
    ORDER BY distance ASC
    LIMIT ${limit}`;
}

/**
 * Rechercher des salles de sport par ville (ou coordonnées)
 * GET /api/gyms/search?city=Paris&lat=48.8&lng=2.3&radius=5000
 *
 * La base locale (import SIRENE) répond en premier : adresse et coordonnées y sont
 * renseignées à 100 %, contre 20 % côté OpenStreetMap. Overpass n'est interrogé
 * qu'en secours, quand la zone est vide — typiquement une commune rurale, ou une
 * salle trop récente pour figurer dans SIRENE.
 */
export const searchGyms = async (req, res) => {
  try {
    let { city, lat, lng, radius = 5000 } = req.query;

    radius = parseInt(radius, 10);
    if (isNaN(radius) || radius < 500 || radius > 50000) radius = 5000;

    let parsedLat = lat ? parseFloat(lat) : null;
    let parsedLng = lng ? parseFloat(lng) : null;
    let resolvedCity = city || null;

    // Géocoder la ville si pas de coordonnées
    if (!parsedLat || !parsedLng) {
      if (!city) return sendError(res, 'city ou lat+lng requis', 400);

      const coords = await geocodeCity(city);
      if (!coords) return sendError(res, `Ville introuvable : ${city}`, 404);

      parsedLat = coords.lat;
      parsedLng = coords.lng;
    }

    const local = await findNearbyInDb(parsedLat, parsedLng, radius);
    if (local.length >= 3) {
      return sendSuccess(res, local, `${local.length} salle(s) trouvée(s)`);
    }

    // Zone peu couverte : on complète depuis Overpass. Un incident côté Overpass
    // ne doit pas faire échouer la requête si la base locale a déjà quelque chose
    // à proposer — l'instance publique renvoie régulièrement des 504.
    let overpassGyms = [];
    try {
      overpassGyms = await searchGymsOverpass(parsedLat, parsedLng, radius);
    } catch (err) {
      console.warn('Overpass indisponible, résultats locaux uniquement :', err.message);
      return sendSuccess(res, local, `${local.length} salle(s) trouvée(s)`);
    }

    // Upsert par (source, sourceId) et non par osmId : la clé de déduplication est
    // désormais commune à toutes les provenances.
    for (const g of overpassGyms) {
      const data = {
        name: g.name,
        brand: g.brand,
        address: g.address,
        city: g.city || resolvedCity || '',
        postalCode: g.postalCode,
        latitude: g.latitude,
        longitude: g.longitude,
      };
      await prisma.gym.upsert({
        where: { source_sourceId: { source: 'osm', sourceId: g.osmId } },
        update: data,
        create: { source: 'osm', sourceId: g.osmId, osmId: g.osmId, ...data },
      });
    }

    // On relit la base : les résultats sortent triés par distance, avec le même
    // format que la réponse issue de la base locale.
    const merged = await findNearbyInDb(parsedLat, parsedLng, radius);
    sendSuccess(res, merged, `${merged.length} salle(s) trouvée(s)`);
  } catch (error) {
    console.error('Search gyms error:', error);
    sendError(res, 'Erreur lors de la recherche de salles', 500);
  }
};

/**
 * Salles visibles dans l'emprise d'une carte.
 * GET /api/gyms/bbox?minLat=&maxLat=&minLng=&maxLng=&limit=300
 *
 * Une carte affiche un rectangle, pas un rayon : demander un rayon obligerait le
 * client à en calculer un circonscrit, donc à recevoir des points hors écran puis
 * à les filtrer. La réponse indique si la limite a été atteinte, pour que
 * l'interface puisse le dire au lieu de laisser croire à une zone complète.
 */
export const getGymsInBbox = async (req, res) => {
  try {
    const minLat = parseFloat(req.query.minLat);
    const maxLat = parseFloat(req.query.maxLat);
    const minLng = parseFloat(req.query.minLng);
    const maxLng = parseFloat(req.query.maxLng);

    if ([minLat, maxLat, minLng, maxLng].some((v) => Number.isNaN(v))) {
      return sendError(res, 'minLat, maxLat, minLng et maxLng sont requis', 400);
    }
    if (minLat > maxLat || minLng > maxLng) {
      return sendError(res, 'Emprise invalide : les bornes min doivent être inférieures aux max', 400);
    }

    let limit = parseInt(req.query.limit ?? '300', 10);
    if (Number.isNaN(limit) || limit < 1 || limit > 1000) limit = 300;

    // Filtre texte appliqué ICI et non côté navigateur : la carte et la liste
    // consomment la même réponse, elles ne peuvent donc pas divergrer. Filtrer au
    // client aurait aussi limité la recherche aux 300 lignes déjà chargées.
    const q = (req.query.q ?? '').toString().trim();
    const textFilter = q.length >= 2
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { brand: { contains: q, mode: 'insensitive' } },
            { address: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    // Positions douteuses écartées par défaut : SIRENE géolocalise certains
    // établissements de franchise au siège du franchiseur, ce qui posait « Kc
    // Euralille » à Ventabren. Un point au mauvais endroit est pire qu'un point
    // absent. `includeApprox=1` permet de les inspecter.
    const includeApprox = req.query.includeApprox === '1';
    const positionFilter = includeApprox ? {} : { approxPosition: false };

    // On demande une ligne de plus que la limite : si elle arrive, l'emprise
    // contient davantage de salles que ce qu'on renvoie.
    const rows = await prisma.gym.findMany({
      where: {
        latitude: { gte: minLat, lte: maxLat },
        longitude: { gte: minLng, lte: maxLng },
        ...positionFilter,
        ...textFilter,
      },
      select: {
        id: true, name: true, brand: true, address: true, city: true,
        postalCode: true, latitude: true, longitude: true, source: true,
      },
      orderBy: { name: 'asc' },
      take: limit + 1,
    });

    const truncated = rows.length > limit;
    const gyms = truncated ? rows.slice(0, limit) : rows;

    // Enseignes présentes dans l'emprise, avec leur effectif. Elles alimentent les
    // filtres rapides : sans elles, il faut deviner l'orthographe exacte d'une
    // enseigne pour la filtrer.
    const brandRows = await prisma.gym.groupBy({
      by: ['brand'],
      where: {
        latitude: { gte: minLat, lte: maxLat },
        longitude: { gte: minLng, lte: maxLng },
        brand: { not: null },
        ...positionFilter,
      },
      _count: { _all: true },
      orderBy: { _count: { brand: 'desc' } },
      take: 12,
    });
    const brands = brandRows.map((b) => ({ brand: b.brand, count: b._count._all }));

    sendSuccess(res, { gyms, brands, truncated, count: gyms.length }, `${gyms.length} salle(s) dans l'emprise`);
  } catch (error) {
    console.error('Get gyms in bbox error:', error);
    sendError(res, 'Erreur lors de la récupération des salles', 500);
  }
};

/**
 * Rechercher des salles dans la base par nom (texte libre)
 * GET /api/gyms/db-search?q=basic-fit&city=Paris
 */
export const searchGymsInDb = async (req, res) => {
  try {
    const { q, city } = req.query;
    if (!q || q.trim().length < 2) return sendError(res, 'Paramètre q requis (min 2 caractères)', 400);

    const gyms = await prisma.gym.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: q.trim(), mode: 'insensitive' } },
              { brand: { contains: q.trim(), mode: 'insensitive' } },
              { address: { contains: q.trim(), mode: 'insensitive' } },
            ],
          },
          ...(city ? [{ city: { contains: city.trim(), mode: 'insensitive' } }] : []),
        ],
      },
      orderBy: { name: 'asc' },
      take: 30,
    });

    sendSuccess(res, gyms, `${gyms.length} salle(s) trouvée(s)`);
  } catch (error) {
    console.error('DB search gyms error:', error);
    sendError(res, 'Erreur lors de la recherche', 500);
  }
};

/**
 * Récupérer une salle par ID
 * GET /api/gyms/:id
 */
export const getGymById = async (req, res) => {
  try {
    const gym = await prisma.gym.findUnique({ where: { id: req.params.id } });
    if (!gym) return sendError(res, 'Salle introuvable', 404);
    sendSuccess(res, gym);
  } catch (error) {
    console.error('Get gym error:', error);
    sendError(res, 'Erreur serveur', 500);
  }
};
