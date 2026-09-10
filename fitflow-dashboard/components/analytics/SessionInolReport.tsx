"use client";

import { useEffect, useState } from "react";
import { analyticsAPI } from "@/lib/api";
import { Zap } from "lucide-react";

/** Libellés des groupes musculaires, alignés sur le panneau d'analyse. */
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

interface MuscleInol {
  muscle: string;
  inol: number;
}

interface SessionInol {
  sessionId: string;
  date: string;
  totalINOL: number;
  exerciseINOL: ExerciseInol[];
  muscleINOL: MuscleInol[];
}

/**
 * Zone d'intensité d'un INOL PAR EXERCICE, d'après les repères de Hristov.
 *
 * Ces seuils ne valent que par exercice et par séance. Un total de séance les
 * dépasse mécaniquement dès qu'il y a plusieurs mouvements — c'est pourquoi on ne
 * qualifie que les lignes d'exercice, jamais le total.
 */
function zoneOf(inol: number) {
  if (inol < 0.4) return { label: "Insuffisant", color: "#8a8a8a" };
  if (inol <= 1.0) return { label: "Optimal", color: "#85e859" };
  if (inol <= 2.0) return { label: "Élevé", color: "#f2c14e" };
  return { label: "Excessif", color: "#ff8a84" };
}

/**
 * Rapport d'intensité d'une séance : INOL par exercice et par groupe musculaire.
 *
 * L'endpoint renvoie toutes les séances d'une plage ; on demande la seule journée
 * concernée plutôt que de filtrer une longue liste côté navigateur.
 */
export default function SessionInolReport({
  clientId,
  date,
  sessionId,
}: {
  clientId: string;
  /** Jour de la séance, au format YYYY-MM-DD. */
  date: string;
  sessionId?: string;
}) {
  /**
   * Un seul état, écrit uniquement depuis les rappels asynchrones.
   *
   * Remettre `loading` à vrai en tête d'effet serait un setState synchrone dans un
   * effet — la règle react-hooks/set-state-in-effect l'interdit, et pour une bonne
   * raison : ça déclenche un second rendu en cascade. La réinitialisation se fait
   * donc par remontage, le parent passant la date en `key`.
   */
  const [state, setState] = useState<{
    status: "loading" | "ready" | "error";
    data: SessionInol | null;
  }>({ status: "loading", data: null });

  useEffect(() => {
    let cancelled = false;

    analyticsAPI
      .getSessionINOL({ clientId, startDate: date, endDate: date })
      .then((res) => {
        if (cancelled) return;
        const sessions: SessionInol[] = res.data?.data?.sessions ?? [];
        // La plage demandée est élargie d'un jour de chaque côté par le serveur :
        // les séances sont horodatées à minuit LOCAL, donc décalées en UTC. On
        // identifie la bonne par son identifiant, et à défaut par sa date locale.
        const byId = sessionId ? sessions.find((s) => s.sessionId === sessionId) : undefined;
        const byDate = sessions.find(
          (s) => new Date(s.date).toLocaleDateString("sv-SE") === date,
        );
        setState({ status: "ready", data: byId ?? byDate ?? null });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", data: null });
      });

    return () => { cancelled = true; };
  }, [clientId, date, sessionId]);

  const { status, data } = state;

  if (status === "loading") {
    return (
      <div className="rounded-lg border border-gray-200 p-3 text-xs text-gray-400">
        Calcul de l&apos;intensité…
      </div>
    );
  }

  // Pas de données exploitables : on explique pourquoi. Rendre `null` ici donnait
  // un écran identique à celui d'un composant en panne, impossible à diagnostiquer
  // depuis l'interface.
  if (status === "error") {
    return (
      <div className="rounded-lg border border-gray-500/20 px-3 py-2 text-xs text-gray-500">
        Intensité indisponible : le calcul a échoué.
      </div>
    );
  }
  // Ici, la séance a bien des exercices reliés et chargés — la page appelante l'a
  // vérifié avant de monter ce composant. Le seul cas restant est l'absence de 1RM
  // de référence : le calcul le cherche sur les 8 semaines précédentes, et un client
  // qui débute n'en a pas encore.
  if (!data || data.exerciseINOL.length === 0) {
    return (
      <div className="rounded-lg border border-gray-500/20 px-3 py-2 text-xs text-gray-500">
        Intensité non calculable : aucun 1RM de référence sur les 8 semaines précédant
        cette séance. Il apparaîtra dès qu&apos;un historique de charges existera.
      </div>
    );
  }

  const maxMuscle = Math.max(...data.muscleINOL.map((m) => m.inol), 0.01);

  return (
    <div className="rounded-lg border border-gray-200 p-3 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h5 className="text-sm font-semibold flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary-500" aria-hidden="true" />
          Intensité (INOL)
        </h5>
        <span className="text-xs text-gray-500">
          total séance <span className="font-bold text-gray-900">{data.totalINOL}</span>
        </span>
      </div>

      {/* Par exercice */}
      <div className="space-y-1">
        {data.exerciseINOL.map((ex) => {
          const zone = zoneOf(ex.inol);
          return (
            <div
              key={ex.exerciseName}
              className="flex items-center gap-2 text-xs rounded px-2 py-1.5 bg-gray-500/5"
            >
              <span className="flex-1 min-w-0 truncate font-medium">{ex.exerciseName}</span>
              {/* Le détail rend le chiffre lisible : un INOL de 0,9 ne dit pas s'il
                  vient de séries lourdes ou de séries longues. */}
              <span className="text-gray-500 shrink-0">
                {ex.sets} × · {ex.totalReps} reps · {ex.topPct1RM} % de {ex.ref1RM} kg
              </span>
              <span className="font-bold w-10 text-right shrink-0" style={{ color: zone.color }}>
                {ex.inol.toFixed(2)}
              </span>
              <span className="w-[68px] text-right shrink-0" style={{ color: zone.color }}>
                {zone.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Par groupe musculaire */}
      {data.muscleINOL.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">
            Par groupe musculaire
          </p>
          <div className="space-y-1">
            {data.muscleINOL.map((m) => (
              <div key={m.muscle} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-gray-500">
                  {MUSCLE_LABELS[m.muscle] ?? m.muscle}
                </span>
                {/* Barre proportionnelle au plus sollicité du jour : elle répond à
                    « qu'est-ce qui a le plus encaissé » d'un coup d'œil. */}
                <span className="flex-1 h-1.5 rounded-full bg-gray-500/15 overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-primary-500"
                    style={{ width: `${(m.inol / maxMuscle) * 100}%` }}
                  />
                </span>
                <span className="w-10 text-right font-semibold">{m.inol.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-400 leading-snug">
        Repères par exercice : moins de 0,4 insuffisant, 0,4 à 1 optimal, 1 à 2 élevé,
        au-delà excessif. Un exercice qui touche deux groupes compte dans les deux.
      </p>
    </div>
  );
}
