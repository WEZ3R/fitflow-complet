"use client";

import { useEffect, useState, useCallback } from "react";
import { Gavel, Loader2 } from "lucide-react";
import { adminAPI } from "@/lib/api";
import type { Appeal } from "@/types";

const STATUTS: Record<string, { label: string; classe: string }> = {
  PENDING: { label: "À examiner", classe: "bg-amber-100 text-amber-800" },
  ACCEPTED: { label: "Accepté", classe: "bg-green-100 text-green-800" },
  REJECTED: { label: "Rejeté", classe: "bg-gray-100 text-gray-700" },
};

export default function AdminAppealsPage() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [actif, setActif] = useState<string | null>(null);
  const [decision, setDecision] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.appeals("PENDING");
      setAppeals(data.data ?? []);
    } catch (e) {
      console.error("Chargement des recours :", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  const statuer = async (id: string, accept: boolean) => {
    if (!decision.trim()) {
      setErreur("Un motif de décision est obligatoire.");
      return;
    }
    setEnvoi(true);
    setErreur("");
    try {
      await adminAPI.reviewAppeal(id, { accept, decision });
      setActif(null);
      setDecision("");
      await charger();
    } catch {
      setErreur("Le traitement a échoué.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Gavel className="h-6 w-6 text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900">Recours</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Un recours en cours suspend toute suppression programmée jusqu&apos;à son examen.
      </p>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      ) : appeals.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">Aucun recours en attente.</div>
      ) : (
        <div className="space-y-3">
          {appeals.map((a) => (
            <div key={a.id} className="card">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">
                    {a.user?.firstName} {a.user?.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{a.user?.email}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUTS[a.status].classe}`}>
                  {STATUTS[a.status].label}
                </span>
              </div>

              {a.user?.suspensionReason && (
                <p className="text-xs text-gray-500 mb-2">
                  Sanction contestée : {a.user.suspensionReason}
                </p>
              )}

              <blockquote className="text-sm text-gray-700 bg-gray-50 border-l-2 border-gray-300 pl-3 py-2 whitespace-pre-wrap">
                {a.message}
              </blockquote>

              {actif === a.id ? (
                <div className="mt-3">
                  <label htmlFor={`d-${a.id}`} className="label">
                    Motif de la décision (obligatoire)
                  </label>
                  <textarea
                    id={`d-${a.id}`}
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                    rows={3}
                    className="input"
                    placeholder="Cette réponse sera communiquée à la personne."
                  />
                  {erreur && <p className="text-sm text-red-600 mt-2">{erreur}</p>}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => statuer(a.id, true)}
                      disabled={envoi}
                      className="btn btn-primary"
                    >
                      Accepter — rétablir le compte
                    </button>
                    <button
                      onClick={() => statuer(a.id, false)}
                      disabled={envoi}
                      className="btn btn-secondary"
                    >
                      Rejeter
                    </button>
                    <button onClick={() => setActif(null)} className="btn btn-secondary">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setActif(a.id); setDecision(""); setErreur(""); }}
                  className="btn btn-primary mt-3"
                >
                  Examiner
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
