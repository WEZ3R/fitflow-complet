-- Provenance des fiches de salles.
-- `osmId` seul ne permettait pas de dédupliquer une source non-OSM : un import
-- SIRENE n'avait aucune clé stable pour se réconcilier avec les lignes existantes.

ALTER TABLE "gyms" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'osm';
ALTER TABLE "gyms" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "gyms" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Reprise des lignes existantes : toutes viennent d'OpenStreetMap.
UPDATE "gyms" SET "sourceId" = "osmId" WHERE "osmId" IS NOT NULL;

CREATE UNIQUE INDEX "gyms_source_sourceId_key" ON "gyms"("source", "sourceId");
CREATE INDEX "gyms_postalCode_idx" ON "gyms"("postalCode");
