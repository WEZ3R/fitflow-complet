"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { analyticsAPI } from "@/lib/api";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Activity, TrendingUp, CheckSquare, Dumbbell, Zap, Award, BarChart2, Flame } from "lucide-react";
import BodyMap from "./BodyMap";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkoutAnalyticsPanelProps {
  clientId: string;
  clientName: string;
  clientGender: string | null;
  period: number;
  /**
   * Affiche le graphique « Intensité par séance ».
   *
   * Masqué sur la fiche client : il compare des TOTAUX de séance à des seuils qui
   * valent PAR EXERCICE (0,5 / 1 / 2 d'après Hristov). Dès qu'une séance compte
   * plusieurs mouvements, le total dépasse mécaniquement le dernier seuil et le
   * graphique affiche « Intense » en permanence — il ne discrimine rien. La fiche
   * client présente déjà l'INOL correctement, exercice par exercice.
   */
  showInol?: boolean;
}

interface WeeklyData {
  week: string;
  estimated1RM?: number;
  maxWeight?: number;
}

interface Exercise1RM {
  exerciseRefId: string;
  exerciseName: string;
  bodyParts: string[];
  weeklyData: WeeklyData[];
}

interface WeeklyVolume {
  week: string;
  muscleGroups: Record<string, number>;
  total: number;
}

interface WeeklyCompletion {
  week: string;
  completed: number;
  total: number;
  rate: number;
}

interface SessionINOL {
  sessionId: string;
  date: string;
  totalINOL: number;
}

interface StrengthExercise {
  exerciseName: string;
  estimated1RM: number;
  ratio: number;
  level: string;
  levelIndex: number;
  levelLabel: string;
  nextLevel: string | null;
  nextLevelRatio: number | null;
}

interface MuscleLandmark {
  name: string;
  weeklyAvgSets: number;
  mev: number;
  mavLow: number;
  mavHigh: number;
  mrv: number;
  zone: string;
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const LINE_COLORS = [
  "#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6",
];

const MUSCLE_COLORS: Record<string, string> = {
  CHEST: "#ef4444",
  BACK: "#3b82f6",
  SHOULDERS: "#f59e0b",
  UPPER_LEGS: "#10b981",
  LOWER_LEGS: "#8b5cf6",
  UPPER_ARMS: "#ec4899",
  LOWER_ARMS: "#06b6d4",
  WAIST: "#84cc16",
};

const LEVEL_COLORS: Record<string, string> = {
  beginner: "#6b7280",
  novice: "#3b82f6",
  intermediate: "#10b981",
  advanced: "#f59e0b",
  elite: "#ef4444",
};

/**
 * Vert d'accent du site, celui de `--accent` dans app/globals.css.
 *
 * Les barres portaient une couleur par zone RP — gris, bleu, vert, ambre, rouge.
 * La zone est désormais NOMMÉE dans l'infobulle (« Zone MAV », « Sur MRV »), et les
 * lignes de repère MEV / MAV / MRV la situent visuellement : l'information n'est
 * pas perdue, elle est simplement écrite au lieu d'être codée en couleur.
 */
const BAR_GREEN = "#85e859";
/**
 * Barres « manquées » : gris plein, sans transparence.
 *
 * Un gris translucide se mélange au fond de la carte et change d'aspect selon ce
 * qu'il recouvre. En opaque, la barre garde la même valeur partout. La teinte est
 * celle de `textSubtle` du thème, assez claire pour ressortir sur la carte à
 * #323232 sans concurrencer le vert.
 */
const BAR_MISSED = "#8a8a8a";

const ZONE_LABELS: Record<string, string> = {
  below_mev: "Sous MEV",
  mev_to_mav: "MEV→MAV",
  mav: "Zone MAV",
  mav_to_mrv: "MAV→MRV",
  above_mrv: "Sur MRV",
};

const MUSCLE_LABELS: Record<string, string> = {
  CHEST: "Pectoraux",
  BACK: "Dos",
  SHOULDERS: "Épaules",
  UPPER_LEGS: "Quadriceps",
  LOWER_LEGS: "Mollets",
  UPPER_ARMS: "Bras",
  LOWER_ARMS: "Avant-bras",
  WAIST: "Abdos",
};

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-primary-500" />
        {title}
      </h3>
      {children}
    </div>
  );
}

