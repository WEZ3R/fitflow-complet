"use client";

import { useEffect, useMemo, useState } from "react";
import { analyticsAPI } from "@/lib/api";
import { ChevronRight } from "lucide-react";

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

/**
 * Zone d'intensité d'un INOL PAR EXERCICE ET PAR SÉANCE, repères de Hristov.
 *
 * Ces seuils ne valent qu'à cette échelle. Un total de séance les dépasse
 * mécaniquement dès qu'il y a plusieurs mouvements, et un cumul sur 30 jours
 * encore davantage — on ne qualifie donc jamais un total, seulement une ligne
 * d'exercice au sein d'une séance, ou une moyenne par séance.
 */
function zoneOf(inol: number) {
  if (inol < 0.4) return { label: "Insuffisant", color: "#8a8a8a" };
  if (inol <= 1.0) return { label: "Optimal", color: "#85e859" };
  if (inol <= 2.0) return { label: "Élevé", color: "#f2c14e" };
  return { label: "Excessif", color: "#ff8a84" };
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });

/**
 * Rapport d'intensité sur une période : par groupe musculaire, par exercice, et
 * séance par séance.
 *
 * Les agrégats sont calculés ici et non côté serveur : l'endpoint renvoie déjà le
 * détail de chaque séance, un second appel pour les mêmes chiffres serait du
 * gaspillage.
 */
