"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { analyticsAPI } from "@/lib/api";
import { Download, ArrowUpDown } from "lucide-react";

const MUSCLE_LABELS: Record<string, string> = {
  CHEST: "Pectoraux",
  BACK: "Dos",
  SHOULDERS: "Épaules",
  UPPER_LEGS: "Cuisses",
  LOWER_LEGS: "Mollets",
  UPPER_ARMS: "Bras",
  LOWER_ARMS: "Avant-bras",
  WAIST: "Abdos",
};

interface ExerciseInol {
  exerciseRefId: string;
  exerciseName: string;
  bodyParts: string[];
  inol: number;
  sets: number;
  totalReps: number;
  topPct1RM: number;
  topWeight: number;
  ref1RM: number;
}

interface SessionInol {
  sessionId: string;
  date: string;
  totalINOL: number;
  exerciseINOL: ExerciseInol[];
  muscleINOL: Array<{ muscle: string; inol: number }>;
}

interface WeeklyVolume {
  week: string;
  muscleGroups: Record<string, number>;
  total: number;
}

/** Une ligne du tableau : un exercice au sein d'une séance. */
interface Row {
  date: string;
  dateLabel: string;
  exercise: string;
  muscles: string;
  sets: number;
  reps: number;
  topWeight: number;
  pct1RM: number;
  ref1RM: number;
  volume: number;
  inol: number;
}

type SortKey = keyof Pick<Row, "date" | "exercise" | "sets" | "reps" | "topWeight" | "pct1RM" | "ref1RM" | "volume" | "inol">;

const COLUMNS: Array<{ key: SortKey; label: string; numeric: boolean; unit?: string }> = [
  { key: "date", label: "Date", numeric: false },
  { key: "exercise", label: "Exercice", numeric: false },
  { key: "sets", label: "Séries", numeric: true },
  { key: "reps", label: "Reps", numeric: true },
  { key: "topWeight", label: "Charge max", numeric: true, unit: "kg" },
  { key: "pct1RM", label: "% 1RM", numeric: true, unit: "%" },
  { key: "ref1RM", label: "1RM réf.", numeric: true, unit: "kg" },
  { key: "volume", label: "Volume", numeric: true, unit: "kg·reps" },
  { key: "inol", label: "INOL", numeric: true },
];

/**
 * Tableau de progression musculaire, exportable en Excel.
 *
 * Granularité : une ligne par exercice et par séance. C'est le grain le plus fin
 * disponible, et le seul qui permette de recalculer les agrégats en aval — un
 * export déjà agrégé par semaine interdirait toute autre lecture.
 *
 * Le volume affiché est une approximation : `charge max × répétitions totales`.
 * L'endpoint ne renvoie pas le détail série par série, donc le produit exact
 * (somme des charge × reps de chaque série) n'est pas reconstituable ici. La
 * colonne est nommée « Volume » et cette limite est indiquée sous le tableau.
 */
