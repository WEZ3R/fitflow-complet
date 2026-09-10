"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { analyticsAPI } from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Calendar,
  TrendingUp,
  Search,
  ChevronUp,
  ChevronDown,
  Users,
  GitCompare,
  Layers,
  X,
  ArrowUpDown,
  Activity,
} from "lucide-react";
import WorkoutAnalyticsPanel from "./_components/WorkoutAnalyticsPanel";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnalyticsClient {
  id: string;
  name: string;
  gender?: string;
  age?: number;
  weight?: number;
  height?: number;
  program?: string;
  programId?: string;
  level?: string;
}

type ViewMode = "comparison" | "groups";
type SortField = "name" | "age" | "weight" | "program";
type SortDir = "asc" | "desc";

interface Group {
  id: "A" | "B";
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  clientIds: string[];
}

interface MetricConfig {
  key: string;
  label: string;
  color: string;
  /** Axe d'affichage : « right » pour les grandeurs en milliers. */
  axis: "left" | "right";
  family: "daily" | "perf";
}

interface ChartDataPoint {
  date: string;
  [key: string]: string | number | undefined;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Métriques traçables, en deux familles.
 *
 * `axis` place la série à gauche ou à droite. Les ordres de grandeur sont
 * incompatibles sur un axe unique : 2 800 kcal et 30 000 kg·reps écraseraient un
 * sommeil de 7 h et un INOL de 8 sur la ligne du zéro. Les grandeurs « milliers »
 * vont donc à droite, les autres à gauche.
 *
 * `family` sert au regroupement du sélecteur : le but est de rapprocher une
 * consommation d'une performance, encore faut-il distinguer les deux.
 */
const METRICS: MetricConfig[] = [
  // Consommation et récupération — issues des relevés quotidiens
  { key: "weight", label: "Poids (kg)", color: "#3b82f6", axis: "left", family: "daily" },
  { key: "waterIntake", label: "Eau (L)", color: "#06b6d4", axis: "left", family: "daily" },
  { key: "sleepHours", label: "Sommeil (h)", color: "#8b5cf6", axis: "left", family: "daily" },
  { key: "totalCalories", label: "Calories", color: "#f59e0b", axis: "right", family: "daily" },
  // Performance — calculées depuis les séances validées
  { key: "inol", label: "INOL", color: "#85e859", axis: "left", family: "perf" },
  { key: "best1RM", label: "1RM estimé (kg)", color: "#a6f487", axis: "left", family: "perf" },
  { key: "topPct1RM", label: "Intensité max (% 1RM)", color: "#f2c14e", axis: "left", family: "perf" },
  { key: "setsDone", label: "Séries réalisées", color: "#ff8a84", axis: "left", family: "perf" },
  { key: "tonnage", label: "Tonnage (kg·reps)", color: "#5cb82c", axis: "right", family: "perf" },
];

const FAMILY_LABELS: Record<string, string> = {
  daily: "Consommation & récupération",
  perf: "Performance",
};

/** Liste de gauche : largeur par défaut (w-72), bornes du redimensionnement. */
const LEFT_DEFAULT = 288;
const LEFT_MIN = 220;
const LEFT_RIGHT_MIN = 420;

const PERIODS = [
  { value: 7, label: "7j" },
  { value: 30, label: "30j" },
  { value: 60, label: "60j" },
  { value: 90, label: "90j" },
  { value: 365, label: "1 an" },
];

/**
 * Motifs de trait, pour distinguer les métriques quand la couleur encode déjà le
 * client ou le groupe. `undefined` = trait plein.
 */
const DASHES: Array<string | undefined> = [undefined, "6 3", "2 2", "9 3 2 3", "12 4", "1 3"];

const CLIENT_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6",
];

