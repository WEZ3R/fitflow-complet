"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Flag, Loader2 } from "lucide-react";
import { adminAPI } from "@/lib/api";
import type { Report, ReportStatus } from "@/types";

const MOTIFS: Record<string, string> = {
  HARASSMENT: "Harcèlement",
  SPAM: "Spam",
  INAPPROPRIATE_CONTENT: "Contenu inapproprié",
  FAKE_PROFILE: "Faux profil",
  OTHER: "Autre",
};

const STATUTS: Record<ReportStatus, { label: string; classe: string }> = {
  PENDING: { label: "En attente", classe: "bg-amber-100 text-amber-800" },
  REVIEWING: { label: "En cours", classe: "bg-blue-100 text-blue-800" },
  ACTIONED: { label: "Sanctionné", classe: "bg-red-100 text-red-800" },
  DISMISSED: { label: "Classé", classe: "bg-gray-100 text-gray-700" },
};

const FILTRES: Array<{ valeur: string; label: string }> = [
  { valeur: "PENDING", label: "En attente" },
  { valeur: "REVIEWING", label: "En cours" },
  { valeur: "ACTIONED", label: "Sanctionnés" },
  { valeur: "DISMISSED", label: "Classés" },
  { valeur: "", label: "Tous" },
];

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filtre, setFiltre] = useState("PENDING");
  const [loading, setLoading] = useState(true);

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.reports(filtre || undefined);
      setReports(data.data ?? []);
    } catch (e) {
      console.error("Chargement des signalements :", e);
    } finally {
      setLoading(false);
    }
  }, [filtre]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Flag className="h-6 w-6 text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900">Signalements</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Chaque consultation d&apos;un signalement est journalisée.
      </p>

      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTRES.map((f) => (
          <button
            key={f.valeur}
            onClick={() => setFiltre(f.valeur)}
            aria-pressed={filtre === f.valeur}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              filtre === f.valeur
                ? "bg-primary-600 text-white border-primary-600"
                : "border-gray-300 text-gray-600 hover:border-primary-500"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      ) : reports.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          Aucun signalement dans cette catégorie.
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Link
              key={r.id}
              href={`/admin/reports/${r.id}`}
              className="card block hover:border-primary-400 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">
                      {MOTIFS[r.reason] ?? r.reason}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${STATUTS[r.status].classe}`}
                    >
                      {STATUTS[r.status].label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {r.context === "CONVERSATION" ? "depuis une conversation" : "depuis un profil"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 truncate">
                    Visé : {r.reported.firstName} {r.reported.lastName} — {r.reported.email}
                  </p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
