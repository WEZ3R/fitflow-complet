"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Eye, Loader2, ShieldAlert } from "lucide-react";
import { adminAPI } from "@/lib/api";
import type { Report } from "@/types";

const MOTIFS: Record<string, string> = {
  HARASSMENT: "Harcèlement",
  SPAM: "Spam",
  INAPPROPRIATE_CONTENT: "Contenu inapproprié",
  FAKE_PROFILE: "Faux profil",
  OTHER: "Autre",
};

/** Toute décision exige un motif : sans lui, la sanction n'est pas contestable. */
type Decision = "dismiss" | "suspend" | "delete" | null;

export default function AdminReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<Decision>(null);
  const [motif, setMotif] = useState("");
  const [jours, setJours] = useState(7);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.report(id);
      setReport(data.data);
    } catch (e) {
      console.error("Chargement du signalement :", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  const valider = async () => {
    if (!report || !motif.trim()) {
      setErreur("Un motif est obligatoire.");
      return;
    }
    setEnvoi(true);
    setErreur("");
    try {
      const cible = report.reported.id;
      if (decision === "dismiss") await adminAPI.dismissReport(report.id, motif);
      if (decision === "suspend") {
        await adminAPI.suspend(cible, { reason: motif, days: jours, reportId: report.id });
      }
      if (decision === "delete") {
        await adminAPI.scheduleDeletion(cible, { reason: motif, reportId: report.id });
      }
      router.push("/admin/reports");
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      setErreur(msg || "L'action a échoué.");
    } finally {
      setEnvoi(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    );
  }
  if (!report) {
    return <div className="p-6 text-gray-500">Signalement introuvable.</div>;
  }

  const clos = report.status === "ACTIONED" || report.status === "DISMISSED";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => router.push("/admin/reports")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Retour à la file
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        {MOTIFS[report.reason] ?? report.reason}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Signalé le {new Date(report.createdAt).toLocaleString("fr-FR")}
      </p>

      {/* Mention d'accès : l'administrateur doit savoir qu'il laisse une trace. */}
      <div className="card mb-5 border-l-4 border-amber-400">
        <div className="flex items-start gap-3">
          <Eye className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-gray-700">{report.conversationAccess}</p>
        </div>
      </div>

      <div className="card mb-5">
        <h2 className="font-semibold text-gray-900 mb-3">Personne visée</h2>
        <dl className="text-sm space-y-1">
          <div className="flex gap-2">
            <dt className="text-gray-500 w-28">Nom</dt>
            <dd>{report.reported.firstName} {report.reported.lastName}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-gray-500 w-28">Email</dt>
            <dd>{report.reported.email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-gray-500 w-28">Statut</dt>
            <dd>{report.reported.status}</dd>
          </div>
        </dl>
        <button
          onClick={() => router.push(`/admin/users/${report.reported.id}`)}
          className="text-sm text-primary-700 hover:underline mt-3"
        >
          Voir la fiche de modération et l&apos;historique
        </button>
        <p className="text-xs text-gray-400 mt-3">
          Les données de santé de cette personne ne sont pas accessibles depuis la modération :
          aucune décision ne s&apos;appuie dessus.
        </p>
      </div>

      {report.description && (
        <div className="card mb-5">
          <h2 className="font-semibold text-gray-900 mb-2">Description du signalant</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.description}</p>
        </div>
      )}

      {report.conversation && report.conversation.length > 0 && (
        <div className="card mb-5">
          <h2 className="font-semibold text-gray-900 mb-3">Conversation signalée</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {report.conversation.map((m) => (
              <div
                key={m.id}
                className={`text-sm p-2 rounded-lg ${
                  m.id === report.messageId
                    ? "bg-amber-50 border border-amber-300"
                    : "bg-gray-50"
                }`}
              >
                <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                  <span>{m.isSentByCoach ? "Coach" : "Client"}</span>
                  <span>{new Date(m.createdAt).toLocaleString("fr-FR")}</span>
                </div>
                <p className="text-gray-800 whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {clos ? (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-2">Décision</h2>
          <p className="text-sm text-gray-700">{report.resolution}</p>
        </div>
      ) : (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary-600" /> Décision
          </h2>

          <div className="flex gap-2 mb-4 flex-wrap">
            {([
              ["dismiss", "Classer sans suite"],
              ["suspend", "Suspendre"],
              ["delete", "Programmer la suppression"],
            ] as Array<[Decision, string]>).map(([valeur, label]) => (
              <button
                key={valeur}
                onClick={() => setDecision(valeur)}
                aria-pressed={decision === valeur}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  decision === valeur
                    ? "bg-primary-600 text-white border-primary-600"
                    : "border-gray-300 text-gray-700 hover:border-primary-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {decision === "suspend" && (
            <div className="mb-3">
              <label htmlFor="duree" className="label">Durée (jours)</label>
              <input
                id="duree"
                type="number"
                min={1}
                value={jours}
                onChange={(e) => setJours(Number(e.target.value))}
                className="input max-w-[140px]"
              />
            </div>
          )}

          {decision === "delete" && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
              La suppression prendra effet dans 30 jours. La personne en est informée,
              peut exporter ses données et contester la décision. Tout recours suspend
              la suppression jusqu&apos;à son examen.
            </p>
          )}

          {decision && (
            <>
              <label htmlFor="motif" className="label">Motif (obligatoire)</label>
              <textarea
                id="motif"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                rows={3}
                className="input"
                placeholder="Ce motif sera communiqué à la personne concernée."
              />
              {erreur && <p className="text-sm text-red-600 mt-2">{erreur}</p>}
              <button
                onClick={valider}
                disabled={envoi || !motif.trim()}
                className="btn btn-primary mt-3"
              >
                {envoi ? "Envoi…" : "Valider la décision"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
