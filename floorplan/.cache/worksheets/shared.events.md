# Worksheet shared.events: Event definitions
Audience: everyone. Write in plain language for a non-technical owner: what it does for the business or its users, in everyday words, still specific. No jargon (endpoint, ORM, blueprint, webhook, worker…): the path and method/URL are already shown next to it. See "Plain language" in references/writing-descriptions.md.
Module: The list of every kind of action (sale, stock change, cooked, booking…) and the messages tablets and server exchange.
Write to: floorplan/descriptions/shared.events.json (a skeleton is already there; fill in every "description", improve every "name").
Entries marked REVIEW already have a description but their code changed: update name/description if the change matters, then delete the "review" field. Entries not listed here are fine; leave them alone.

## packages/shared/src/events.ts  (393 loc, typescript)
defines: PAYMENT_METHODS (Moyens de paiement. `prepaid` : réservation réglée avant la soirée (virement, HelloAsso…).); PaymentMethod; PAYMENT_LABELS (Libellé affichable d'un moyen de paiement.); paymentLabel(); STOCK_REASONS; StockReason; SaleItemSchema (Ligne de commande (prix figé au moment de la vente).); SaleItem; SalePayloadSchema (Vente finalisée (encaissement).); SalePayload; OrderVoidPayloadSchema (Annulation d'une commande déjà encaissée.); OrderVoidPayload; … +51
used by: Money, stats & bookings ×2, Live totals, Event definitions, Tests

## packages/shared/src/protocol.ts  (83 loc, typescript)
defines: ROLES (Postes possibles pour une connexion.); Role; SyncAck (Accusé de réception d'un batch d'événements poussé par le client.); PullResponse (Réponse à une demande de rattrapage (pull) depuis un curseur.); ServerHello (Salutation du serveur : identifie la « session de données » courante.); PresenceEntry (Poste connecté, tel que l'admin le voit.); ClientToServerEvents (Événements émis par le CLIENT vers le SERVEUR.); ServerToClientEvents (Événements émis par le SERVEUR vers le CLIENT.); HandshakeAuth (Données attachées à une connexion (handshake auth).)
uses: Event definitions
used by: Money, stats & bookings