export default function InolBreakdown({
  clientId,
  days,
}: {
  clientId: string;
  /** Profondeur de la période, en jours. */
  days: number;
}) {
  const [state, setState] = useState<{
    status: "loading" | "ready" | "error";
    sessions: SessionInol[];
  }>({ status: "loading", sessions: [] });
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const end = new Date();
    const start = new Date(Date.now() - days * 86400000);

    analyticsAPI
      .getSessionINOL({
        clientId,
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      })
      .then((res) => {
        if (!cancelled) {
          setState({ status: "ready", sessions: res.data?.data?.sessions ?? [] });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", sessions: [] });
      });

    return () => { cancelled = true; };
  }, [clientId, days]);

  const { status, sessions } = state;

  /** Cumuls et moyennes par exercice, sur toute la période. */
  const byExercise = useMemo(() => {
    const m = new Map<string, { name: string; total: number; sessions: number; sets: number; topPct: number }>();
    for (const s of sessions) {
      for (const ex of s.exerciseINOL) {
        const cur = m.get(ex.exerciseName) ?? { name: ex.exerciseName, total: 0, sessions: 0, sets: 0, topPct: 0 };
        cur.total += ex.inol;
        cur.sessions += 1;
        cur.sets += ex.sets;
        cur.topPct = Math.max(cur.topPct, ex.topPct1RM);
        m.set(ex.exerciseName, cur);
      }
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [sessions]);

  /** Cumuls par groupe musculaire, sur toute la période. */
  const byMuscle = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) {
      for (const mi of s.muscleINOL) m.set(mi.muscle, (m.get(mi.muscle) ?? 0) + mi.inol);
    }
    return [...m.entries()].map(([muscle, inol]) => ({ muscle, inol })).sort((a, b) => b.inol - a.inol);
  }, [sessions]);

  const weeks = Math.max(1, days / 7);
  const maxMuscle = Math.max(...byMuscle.map((m) => m.inol), 0.01);

  if (status === "loading") {
    return <p className="text-sm text-gray-500">Calcul de l&apos;intensité…</p>;
  }
  if (status === "error") {
    return <p className="text-sm text-gray-500">Intensité indisponible pour cette période.</p>;
  }
  if (sessions.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Aucune séance de musculation exploitable sur cette période. L&apos;intensité demande
        des charges et des répétitions saisies, sur des exercices reliés au catalogue.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Par groupe musculaire ── */}
      <div>
        <h4 className="text-sm font-semibold mb-1">Par groupe musculaire</h4>
        <p className="text-xs text-gray-500 mb-3">
          Cumul sur la période, et moyenne hebdomadaire. Un exercice qui sollicite deux
          groupes compte dans les deux.
        </p>
        <div className="space-y-1.5">
          {byMuscle.map((m) => (
            <div key={m.muscle} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 text-gray-500">
                {MUSCLE_LABELS[m.muscle] ?? m.muscle}
              </span>
              <span className="flex-1 h-2 rounded-full bg-gray-500/15 overflow-hidden">
                <span
                  className="block h-full rounded-full bg-primary-500"
                  style={{ width: `${(m.inol / maxMuscle) * 100}%` }}
                />
              </span>
              <span className="w-12 text-right font-semibold">{m.inol.toFixed(1)}</span>
              <span className="w-24 text-right text-xs text-gray-500">
                {(m.inol / weeks).toFixed(2)} / sem.
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Par exercice ── */}
      <div>
        <h4 className="text-sm font-semibold mb-1">Par exercice</h4>
        <p className="text-xs text-gray-500 mb-3">
          La moyenne par séance est la valeur à comparer aux repères : moins de 0,4
          insuffisant, 0,4 à 1 optimal, 1 à 2 élevé, au-delà excessif.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-500/20">
                <th className="text-left font-medium py-1.5">Exercice</th>
                <th className="text-right font-medium py-1.5">Séances</th>
                <th className="text-right font-medium py-1.5">Séries</th>
                <th className="text-right font-medium py-1.5">Cumul</th>
                <th className="text-right font-medium py-1.5">Moy./séance</th>
                <th className="text-right font-medium py-1.5">%1RM max</th>
                <th className="text-right font-medium py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {byExercise.map((ex) => {
                const avg = ex.total / ex.sessions;
                const zone = zoneOf(avg);
                return (
                  <tr key={ex.name} className="border-b border-gray-500/10">
                    <td className="py-1.5 pr-2 font-medium">{ex.name}</td>
                    <td className="py-1.5 text-right text-gray-500">{ex.sessions}</td>
                    <td className="py-1.5 text-right text-gray-500">{ex.sets}</td>
                    <td className="py-1.5 text-right">{ex.total.toFixed(1)}</td>
                    <td className="py-1.5 text-right font-bold" style={{ color: zone.color }}>
                      {avg.toFixed(2)}
                    </td>
                    <td className="py-1.5 text-right text-gray-500">{ex.topPct} %</td>
                    <td className="py-1.5 text-right text-xs" style={{ color: zone.color }}>
                      {zone.label}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Séance par séance ── */}
      <div>
        <h4 className="text-sm font-semibold mb-1">Séance par séance</h4>
        <p className="text-xs text-gray-500 mb-3">
          {sessions.length} séance(s) sur la période. Cliquez pour le détail par exercice.
        </p>
        <div className="space-y-1">
          {[...sessions].reverse().map((s) => {
            const open = openId === s.sessionId;
            const avg = s.exerciseINOL.length ? s.totalINOL / s.exerciseINOL.length : 0;
            const zone = zoneOf(avg);
            return (
              <div key={s.sessionId} className="rounded-lg border border-gray-500/20">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : s.sessionId)}
                  aria-expanded={open}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-gray-500/5 transition-colors"
                >
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
                    aria-hidden="true"
                  />
                  <span className="w-32 shrink-0">{fmtDate(s.date)}</span>
                  <span className="flex-1 text-gray-500 text-xs">
                    {s.exerciseINOL.length} exercice(s)
                  </span>
                  {/* On affiche la moyenne par exercice à côté du total : c'est elle
                      qui est comparable aux repères, le total ne l'est pas. */}
                  <span className="text-xs text-gray-500">
                    cumul <span className="font-semibold text-gray-700">{s.totalINOL.toFixed(1)}</span>
                  </span>
                  <span className="w-24 text-right font-bold" style={{ color: zone.color }}>
                    {avg.toFixed(2)} moy.
                  </span>
                </button>

                {open && (
                  <div className="px-3 pb-2 space-y-1">
                    {s.exerciseINOL.map((ex) => {
                      const z = zoneOf(ex.inol);
                      return (
                        <div
                          key={ex.exerciseName}
                          className="flex items-center gap-2 text-xs rounded px-2 py-1.5 bg-gray-500/5"
                        >
                          <span className="flex-1 min-w-0 truncate font-medium">{ex.exerciseName}</span>
                          <span className="text-gray-500 shrink-0">
                            {ex.sets} × · {ex.totalReps} reps · {ex.topPct1RM} % de {ex.ref1RM} kg
                          </span>
                          <span className="w-10 text-right font-bold" style={{ color: z.color }}>
                            {ex.inol.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