export default function MuscleProgressTable({
  clientId,
  clientName,
  days,
}: {
  clientId: string;
  clientName: string;
  days: number;
}) {
  const [state, setState] = useState<{
    status: "loading" | "ready" | "error";
    sessions: SessionInol[];
    weekly: WeeklyVolume[];
  }>({ status: "loading", sessions: [], weekly: [] });

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    let cancelled = false;
    const end = new Date().toISOString().split("T")[0];
    const start = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
    const params = { clientId, startDate: start, endDate: end };

    Promise.all([
      analyticsAPI.getSessionINOL(params),
      analyticsAPI.getWeeklyVolume(params),
    ])
      .then(([inolRes, volRes]) => {
        if (cancelled) return;
        setState({
          status: "ready",
          sessions: inolRes.data?.data?.sessions ?? [],
          weekly: volRes.data?.data?.weeklyVolume ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", sessions: [], weekly: [] });
      });

    return () => { cancelled = true; };
  }, [clientId, days]);

  const { status, sessions, weekly } = state;

  const rows = useMemo<Row[]>(
    () =>
      sessions.flatMap((s) =>
        s.exerciseINOL.map((ex) => ({
          date: new Date(s.date).toLocaleDateString("sv-SE"),
          dateLabel: new Date(s.date).toLocaleDateString("fr-FR"),
          exercise: ex.exerciseName,
          muscles: ex.bodyParts.map((b) => MUSCLE_LABELS[b] ?? b).join(", "),
          sets: ex.sets,
          reps: ex.totalReps,
          topWeight: ex.topWeight,
          pct1RM: ex.topPct1RM,
          ref1RM: ex.ref1RM,
          volume: Math.round(ex.topWeight * ex.totalReps),
          inol: ex.inol,
        })),
      ),
    [sessions],
  );

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" || key === "exercise" ? "asc" : "desc");
    }
  };

  const exportToExcel = () => {
    // Feuille 1 : le grain fin, exactement ce que montre le tableau, dans l'ordre
    // affiché — un export qui trie autrement que l'écran surprend toujours.
    const detail = sorted.map((r) => ({
      Date: r.dateLabel,
      Exercice: r.exercise,
      "Groupes musculaires": r.muscles,
      Séries: r.sets,
      "Répétitions totales": r.reps,
      "Charge max (kg)": r.topWeight,
      "% du 1RM": r.pct1RM,
      "1RM de référence (kg)": r.ref1RM,
      "Volume approx. (kg·reps)": r.volume,
      INOL: r.inol,
    }));

    // Feuille 2 : le volume hebdomadaire par muscle, qui vient d'un autre endpoint
    // et n'a pas le même grain — il mérite sa propre feuille plutôt qu'un mélange.
    const muscles = [...new Set(weekly.flatMap((w) => Object.keys(w.muscleGroups)))];
    const volume = weekly.map((w) => ({
      Semaine: w.week,
      ...Object.fromEntries(
        muscles.map((m) => [MUSCLE_LABELS[m] ?? m, Math.round(w.muscleGroups[m] ?? 0)]),
      ),
      Total: Math.round(w.total),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "Exercices par séance");
    if (volume.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(volume), "Volume hebdo par muscle");
    }

    const safe = clientName.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "") || "client";
    XLSX.writeFile(wb, `${safe}_progression_musculaire_${days}j.xlsx`);
  };

  if (status === "loading") return <p className="text-sm text-gray-500">Chargement du tableau…</p>;
  if (status === "error") return <p className="text-sm text-gray-500">Données indisponibles.</p>;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Aucune donnée de progression musculaire sur cette période. Le tableau se remplit
        avec les séances validées dont les exercices sont reliés au catalogue et les
        charges saisies.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500">
          {rows.length} ligne(s) — un exercice par séance, sur {days} jours
        </p>
        <button
          type="button"
          onClick={exportToExcel}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Exporter en Excel
        </button>
      </div>

      {/* max-h + overflow : sur 90 jours le tableau dépasse la centaine de lignes,
          il doit défiler dans son cadre et non pousser la page. */}
      <div className="overflow-auto max-h-[26rem] rounded-lg border border-gray-500/20">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--surface-card,#fff)]">
            <tr className="text-xs text-gray-500 border-b border-gray-500/20">
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={`font-medium py-2 px-2 whitespace-nowrap ${c.numeric ? "text-right" : "text-left"}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className={`inline-flex items-center gap-1 hover:text-gray-700 ${
                      sortKey === c.key ? "text-primary-600 font-semibold" : ""
                    }`}
                  >
                    {c.label}
                    {c.unit && <span className="opacity-60">({c.unit})</span>}
                    <ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden="true" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr
                key={`${r.date}-${r.exercise}-${i}`}
                className="border-b border-gray-500/10 hover:bg-gray-500/5"
              >
                <td className="py-1.5 px-2 whitespace-nowrap text-gray-500">{r.dateLabel}</td>
                <td className="py-1.5 px-2">
                  <span className="font-medium">{r.exercise}</span>
                  <span className="block text-[11px] text-gray-500">{r.muscles}</span>
                </td>
                <td className="py-1.5 px-2 text-right text-gray-500">{r.sets}</td>
                <td className="py-1.5 px-2 text-right text-gray-500">{r.reps}</td>
                <td className="py-1.5 px-2 text-right font-medium">{r.topWeight}</td>
                <td className="py-1.5 px-2 text-right text-gray-500">{r.pct1RM}</td>
                <td className="py-1.5 px-2 text-right text-gray-500">{r.ref1RM}</td>
                <td className="py-1.5 px-2 text-right">{r.volume.toLocaleString("fr-FR")}</td>
                <td className="py-1.5 px-2 text-right font-bold">{r.inol.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-400 leading-snug">
        « Charge max » est la charge la plus lourde de la séance sur cet exercice, et
        « % 1RM » sa part du 1RM de référence. Le volume est approché par charge max ×
        répétitions : le détail série par série n&apos;est pas exposé par l&apos;API, le
        chiffre surestime donc légèrement les séances à charges dégressives.
        L&apos;export contient une seconde feuille avec le volume hebdomadaire par muscle.
      </p>
    </div>
  );
}
