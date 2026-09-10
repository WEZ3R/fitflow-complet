/**
 * Service Overpass API (OpenStreetMap) — Recherche de salles de sport
 * Cache en mémoire 24h par (city, radius)
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'FitFlow/1.0 (contact@fitflow.app)';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Cache mémoire simple : clé → { data, expiresAt }
const cache = new Map();

/**
 * Géocode une ville via Nominatim → { lat, lng }
 */
export async function geocodeCity(city) {
  const cacheKey = `geo:${city.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(city)}&format=json&limit=1&addressdetails=0`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });

  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);

  const results = await res.json();
  if (!results.length) return null;

  const data = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

/**
 * Requête Overpass pour trouver les salles de sport autour d'un point
 * @param {number} lat
 * @param {number} lng
 * @param {number} radius - rayon en mètres (défaut 5000)
 */
export async function searchGymsOverpass(lat, lng, radius = 5000) {
  const cacheKey = `gyms:${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const query = `
[out:json][timeout:25];
(
  node["leisure"="fitness_centre"](around:${radius},${lat},${lng});
  way["leisure"="fitness_centre"](around:${radius},${lat},${lng});
  node["sport"="fitness"](around:${radius},${lat},${lng});
  way["sport"="fitness"](around:${radius},${lat},${lng});
);
out center;
`;

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);

  const json = await res.json();

  const gyms = (json.elements || []).map((el) => {
    const elLat = el.type === 'node' ? el.lat : el.center?.lat;
    const elLng = el.type === 'node' ? el.lon : el.center?.lon;
    return {
      osmId: `${el.type}/${el.id}`,
      name: el.tags?.name || el.tags?.['name:fr'] || 'Salle de sport',
      brand: el.tags?.brand || el.tags?.operator || null,
      address: el.tags?.['addr:street']
        ? `${el.tags['addr:housenumber'] || ''} ${el.tags['addr:street']}`.trim()
        : null,
      city: el.tags?.['addr:city'] || null,
      postalCode: el.tags?.['addr:postcode'] || null,
      latitude: elLat,
      longitude: elLng,
    };
  }).filter((g) => g.latitude && g.longitude);

  cache.set(cacheKey, { data: gyms, expiresAt: Date.now() + CACHE_TTL_MS });
  return gyms;
}
