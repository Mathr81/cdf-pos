# Architecture technique

Pour les développeurs. L'installation, le déploiement et la sauvegarde sont dans
le [README](../README.md) ; l'usage de l'app dans le
[guide d'utilisation](guide-utilisateur.md).

---

## Vue d'ensemble

```
 Tablette (PWA)                                  Serveur                      PostgreSQL
┌──────────────────────────────┐   Socket.IO   ┌──────────────────────┐    ┌──────────────┐
│ écran ─► dispatch(event)     │ events:push ─►│ ingest()             │───►│ Event        │
│            │                 │               │  zod + droits + PIN  │    │ (journal)    │
│            ▼                 │◄─ ack ────────│  projections SQL     │───►│ Order, Stock…│
│ IndexedDB : outbox + log     │◄─ broadcast ──│  file de sauvegarde  │───►│ BackupQueue  │
│            │                 │◄─ pull ───────│                      │    └──────────────┘
│            ▼                 │               └──────────┬───────────┘
│ projection (réducteur local) │                          ▼
│   ─► écrans React            │               Google Sheet (miroir) · pg_dump (backup-cron)
└──────────────────────────────┘
```

| Dossier | Rôle |
|---|---|
| `packages/shared` | Schémas d'événements (zod), réducteur de projection, stats, clôture, réservations, prévision, monnaie. **Partagé** client/serveur. |
| `apps/web` | PWA React + Vite. Écrans dans `src/screens`, synchro et stockage local dans `src/lib`. |
| `apps/server` | Fastify + Socket.IO + Prisma. Ingestion, projections SQL, auth, médias, sauvegarde. |
| `docker` | Dockerfiles, `docker-compose.yml`, `nginx.conf`, conteneur `backup-cron`. |
| `scripts/update.sh` | Mise à jour en production (builds séquentiels). |

---

## Le journal d'événements

Toute action est un **événement immuable** (`packages/shared/src/events.ts`) :

```ts
{ id: uuid,          // généré par le client → idempotence
  deviceId, clientSeq, createdAt,
  type: "sale",
  payload: { … } }
```

Le serveur l'enrichit d'un `seq` monotone et d'un `serverReceivedAt`
(`StoredEvent`). Le journal est à la fois la source de vérité de la synchro, la
piste d'audit et ce qui est sauvegardé.

### Types d'événements

| Domaine | Types | Sans PIN |
|---|---|---|
| Ventes | `sale`, `order_void`, `order_amend` | `sale` seul (+ `order_void` d'une réservation par la tablette qui l'a pointée, < 10 min) |
| Stock / cuisine | `stock_adjust`, `prepared` | ✅ |
| Caisse | `cash_open`, `cash_count` | — |
| Catalogue | `product_upsert`, `product_delete`, `station_upsert`, `station_delete`, `category_order` | — |
| Soirées | `soiree_upsert`, `soiree_activate`, `soiree_close`, `soiree_delete`, `soiree_product_set` | — |
| Modèles | `preset_upsert`, `preset_delete` | — |
| Réservations | `reservation_upsert`, `reservation_delete`, `booking_tariffs_set` | — |

Moyens de paiement (`PAYMENT_METHODS`) : `cash`, `card`, `cheque`, `offert`,
`prepaid`. `offert` garde les vrais prix mais est exclu de tout agrégat d'argent
via `paidOrders()` (`shared/stats.ts`). `prepaid` est du CA mais n'est dans
aucune caisse. Libellés : `PAYMENT_LABELS` / `paymentLabel()` — ne jamais
réécrire le ternaire à la main.

### Règles de compatibilité (à respecter absolument)

Le journal est **rejoué** au démarrage, sur le client comme pour reconstruire
les projections :

1. **Tout nouveau champ de payload est optionnel** (ou a un `.default()` qui dit
   la vérité pour l'historique). Un champ requis invalide tous les événements
   déjà en base et l'app ne démarre plus.
2. **On ajoute des valeurs d'enum, on n'en retire jamais.**
3. Pour un `*_upsert` en last-write-wins, `.optional()` **sans** `.default()`
   quand l'absence doit signifier « ne pas toucher » (cf. `imageKey`) : un poste
   pas encore à jour effacerait sinon la valeur.
4. `Event.payload` est du `Json` : le journal n'a jamais besoin de migration.
   Seules les tables de projection en demandent.

### Ajouter un type d'événement

1. Schéma + entrée dans `EventSchema` (`shared/src/events.ts`).
2. `case` dans le réducteur client (`shared/src/projection.ts`).
3. `case` dans la projection SQL (`server/src/projections.ts`) si une table en a
   besoin. **Les deux réducteurs doivent rester d'accord** : c'est le point le
   plus fragile du projet.
4. Droits : ajouter à `PUBLIC_TYPES` (`server/src/ingest.ts`) seulement si un
   poste sans PIN doit pouvoir l'émettre.
5. Remise à zéro : l'ajouter à `OPERATIONAL_EVENT_TYPES` (`server/src/reset.ts`)
   s'il doit être effacé avec les ventes.
6. Tests dans `packages/shared/src/*.test.ts`.

---

## Synchronisation et hors-ligne

Côté client (`apps/web/src/lib/sync.ts`, `db.ts`), IndexedDB via Dexie :

| Table | Contenu |
|---|---|
| `outbox` | Événements émis ici et pas encore acquittés. |
| `log` | Journal local complet (rejoué au démarrage → app utilisable hors ligne). |
| `meta` | Curseur de synchro, `epoch`. |
| `conflicts` | Encaissements de réservation refusés, à présenter à l'utilisateur. |

Cycle :

1. **`dispatch(event)`** écrit dans `outbox` + `log`, applique à la projection
   locale (l'écran se met à jour immédiatement), puis tente un push. Si
   l'écriture locale échoue, la vente n'est **pas** confirmée à l'utilisateur.
2. À la connexion : `sync:hello` → comparaison d'**epoch** → `events:push`
   (par paquets de 200, Socket.IO coupant au-delà d'1 Mo) → `events:pull` depuis
   le curseur (paginé).
3. Le serveur acquitte (`SyncAck.acceptedIds`) les événements stockés, **y
   compris les doublons** déjà connus : le client vide son outbox.
   `rejected` avec `code: "conflict"` = refus définitif (réservation déjà
   encaissée) → retiré de l'outbox, versé dans `conflicts`.
4. Les nouveaux événements sont diffusés à tous (`events:broadcast`).

L'ingestion serveur (`ingest.ts`) est **sérialisée** : les `seq` sont visibles
dans l'ordre des commits, sinon un poste pourrait avancer son curseur au-delà
d'un événement pas encore publié.

### Epoch et remise à zéro

`POST /api/admin/reset` (`scope: "sales" | "all"`) efface les tables et génère
un nouvel **epoch** (`AppMeta`), diffusé par `server:reset`. Un client qui
découvre un epoch différent purge son IndexedDB et se recharge — **sauf** s'il a
des ventes dans l'outbox : `PendingSalesGuard` bloque et propose de réessayer,
de télécharger un fichier de secours (`lib/rescue.ts`) ou d'annuler.

### Présence

Chaque socket déclare `deviceId`, rôle, libellé, et son nombre de ventes en
attente (`presence:pending`). Le serveur tient un registre en mémoire
(`presence.ts`) diffusé par `presence:update` → panneau « Postes connectés » et
bandeau « deux tablettes sous le même nom de caisse ».

---

## Serveur

| Route | Garde | Rôle |
|---|---|---|
| `GET /api/health` | — | Sonde. |
| `POST /api/auth/check` | rate limit 10/min/IP | Vérifie code d'accès et PIN. |
| `GET /api/state` | code d'accès | État initial (stations…) pour l'écran de connexion. |
| `POST /api/admin/reset` | PIN | Remise à zéro (voir plus haut). |
| `POST /api/admin/media` | PIN | Upload d'image produit → WebP 320 px, nommé par hash (`media.ts`). |
| `GET /api/media/:key` | — | Sert une image (`<hash32>.webp`). |

Socket.IO : authentification au handshake (`accessCode`, `adminPin`, `role`,
`deviceId`). Un PIN faux refuse la connexion ; le client renvoie alors à l'écran
de connexion en gardant son outbox. `socket.data.isAdmin` décide des droits
d'émission dans `ingest()`.

### Modèle de données (Prisma)

- `Event` : le journal (`id` client, `seq` serveur).
- Projections : `Station`, `Product`, `Soiree`, `Order`, `OrderItem`,
  `StockMovement`, `Prepared`, `CashSession`.
- `AppMeta` : clé/valeur (epoch).
- `BackupQueue` : file de retry du miroir Google Sheet.

Les modèles, réservations, tarifs et l'ordre des catégories **n'ont pas de
table** : ils ne vivent que dans le journal (le serveur n'a besoin que de
`Order.reservationId` pour départager deux caisses).

### Sauvegardes

- **Google Sheet** (`backup/`) : chaque événement est mis en file
  (`enqueueBackup`), un worker l'écrit, avec retry illimité.
- **`backup-cron`** : `pg_dump` toutes les `BACKUP_INTERVAL` s (rétention
  `BACKUP_KEEP`), plus une archive des images quand elles changent
  (`MEDIA_KEEP`).

---

## Client

| Fichier | Rôle |
|---|---|
| `App.tsx` | Routes ; les routes admin n'existent pas sans PIN. |
| `components/Layout.tsx` | En-tête, onglets par rôle, indicateur de synchro, bandeaux, wake lock. |
| `lib/store.ts` | Store Zustand + projection courante. |
| `lib/actions.ts` | Fabrique les événements (`emitSale`, `voidOrder`, `amendOrder`…). |
| `lib/session.ts` | Code, PIN, rôle, libellé (persistés). |
| `lib/persist.ts` | Demande de stockage persistant. |
| `lib/wakeLock.ts` | Empêche la mise en veille. |
| `components/UpdateBanner.tsx` | Service worker en mode `prompt` : vérifie les mises à jour toutes les 5 min et propose « Recharger » (jamais de rechargement d'office). |
| `lib/reservationCsv.ts` | Import CSV des réservations (détection séparateur / encodage). |
| `lib/export.ts` | Exports CSV (ventes, bilan réservations). |
| `screens/Aide.tsx` | Aide intégrée — **à tenir à jour avec ce guide**. |

Logique métier pure dans `packages/shared` : `stats.ts` (`computeStats`,
`computeCashup`, `paidOrders`), `forecast.ts` (prévision de rupture : fenêtre
20 min, horizon 1 h), `reservations.ts`, `money.ts` (centimes partout, jamais de
flottants).

---

## Tests et CI

```bash
pnpm typecheck
pnpm test        # vitest dans chaque package
```

Le cœur monétaire est couvert dans `packages/shared` (projection, stats,
clôture, offerts, entraînement, réservations, prévision, récap). Côté web :
synchro, stockage, validation, import CSV, wake lock. Côté serveur : ingestion,
auth, présence.

La CI GitHub (`.github/workflows/ci.yml`) enchaîne install → build du paquet
partagé + client Prisma → typecheck → tests → build.

---

## Choix assumés

- **Sécurité simple** : un code d'accès partagé et un PIN, vérifiés côté
  serveur ; pas de comptes individuels. Ça protège d'un passant, pas d'un
  attaquant déterminé.
- **Le stock n'est pas réservé** : hors ligne, deux caisses peuvent vendre la
  dernière unité. Vendre au-delà du stock est permis après confirmation.
- **Jetons prépayés et prix de revient écartés** (voir
  [specs/2026-08-26-chantiers.md](specs/2026-08-26-chantiers.md)).
