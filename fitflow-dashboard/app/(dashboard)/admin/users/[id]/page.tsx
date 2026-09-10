"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Eye, Loader2, ShieldCheck } from "lucide-react";
import { adminAPI } from "@/lib/api";
import type { UserFile } from "@/types";

const MOTIFS: Record<string, string> = {
  HARASSMENT: "Harcèlement",
  SPAM: "Spam",
  INAPPROPRIATE_CONTENT: "Contenu inapproprié",
  FAKE_PROFILE: "Faux profil",
  OTHER: "Autre",
};

const SANCTIONS: Record<string, string> = {
  SUSPEND: "Suspension",
  UNSUSPEND: "Levée de suspension",
  SCHEDULE_DELETION: "Suppression programmée",
  CANCEL_DELETION: "Suppression annulée",
  DELETE: "Compte supprimé",
  DISMISS_REPORT: "Signalement classé",
};

const STATUTS: Record<string, { label: string; classe: string }> = {
  ACTIVE: { label: "Actif", classe: "bg-green-100 text-green-800" },
  SUSPENDED: { label: "Suspendu", classe: "bg-red-100 text-red-800" },
  PENDING_DELETION: { label: "Suppression programmée", classe: "bg-amber-100 text-amber-800" },
};

const dateFr = (v?: string | null) =>
  v ? new Date(v).toLocaleString("fr-FR") : "—";

/**
 * Fiche de modération d'un compte.
 *
 * C'est l'écran qui permet de **revenir en arrière** : sans lui, une sanction ne peut
 * être levée qu'en acceptant un recours, ce qui suppose que la personne en dépose un.
 * Une modération qui ne sait que punir est une modération incomplète.
 *
 * La consultation de cette page est journalisée côté serveur, comme celle d'un
 * signalement : la fiche donne accès à l'identité et à l'historique disciplinaire
 * d'une personne, ce qui n'est pas une lecture anodine.
 */
