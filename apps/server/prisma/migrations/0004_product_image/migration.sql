-- Image personnalisée par produit (photo, icône ou logo).
--
-- On ne stocke que le NOM DE FICHIER ("<hash32>.webp"), pas une URL : la valeur
-- est recopiée dans le journal d'événements, qui est immuable et mirroré dans
-- Google Sheets. Le binaire lui-même vit dans le volume MEDIA_DIR.
--
-- Colonne nullable sans valeur par défaut : migration additive et réversible,
-- les lignes existantes restent valides sans réécriture.

ALTER TABLE "Product" ADD COLUMN "imageKey" TEXT;
