# Plan de chantiers — 26 août 2026

Audit du projet et découpage du travail décidé à cette date. Sert de référence
pour les huit lots qui suivent : chacun donne lieu à une branche et une PR.

---

## Contraintes d'architecture

Trois règles cadrent tous les chantiers.

**Le journal est immuable et rejoué au démarrage.** Ajouter une fonctionnalité
suppose d'ajouter un type dans la union zod (`shared/events.ts`), un `case` dans
le réducteur client (`shared/projection.ts`) **et** un `case` dans la projection
SQL (`server/projections.ts`). Les deux réducteurs doivent rester d'accord :
c'est le point le plus fragile du projet.

**Tout nouveau champ de payload doit être optionnel.** Les événements déjà en
base seront rejoués tels quels. Un champ requis ajouté à un payload existant
invalide tout l'historique et empêche l'application de démarrer.

**`Event.payload` est du `Json`** : le journal n'a jamais besoin de migration.
Seules les nouvelles tables de projection en demandent une.

## Constats de l'audit

| Constat | Emplacement |
|---|---|
| `JWT_SECRET` chargé, documenté, exigé par le README — jamais utilisé | `server/src/env.ts:25`, `.env.example:32` |
| Les stats sont implémentées deux fois : client (`computeStats`) et serveur (SQL) | `shared/stats.ts` vs `server/src/routes/stats.ts` |
| `/api/stats` est exposé mais aucun appelant côté web | `web/src/lib/api.ts:45` |
| Le miroir Google Sheet code en dur `cash ? "Espèces" : "Carte"` — un 3ᵉ mode serait silencieusement mal étiqueté | `server/src/backup/sheets.ts:79` |
| Même ternaire dans l'export CSV | `web/src/lib/export.ts` |
| `Admin.tsx` fait 1214 lignes et mélange quatre responsabilités | `web/src/screens/Admin.tsx` |
| Aucun test sur le cœur monétaire (réducteur, agrégations) | `shared/projection.ts`, `shared/stats.ts` |
| Pas de registre de présence : `deviceId`/`role`/`label` reçus au handshake puis oubliés | `server/src/socket.ts:65` |
| Aucune notion de prix de revient nulle part | — |

Vérifié et **écarté** : « dupliquer une soirée » existe déjà
(`web/src/screens/Soirees.tsx:259`).

## Décisions

- **Jetons prépayés : hors périmètre.** L'événement fonctionne en encaissement
  direct aux stands, pas en tickets vendus à l'entrée. Ce chantier aurait
  imposé deux flux d'argent distincts et une redéfinition du CA pour éviter le
  double comptage.
- **Repas offerts : la valeur est tracée.** La commande conserve les vrais prix
  et le mode `offert` est exclu du CA. On peut donc rapporter « 47 € offerts ».
  En contrepartie, chaque agrégation monétaire doit filtrer explicitement — d'où
  le lot 0 en préalable.
- **Prix de revient figé à la vente.** `unitCostCents` est porté par la ligne de
  commande, comme `unitPriceCents`. Sans cela, changer un prix d'achat
  réécrirait rétroactivement la marge des soirées passées. Les ventes
  antérieures auront une marge *inconnue*, jamais fausse.
- **`Admin.tsx` : découpage à vue**, en commit isolé sans changement de
  comportement, plutôt que de monter d'abord une infra de test React (jsdom +
  Testing Library). C'est du déplacement de code pur.
- **`JWT_SECRET` est supprimé**, pas implémenté : des sessions signées n'ont pas
  de sens pour un code d'accès partagé entre bénévoles. Une configuration qui
  promet de la sécurité sans en fournir est pire que son absence.

## Lots

| # | Lot | Migration |
|---|---|---|
| 0 | Filet de tests sur `projection.ts` et `stats.ts` (comportement actuel) | — |
| 1 | Nettoyage : `JWT_SECRET`, rate limit `/auth/check`, suppression de `/api/stats` | — |
| 2 | Découpage de `Admin.tsx`, sans changement de comportement | — |
| 3 | Prévision de rupture + comparaison à la soirée précédente | — |
| 4 | Fond de caisse, comptage réel, écart par poste | `CashSession` |
| 5 | Postes connectés et ventes en attente visibles dans Admin | — |
| 6 | Repas offerts + prix de revient et marge | `costCents` |
| 7 | Mode démo / entraînement | — |

L'ordre n'est pas arbitraire : le lot 0 protège les lots 4 et 6, le lot 2 évite
d'aggraver `Admin.tsx` avant d'y ajouter quatre écrans, et le lot 3 livre de la
valeur sans toucher au modèle.

### Détail des lots à migration

**Lot 4 — caisse.** Deux événements : `cash_open { soireeId, registerLabel,
floatCents }` et `cash_count { soireeId, registerLabel, countedCents, note? }`.
L'écart vaut `fond + espèces théoriques − compté`. `computeCashup()` fournit
déjà les espèces théoriques par poste.

**Lot 6 — argent.** Le mode `offert` doit être filtré dans `paidOrders()`
(`shared/stats.ts`), qui alimente `computeStats`, `computeCashup` *et*
`soireeSummaries` — plus `sheets.ts:79`, `export.ts`, `Journal.tsx`,
`Stats.tsx`. Ajouter une valeur à `PAYMENT_METHODS` est rétro-compatible ;
la retirer ensuite ne l'est pas.
