"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { onboardingAPI } from "@/lib/api";
import { X, Map as MapIcon, List, MapPin, Check, Search, Crosshair } from "lucide-react";
import type { MapGym, BrandFacet } from "@/components/gyms/GymMap";

// Leaflet touche `window` au chargement du module : sans ssr:false, le rendu
// serveur de Next échoue avant même d'atteindre le navigateur.
const GymMap = dynamic(() => import("@/components/gyms/GymMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] border border-gray-200 bg-gray-50/5 flex items-center justify-center text-xs text-gray-400">
      Chargement de la carte…
    </div>
  ),
});

interface Gym {
  id: string;
  name: string;
  address?: string | null;
  brand?: string | null;
  latitude?: number;
  longitude?: number;
  city?: string | null;
  postalCode?: string | null;
}

interface GymPickerProps {
  city: string;
  onCityChange: (v: string) => void;
  gyms: Gym[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSearch: () => void;
  loading: boolean;
  onDbResults?: (gyms: Gym[]) => void;
}

/** Centre par défaut : Paris, avant toute recherche de ville. */
const DEFAULT_CENTER: [number, number] = [48.8566, 2.3522];

export function GymPicker({
  city,
  onCityChange,
  gyms,
  selectedIds,
  onToggle,
  onSearch,
  loading,
  onDbResults,
}: GymPickerProps) {
  /** Filtre unique : il pilote la carte et la liste, jamais l'une sans l'autre. */
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showMap, setShowMap] = useState(true);
  const [visibleGyms, setVisibleGyms] = useState<MapGym[]>([]);
  const [brands, setBrands] = useState<BrandFacet[]>([]);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; key: string } | null>(null);
  const [elsewhere, setElsewhere] = useState<Gym[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Répertoire des salles déjà vues, par identifiant.
   *
   * Le parent ne conserve que des identifiants. Sans ce répertoire, une salle
   * retenue puis sortie de l'écran perdrait son nom : la puce afficherait un UUID.
   */
  const [known, setKnown] = useState<Record<string, Gym>>({});
  const remember = useCallback((list: Gym[]) => {
    if (!list.length) return;
    setKnown((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const g of list) {
        if (!next[g.id]) {
          next[g.id] = g;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => { remember(gyms); }, [gyms, remember]);

  // Le filtre est débattu avant d'atteindre la carte : sinon chaque frappe
  // déclenche une requête d'emprise.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleGymsLoaded = useCallback(
    (list: MapGym[]) => {
      setVisibleGyms(list);
      remember(list);
    },
    [remember],
  );

  /**
   * Recherche de secours hors emprise.
   *
   * Filtrer « On Air » sur une zone qui n'en contient aucun donnerait une liste
   * vide sans rien dire de plus. On interroge donc la base entière en parallèle,
   * pour proposer de se déplacer vers le résultat le plus proche.
   */
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2 || visibleGyms.length > 0) {
      setElsewhere([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await onboardingAPI.searchGymsInDb(q);
        if (cancelled) return;
        const list: Gym[] = res.data?.data ?? [];
        setElsewhere(list);
        remember(list);
        onDbResults?.(list);
      } catch {
        if (!cancelled) setElsewhere([]);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, visibleGyms.length]);

  /**
   * Centre de la carte : moyenne des salles renvoyées par la recherche de ville.
   * Le back-end a déjà géocodé la ville pour les trouver — recentrer sur elles
   * évite un second appel de géocodage depuis le navigateur.
   */
  const searchCenter = useMemo<[number, number] | null>(() => {
    const geo = gyms.filter((g) => g.latitude != null && g.longitude != null);
    if (!geo.length) return null;
    const lat = geo.reduce((s, g) => s + (g.latitude as number), 0) / geo.length;
    const lng = geo.reduce((s, g) => s + (g.longitude as number), 0) / geo.length;
    return [lat, lng];
  }, [gyms]);

  const filtering = debouncedQuery.trim().length >= 2;
  const selectedGyms = selectedIds.map((id) => known[id]).filter(Boolean);
  const firstElsewhere = elsewhere.find((g) => g.latitude != null && g.longitude != null);

  return (
    <div className="space-y-3">
      {/* Ville */}
      <div className="flex gap-2">
        <input
          type="text"
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder="Votre ville (ex: Paris)"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="button"
          onClick={onSearch}
          disabled={loading}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? "..." : "Rechercher"}
        </button>
        <button
          type="button"
          onClick={() => setShowMap((v) => !v)}
          aria-pressed={showMap}
          title={showMap ? "Masquer la carte" : "Afficher la carte"}
          className="px-3 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-500/10"
        >
          {showMap ? <List className="w-4 h-4" aria-hidden="true" /> : <MapIcon className="w-4 h-4" aria-hidden="true" />}
        </button>
      </div>

      {/* Filtre — un seul champ pour la carte et la liste */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer : nom, enseigne ou rue (ex : On Air)"
          className="w-full border border-gray-300 rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Effacer le filtre"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
          >
            <X className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Enseignes présentes dans la zone : évite d'avoir à deviner l'orthographe */}
      {brands.length > 0 && !filtering && (
        <div className="flex flex-wrap gap-1.5">
          {brands.map((b) => (
            <button
              key={b.brand}
              type="button"
              onClick={() => setQuery(b.brand)}
              className="rounded-full border border-gray-300 px-2.5 py-1 text-[11px] text-gray-600 hover:border-primary-500 hover:text-primary-600 transition-colors"
            >
              {b.brand} <span className="opacity-60">{b.count}</span>
            </button>
          ))}
        </div>
      )}

      {showMap && (
        <>
          <GymMap
            center={searchCenter ?? DEFAULT_CENTER}
            centerKey={searchCenter ? `${searchCenter[0]},${searchCenter[1]}` : "default"}
            selectedIds={selectedIds}
            onToggle={(gym) => {
              remember([gym]);
              onToggle(gym.id);
            }}
            onGymsLoaded={handleGymsLoaded}
            onBrandsLoaded={setBrands}
            query={debouncedQuery}
            flyTo={flyTo}
            height={300}
          />

          <p className="text-[11px] text-gray-400">
            Cliquez un point pour voir la salle, puis « Ajouter à mes salles ».
          </p>
        </>
      )}

      {/* Aucun résultat ici, mais ailleurs : on propose d'y aller */}
      {filtering && visibleGyms.length === 0 && firstElsewhere && (
        <button
          type="button"
          onClick={() =>
            setFlyTo({
              lat: firstElsewhere.latitude as number,
              lng: firstElsewhere.longitude as number,
              key: `${firstElsewhere.id}-${Date.now()}`,
            })
          }
          className="w-full flex items-center gap-2 rounded-lg border border-primary-500/40 bg-primary-500/10 px-3 py-2 text-xs text-primary-600 hover:bg-primary-500/20 transition-colors"
        >
          <Crosshair className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="text-left">
            Aucun résultat dans cette zone, mais {elsewhere.length} ailleurs — voir «{" "}
            {firstElsewhere.name} » {firstElsewhere.city ? `à ${firstElsewhere.city}` : ""}
          </span>
        </button>
      )}

      {/* Salles retenues — visibles même hors de l'emprise */}
      {selectedGyms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedGyms.map((gym) => (
            <span
              key={gym.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 text-primary-700 px-2.5 py-1 text-xs font-medium"
            >
              <MapPin className="w-3 h-3" aria-hidden="true" />
              {gym.name}
              <button
                type="button"
                onClick={() => onToggle(gym.id)}
                aria-label={`Retirer ${gym.name}`}
                className="hover:opacity-70"
              >
                <X className="w-3 h-3" strokeWidth={2.5} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Liste — exactement ce que la carte affiche */}
      {visibleGyms.length > 0 && (
        <>
          {/* Le décompte n'apparaît que si la carte est masquée : quand elle est
              visible, elle porte déjà ce chiffre dans son bandeau. */}
          {!showMap && (
            <p className="text-[11px] text-gray-400">
              {filtering
                ? `${visibleGyms.length} × « ${debouncedQuery.trim()} »`
                : `${visibleGyms.length} salle(s) dans la zone affichée`}
            </p>
          )}
          <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
            {visibleGyms.map((gym) => {
              const selected = selectedIds.includes(gym.id);
              return (
                <div key={gym.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onToggle(gym.id)}
                    className={`flex-1 min-w-0 flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                      selected ? "bg-primary-100" : "hover:bg-gray-500/10"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                        selected ? "bg-primary-600 border-primary-600" : "border-gray-300"
                      }`}
                    >
                      {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} aria-hidden="true" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate">{gym.name}</span>
                      {gym.address && (
                        <span className="block text-xs text-gray-500 truncate">
                          {gym.address}
                          {gym.postalCode ? ` · ${gym.postalCode}` : ""}
                        </span>
                      )}
                    </span>
                  </button>
                  {/* Centrer la carte sur cette salle : relie la liste à la carte
                      dans les deux sens. */}
                  <button
                    type="button"
                    onClick={() =>
                      setFlyTo({ lat: gym.latitude, lng: gym.longitude, key: `${gym.id}-${Date.now()}` })
                    }
                    aria-label={`Centrer la carte sur ${gym.name}`}
                    title="Centrer sur la carte"
                    className="p-1.5 rounded-md text-gray-400 hover:text-primary-500 transition-colors"
                  >
                    <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