/**
 * Sélection des mouvements ou groupes musculaires étudiés.
 *
 * Partagé par « Progression de charge » et « 1RM estimé » : les deux répondent à
 * la même question sur les mêmes mouvements, une sélection distincte par
 * graphique obligerait à la refaire deux fois pour comparer.
 */
function MovementFilter({
  muscleOptions,
  exerciseOptions,
  selectedMuscles,
  selectedExercises,
  colorOf,
  onToggleMuscle,
  onToggleExercise,
  onReset,
}: {
  muscleOptions: Array<[string, number]>;
  exerciseOptions: Exercise1RM[];
  selectedMuscles: string[];
  selectedExercises: string[];
  colorOf: Map<string, string>;
  onToggleMuscle: (part: string) => void;
  onToggleExercise: (id: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="mb-3 space-y-2">
      {muscleOptions.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-0.5">Groupes</span>
          {muscleOptions.map(([part, count]) => {
            const on = selectedMuscles.includes(part);
            return (
              <button
                key={part}
                type="button"
                onClick={() => onToggleMuscle(part)}
                aria-pressed={on}
                className={`rounded-full px-2.5 py-1 text-[11px] border transition-colors ${
                  on
                    ? "bg-primary-600 text-white border-primary-600"
                    : "border-gray-300 text-gray-600 hover:border-primary-500 hover:text-primary-600"
                }`}
              >
                {MUSCLE_LABELS[part] ?? part} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-0.5">Mouvements</span>
        {exerciseOptions.map((ex) => {
          const on = selectedExercises.includes(ex.exerciseRefId);
          const color = colorOf.get(ex.exerciseRefId);
          return (
            <button
              key={ex.exerciseRefId}
              type="button"
              onClick={() => onToggleExercise(ex.exerciseRefId)}
              aria-pressed={on}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] border transition-colors ${
                on ? "border-transparent text-gray-900" : "border-gray-300 text-gray-600 hover:border-gray-400"
              }`}
              style={on ? { backgroundColor: color } : undefined}
            >
              {/* Pastille de la couleur de la courbe : elle relie le bouton à la
                  ligne du graphique sans lire la légende. */}
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: on ? "rgba(0,0,0,0.45)" : color }}
              />
              {ex.exerciseName}
            </button>
          );
        })}
        {(selectedMuscles.length > 0 || selectedExercises.length > 0) && (
          <button
            type="button"
            onClick={onReset}
            className="rounded-full px-2.5 py-1 text-[11px] text-gray-400 hover:text-gray-600 underline"
          >
            Tout afficher
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-sm text-gray-400">
      {message}
    </div>
  );
}

function Loader() {
  return (
    <div className="h-40 flex items-center justify-center">
      <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WorkoutAnalyticsPanel({
  clientId,
  clientName,
  clientGender,
  period,
  showInol = true,
}: WorkoutAnalyticsPanelProps) {
  // La plage de dates est dérivée de l'horloge, qui est impure : la lire pendant le
  // rendu est interdit et produirait de toute façon des bornes différentes à chaque
  // passage. Elle est donc calculée dans fetchAll, au moment de l'appel.

  // ── State ─────────────────────────────────────────────────────────────────
  const [loading1RM, setLoading1RM] = useState(false);
  const [loadingVolume, setLoadingVolume] = useState(false);
  const [loadingCompletion, setLoadingCompletion] = useState(false);
  const [loadingLoad, setLoadingLoad] = useState(false);
  const [loadingINOL, setLoadingINOL] = useState(false);
  const [loadingStandards, setLoadingStandards] = useState(false);
  const [loadingLandmarks, setLoadingLandmarks] = useState(false);

  const [exercises1RM, setExercises1RM] = useState<Exercise1RM[]>([]);
  const [weeklyVolume, setWeeklyVolume] = useState<WeeklyVolume[]>([]);
  const [totalByMuscle, setTotalByMuscle] = useState<Record<string, number>>({});
  const [completion, setCompletion] = useState<{
    currentStreak: number;
    longestStreak: number;
    weeklyCompletion: WeeklyCompletion[];
  } | null>(null);
  const [loadProgression, setLoadProgression] = useState<Exercise1RM[]>([]);
  // Filtre de la progression de charge. Vide = tout afficher : un plan complet
  // trace une quinzaine de courbes, illisibles empilées.
  const [loadMuscles, setLoadMuscles] = useState<string[]>([]);
  const [loadExercises, setLoadExercises] = useState<string[]>([]);
  const [inol, setInol] = useState<SessionINOL[]>([]);
  const [standards, setStandards] = useState<StrengthExercise[]>([]);
  const [landmarks, setLandmarks] = useState<MuscleLandmark[]>([]);

  // ── Fetch all data ────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    const now = Date.now();
    const params = {
      clientId,
      startDate: new Date(now - period * 86400000).toISOString().split("T")[0],
      endDate: new Date(now).toISOString().split("T")[0],
    };

    // 1RM estimé
    setLoading1RM(true);
    analyticsAPI
      .getEstimated1RM(params)
      .then((r) => setExercises1RM(r.data.data?.exercises ?? []))
      .catch(console.error)
      .finally(() => setLoading1RM(false));

    // Volume hebdo
    setLoadingVolume(true);
    analyticsAPI
      .getWeeklyVolume(params)
      .then((r) => {
        setWeeklyVolume(r.data.data?.weeklyVolume ?? []);
        setTotalByMuscle(r.data.data?.totalByMuscle ?? {});
      })
      .catch(console.error)
      .finally(() => setLoadingVolume(false));

    // Complétion + streak
    setLoadingCompletion(true);
    analyticsAPI
      .getCompletion(params)
      .then((r) => setCompletion(r.data.data ?? null))
      .catch(console.error)
      .finally(() => setLoadingCompletion(false));

    // Progression de charge
    setLoadingLoad(true);
    analyticsAPI
      .getLoadProgression(params)
      .then((r) => setLoadProgression(r.data.data?.exercises ?? []))
      .catch(console.error)
      .finally(() => setLoadingLoad(false));

    // INOL — seulement si la section est affichée : inutile d'interroger
    // l'endpoint le plus coûteux du lot pour un graphique masqué.
    if (showInol) {
      setLoadingINOL(true);
      analyticsAPI
        .getSessionINOL(params)
        .then((r) => setInol(r.data.data?.sessions ?? []))
        .catch(console.error)
        .finally(() => setLoadingINOL(false));
    }

    // Standards de force
    setLoadingStandards(true);
    analyticsAPI
      .getStrengthStandards({ clientId })
      .then((r) => setStandards(r.data.data?.exercises ?? []))
      .catch(() => setStandards([]))
      .finally(() => setLoadingStandards(false));

    // Volume landmarks
    setLoadingLandmarks(true);
    analyticsAPI
      .getVolumeLandmarks(params)
      .then((r) => setLandmarks(r.data.data?.muscleGroups ?? []))
      .catch(console.error)
      .finally(() => setLoadingLandmarks(false));
  }, [clientId, period, showInol]);

  useEffect(() => {
    // set-state-in-effect vise les effets qui écrivent l'état pendant le rendu et
    // provoquent des rendus en cascade. Ici l'écriture est celle des drapeaux de
    // chargement d'un chargement de données au montage : le rendu supplémentaire est
    // voulu, c'est lui qui affiche les squelettes. La règle ne sait pas distinguer ce
    // cas ; la lever ponctuellement vaut mieux que de la désactiver pour tout le projet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, [fetchAll]);

  // ── Progression de charge : groupes, mouvements, couleurs ─────────────────

  /**
   * Couleur figée par mouvement, calculée sur la liste COMPLÈTE.
   *
   * Indexer les couleurs sur la liste filtrée les ferait glisser à chaque
   * changement de filtre : le squat passerait du bleu au vert sans raison, et on
   * ne pourrait plus comparer deux vues.
   */
  /** Union des mouvements des deux graphiques, dédupliquée, ordre stable. */
  const allMovements = useMemo(() => {
    const byId = new Map<string, Exercise1RM>();
    for (const ex of [...loadProgression, ...exercises1RM]) {
      if (!byId.has(ex.exerciseRefId)) byId.set(ex.exerciseRefId, ex);
    }
    return [...byId.values()];
  }, [loadProgression, exercises1RM]);

  const loadColorOf = useMemo(() => {
    const m = new Map<string, string>();
    allMovements.forEach((ex, i) => m.set(ex.exerciseRefId, LINE_COLORS[i % LINE_COLORS.length]));
    return m;
  }, [allMovements]);

  /** Groupes musculaires réellement présents dans les données, avec leur effectif. */
  const loadMuscleOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ex of allMovements) {
      for (const part of ex.bodyParts) counts.set(part, (counts.get(part) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [allMovements]);

  /** Mouvements proposés : restreints aux groupes retenus, s'il y en a. */
  const loadExerciseOptions = useMemo(
    () =>
      loadMuscles.length === 0
        ? allMovements
        : allMovements.filter((ex) => ex.bodyParts.some((p) => loadMuscles.includes(p))),
    [allMovements, loadMuscles],
  );

  /**
   * Applique la sélection à un jeu de courbes.
   * Un choix de mouvements l'emporte sur le choix de groupes.
   */
  const applySelection = useCallback(
    (list: Exercise1RM[]) => {
      const byMuscle =
        loadMuscles.length === 0
          ? list
          : list.filter((ex) => ex.bodyParts.some((p) => loadMuscles.includes(p)));
      return loadExercises.length === 0
        ? byMuscle
        : byMuscle.filter((ex) => loadExercises.includes(ex.exerciseRefId));
    },
    [loadMuscles, loadExercises],
  );

  const loadDisplayed = useMemo(() => applySelection(loadProgression), [applySelection, loadProgression]);
  const displayed1RM = useMemo(() => applySelection(exercises1RM), [applySelection, exercises1RM]);

  const toggleLoadMuscle = (part: string) => {
    // Le prochain état est calculé ICI, pas dans une fonction de mise à jour :
    // React peut rejouer un updater, qui doit donc rester pur. Imbriquer un
    // second setState dedans le rendrait à effet de bord.
    const nextMuscles = loadMuscles.includes(part)
      ? loadMuscles.filter((p) => p !== part)
      : [...loadMuscles, part];

    setLoadMuscles(nextMuscles);
    // Les mouvements retenus qui sortent du périmètre sont abandonnés, sinon le
    // graphique se vide sans que rien ne l'explique à l'écran.
    setLoadExercises((exs) =>
      exs.filter((id) => {
        const ex = allMovements.find((e) => e.exerciseRefId === id);
        return !ex || nextMuscles.length === 0 || ex.bodyParts.some((p) => nextMuscles.includes(p));
      }),
    );
  };

  const toggleLoadExercise = (id: string) =>
    setLoadExercises((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const resetLoadFilter = () => {
    setLoadMuscles([]);
    setLoadExercises([]);
  };

  /**
   * Fusionne des séries par semaine en un seul tableau de lignes.
   *
   * Recharts n'affiche AUCUN titre d'infobulle quand chaque `<Line>` porte son propre
   * `data` : sans jeu de données sur le `<LineChart>`, il n'a pas de valeur d'axe à
   * nommer. C'était le cas ici, et aucune couleur de texte n'y changeait rien — le
   * titre était absent, pas illisible.
   *
   * Les semaines sont l'union de toutes les séries, triées : un exercice absent une
   * semaine laisse un trou, que `connectNulls` relie visuellement.
   */
  const mergeWeekly = (
    list: Exercise1RM[],
    pick: (d: WeeklyData) => number | undefined,
  ) => {
    const weeks = [...new Set(list.flatMap((ex) => ex.weeklyData.map((d) => d.week)))].sort();
    return weeks.map((week) => {
      const row: Record<string, string | number> = { week: week.replace(/^\d{4}-/, "") };
      for (const ex of list) {
        const point = ex.weeklyData.find((d) => d.week === week);
        const value = point ? pick(point) : undefined;
        if (value != null) row[ex.exerciseName] = value;
      }
      return row;
    });
  };

  const loadChartData = useMemo(
    () => mergeWeekly(loadDisplayed, (d) => d.maxWeight),
    [loadDisplayed],
  );
  const chart1RMData = useMemo(
    () => mergeWeekly(displayed1RM, (d) => d.estimated1RM),
    [displayed1RM],
  );

  // ── Body map volume normalization ─────────────────────────────────────────
  const maxMuscleVolume = Math.max(0, ...Object.values(totalByMuscle).filter((v): v is number => typeof v === "number"));

  // ── Volume chart data: flatten by week ────────────────────────────────────
  const volumeChartData = weeklyVolume.map((entry) => ({
    week: entry.week.replace(/^\d{4}-/, ""),
    ...Object.fromEntries(
      Object.entries(entry.muscleGroups).map(([muscle, vol]) => [
        MUSCLE_LABELS[muscle] ?? muscle,
        Math.round(vol),
      ])
    ),
    total: Math.round(entry.total),
  }));

  const allMusclesInChart = Array.from(
    new Set(weeklyVolume.flatMap((e) => Object.keys(e.muscleGroups)))
  );

  // ── INOL chart data ───────────────────────────────────────────────────────
  const inolChartData = inol.map((s) => ({
    date: new Date(s.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    INOL: Math.round(s.totalINOL * 100) / 100,
    sessionId: s.sessionId,
  }));

  // ── Landmarks chart data ──────────────────────────────────────────────────
  const landmarksChartData = landmarks.map((mg) => ({
    name: MUSCLE_LABELS[mg.name] ?? mg.name,
    sets: mg.weeklyAvgSets,
    mev: mg.mev,
    mavLow: mg.mavLow,
    mavHigh: mg.mavHigh,
    mrv: mg.mrv,
    zone: mg.zone,
    zoneLabel: ZONE_LABELS[mg.zone],
  }));

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">

      {/* Client header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3 flex items-center gap-3 shrink-0">
        <Activity className="h-5 w-5 text-primary-500" />
        <div>
          <h2 className="text-sm font-bold text-gray-900">Performance musculation</h2>
          <p className="text-xs text-gray-500">{clientName} — {period} derniers jours</p>
        </div>
        {completion && (
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-primary-500" />
              <span className="text-lg font-bold text-gray-900">{completion.currentStreak}</span>
              <span className="text-xs text-gray-500">jours consécutifs</span>
            </div>
            <div className="text-xs text-gray-400 border-l border-gray-200 pl-4">
              Record&nbsp;: <span className="font-semibold text-gray-700">{completion.longestStreak}</span>&nbsp;j
            </div>
          </div>
        )}
      </div>

      {/* Row 1: Completion + Volume map */}
      <div className="grid grid-cols-2 gap-4">

        {/* Complétion */}
        <Section title="Complétion des séances" icon={CheckSquare}>
          {loadingCompletion ? (
            <Loader />
          ) : !completion || completion.weeklyCompletion.length === 0 ? (
            <EmptyState message="Aucune séance sur cette période" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={completion.weeklyCompletion.map((w) => ({
                  week: w.week.replace(/^\d{4}-/, ""),
                  Complétées: w.completed,
                  Manquées: w.total - w.completed,
                  rate: Math.round(w.rate * 100),
                }))}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                barSize={14}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} allowDecimals={false} />
                <Tooltip
                  offset={26}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)" }}
                  labelStyle={{ color: "#ffffff", fontWeight: 600 }}
                  itemStyle={{ paddingTop: 1, paddingBottom: 1 }}
                  formatter={(value, name) =>
                    name === "Complétées" || name === "Manquées" ? [value, name] : [`${value}%`, "Taux"]
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {/* Vert d'accent pour les séances faites, gris plein pour les
                    manquées : deux teintes franches, lisibles empilées. */}
                <Bar dataKey="Complétées" stackId="a" fill={BAR_GREEN} />
                <Bar dataKey="Manquées" stackId="a" fill={BAR_MISSED} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* Volume par muscle — BodyMap */}
        <Section title="Volume musculaire" icon={Dumbbell}>
          {loadingVolume ? (
            <Loader />
          ) : maxMuscleVolume === 0 ? (
            <EmptyState message="Aucune donnée de volume" />
          ) : (
            <BodyMap
              gender={clientGender}
              muscleVolumes={totalByMuscle}
              maxVolume={maxMuscleVolume}
            />
          )}
        </Section>
      </div>

      {/* Row 2 : volume hebdomadaire + intensité, deux demi-cartes */}
      <div className="grid grid-cols-2 gap-4">

        {/* Volume hebdo stacked */}
        <Section
          title="Volume par groupe musculaire / semaine"
          icon={BarChart2}
          className={showInol ? "" : "col-span-2"}
        >
          {loadingVolume ? (
            <Loader />
          ) : volumeChartData.length === 0 ? (
            <EmptyState message="Aucune donnée de volume" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={volumeChartData}
                margin={{ top: 4, right: 8, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <Tooltip
                  offset={26}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)" }}
                  labelStyle={{ color: "#ffffff", fontWeight: 600 }}
                  itemStyle={{ paddingTop: 1, paddingBottom: 1 }}
                  formatter={(val) => `${Math.round((val as number) ?? 0).toLocaleString()} kg·reps`}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {allMusclesInChart.map((muscle, i) => (
                  <Bar
                    key={muscle}
                    dataKey={MUSCLE_LABELS[muscle] ?? muscle}
                    stackId="vol"
                    fill={MUSCLE_COLORS[muscle] ?? LINE_COLORS[i % LINE_COLORS.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* INOL — masquable, cf. la prop showInol */}
        {showInol && (
          <Section title="Intensité par séance (INOL)" icon={Zap}>
            {loadingINOL ? (
              <Loader />
            ) : inolChartData.length === 0 ? (
              <EmptyState message="Aucune donnée INOL" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={inolChartData}
                  margin={{ top: 4, right: 8, left: -10, bottom: 0 }}
                  barSize={16}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <Tooltip
                    offset={26}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)" }}
                    labelStyle={{ color: "#ffffff", fontWeight: 600 }}
                    itemStyle={{ paddingTop: 1, paddingBottom: 1 }}
                    formatter={(v) => [((v as number) ?? 0).toFixed(2), "INOL"]}
                  />
                  {/* Zones INOL: facile <0.5, modéré 0.5-1, difficile 1-2, extrême >2 */}
                  <ReferenceLine y={0.5} stroke="#10b981" strokeDasharray="3 3" label={{ value: "Léger", fontSize: 9, fill: "#10b981" }} />
                  <ReferenceLine y={1} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "Modéré", fontSize: 9, fill: "#f59e0b" }} />
                  <ReferenceLine y={2} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Intense", fontSize: 9, fill: "#ef4444" }} />
                  <Bar dataKey="INOL" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Section>
        )}

      </div>

      {/* Row 3 : les deux séries temporelles, en pleine largeur */}
      <div className="grid grid-cols-2 gap-4">

        {/* Progression de charge */}
        <Section title="Progression de charge" icon={TrendingUp} className="col-span-2">
          {loadingLoad ? (
            <Loader />
          ) : loadProgression.length === 0 ? (
            <EmptyState message="Aucune donnée de charge" />
          ) : (
            <>
              <MovementFilter
                muscleOptions={loadMuscleOptions}
                exerciseOptions={loadExerciseOptions}
                selectedMuscles={loadMuscles}
                selectedExercises={loadExercises}
                colorOf={loadColorOf}
                onToggleMuscle={toggleLoadMuscle}
                onToggleExercise={toggleLoadExercise}
                onReset={resetLoadFilter}
              />

              {loadDisplayed.length === 0 ? (
                <EmptyState message="Aucun mouvement sélectionné" />
              ) : (
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={loadChartData} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} unit=" kg" />
                <Tooltip
                  offset={26}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)" }}
                  labelStyle={{ color: "#ffffff", fontWeight: 600 }}
                  itemStyle={{ paddingTop: 1, paddingBottom: 1 }}
                  labelFormatter={(w) => `Semaine ${w}`}
                  formatter={(v, name) => [`${(v as number) ?? 0} kg`, name]}
                />
                {loadDisplayed.map((ex) => (
                  <Line
                    key={ex.exerciseRefId}
                    type="monotone"
                    dataKey={ex.exerciseName}
                    stroke={loadColorOf.get(ex.exerciseRefId)}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
              )}
            </>
          )}
        </Section>

        {/* 1RM estimé */}
        <Section title="1RM estimé par exercice" icon={TrendingUp} className="col-span-2">
          {loading1RM ? (
            <Loader />
          ) : exercises1RM.length === 0 ? (
            <EmptyState message="Aucune donnée de 1RM" />
          ) : (
            <>
              {/* Même sélection que la progression de charge : l'état est unique,
                  cocher ici se répercute là-bas et réciproquement. */}
              <MovementFilter
                muscleOptions={loadMuscleOptions}
                exerciseOptions={loadExerciseOptions}
                selectedMuscles={loadMuscles}
                selectedExercises={loadExercises}
                colorOf={loadColorOf}
                onToggleMuscle={toggleLoadMuscle}
                onToggleExercise={toggleLoadExercise}
                onReset={resetLoadFilter}
              />

              {displayed1RM.length === 0 ? (
                <EmptyState message="Aucun mouvement sélectionné" />
              ) : (
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chart1RMData} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} unit=" kg" />
                <Tooltip
                  offset={26}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)" }}
                  labelStyle={{ color: "#ffffff", fontWeight: 600 }}
                  itemStyle={{ paddingTop: 1, paddingBottom: 1 }}
                  labelFormatter={(w) => `Semaine ${w}`}
                  formatter={(v, name) => [`${(v as number) ?? 0} kg`, name]}
                />
                {displayed1RM.map((ex) => (
                  <Line
                    key={ex.exerciseRefId}
                    type="monotone"
                    dataKey={ex.exerciseName}
                    // Couleur commune aux deux graphiques : le squat garde la
                    // même teinte en 1RM et en progression de charge.
                    stroke={loadColorOf.get(ex.exerciseRefId)}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
              )}
            </>
          )}
        </Section>
      </div>

      {/* Row 4: Standards de force + Volume landmarks */}
      <div className="grid grid-cols-2 gap-4">

        {/* Standards de force */}
        <Section title="Standards de force (ExRx)" icon={Award}>
          {loadingStandards ? (
            <Loader />
          ) : standards.length === 0 ? (
            <EmptyState message="Aucune donnée — poids du client requis et exercices barre" />
          ) : (
            <div className="flex flex-col gap-3">
              {standards.map((ex) => (
                <div key={ex.exerciseName}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700 truncate">{ex.exerciseName}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-500">{ex.estimated1RM} kg</span>
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: LEVEL_COLORS[ex.level] ?? "#6b7280" }}
                      >
                        {ex.levelLabel}
                      </span>
                    </div>
                  </div>
                  {/* Progress bar across 5 levels */}
                  <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, ((ex.levelIndex + 1) / 5) * 100)}%`,
                        backgroundColor: LEVEL_COLORS[ex.level] ?? "#6b7280",
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-0.5">
                    {["Déb.", "Nov.", "Inter.", "Avancé", "Élite"].map((l) => (
                      <span key={l} className="text-[9px] text-gray-300">{l}</span>
                    ))}
                  </div>
                  {ex.nextLevel && ex.nextLevelRatio && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Prochain niveau : {ex.nextLevelRatio}× poids de corps
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Volume Landmarks */}
        <Section title="Volume landmarks RP (sets/semaine)" icon={BarChart2}>
          {loadingLandmarks ? (
            <Loader />
          ) : landmarksChartData.length === 0 ? (
            <EmptyState message="Aucune donnée de volume landmarks" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={landmarksChartData}
                layout="vertical"
                margin={{ top: 4, right: 60, left: 50, bottom: 0 }}
                barSize={14}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  width={45}
                />
                <Tooltip
                  offset={26}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)" }}
                  labelStyle={{ color: "#ffffff", fontWeight: 600 }}
                  // Couleur d'item imposée : ailleurs Recharts la prend sur la
                  // série, ce qui relie utilement une courbe à son chiffre. Ici les
                  // barres sont colorées cellule par cellule selon la zone RP, il
                  // n'y a donc pas de couleur de série — l'item retombait sur un
                  // gris sombre, illisible sur la carte grise.
                  itemStyle={{ color: "#f2f2f2", paddingTop: 1, paddingBottom: 1 }}
                  // La zone est nommée ici. `zoneLabel` était calculé et affiché
                  // nulle part : la seule indication était la couleur de la barre,
                  // ce qui obligeait à connaître le code couleur par cœur.
                  formatter={(v, name, item) => {
                    if (name !== "sets") return [`${v}`, name];
                    const zone = (item?.payload as { zoneLabel?: string })?.zoneLabel;
                    return [`${v} sets/sem${zone ? ` — ${zone}` : ""}`, "Moy. hebdo"];
                  }}
                />
                <Bar dataKey="sets" name="sets" fill={BAR_GREEN} radius={[0, 4, 4, 0]} />
                {/* MEV / MAV lines — use first entry as reference if all same */}
                {landmarksChartData.length > 0 && (
                  <>
                    <ReferenceLine
                      x={landmarksChartData[0].mev}
                      stroke="#3b82f6"
                      strokeDasharray="3 3"
                      label={{ value: "MEV", fontSize: 9, fill: "#3b82f6", position: "insideTopRight" }}
                    />
                    <ReferenceLine
                      x={landmarksChartData[0].mavLow}
                      stroke="#10b981"
                      strokeDasharray="3 3"
                      label={{ value: "MAV", fontSize: 9, fill: "#10b981", position: "insideTopRight" }}
                    />
                    <ReferenceLine
                      x={landmarksChartData[0].mrv}
                      stroke="#ef4444"
                      strokeDasharray="3 3"
                      label={{ value: "MRV", fontSize: 9, fill: "#ef4444", position: "insideTopRight" }}
                    />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>
    </div>
  );
}
