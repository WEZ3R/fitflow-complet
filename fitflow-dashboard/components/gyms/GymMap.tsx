"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  AttributionControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { onboardingAPI } from "@/lib/api";

export interface MapGym {
  id: string;
  name: string;
  brand?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  latitude: number;
  longitude: number;
  source?: string;
}

export interface BrandFacet {
  brand: string;
  count: number;
}

/**
 * Fonds de carte disponibles, tous sans clé d'API.
 *
 * `dark` remplace l'ancienne approche — des tuiles claires inversées en CSS. Une
 * inversion retourne aussi les teintes : la végétation devenait rose et le texte
 * gris sale. Ici le fond est nativement sombre, et l'ajustement CSS ne sert plus
 * qu'à le rapprocher du gris du site.
 */
export const BASEMAPS = {
  dark: {
    label: "Sombre",
    url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    tune: true,
  },
  minimal: {
    label: "Épuré",
    url: "https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    tune: true,
  },
  light: {
    label: "Clair",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    tune: false,
  },
} as const;

export type BasemapKey = keyof typeof BASEMAPS;

interface GymMapProps {
  center: [number, number];
  centerKey?: string | number;
  selectedIds: string[];
  onToggle: (gym: MapGym) => void;
  onGymsLoaded?: (gyms: MapGym[]) => void;
  onBrandsLoaded?: (brands: BrandFacet[]) => void;
  onStateChange?: (s: { loading: boolean; zoomTooLow: boolean; truncated: boolean }) => void;
  /** Filtre texte, appliqué par le serveur : carte et liste montrent le même jeu. */
  query?: string;
  basemap?: BasemapKey;
  height?: number;
  /** Coordonnées vers lesquelles se déplacer, hors recentrage de recherche. */
  flyTo?: { lat: number; lng: number; key: string } | null;
}

/**
 * Niveau de zoom en dessous duquel on ne charge rien — sauf si un filtre est actif.
 *
 * À l'échelle du pays, l'emprise contient des milliers de points indistinguables.
 * Mais dès qu'on filtre (« on air »), le nombre de résultats redevient petit et il
 * est utile de les voir à large échelle : le seuil s'abaisse alors.
 */
const MIN_ZOOM_TO_LOAD = 11;
const MIN_ZOOM_FILTERED = 6;

