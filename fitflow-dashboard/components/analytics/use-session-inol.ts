"use client";

import { useEffect, useState } from "react";
import { analyticsAPI } from "@/lib/api";

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

export interface SessionInolResult {
  status: "loading" | "ready" | "error";
  total: number | null;
  /** INOL indexé par `exerciseRefId`, seule clé fiable entre séance et catalogue. */
  byRef: Map<string, ExerciseInol>;
}

/**
 * Zone d'intensité d'un INOL par exercice et par séance, repères de Hristov.
 * Ces seuils ne valent qu'à cette échelle : un total de séance les dépasse
 * mécaniquement dès qu'il y a plusieurs mouvements.
 */
export function inolZone(inol: number) {
  if (inol < 0.4) return { label: "insuffisant", color: "#8a8a8a" };
  if (inol <= 1.0) return { label: "optimal", color: "#85e859" };
  if (inol <= 2.0) return { label: "élevé", color: "#f2c14e" };
  return { label: "excessif", color: "#ff8a84" };
}

/**
 * Intensité d'une séance, indexée par référence d'exercice.
 *
 * Renvoie les données brutes plutôt qu'un rendu : l'INOL s'affiche à côté du titre
 * de chaque exercice, au milieu d'un balisage qui appartient à la page appelante.
 *
 * L'appariement se fait sur `exerciseRefId` et non sur le nom : le catalogue écrit
 * « DC Barre » là où le programme écrit « Développé couché barre ».
 *
 * Un `date` vide neutralise le hook — aucune requête, statut « ready » et carte
 * vide. C'est ce qui permet de l'appeler inconditionnellement au niveau du
 * composant, même quand aucun jour n'est sélectionné.
 */
export function useSessionInol(
  clientId: string,
  /** Jour de la séance, au format YYYY-MM-DD. */
  date: string,
  sessionId?: string,
): SessionInolResult {
  const [state, setState] = useState<{ status: SessionInolResult["status"]; data: SessionInol | null }>({
    status: "loading",
    data: null,
  });

  useEffect(() => {
    if (!clientId || !date) return;
    let cancelled = false;

    analyticsAPI
      .getSessionINOL({ clientId, startDate: date, endDate: date })
      .then((res) => {
        if (cancelled) return;
        const sessions: SessionInol[] = res.data?.data?.sessions ?? [];
        // La plage est élargie d'un jour de chaque côté par le serveur — les séances
        // sont horodatées à minuit local, donc décalées en UTC. On identifie la bonne
        // par son identifiant, à défaut par sa date locale.
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

  return {
    status: date ? status : "ready",
    total: data?.totalINOL ?? null,
    byRef: new Map((data?.exerciseINOL ?? []).map((e) => [e.exerciseRefId, e])),
  };
}
