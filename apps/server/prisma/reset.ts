import { resetData, type ResetScope } from "../src/reset.js";
import { prisma } from "../src/db.js";

/**
 * Remise à zéro en ligne de commande (quand l'interface admin n'est pas
 * accessible) :
 *
 *   pnpm db:reset            → efface les ventes, garde la carte
 *   pnpm db:reset -- --all   → efface tout, y compris produits et stations
 *
 * Les appareils connectés se purgeront à leur prochaine connexion grâce au
 * changement d'epoch.
 */

async function main() {
  const scope: ResetScope = process.argv.includes("--all") ? "all" : "sales";
  const result = await resetData(scope);

  // eslint-disable-next-line no-console
  console.log(
    [
      `Remise à zéro « ${scope} » effectuée.`,
      `  événements supprimés : ${result.deleted.events}`,
      `  commandes supprimées : ${result.deleted.orders}`,
      `  mouvements de stock  : ${result.deleted.stockMovements}`,
      `  préparations         : ${result.deleted.prepared}`,
      `  produits conservés   : ${result.keptProducts}`,
      `  nouvel epoch         : ${result.epoch}`,
      "",
      "Les caisses / écrans cuisine se videront à leur prochaine connexion.",
    ].join("\n"),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
