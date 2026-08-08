-- Soirées (sessions de vente) + rattachement des projections à une soirée.

-- CreateTable
CREATE TABLE "Soiree" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Soiree_pkey" PRIMARY KEY ("id")
);

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN "soireeId" TEXT;
ALTER TABLE "Order" ADD COLUMN "amended" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable StockMovement
ALTER TABLE "StockMovement" ADD COLUMN "soireeId" TEXT;

-- AlterTable Prepared
ALTER TABLE "Prepared" ADD COLUMN "soireeId" TEXT;

-- CreateIndex
CREATE INDEX "Order_soireeId_idx" ON "Order"("soireeId");
CREATE INDEX "StockMovement_soireeId_idx" ON "StockMovement"("soireeId");
CREATE INDEX "Prepared_soireeId_idx" ON "Prepared"("soireeId");
