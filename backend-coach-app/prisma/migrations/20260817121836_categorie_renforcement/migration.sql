-- Catégorie pour le travail isométrique ou au poids du corps, compté en temps.
--
-- ALTER TYPE ... ADD VALUE et l'utilisation de la nouvelle valeur ne peuvent pas
-- cohabiter dans une même transaction : aucune requête de cette migration ne
-- référence donc 'RENFORCEMENT'. La bascule des données existantes se fait par le
-- seed ou à la main.
ALTER TYPE "ExerciseCategory" ADD VALUE IF NOT EXISTS 'RENFORCEMENT' AFTER 'MAIN';

-- Temps tenu par série, distinct des répétitions.
ALTER TABLE "set_completions" ADD COLUMN "durationAchieved" TEXT;
