-- Niveau de zoom de l'image produit, en pourcentage du cadre occupé par le
-- dessin (40 à 100).
--
-- C'est un réglage d'AFFICHAGE, pas un paramètre de traitement : il n'est pas
-- cuit dans le fichier WebP. Le corriger ne demande donc pas de resélectionner
-- le fichier source, contrairement au mode photo/icône.
--
-- Colonne nullable sans valeur par défaut : `null` signifie « défaut du
-- client », ce qui laisse la valeur de référence dans le code plutôt que
-- figée en base.

ALTER TABLE "Product" ADD COLUMN "imageZoom" INTEGER;
