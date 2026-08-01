-- Stock illimité + composants de menu
ALTER TABLE "Product" ADD COLUMN "stockUnlimited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "components" JSONB NOT NULL DEFAULT '[]';

-- Métadonnées serveur (epoch de remise à zéro)
CREATE TABLE "AppMeta" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppMeta_pkey" PRIMARY KEY ("key")
);
