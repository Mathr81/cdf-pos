# Worksheet shared.projection: Live totals
Audience: everyone. Write in plain language for a non-technical owner: what it does for the business or its users, in everyday words, still specific. No jargon (endpoint, ORM, blueprint, webhook, worker…): the path and method/URL are already shown next to it. See "Plain language" in references/writing-descriptions.md.
Module: Replays the event list to work out current stock, orders, what the kitchen still has to make, and cash drawers.
Write to: floorplan/descriptions/shared.projection.json (a skeleton is already there; fill in every "description", improve every "name").
Entries marked REVIEW already have a description but their code changed: update name/description if the change matters, then delete the "review" field. Entries not listed here are fine; leave them alone.

## packages/shared/src/projection.ts  (604 loc, typescript)
defines: ClientProduct; ClientStation; ClientSoiree; ClientPreset; SoireeProductConfig (Configuration d'un produit dans la carte d'une soirée.); ClientOrder; ClientReservation (Réservation d'une soirée sur réservation (liste importée par l'admin).); BookingTariff; BOOKING_ADULT_ID (Ids des deux tarifs d'origine (adulte / enfant), repris par l'ancien format.); BOOKING_CHILD_ID; CashSession (Caisse d'un poste pour une soirée : fond déposé avant le service, et comptage réel après.); ProjectionState; … +20
uses: Event definitions
used by: Tests ×6, Money, stats & bookings ×4