export default function AdminUserFilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [fiche, setFiche] = useState<UserFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"unsuspend" | "cancelDeletion" | null>(null);
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.userFile(id);
      setFiche(data.data);
    } catch (e) {
      console.error("Chargement de la fiche :", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  const valider = async () => {
    if (!motif.trim()) {
      setErreur("Un motif est obligatoire — il est consigné au journal des décisions.");
      return;
    }
    setEnvoi(true);
    setErreur("");
    try {
      if (action === "unsuspend") await adminAPI.unsuspend(id, motif);
      if (action === "cancelDeletion") await adminAPI.cancelDeletion(id, motif);
      setAction(null);
      setMotif("");
      await charger();
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
  if (!fiche) {
    return <div className="p-6 text-gray-500">Fiche introuvable.</div>;
  }

  const { user, signalements, sanctions, recours } = fiche;
  const statut = STATUTS[user.status ?? "ACTIVE"] ?? STATUTS.ACTIVE;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>

      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-2xl font-bold text-gray-900">
          {user.firstName} {user.lastName}
        </h1>
        <span className={`text-xs px-2.5 py-1 rounded-full ${statut.classe}`}>
          {statut.label}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-6">Fiche de modération</p>

      <div className="card mb-5 border-l-4 border-amber-400">
        <div className="flex items-start gap-3">
          <Eye className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-gray-700">
            Votre consultation de cette fiche est journalisée.
          </p>
        </div>
      </div>

      <div className="card mb-5">
        <h2 className="font-semibold text-gray-900 mb-3">Compte</h2>
        <dl className="text-sm space-y-1">
          <div className="flex gap-2"><dt className="text-gray-500 w-44">Email</dt><dd>{user.email}</dd></div>
          <div className="flex gap-2"><dt className="text-gray-500 w-44">Rôle</dt><dd>{user.role}</dd></div>
          <div className="flex gap-2"><dt className="text-gray-500 w-44">Inscrit le</dt><dd>{dateFr(user.createdAt)}</dd></div>
          {user.status === "SUSPENDED" && (
            <>
              <div className="flex gap-2"><dt className="text-gray-500 w-44">Suspendu le</dt><dd>{dateFr(user.suspendedAt)}</dd></div>
              <div className="flex gap-2"><dt className="text-gray-500 w-44">Jusqu&apos;au</dt><dd>{dateFr(user.suspendedUntil)}</dd></div>
              <div className="flex gap-2"><dt className="text-gray-500 w-44">Motif</dt><dd>{user.suspensionReason ?? "—"}</dd></div>
            </>
          )}
          {user.status === "PENDING_DELETION" && (
            <div className="flex gap-2">
              <dt className="text-gray-500 w-44">Suppression prévue le</dt>
              <dd>{dateFr(user.scheduledDeletionAt)}</dd>
            </div>
          )}
        </dl>
        <p className="text-xs text-gray-400 mt-3">
          Cette fiche ne contient aucune donnée de santé — ni poids, ni sommeil, ni repas,
          ni performances. Aucune décision de modération ne s&apos;appuie dessus.
        </p>
      </div>

      {user.status !== "ACTIVE" && (
        <div className="card mb-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary-600" /> Revenir sur la sanction
          </h2>

          {action === null ? (
            <button
              onClick={() => { setAction(user.status === "SUSPENDED" ? "unsuspend" : "cancelDeletion"); setErreur(""); }}
              className="btn btn-primary"
            >
              {user.status === "SUSPENDED" ? "Lever la suspension" : "Annuler la suppression"}
            </button>
          ) : (
            <>
              <label htmlFor="motif-levee" className="label">Motif (obligatoire)</label>
              <textarea
                id="motif-levee"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                rows={3}
                className="input"
                placeholder="Ce motif est consigné au journal des décisions et communiqué à la personne."
              />
              {erreur && <p className="text-sm text-red-600 mt-2">{erreur}</p>}
              <div className="flex gap-2 mt-3">
                <button onClick={valider} disabled={envoi || !motif.trim()} className="btn btn-primary">
                  {envoi ? "Envoi…" : "Confirmer"}
                </button>
                <button onClick={() => { setAction(null); setMotif(""); setErreur(""); }} className="btn btn-secondary">
                  Annuler
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="card mb-5">
        <h2 className="font-semibold text-gray-900 mb-3">
          Signalements reçus ({signalements.length})
        </h2>
        {signalements.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun.</p>
        ) : (
          <ul className="text-sm divide-y divide-gray-100">
            {signalements.map((s) => (
              <li key={s.id} className="py-2 flex items-center justify-between gap-3">
                <button
                  onClick={() => router.push(`/admin/reports/${s.id}`)}
                  className="text-left text-primary-700 hover:underline"
                >
                  {MOTIFS[s.reason] ?? s.reason}
                </button>
                <span className="text-gray-400 text-xs">
                  {s.status} · {dateFr(s.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card mb-5">
        <h2 className="font-semibold text-gray-900 mb-3">
          Historique des décisions ({sanctions.length})
        </h2>
        {sanctions.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune décision prise sur ce compte.</p>
        ) : (
          <ul className="text-sm divide-y divide-gray-100">
            {sanctions.map((a) => (
              <li key={a.id} className="py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-gray-900">{SANCTIONS[a.type] ?? a.type}</span>
                  <span className="text-gray-400 text-xs">{dateFr(a.createdAt)}</span>
                </div>
                <p className="text-gray-600 mt-0.5">{a.reason}</p>
                <p className="text-xs text-gray-400">Par {a.moderator?.email ?? "compte supprimé"}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-3">Recours déposés ({recours.length})</h2>
        {recours.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun.</p>
        ) : (
          <ul className="text-sm divide-y divide-gray-100">
            {recours.map((r) => (
              <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                <span>{r.status}</span>
                <span className="text-gray-400 text-xs">{dateFr(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