const GROUP_DEFAULTS: Record<"A" | "B", Omit<Group, "clientIds" | "label">> = {
  A: { id: "A", color: "#3b82f6", bgColor: "#eff6ff", borderColor: "#bfdbfe", textColor: "#1d4ed8" },
  B: { id: "B", color: "#f59e0b", bgColor: "#fffbeb", borderColor: "#fde68a", textColor: "#b45309" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const round1 = (n: number) => Math.round(n * 10) / 10;

function sortByDateKey(data: ChartDataPoint[]): ChartDataPoint[] {
  return [...data].sort((a, b) => {
    const [dayA, monthA] = (a.date as string).split("/");
    const [dayB, monthB] = (b.date as string).split("/");
    return (
      new Date(2024, +monthA - 1, +dayA).getTime() -
      new Date(2024, +monthB - 1, +dayB).getTime()
    );
  });
}

function formatDateKey(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  /**
   * Onglet et client pré-sélectionnés depuis l'URL.
   *
   * La fiche client renvoie ici avec `?tab=workout&clientId=…` : sans cette lecture,
   * il faudrait retrouver le client à la main dans une liste de trente. Les valeurs
   * servent d'état INITIAL, pas de source de vérité — l'utilisateur doit pouvoir
   * changer d'onglet ensuite sans que l'URL le ramène en arrière.
   */
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "workout" ? "workout" : "daily";
  const initialClientId = searchParams.get("clientId");

  // ── Tab
  const [activeTab, setActiveTab] = useState<"daily" | "workout">(initialTab);

  // ── Data
  const [clients, setClients] = useState<AnalyticsClient[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Workout tab: single client selection
  const [workoutClientId, setWorkoutClientId] = useState<string | null>(initialClientId);

  // ── View
  const [viewMode, setViewMode] = useState<ViewMode>("comparison");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([
    { ...GROUP_DEFAULTS.A, label: "Groupe A", clientIds: [] },
    { ...GROUP_DEFAULTS.B, label: "Groupe B", clientIds: [] },
  ]);

  // ── Chart config
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["weight"]);
  const [period, setPeriod] = useState(30);

  // ── Client list controls
  const [search, setSearch] = useState("");
  const [filterGender, setFilterGender] = useState("all");
  const [filterWeightMin, setFilterWeightMin] = useState("");
  const [filterWeightMax, setFilterWeightMax] = useState("");
  const [filterAgeMin, setFilterAgeMin] = useState("");
  const [filterAgeMax, setFilterAgeMax] = useState("");
  const [filterProgram, setFilterProgram] = useState("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // ── Largeur de la liste : la composition de groupes ajoute une colonne de
  // boutons par groupe, qui écrase les colonnes de mesures à 288 px.
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  const startResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const panel = leftPanelRef.current;
    if (!panel) return;
    const originX = panel.getBoundingClientRect().left;
    // Le graphique doit rester lisible : on borne aussi par la fenêtre, sinon la
    // liste peut le réduire à rien sur un écran étroit.
    const max = Math.max(LEFT_MIN, window.innerWidth - LEFT_RIGHT_MIN);

    const onMove = (ev: PointerEvent) => {
      setLeftWidth(Math.min(max, Math.max(LEFT_MIN, ev.clientX - originX)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    // Sans ça, le glissement sélectionne les noms de la liste et le curseur
    // redevient une flèche dès qu'on sort de la poignée.
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  // ── Fetch clients
  useEffect(() => {
    analyticsAPI
      .getCoachClients()
      .then((res) => setClients(res.data.data ?? []))
      .catch(console.error);
  }, []);

  // ── Derived: filtered + sorted clients
  const filteredClients = useMemo(() => {
    let result = [...clients];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (filterGender === "none") {
      result = result.filter((c) => !c.gender);
    } else if (filterGender !== "all") {
      result = result.filter((c) => c.gender === filterGender);
    }
    if (filterWeightMin !== "") {
      result = result.filter(
        (c) => c.weight != null && c.weight >= +filterWeightMin
      );
    }
    if (filterWeightMax !== "") {
      result = result.filter(
        (c) => c.weight != null && c.weight <= +filterWeightMax
      );
    }
    if (filterAgeMin !== "") {
      result = result.filter((c) => c.age != null && c.age >= +filterAgeMin);
    }
    if (filterAgeMax !== "") {
      result = result.filter((c) => c.age != null && c.age <= +filterAgeMax);
    }
    if (filterProgram !== "all") {
      result = result.filter((c) => c.programId === filterProgram);
    }

    result.sort((a, b) => {
      const valA: string | number =
        sortField === "name" ? a.name
        : sortField === "age" ? (a.age ?? 0)
        : sortField === "weight" ? (a.weight ?? 0)
        : (a.program ?? "");
      const valB: string | number =
        sortField === "name" ? b.name
        : sortField === "age" ? (b.age ?? 0)
        : sortField === "weight" ? (b.weight ?? 0)
        : (b.program ?? "");

      if (typeof valA === "string") {
        return sortDir === "asc"
          ? valA.localeCompare(valB as string)
          : (valB as string).localeCompare(valA);
      }
      return sortDir === "asc" ? valA - (valB as number) : (valB as number) - valA;
    });

    return result;
  }, [clients, search, filterGender, filterWeightMin, filterWeightMax, filterAgeMin, filterAgeMax, filterProgram, sortField, sortDir]);

  // ── Derived: unique programs
  const programs = useMemo(() => {
    const seen = new Set<string>();
    return clients.reduce<{ id: string; name: string }[]>((acc, c) => {
      if (c.programId && c.program && !seen.has(c.programId)) {
        seen.add(c.programId);
        acc.push({ id: c.programId, name: c.program });
      }
      return acc;
    }, []);
  }, [clients]);

  // ── Client color by index
  const clientColor = useCallback(
    (id: string) =>
      CLIENT_COLORS[clients.findIndex((c) => c.id === id) % CLIENT_COLORS.length],
    [clients]
  );

  /**
   * Change d'onglet en TRANSPORTANT la sélection.
   *
   * Les deux onglets ne sélectionnent pas de la même façon : le suivi quotidien
   * compare plusieurs clients (cases à cocher), la musculation en analyse un seul.
   * Sans passerelle, choisir un client puis changer d'onglet remettait l'écran à
   * « Sélectionnez un client » — et le retour perdait la sélection à son tour.
   *
   * Le passage se fait dans le gestionnaire de clic et non dans un effet : un effet
   * qui écrit dans l'état déclenche un rendu en cascade, et la règle
   * react-hooks/set-state-in-effect l'interdit à juste titre.
   */
  const switchTab = (next: "daily" | "workout") => {
    if (next === activeTab) return;

    if (next === "workout") {
      // Plusieurs clients cochés : on prend le premier, faute de pouvoir en analyser
      // deux à la fois. Un client déjà choisi ici n'est pas écrasé.
      if (!workoutClientId && selectedClients.length > 0) {
        setWorkoutClientId(selectedClients[0]);
      }
    } else if (workoutClientId && !selectedClients.includes(workoutClientId)) {
      // Retour au suivi quotidien : le client étudié rejoint la comparaison au lieu
      // de disparaître.
      setSelectedClients((prev) => [...prev, workoutClientId]);
    }

    setActiveTab(next);
  };

  /**
   * Qui porte la couleur : le client, ou la métrique ?
   *
   * Un seul client affiché → la couleur est libre, elle sert à distinguer les
   * métriques. C'est le cas de lecture le plus courant, et l'ancien comportement le
   * rendait inutilisable : toutes les courbes prenaient la couleur du client, donc
   * cinq métriques donnaient cinq courbes identiques.
   *
   * Plusieurs clients ou des groupes → la couleur doit rester l'identité du client,
   * sinon on ne sait plus de qui on parle. Les métriques se distinguent alors par le
   * motif du trait.
   */
  const colorByMetric = viewMode === "comparison" && selectedClients.length === 1;

  // ── Active client IDs (for API call)
  const activeClientIds = useMemo(() => {
    if (viewMode === "comparison") return selectedClients;
    return [...new Set([...groups[0].clientIds, ...groups[1].clientIds])];
  }, [viewMode, selectedClients, groups]);

  // ── Fetch chart data
  const fetchChartData = useCallback(async () => {
    if (activeClientIds.length === 0 || selectedMetrics.length === 0) {
      setChartData([]);
      return;
    }
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);

      const response = await analyticsAPI.getClientStats({
        clientIds: activeClientIds,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const rawData: Array<{
        clientId: string;
        clientName: string;
        stats: Array<{ date: string; [key: string]: unknown }>;
      }> = response.data.data ?? [];

      if (viewMode === "comparison") {
        // One line per client per metric
        const byDate: Record<string, ChartDataPoint> = {};
        rawData.forEach((cd) => {
          cd.stats.forEach((stat) => {
            const dk = formatDateKey(stat.date as string);
            if (!byDate[dk]) byDate[dk] = { date: dk };
            selectedMetrics.forEach((m) => {
              byDate[dk][`${cd.clientName}_${m}`] = stat[m] as number;
            });
          });
        });
        setChartData(sortByDateKey(Object.values(byDate)));
      } else {
        // ── Group mode avec interpolation ───────────────────────────────────
        // Étape 1 : indexer les stats de chaque client par date YYYY-MM-DD
        type MetricMap = Record<string, number>;
        const clientIndex: Record<string, Record<string, MetricMap>> = {};
        // clientIndex[clientId][YYYY-MM-DD] = { weight: 80, sleepHours: 7, ... }

        rawData.forEach((cd) => {
          clientIndex[cd.clientId] = {};
          cd.stats.forEach((stat) => {
            const day = new Date(stat.date as string).toISOString().split("T")[0];
            const vals: MetricMap = {};
            selectedMetrics.forEach((m) => {
              const v = stat[m];
              if (v != null && typeof v === "number") vals[m] = v;
            });
            if (Object.keys(vals).length > 0) clientIndex[cd.clientId][day] = vals;
          });
        });

        // Étape 2 : union de toutes les dates couvertes par au moins un client
        const allDaysSet = new Set<string>();
        Object.values(clientIndex).forEach((days) =>
          Object.keys(days).forEach((d) => allDaysSet.add(d))
        );
        const allDays = [...allDaysSet].sort();

        // Étape 3 : pour chaque client, interpoler les jours manquants
        const interpolated: Record<string, Record<string, MetricMap>> = {};

        for (const [clientId, dayMap] of Object.entries(clientIndex)) {
          interpolated[clientId] = {};
          const knownDays = Object.keys(dayMap).sort();
          if (knownDays.length === 0) continue;

          for (const day of allDays) {
            if (dayMap[day]) {
              interpolated[clientId][day] = dayMap[day];
              continue;
            }
            // Trouver prev et next connus
            const prevDay = [...knownDays].reverse().find((d) => d < day);
            const nextDay = knownDays.find((d) => d > day);

            const vals: MetricMap = {};
            for (const m of selectedMetrics) {
              const prevVal = prevDay ? dayMap[prevDay]?.[m] : undefined;
              const nextVal = nextDay ? dayMap[nextDay]?.[m] : undefined;

              if (prevVal != null && nextVal != null) {
                // Interpolation linéaire
                const t0 = new Date(prevDay!).getTime();
                const t1 = new Date(nextDay!).getTime();
                const tc = new Date(day).getTime();
                const ratio = (tc - t0) / (t1 - t0);
                vals[m] = round1(prevVal + (nextVal - prevVal) * ratio);
              } else if (prevVal != null) {
                vals[m] = prevVal;
              } else if (nextVal != null) {
                vals[m] = nextVal;
              }
            }
            if (Object.keys(vals).length > 0) interpolated[clientId][day] = vals;
          }
        }

        // Étape 4 : calculer la moyenne par groupe pour chaque jour
        const byDate: Record<string, ChartDataPoint> = {};

        for (const day of allDays) {
          const dk = new Date(day).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
          });

          for (const grp of groups) {
            for (const m of selectedMetrics) {
              const values: number[] = [];
              for (const clientId of grp.clientIds) {
                const v = interpolated[clientId]?.[day]?.[m];
                if (v != null) values.push(v);
              }
              // Si aucun client du groupe n'a de valeur (réelle ou interpolée) → on skip
              if (values.length === 0) continue;

              if (!byDate[dk]) byDate[dk] = { date: dk };
              byDate[dk][`${grp.label}_${m}`] = round1(
                values.reduce((a, b) => a + b, 0) / values.length
              );
            }
          }
        }

        setChartData(sortByDateKey(Object.values(byDate)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeClientIds, period, selectedMetrics, viewMode, groups]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  // ── Handlers: comparison selection
  const allFilteredSelected =
    filteredClients.length > 0 &&
    filteredClients.every((c) => selectedClients.includes(c.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedClients((prev) =>
        prev.filter((id) => !filteredClients.some((c) => c.id === id))
      );
    } else {
      const toAdd = filteredClients
        .map((c) => c.id)
        .filter((id) => !selectedClients.includes(id));
      setSelectedClients((prev) => [...prev, ...toAdd]);
    }
  };

  const toggleClient = (id: string) =>
    setSelectedClients((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  // ── Handlers: sort
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  // ── Handlers: groups
  const assignToGroup = (clientId: string, groupId: "A" | "B") => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          return g.clientIds.includes(clientId)
            ? { ...g, clientIds: g.clientIds.filter((id) => id !== clientId) }
            : { ...g, clientIds: [...g.clientIds, clientId] };
        }
        return { ...g, clientIds: g.clientIds.filter((id) => id !== clientId) };
      })
    );
  };

  const getClientGroupId = (clientId: string): "A" | "B" | null =>
    groups.find((g) => g.clientIds.includes(clientId))?.id ?? null;

  const assignAllFiltered = (groupId: "A" | "B") => {
    const ids = filteredClients.map((c) => c.id);
    const group = groups.find((g) => g.id === groupId)!;
    const allAlreadyIn = ids.every((id) => group.clientIds.includes(id));

    setGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          return allAlreadyIn
            ? { ...g, clientIds: g.clientIds.filter((id) => !ids.includes(id)) }
            : { ...g, clientIds: [...new Set([...g.clientIds, ...ids])] };
        }
        // Si on ajoute au groupe, retirer de l'autre
        if (!allAlreadyIn) {
          return { ...g, clientIds: g.clientIds.filter((id) => !ids.includes(id)) };
        }
        return g;
      })
    );
  };

  const resetGroups = () =>
    setGroups([
      { ...GROUP_DEFAULTS.A, label: "Groupe A", clientIds: [] },
      { ...GROUP_DEFAULTS.B, label: "Groupe B", clientIds: [] },
    ]);

  // ── Handlers: metrics
  const toggleMetric = (key: string) =>
    setSelectedMetrics((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  /** Vrai si au moins une métrique retenue se trace sur l'axe de droite. */
  const usesRightAxis = useMemo(
    () => selectedMetrics.some((m) => METRICS.find((x) => x.key === m)?.axis === "right"),
    [selectedMetrics],
  );

  // ── Chart lines
  const chartLines = useMemo((): React.ReactElement[] => {
    if (viewMode === "comparison") {
      return selectedClients.flatMap((id) => {
        const client = clients.find((c) => c.id === id);
        if (!client) return [];
        const color = clientColor(id);
        return selectedMetrics.map((m, mi) => {
          const metric = METRICS.find((x) => x.key === m);
          return (
            <Line
              key={`${id}_${m}`}
              type="monotone"
              dataKey={`${client.name}_${m}`}
              yAxisId={metric?.axis ?? "left"}
              stroke={colorByMetric ? metric?.color ?? color : color}
              strokeDasharray={colorByMetric ? undefined : DASHES[mi % DASHES.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              name={`${client.name} — ${metric?.label}`}
              connectNulls
            />
          );
        });
      });
    }

    return groups.flatMap((g) =>
      selectedMetrics.map((m, mi) => {
        const metric = METRICS.find((x) => x.key === m);
        return (
          <Line
            key={`${g.id}_${m}`}
            type="monotone"
            dataKey={`${g.label}_${m}`}
            yAxisId={metric?.axis ?? "left"}
            stroke={g.color}
            strokeDasharray={DASHES[mi % DASHES.length]}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            name={`${g.label} — ${metric?.label}`}
            connectNulls
          />
        );
      })
    );
  }, [viewMode, selectedClients, clients, clientColor, selectedMetrics, groups, colorByMetric]);

  // ── Sort icon
  const SortIcon = ({ field }: { field: SortField }) =>
    sortField !== field ? (
      <ArrowUpDown className="h-3 w-3 text-gray-300" />
    ) : sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 text-primary-600" />
    ) : (
      <ChevronDown className="h-3 w-3 text-primary-600" />
    );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-2 -mx-8 -my-8 px-4 py-4" style={{ height: "calc(100vh - 32px)" }}>

      {/* ════════════════════════════════════════
          LEFT — Client list
      ════════════════════════════════════════ */}
      <div
        ref={leftPanelRef}
        style={{ width: leftWidth }}
        className="shrink-0 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
      >

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 shrink-0">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary-500" />
            Clients
            <span className="ml-auto text-xs font-normal text-gray-400">
              {filteredClients.length}/{clients.length}
            </span>
          </h2>
        </div>

        {/* Search */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-gray-50"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="px-3 pb-3 flex flex-col gap-2 shrink-0">
          <div className="flex gap-2">
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">Tous genres</option>
              <option value="male">Homme</option>
              <option value="female">Femme</option>
              <option value="none">Non renseigné</option>
            </select>
            {programs.length > 0 && (
              <select
                value={filterProgram}
                onChange={(e) => setFilterProgram(e.target.value)}
                className="w-0 flex-1 min-w-0 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-500 truncate"
              >
                <option value="all">Tous prog.</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Weight range */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-9 shrink-0">Poids</span>
            <input
              type="number"
              placeholder="min"
              value={filterWeightMin}
              onChange={(e) => setFilterWeightMin(e.target.value)}
              className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <span className="text-xs text-gray-300">–</span>
            <input
              type="number"
              placeholder="max"
              value={filterWeightMax}
              onChange={(e) => setFilterWeightMax(e.target.value)}
              className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <span className="text-xs text-gray-400">kg</span>
          </div>

          {/* Age range */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-9 shrink-0">Âge</span>
            <input
              type="number"
              placeholder="min"
              value={filterAgeMin}
              onChange={(e) => setFilterAgeMin(e.target.value)}
              className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <span className="text-xs text-gray-300">–</span>
            <input
              type="number"
              placeholder="max"
              value={filterAgeMax}
              onChange={(e) => setFilterAgeMax(e.target.value)}
              className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <span className="text-xs text-gray-400">ans</span>
          </div>
        </div>

        {/* Column headers */}
        <div className="px-3 py-1.5 border-y border-gray-100 bg-gray-50/80 shrink-0">
          <div className="flex items-center gap-1 text-[11px] text-gray-500 font-medium">
            {activeTab === "daily" && viewMode === "comparison" && (
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleSelectAll}
                className="h-3 w-3 rounded mr-0.5 accent-primary-600"
              />
            )}
            {(activeTab === "workout" || viewMode === "groups") && <span className="w-3 mr-0.5" />}
            <button
              onClick={() => toggleSort("name")}
              className="flex items-center gap-0.5 hover:text-gray-900 flex-1"
            >
              Nom <SortIcon field="name" />
            </button>
            <span className="text-gray-400 w-6 text-right shrink-0">Sexe</span>
            <button
              onClick={() => toggleSort("age")}
              className="flex items-center gap-0.5 hover:text-gray-900 w-8 justify-end"
            >
              Âge <SortIcon field="age" />
            </button>
            <span className="text-gray-400 w-10 text-right shrink-0">Taille</span>
            <button
              onClick={() => toggleSort("weight")}
              className="flex items-center gap-0.5 hover:text-gray-900 w-11 justify-end"
            >
              Poids <SortIcon field="weight" />
            </button>
            {activeTab === "daily" && viewMode === "groups" && (
              <div className="flex gap-1 ml-1 shrink-0">
                {(["A", "B"] as const).map((gid) => {
                  const ids = filteredClients.map((c) => c.id);
                  const grp = groups.find((g) => g.id === gid)!;
                  const allIn = ids.length > 0 && ids.every((id) => grp.clientIds.includes(id));
                  return (
                    <button
                      key={gid}
                      onClick={() => assignAllFiltered(gid)}
                      title={allIn ? `Retirer la sélection du groupe ${gid}` : `Tout mettre dans le groupe ${gid}`}
                      className={`w-6 h-6 rounded text-[11px] font-bold transition-all hover:scale-110 ${
                        gid === "A"
                          ? allIn
                            ? "bg-blue-500 text-white hover:bg-blue-300"
                            : "bg-blue-100 text-blue-600 hover:bg-blue-500 hover:text-white"
                          : allIn
                          ? "bg-amber-500 text-white hover:bg-amber-300"
                          : "bg-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white"
                      }`}
                    >
                      {gid}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto">
          {filteredClients.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-400">
              Aucun client trouvé
            </p>
          ) : (
            filteredClients.map((client) => {
              const isSelected = selectedClients.includes(client.id);
              const groupId = getClientGroupId(client.id);
              const color = clientColor(client.id);

              return (
                <div
                  key={client.id}
                  onClick={
                    activeTab === "workout"
                      ? () => setWorkoutClientId(workoutClientId === client.id ? null : client.id)
                      : viewMode === "comparison"
                      ? () => toggleClient(client.id)
                      : undefined
                  }
                  className={`flex items-center gap-2 px-3 py-2 border-b border-gray-50 hover:bg-gray-50/80 transition-colors text-xs ${
                    activeTab === "workout" && workoutClientId === client.id
                      ? "bg-primary-50 border-l-2 border-l-primary-400"
                      : isSelected && viewMode === "comparison"
                      ? "bg-primary-50/40"
                      : ""
                  } ${activeTab === "workout" || viewMode === "comparison" ? "cursor-pointer" : ""}`}
                >
                  {activeTab === "workout" ? (
                    <span
                      className={`h-3 w-3 rounded-full shrink-0 border-2 ${
                        workoutClientId === client.id
                          ? "bg-primary-500 border-primary-500"
                          : "border-gray-300"
                      }`}
                    />
                  ) : viewMode === "comparison" ? (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleClient(client.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-3 w-3 rounded shrink-0 accent-primary-600"
                    />
                  ) : null}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {client.name}
                    </p>
                    {client.program && (
                      <p className="text-[10px] text-gray-400 truncate">
                        {client.program}
                      </p>
                    )}
                  </div>

                  <span className="text-gray-400 w-6 text-right shrink-0">
                    {client.gender === "male" ? "H" : client.gender === "female" ? "F" : "—"}
                  </span>
                  <span className="text-gray-400 w-8 text-right shrink-0">
                    {client.age != null ? client.age : "—"}
                  </span>
                  <span className="text-gray-400 w-10 text-right shrink-0">
                    {client.height != null ? `${client.height}cm` : "—"}
                  </span>
                  <span className="text-gray-400 w-11 text-right shrink-0">
                    {client.weight != null ? `${client.weight}kg` : "—"}
                  </span>

                  {activeTab === "daily" && viewMode === "groups" && (
                    <div className="flex gap-1 ml-1 shrink-0">
                      {(["A", "B"] as const).map((gid) => (
                        <button
                          key={gid}
                          onClick={() => assignToGroup(client.id, gid)}
                          className={`w-6 h-6 rounded text-[11px] font-bold transition-all ${
                            groupId === gid
                              ? gid === "A"
                                ? "bg-blue-500 text-white"
                                : "bg-amber-500 text-white"
                              : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                          }`}
                        >
                          {gid}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Poignée de redimensionnement — double-clic pour revenir à la largeur
          d'origine.

          La zone cliquable fait 10 px : un trait de 1 px serait presque
          impossible à viser. Le trait visible est donc un enfant centré dans
          cette zone, ce qui découple ce qu'on voit de ce qu'on peut attraper. */}
      <div
        onPointerDown={startResize}
        onDoubleClick={() => setLeftWidth(LEFT_DEFAULT)}
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionner la liste des clients"
        title="Glisser pour redimensionner — double-clic pour réinitialiser"
        className="group w-2.5 shrink-0 self-stretch cursor-col-resize flex items-center justify-center"
      >
        <div className="h-full w-px rounded-full bg-white/15 group-hover:w-0.5 group-hover:bg-primary-500 group-active:bg-primary-500 transition-all" />
      </div>

      {/* ════════════════════════════════════════
          RIGHT — Controls + Chart
      ════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-hidden">

        {/* Top bar */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3 flex flex-wrap items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 mr-auto">
            <TrendingUp className="h-5 w-5 text-primary-500" />
            <h1 className="text-base font-bold text-gray-900">
              Analyse des Performances
            </h1>
          </div>

          {/* Tab toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            <button
              onClick={() => switchTab("daily")}
              className={`px-3 py-2 flex items-center gap-1.5 transition-colors font-medium ${
                activeTab === "daily"
                  ? "bg-primary-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Suivi quotidien
            </button>
            <button
              onClick={() => switchTab("workout")}
              className={`px-3 py-2 flex items-center gap-1.5 border-l border-gray-200 transition-colors font-medium ${
                activeTab === "workout"
                  ? "bg-primary-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              Musculation
            </button>
          </div>

          {/* Mode toggle + Period — daily only */}
          {activeTab === "daily" && (
            <>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                <button
                  onClick={() => setViewMode("comparison")}
                  className={`px-3 py-2 flex items-center gap-1.5 transition-colors font-medium ${
                    viewMode === "comparison"
                      ? "bg-primary-600 text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <GitCompare className="h-3.5 w-3.5" />
                  Individuel
                </button>
                <button
                  onClick={() => setViewMode("groups")}
                  className={`px-3 py-2 flex items-center gap-1.5 border-l border-gray-200 transition-colors font-medium ${
                    viewMode === "groups"
                      ? "bg-primary-600 text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Groupes
                </button>
              </div>

              {/* Period */}
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                  {PERIODS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPeriod(p.value)}
                      className={`px-2.5 py-2 transition-colors font-medium border-l border-gray-200 first:border-0 ${
                        period === p.value
                          ? "bg-primary-600 text-white"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Workout analytics tab ── */}
        {activeTab === "workout" && (
          <div className="flex-1 overflow-y-auto">
            {workoutClientId ? (
              <WorkoutAnalyticsPanel
                clientId={workoutClientId}
                clientName={clients.find((c) => c.id === workoutClientId)?.name ?? ""}
                clientGender={clients.find((c) => c.id === workoutClientId)?.gender ?? null}
                period={period}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400">
                <Activity className="h-12 w-12 text-gray-200" />
                <p className="text-sm text-center">
                  Sélectionnez un client dans la liste de gauche
                </p>
              </div>
            )}
          </div>
        )}

        {/* Group builder (groups mode) */}
        {activeTab === "daily" && viewMode === "groups" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 shrink-0">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary-500" />
                Groupes de comparaison
              </h3>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={resetGroups}
                  className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                >
                  Réinitialiser
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {groups.map((g) => (
                <div
                  key={g.id}
                  className="rounded-xl border p-3"
                  style={{ borderColor: g.borderColor, backgroundColor: g.bgColor }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: g.color }}
                    />
                    <span
                      className="text-xs font-bold"
                      style={{ color: g.textColor }}
                    >
                      {g.label}
                    </span>
                    <span className="ml-auto text-[11px] text-gray-400">
                      {g.clientIds.length} client{g.clientIds.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 min-h-[24px]">
                    {g.clientIds.length === 0 ? (
                      <span className="text-[11px] text-gray-400 italic">
                        Cliquez sur A ou B dans la liste
                      </span>
                    ) : (
                      g.clientIds.map((id) => {
                        const c = clients.find((x) => x.id === id);
                        return c ? (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700"
                          >
                            {c.name}
                            <button
                              onClick={() => assignToGroup(id, g.id)}
                              className="hover:text-red-500 transition-colors"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        ) : null;
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metrics selector — daily only */}
        {activeTab === "daily" && <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-2.5 flex items-center gap-4 flex-wrap shrink-0">
          {/* Deux familles séparées : le but du croisement est de rapprocher une
              consommation d'une performance, encore faut-il les distinguer. */}
          <span className="text-[10px] text-gray-400 w-full">
            {colorByMetric
              ? 'Un seul client : chaque métrique a sa couleur.'
              : 'Plusieurs clients : la couleur identifie le client, le motif du trait la métrique.'}
          </span>
          {(["daily", "perf"] as const).map((family) => (
            <div key={family} className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-gray-600">
                {FAMILY_LABELS[family]} :
              </span>
              {METRICS.filter((m) => m.family === family).map((m) => (
                <label key={m.key} className="flex items-center gap-1.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedMetrics.includes(m.key)}
                    onChange={() => toggleMetric(m.key)}
                    className="h-3.5 w-3.5 rounded"
                    style={{ accentColor: m.color }}
                  />
                  <span className="text-xs text-gray-700 group-hover:text-gray-900 transition-colors">
                    {m.label}
                  </span>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                  {/* Repère d'axe : sans lui, deux courbes voisines à l'écran peuvent
                      se lire sur des échelles différentes sans qu'on le sache. */}
                  {m.axis === "right" && (
                    <span className="text-[9px] text-gray-400" title="Axe de droite">→|</span>
                  )}
                </label>
              ))}
            </div>
          ))}
        </div>}

        {/* Chart — daily only */}
        {activeTab === "daily" && <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm p-5 min-h-0">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : activeClientIds.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400">
              <TrendingUp className="h-12 w-12 text-gray-200" />
              <p className="text-sm text-center">
                {viewMode === "comparison"
                  ? "Sélectionnez des clients dans la liste de gauche"
                  : "Assignez des clients aux groupes A et B"}
              </p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              Aucune donnée disponible pour cette période
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  stroke="#d1d5db"
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                />
                {/* Deux axes : les grandeurs en milliers (calories, tonnage) à
                    droite, le reste à gauche. Sur un axe unique elles aplatissaient
                    tout le reste sur la ligne du zéro. L'axe droit ne s'affiche que
                    s'il porte au moins une série. */}
                <YAxis
                  yAxisId="left"
                  stroke="#d1d5db"
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                />
                {usesRightAxis && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#d1d5db"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                )}
                <Tooltip
                  offset={26}
                  labelStyle={{ color: "#ffffff", fontWeight: 600 }}
                  contentStyle={{
                    backgroundColor: "var(--surface-card, #323232)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: "10px",
                    fontSize: "12px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "16px", fontSize: "11px" }}
                  iconType="line"
                />
                {chartLines}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>}
      </div>
    </div>
  );
}
