# Worksheet web.sync: Offline storage & sync
Audience: everyone. Write in plain language for a non-technical owner: what it does for the business or its users, in everyday words, still specific. No jargon (endpoint, ORM, blueprint, webhook, worker…): the path and method/URL are already shown next to it. See "Plain language" in references/writing-descriptions.md.
Module: Saves every action on the tablet first, then sends it to the server and pulls in what other tablets did, so tills keep selling without Wi-Fi.
Write to: floorplan/descriptions/web.sync.json (a skeleton is already there; fill in every "description", improve every "name").
Entries marked REVIEW already have a description but their code changed: update name/description if the change matters, then delete the "review" field. Entries not listed here are fine; leave them alone.

## apps/web/src/lib/actions.ts  (256 loc, typescript)
defines: emitSale(); voidOrder(); amendOrder(); adjustStock(); openCash() (Déclare le fond de monnaie déposé dans un poste avant le service.); countCash() (Enregistre le comptage réel de la boîte.); markPrepared(); upsertProduct(); deleteProduct(); upsertStation(); deleteStation(); upsertSoiree(); … +12
uses: Offline storage & sync ×4, Money, stats & bookings
used by: Screens ×7, Admin settings ×4, Shared building blocks

## apps/web/src/lib/api.ts  (85 loc, typescript)
defines: mediaUrl() (URL publique d'une image produit.); UploadedImage; api
uses: Web addresses ×2, Small helpers, Offline storage & sync
used by: Admin settings ×2, Shared building blocks, Screens

## apps/web/src/lib/db.ts  (56 loc, typescript)
defines: OutboxRow; LogRow; ConflictRow; MetaRow; db; getMeta(); setMeta()
uses: Money, stats & bookings
used by: Offline storage & sync ×4, Tests ×2

## apps/web/src/lib/device.ts  (20 loc, typescript)
doc: Identité persistante de l'appareil + compteur de séquence local.
defines: getDeviceId(); nextClientSeq() (Renvoie une séquence locale strictement croissante (ordre d'émission).); newId()
used by: Screens ×3, Offline storage & sync ×2, Shared building blocks, Admin settings

## apps/web/src/lib/deviceInfo.ts  (59 loc, typescript)
doc: « iPad · Safari », « Android SM-X200 · Chrome » : de quoi reconnaître un poste dans la liste des postes connectés (Admin).
defines: describeDevice(); describeUserAgent()
used by: Tests, Offline storage & sync

## apps/web/src/lib/localData.ts  (61 loc, typescript)
defines: PendingSalesError (Levée quand une purge détruirait des ventes que le serveur n'a jamais reçues.); pendingCount() (Nombre d'événements créés ici et pas encore acquittés par le serveur, plus les encaissements en conflit non tranchés : de l'argent a pu être reçu pour eux, ils n'existent que sur cette tablette.); wipeLocalData() (Efface toutes les données locales (journal, outbox, curseur).); serializeOutbox() (Sérialise l'outbox en JSON.)
uses: Money, stats & bookings, Offline storage & sync
used by: Offline storage & sync ×2, Tests, Admin settings

## apps/web/src/lib/persist.ts  (39 loc, typescript)
doc: Stockage persistant. ───────────────────────────────────────────────────────────── Sans cette demande, IndexedDB est en mode « best-effort » : le navigateur peut évincer la base sous pression disque — et l'outbox…
defines: PersistStatus; requestPersistentStorage(); estimateStorage() (Occupation du quota, pour repérer une tablette proche de la saturation.)
used by: Tests, Screens, Admin settings

## apps/web/src/lib/rescue.ts  (12 loc, typescript)
defines: downloadOutboxRescue() (Télécharge les ventes non synchronisées avant une purge.)
uses: Small helpers, Offline storage & sync
used by: Shared building blocks

## apps/web/src/lib/session.ts  (37 loc, typescript)
defines: useSession
uses: Money, stats & bookings
used by: Screens ×5, Shared building blocks ×2, Offline storage & sync ×2

## apps/web/src/lib/store.ts  (92 loc, typescript)
defines: projection (Projection locale (singleton muté en place) + état UI réactif minimal.); BlockedWipe (Purge suspendue faute d'avoir pu sauver les ventes en attente.); useStore; applyIncoming() (Applique un lot d'événements (locaux ou reçus) à la projection, en dédupliquant par `id`.); retractOrders() (Retire des commandes refusées par le serveur de la projection locale.); hasApplied()
uses: Offline storage & sync, Money, stats & bookings
used by: Screens ×10, Admin settings ×7, Shared building blocks ×5, Offline storage & sync ×2, Small helpers

## apps/web/src/lib/sync.ts  (272 loc, typescript)
defines: retryPendingSync() (Pousse ce qui reste, puis renvoie le nombre de ventes encore en attente.); forceWipeAndReload() (Purge acceptée en connaissance de cause, après sauvegarde du secours.); hydrateFromLog() (Reconstruit la projection depuis le journal local (démarrage hors-ligne).); pushOutbox() (Pousse l'outbox vers le serveur et purge les événements acquittés.); settleConflicts() (Encaissements de réservation refusés : une autre caisse est passée avant.); dispatch() (Enregistre localement un nouvel événement (optimiste) puis tente de le pousser.); dispatchMany() (Même chose pour un lot (import de réservations) : une seule écriture et une seule poussée, au lieu d'une poussée concurrente par événement.); dismissConflict() (Décision de la caisse sur un conflit : la ligne disparaît, l'éventuelle vente de remplacement est déjà émise.); connect() (Établit la connexion temps réel et lance la synchro.); disconnect()
uses: Offline storage & sync ×6, Money, stats & bookings, Live connection
used by: Shared building blocks ×2, Screens, Offline storage & sync, Tests, Live connection

## apps/web/src/lib/wakeLock.ts  (66 loc, typescript)
defines: WakeLockDeps; startWakeLock() (Démarre le maintien d'écran.); useWakeLock() (Câblage React : actif tant que le composant est monté.)
used by: Shared building blocks, Tests