const pinIcon = (selected: boolean) =>
  L.divIcon({
    className: "fitflow-pin",
    html: `<span class="fitflow-pin__dot${selected ? " is-selected" : ""}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });

function Recenter({ center, centerKey }: { center: [number, number]; centerKey?: string | number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, Math.max(map.getZoom(), 13), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerKey]);
  return null;
}

/** Déplacement ponctuel : « voir la plus proche » depuis un résultat hors écran. */
function FlyTo({ target }: { target: GymMapProps["flyTo"] }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 14), { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.key]);
  return null;
}

function BboxLoader({
  query,
  onLoaded,
  onBrands,
  onState,
}: {
  query: string;
  onLoaded: (gyms: MapGym[]) => void;
  onBrands: (brands: BrandFacet[]) => void;
  onState: (s: { loading: boolean; zoomTooLow: boolean; truncated: boolean }) => void;
}) {
  const map = useMap();
  const requestRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Le filtre courant est lu dans un ref : les gestionnaires d'événements de la
  // carte sont enregistrés une fois, ils doivent voir la valeur à jour.
  const queryRef = useRef(query);
  queryRef.current = query;

  const load = useCallback(async () => {
    const q = queryRef.current.trim();
    const filtered = q.length >= 2;
    const minZoom = filtered ? MIN_ZOOM_FILTERED : MIN_ZOOM_TO_LOAD;

    if (map.getZoom() < minZoom) {
      onState({ loading: false, zoomTooLow: true, truncated: false });
      onLoaded([]);
      onBrands([]);
      return;
    }

    const b = map.getBounds();
    const token = ++requestRef.current;
    onState({ loading: true, zoomTooLow: false, truncated: false });

    try {
      const res = await onboardingAPI.gymsInBbox(
        {
          minLat: b.getSouth(),
          maxLat: b.getNorth(),
          minLng: b.getWest(),
          maxLng: b.getEast(),
        },
        300,
        filtered ? q : undefined,
      );
      // Un glissement rapide enchaîne les requêtes : une réponse tardive ne doit
      // pas écraser celle de l'emprise courante.
      if (token !== requestRef.current) return;
      const data = res.data?.data ?? {};
      onLoaded(data.gyms ?? []);
      onBrands(data.brands ?? []);
      onState({ loading: false, zoomTooLow: false, truncated: !!data.truncated });
    } catch {
      if (token !== requestRef.current) return;
      onLoaded([]);
      onState({ loading: false, zoomTooLow: false, truncated: false });
    }
  }, [map, onLoaded, onBrands, onState]);

  const schedule = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, 300);
  }, [load]);

  useMapEvents({ moveend: schedule, zoomend: schedule });

  // Rechargement quand le filtre change, sans attendre un déplacement de carte.
  useEffect(() => {
    schedule();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return null;
}

export default function GymMap({
  center,
  centerKey,
  selectedIds,
  onToggle,
  onGymsLoaded,
  onBrandsLoaded,
  onStateChange,
  query = "",
  basemap = "dark",
  height = 340,
  flyTo = null,
}: GymMapProps) {
  const [gyms, setGyms] = useState<MapGym[]>([]);
  const [state, setState] = useState({ loading: false, zoomTooLow: false, truncated: false });

  const handleLoaded = useCallback(
    (list: MapGym[]) => {
      setGyms(list);
      onGymsLoaded?.(list);
    },
    [onGymsLoaded],
  );

  const handleBrands = useCallback((b: BrandFacet[]) => onBrandsLoaded?.(b), [onBrandsLoaded]);

  const handleState = useCallback(
    (s: typeof state) => {
      setState(s);
      onStateChange?.(s);
    },
    [onStateChange],
  );

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const tiles = BASEMAPS[basemap];
  const filtering = query.trim().length >= 2;

  return (
    <div
      className={`relative overflow-hidden fitflow-map__frame${
        tiles.tune ? " is-tuned" : ""
      }`}
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom
        // Contrôle par défaut désactivé : on le remplace par le nôtre, sans le
        // préfixe « Leaflet ». Ce préfixe est publicitaire, pas obligatoire — la
        // licence BSD de Leaflet n'exige rien dans l'interface.
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
        className="fitflow-map"
      >
        {/* L'attribution OpenStreetMap et CARTO reste dans le DOM : elle est
            juridiquement obligatoire (ODbL pour les données, conditions de CARTO
            pour les tuiles). Les guides d'attribution d'OSM admettent qu'elle soit
            repliée derrière une icône sur une carte interactive, à condition de
            rester atteignable — c'est ce que fait le CSS, qui la réduit à un ⓘ
            déployé au survol et au focus clavier. */}
        <AttributionControl position="bottomright" prefix={false} />
        {/* key : Leaflet ne remplace pas l'URL d'une couche existante, il faut
            remonter la couche pour changer de fond de carte. */}
        <TileLayer key={basemap} url={tiles.url} attribution={tiles.attribution} maxZoom={19} />
        <Recenter center={center} centerKey={centerKey} />
        <FlyTo target={flyTo} />
        <BboxLoader query={query} onLoaded={handleLoaded} onBrands={handleBrands} onState={handleState} />

        {gyms.map((gym) => (
          <Marker
            key={gym.id}
            position={[gym.latitude, gym.longitude]}
            icon={pinIcon(selected.has(gym.id))}
          >
            <Popup>
              <div className="fitflow-popup">
                <div className="fitflow-popup__title">{gym.name}</div>
                {gym.brand && gym.brand !== gym.name && (
                  <div className="fitflow-popup__brand">{gym.brand}</div>
                )}
                {gym.address && <div className="fitflow-popup__line">{gym.address}</div>}
                <div className="fitflow-popup__line fitflow-popup__muted">
                  {gym.postalCode} {gym.city}
                </div>
                <button type="button" onClick={() => onToggle(gym)} className="fitflow-popup__action">
                  {selected.has(gym.id) ? "Retirer de mes salles" : "Ajouter à mes salles"}
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Bandeau d'état : un fond de carte sans marqueurs est ambigu — zone
          réellement vide, ou rien de chargé ? */}
      {(state.zoomTooLow || state.loading || state.truncated || (filtering && gyms.length === 0)) && (
        <div className="fitflow-map__badge">
          {state.zoomTooLow
            ? filtering
              ? "Zoomez un peu pour chercher"
              : "Zoomez pour afficher les salles"
            : state.loading
              ? "Chargement…"
              : filtering && gyms.length === 0
                ? `Aucun résultat pour « ${query.trim()} » dans cette zone`
                : "Beaucoup de salles ici — zoomez pour toutes les voir"}
        </div>
      )}

      {filtering && gyms.length > 0 && !state.loading && (
        <div className="fitflow-map__badge fitflow-map__badge--accent">
          {gyms.length} × {query.trim()}
        </div>
      )}
    </div>
  );
}
