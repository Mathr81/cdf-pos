# Worksheet shared.business: Money, stats & bookings
Audience: everyone. Write in plain language for a non-technical owner: what it does for the business or its users, in everyday words, still specific. No jargon (endpoint, ORM, blueprint, webhook, worker…): the path and method/URL are already shown next to it. See "Plain language" in references/writing-descriptions.md.
Module: Amount formatting, sales statistics, stock run-out forecasts and booking rules.
Write to: floorplan/descriptions/shared.business.json (a skeleton is already there; fill in every "description", improve every "name").
Entries marked REVIEW already have a description but their code changed: update name/description if the change matters, then delete the "review" field. Entries not listed here are fine; leave them alone.

## packages/shared/src/forecast.ts  (96 loc, typescript)
defines: StockForecast; forecastDepletion() (Estime quand un produit sera épuisé.)
uses: Live totals
used by: Tests, Money, stats & bookings

## packages/shared/src/index.ts  (7 loc, typescript)
uses: Money, stats & bookings ×4, Event definitions ×2, Live totals
used by: Screens ×11, Offline storage & sync ×6, Admin settings ×5, Shared building blocks ×4, Tests ×3

## packages/shared/src/money.ts  (22 loc, typescript)
doc: Toutes les valeurs monétaires sont stockées en **centimes entiers** (Int) pour éviter les erreurs d'arrondi des flottants.
defines: formatCents() (Formate des centimes en chaîne « 12,50 € » (locale FR).); formatAmount() (Formate des centimes sans le symbole, ex « 12,50 ».); parseAmountToCents() (Convertit une saisie utilisateur (« 12,50 » ou « 12.5 ») en centimes.)
used by: Money, stats & bookings

## packages/shared/src/reservations.ts  (335 loc, typescript)
defines: SELF_VOID_WINDOW_MS (Fenêtre pendant laquelle la tablette qui a encaissé peut annuler sans PIN.); Counts (Personnes par tarif : productId → nombre.); Tariff; bookingTariffs() (Tarifs de la soirée, dans l'ordre réglé par l'admin.); isBookingSoiree(); isReservationsOnly() (Soirée sur réservation sans rien d'autre à vendre (carte vide) : la caisse, la cuisine et le stock n'ont alors rien à montrer.); countTotal(); bookingItems() (Lignes de vente pour ces personnes ; les quantités nulles sont omises (le schéma les refuse).); itemsTotal(); orderHeads() (Personnes réellement présentes pour une commande : `heads` si donné, sinon ses lignes.); arrivedHeads() (Personnes arrivées pour une réservation, toutes vagues comprises.); ReservationRow; … +8
uses: Live totals, Event definitions
used by: Money, stats & bookings, Tests

## packages/shared/src/stats.ts  (420 loc, typescript)
defines: StatsResponse (Réponse stats (partagée serveur ↔ client).); computeStats() (Calcule les statistiques depuis la projection locale (live & offline).); SoireeSummary (Résumé compact d'une soirée (pour la comparaison entre soirées).); soireeSummaries() (Résumés des VRAIES soirées, triés par date.); SoireeComparison; compareToPrevious() (Situe une soirée par rapport au service précédent : « +18 % vs 14 juin ».); CashupRow (Ligne de clôture de caisse (rapport Z) par poste de caisse.); Cashup; computeCashup() (Clôture de caisse d'une soirée : espèces/carte par poste, plus le fond, le comptage réel et l'écart.); RecapProductRow; Recap; computeRecap() (Tout ce que le trésorier demande le lendemain, sur une page : argent par moyen et par caisse, écarts de comptage, produits vendus, offerts, pertes et annulations.)
uses: Live totals
used by: Tests ×6, Money, stats & bookings
