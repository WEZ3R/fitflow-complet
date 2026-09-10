"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
// Feuille de style de la bibliothèque : elle porte le positionnement absolu du
// conteneur et de l'image. Sans elle, le composant se monte mais rien n'est
// visible — l'image reste à sa taille naturelle, hors du cadre.
import "react-easy-crop/react-easy-crop.css";
import { Check, X, ZoomIn, RotateCw } from "lucide-react";

/** Côté de l'image produite, en pixels. */
const OUTPUT_SIZE = 512;
/** Qualité JPEG : 0,88 tient sous ~80 ko à 512 px, sans artefact visible. */
const JPEG_QUALITY = 0.88;

/**
 * Découpe la zone choisie et renvoie un fichier carré.
 *
 * Le rendu passe par un canvas de taille FIXE : sans normalisation, une photo de
 * 6 000 px produirait un fichier de plusieurs mégaoctets pour un affichage de 96 px.
 * La rotation est appliquée avant la découpe, sinon les coordonnées de la zone ne
 * correspondraient plus à l'image tournée.
 */
async function cropToFile(
  imageSrc: string,
  area: Area,
  rotation: number,
  fileName: string,
): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image illisible"));
    img.src = imageSrc;
  });

  // Étape 1 : redresser l'image dans un canvas intermédiaire.
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const rotW = image.width * cos + image.height * sin;
  const rotH = image.width * sin + image.height * cos;

  const stage = document.createElement("canvas");
  stage.width = rotW;
  stage.height = rotH;
  const sctx = stage.getContext("2d");
  if (!sctx) throw new Error("Canvas indisponible");
  sctx.translate(rotW / 2, rotH / 2);
  sctx.rotate(rad);
  sctx.drawImage(image, -image.width / 2, -image.height / 2);

  // Étape 2 : extraire la zone, mise à l'échelle de sortie.
  const out = document.createElement("canvas");
  out.width = OUTPUT_SIZE;
  out.height = OUTPUT_SIZE;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Canvas indisponible");
  octx.imageSmoothingQuality = "high";
  octx.drawImage(
    stage,
    area.x, area.y, area.width, area.height,
    0, 0, OUTPUT_SIZE, OUTPUT_SIZE,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    out.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error("Export impossible");

  // JPEG et non PNG : la transparence n'a pas de sens sur une photo, et le PNG
  // pèserait cinq à dix fois plus lourd à qualité comparable.
  const base = fileName.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

/**
 * Recadrage d'une photo de profil, en fenêtre modale.
 *
 * Les photos s'affichent dans un cercle : la zone de découpe est ronde et carrée en
 * proportion, pour que ce qu'on cadre soit exactement ce qu'on verra. Sans cet
 * outil, un portrait en pied était réduit à une vignette où le visage faisait
 * quelques pixels.
 */
export default function PhotoCropper({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  onDone: (cropped: File, previewUrl: string) => void;
}) {
  /**
   * URL de l'image, créée une seule fois à l'initialisation de l'état.
   *
   * Le faire dans un effet serait un setState synchrone dans un effet — interdit par
   * react-hooks/set-state-in-effect, et à raison : ça provoque un premier rendu à
   * vide suivi d'un second. L'initialiseur paresseux ne s'exécute qu'au montage, et
   * le parent remonte le composant à chaque nouveau fichier grâce à sa `key`.
   *
   * createObjectURL plutôt qu'un FileReader : pas de conversion en base64, donc pas
   * de pic mémoire à un tiers du poids du fichier sur les grosses photos.
   */
  const [src] = useState(() => URL.createObjectURL(file));
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * PAS de révocation dans un effet de démontage.
   *
   * React exécute les effets DEUX FOIS en développement (StrictMode) : montage,
   * nettoyage, remontage. Le nettoyage révoquait donc l'URL aussitôt créée, et le
   * second montage héritait d'une URL morte — le cadre restait noir, sans image ni
   * cercle de découpe.
   *
   * La libération se fait aux deux sorties réelles du composant : après un recadrage
   * validé, et à l'annulation.
   */
  const release = useCallback(() => URL.revokeObjectURL(src), [src]);

  const cancel = useCallback(() => {
    release();
    onCancel();
  }, [release, onCancel]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  const confirm = async () => {
    if (!src || !area) return;
    setBusy(true);
    setError(null);
    try {
      const cropped = await cropToFile(src, area, rotation, file.name);
      release(); // l'original ne sert plus, l'aperçu vient du fichier découpé
      // L'aperçu vient du fichier DÉCOUPÉ, pas de l'original : l'utilisateur doit
      // voir le résultat exact de son cadrage.
      onDone(cropped, URL.createObjectURL(cropped));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recadrage impossible");
      setBusy(false);
    }
  };

  // Échap pour annuler : une modale qui ne se ferme qu'au bouton est une impasse
  // au clavier.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancel]);

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Recadrer la photo"
    >
      <div className="w-full max-w-md rounded-xl border border-gray-500/20 bg-[var(--surface-card,#fff)] p-4 space-y-3">
        <h3 className="text-sm font-semibold">Recadrer la photo</h3>

        <div className="relative h-72 w-full overflow-hidden rounded-lg bg-black/40">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <p className="text-[11px] text-gray-500">
          Faites glisser pour déplacer, la molette ou le curseur pour zoomer.
        </p>

        <div className="flex items-center gap-2">
          <ZoomIn className="h-4 w-4 text-gray-400 shrink-0" aria-hidden="true" />
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="flex-1 accent-primary-600"
          />
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            title="Pivoter de 90°"
            aria-label="Pivoter de 90°"
            className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 transition-colors"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={cancel}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-500/30 px-3 py-2 text-sm text-gray-500 hover:bg-gray-500/10 transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Annuler
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy || !area}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            {busy ? "Traitement…" : "Valider"}
          </button>
        </div>
      </div>
    </div>
  );
}
