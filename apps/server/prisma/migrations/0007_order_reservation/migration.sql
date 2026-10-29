-- Encaissement d'une réservation : la vente porte l'id de la réservation.
-- Sert à refuser un second encaissement payé pour la même réservation (deux
-- caisses sur la même famille) ; les réservations elles-mêmes ne vivent que
-- dans le journal d'événements.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "reservationId" TEXT;

-- CreateIndex
CREATE INDEX "Order_reservationId_idx" ON "Order"("reservationId");
