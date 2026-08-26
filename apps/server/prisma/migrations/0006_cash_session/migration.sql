-- Clôture de caisse : fond de monnaie et comptage réel, par poste et par soirée.
--
-- L'écart (compté − fond − espèces encaissées) n'est délibérément PAS stocké.
-- Il se recalcule à la lecture, sinon une vente enregistrée après le comptage
-- — une caisse hors ligne qui se resynchronise — laisserait en base un écart
-- devenu faux, sans que rien ne le signale.
--
-- `countedCents` est nullable et le restera : « pas encore compté » n'est pas
-- « compté à zéro ». Un 0 par défaut afficherait un écart parfaitement faux
-- sur chaque poste non compté.

-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "soireeId" TEXT NOT NULL,
    "registerLabel" TEXT NOT NULL,
    "floatCents" INTEGER NOT NULL DEFAULT 0,
    "countedCents" INTEGER,
    "countedNote" TEXT,
    "openedAt" TIMESTAMP(3),
    "countedAt" TIMESTAMP(3),

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Une seule caisse par (soirée, poste) : c'est cette contrainte qui rend
-- l'ingestion idempotente, un événement rejoué retombant sur le même upsert.
CREATE UNIQUE INDEX "CashSession_soireeId_registerLabel_key" ON "CashSession"("soireeId", "registerLabel");

-- CreateIndex
CREATE INDEX "CashSession_soireeId_idx" ON "CashSession"("soireeId");
