"use client";

import React, { useState } from "react";
import {
  ANTERIOR,
  POSTERIOR,
  ANTERIOR_VIEWBOX,
  POSTERIOR_VIEWBOX,
  NEUTRAL_FILL,
  NEUTRAL_STROKE,
  type PolyGroup,
} from "@/lib/bodyPolygons";

// ─── Types ────────────────────────────────────────────────────────────────────

type BodyMapProps = {
  gender: "M" | "F" | string | null;
  muscleVolumes: Record<string, number | null>;
  maxVolume: number;
};

type TooltipState = {
  visible: boolean;
  label: string;
  volume: number | null;
  x: number;
  y: number;
};

// ─── Color helper ─────────────────────────────────────────────────────────────

function getVolumeColor(volume: number | null | undefined, maxVolume: number): string {
  if (!volume || volume === 0 || maxVolume === 0) return "#e2e8f0";
  const ratio = Math.min(1, volume / maxVolume);
  // #fde2e2 → #7f1d1d
  const r = Math.round(253 + (127 - 253) * ratio);
  const g = Math.round(226 + (29 - 226) * ratio);
  const b = Math.round(226 + (29 - 226) * ratio);
  return `rgb(${r},${g},${b})`;
}


// ─── BodyView ─────────────────────────────────────────────────────────────────

function BodyView({
  data,
  viewBox,
  muscleVolumes,
  maxVolume,
  setTooltip,
  hideTooltip,
  label,
}: {
  data: PolyGroup[];
  viewBox: string;
  muscleVolumes: Record<string, number | null>;
  maxVolume: number;
  setTooltip: (t: TooltipState) => void;
  hideTooltip: () => void;
  label: string;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  /**
   * Position de l'infobulle, mesurée sur le CONTENEUR et non sur le SVG survolé.
   *
   * L'infobulle est positionnée en absolu dans le conteneur qui porte les deux
   * vues côte à côte. Des coordonnées relatives au SVG faisaient donc apparaître
   * l'infobulle décalée de toute la largeur de la première vue quand on survolait
   * la seconde (« Dos »).
   */
  const track = (
    e: React.MouseEvent<SVGPathElement>,
    label: string,
    volume: number | null,
  ) => {
    const root = e.currentTarget.closest("[data-bodymap-root]") as HTMLElement | null;
    const rect = (root ?? (e.currentTarget.closest("svg") as SVGSVGElement)).getBoundingClientRect();
    setTooltip({
      visible: true,
      label,
      volume,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </span>
      <svg
        viewBox={viewBox}
        width={140}
        height={viewBox === ANTERIOR_VIEWBOX ? 280 : 311}
        className="overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        {data.map(({ id, bodyPart, label: zoneLabel, pts }) => {
          const isNeutral = bodyPart === null;
          const volume = isNeutral ? null : muscleVolumes[bodyPart];
          const fill = isNeutral
            ? NEUTRAL_FILL
            : getVolumeColor(volume, maxVolume);
          const stroke = isNeutral ? NEUTRAL_STROKE : "white";
          const isHovered = hoveredId === id;

          return pts.map((points, i) => (
            <polygon
              key={`${id}-${i}`}
              points={points}
              fill={fill}
              fillOpacity={isHovered && !isNeutral ? 1 : isNeutral ? 1 : 0.9}
              stroke={isHovered && !isNeutral ? "#1f2937" : stroke}
              strokeWidth={isHovered && !isNeutral ? 0.6 : 0.3}
              strokeLinejoin="round"
              style={{
                cursor: isNeutral ? "default" : "pointer",
                transition: "fill-opacity 120ms, stroke-width 120ms",
              }}
              onMouseEnter={(e) => {
                if (isNeutral) return;
                setHoveredId(id);
                track(e, zoneLabel, volume);
              }}
              onMouseMove={(e) => {
                if (isNeutral) return;
                track(e, zoneLabel, volume);
              }}
              onMouseLeave={() => {
                if (isNeutral) return;
                setHoveredId(null);
                hideTooltip();
              }}
            />
          ));
        })}
      </svg>
    </div>
  );
}

// ─── BodyMap ──────────────────────────────────────────────────────────────────

export default function BodyMap({
  gender: _gender,
  muscleVolumes,
  maxVolume,
}: BodyMapProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    label: "",
    volume: null,
    x: 0,
    y: 0,
  });

  const hideTooltip = () =>
    setTooltip((t) => ({ ...t, visible: false }));

  return (
    <div
      data-bodymap-root
      className="relative flex gap-8 items-start justify-center select-none"
    >
      <BodyView
        data={ANTERIOR}
        viewBox={ANTERIOR_VIEWBOX}
        muscleVolumes={muscleVolumes}
        maxVolume={maxVolume}
        setTooltip={setTooltip}
        hideTooltip={hideTooltip}
        label="Face"
      />
      <BodyView
        data={POSTERIOR}
        viewBox={POSTERIOR_VIEWBOX}
        muscleVolumes={muscleVolumes}
        maxVolume={maxVolume}
        setTooltip={setTooltip}
        hideTooltip={hideTooltip}
        label="Dos"
      />

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          // Pas de `text-white` : le thème inverse l'échelle de gris, si bien que
          // `bg-gray-900` vaut 98 % de clarté — un fond quasi blanc. Le titre en
          // blanc y était invisible. Il prend donc la couleur du texte qu'il
          // surmonte, et chaque ligne déclare la sienne.
          className="pointer-events-none absolute z-10 bg-gray-900/95 backdrop-blur-sm text-xs px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap border border-gray-800"
          // Placée au-dessus du curseur (translateY -100 %) et décalée à droite :
          // à 12 px sous le pointeur, la flèche recouvrait la première ligne.
          style={{
            left: tooltip.x + 16,
            top: tooltip.y - 14,
            transform: "translateY(-100%)",
          }}
        >
          <p className="font-semibold text-gray-300">{tooltip.label}</p>
          {tooltip.volume != null && tooltip.volume > 0 ? (
            <p className="text-gray-300 text-[11px] mt-0.5">
              {Math.round(tooltip.volume).toLocaleString()} kg·reps
            </p>
          ) : (
            <p className="text-gray-400 text-[11px] mt-0.5">Pas de données</p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-col gap-1.5 justify-center pt-6">
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1">
          Volume
        </p>
        {[
          { label: "Aucun", color: "#e2e8f0" },
          { label: "Faible", color: "#fde2e2" },
          { label: "Moyen", color: "#f87171" },
          { label: "Élevé", color: "#dc2626" },
          { label: "Très élevé", color: "#7f1d1d" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm shrink-0 ring-1 ring-gray-200"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[10px] text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
