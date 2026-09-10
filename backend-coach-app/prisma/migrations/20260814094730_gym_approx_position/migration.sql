-- Fiches dont la position est douteuse (empilement sur des coordonnées identiques).
ALTER TABLE "gyms" ADD COLUMN "approxPosition" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "gyms_approxPosition_idx" ON "gyms"("approxPosition");
