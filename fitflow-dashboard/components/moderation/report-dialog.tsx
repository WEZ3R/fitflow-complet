"use client";

import { useState } from "react";
import { Flag, X } from "lucide-react";
import { reportsAPI } from "@/lib/api";

const MOTIFS: Array<{ valeur: string; label: string }> = [
  { valeur: "HARASSMENT", label: "Harcèlement" },
  { valeur: "SPAM", label: "Spam ou sollicitation" },
  { valeur: "INAPPROPRIATE_CONTENT", label: "Contenu inapproprié" },
  { valeur: "FAKE_PROFILE", label: "Faux profil" },
  { valeur: "OTHER", label: "Autre" },
];

interface Props {
  reportedUserId: string;
  reportedName?: string;
  /** D'où part le signalement : cela détermine ce que la modération pourra consulter. */
  context: "PROFILE" | "CONVERSATION";
  /** Message visé, quand le signalement part d'une conversation. */
  messageId?: string;
  /** Rendu compact pour un en-tête de conversation. */
  compact?: boolean;
}

/**
 * Boîte de dialogue de signalement, partagée par la fiche d'un profil et par une
 * conversation. Le motif est choisi dans une liste fermée : un champ libre seul
 * produirait des signalements intriables, et exposerait la modération à des données
 * qu'elle n'a pas demandées.
 */
export const ReportDialog = ({
  reportedUserId,
  reportedName,
  context,
  messageId,
  compact = false,
}: Props) => {
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [description, setDescription] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [envoye, setEnvoye] = useState(false);

  const envoyer = async () => {
    if (!motif) {
      setErreur("Choisissez un motif.");
      return;
    }
    setEnvoi(true);
    setErreur("");
    try {
      await reportsAPI.create({
        reportedUserId,
        reason: motif,
        context,
        description: description.trim() || undefined,
        messageId,
      });
      setEnvoye(true);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      setErreur(msg || "L'envoi a échoué.");
    } finally {
      setEnvoi(false);
    }
  };

  const fermer = () => {
    setOuvert(false);
    setMotif("");
    setDescription("");
    setErreur("");
    setEnvoye(false);
  };

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        aria-label={`Signaler ${reportedName ?? "cet utilisateur"}`}
        className={
          compact
            ? "p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            : "inline-flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
        }
      >
        <Flag className="h-4 w-4" />
        {!compact && <span>Signaler</span>}
      </button>

      {ouvert && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-signalement"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <h2 id="titre-signalement" className="text-lg font-semibold text-gray-900">
                {envoye ? "Signalement transmis" : `Signaler ${reportedName ?? "cet utilisateur"}`}
              </h2>
              <button onClick={fermer} aria-label="Fermer" className="text-gray-400 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {envoye ? (
              <>
                <p className="text-sm text-gray-700">
                  Votre signalement a été transmis à la modération. Vous pouvez suivre son
                  traitement, mais la décision prise concernant l&apos;autre personne ne vous
                  sera pas communiquée : elle la concerne seule.
                </p>
                <button onClick={fermer} className="btn btn-primary mt-4 w-full">Fermer</button>
              </>
            ) : (
              <>
                <fieldset className="mb-4">
                  <legend className="label">Motif</legend>
                  <div className="space-y-1.5">
                    {MOTIFS.map((m) => (
                      <label key={m.valeur} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="motif"
                          value={m.valeur}
                          checked={motif === m.valeur}
                          onChange={(e) => setMotif(e.target.value)}
                        />
                        {m.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label htmlFor="desc-signalement" className="label">
                  Précisions (facultatif)
                </label>
                <textarea
                  id="desc-signalement"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="input"
                  placeholder="Ce qui vous a amené à signaler."
                />

                {context === "CONVERSATION" && (
                  <p className="text-xs text-gray-500 mt-3">
                    Un modérateur pourra consulter cette conversation pour instruire le
                    signalement. Chaque consultation est journalisée, et l&apos;accès cesse
                    dès le signalement traité.
                  </p>
                )}

                {erreur && <p className="text-sm text-red-600 mt-3">{erreur}</p>}

                <div className="flex gap-2 mt-4">
                  <button onClick={envoyer} disabled={envoi || !motif} className="btn btn-primary flex-1">
                    {envoi ? "Envoi…" : "Envoyer le signalement"}
                  </button>
                  <button onClick={fermer} className="btn btn-secondary">Annuler</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
