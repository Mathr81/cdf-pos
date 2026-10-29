# Guide d'utilisation

Ce guide décrit l'application écran par écran, pour les **bénévoles** (caisse,
cuisine) et pour les **responsables** (ceux qui ont le PIN admin). L'installation
et le déploiement sont dans le [README](../README.md) ; le fonctionnement interne
dans [architecture.md](architecture.md).

Le bouton **?** (Aide), en haut à droite de l'application, reprend l'essentiel de ce guide, en version
courte, sur chaque tablette.

---

## Sommaire

1. [Vocabulaire](#1-vocabulaire)
2. [Démarrer une tablette](#2-démarrer-une-tablette)
3. [L'en-tête : indicateurs et bandeaux](#3-len-tête--indicateurs-et-bandeaux)
4. [Caisse](#4-caisse)
5. [Cuisine](#5-cuisine)
6. [Stock](#6-stock)
7. [Réservations](#7-réservations)
8. [Journal](#8-journal-pin)
9. [Statistiques et clôture de caisse](#9-statistiques-et-clôture-de-caisse-pin)
10. [Récapitulatif imprimable](#10-récapitulatif-imprimable-pin)
11. [Soirées](#11-soirées-pin)
12. [Admin : produits, stations, remise à zéro](#12-admin-pin)
13. [Réseau coupé et ventes en attente](#13-réseau-coupé-et-ventes-en-attente)
14. [Qui peut faire quoi](#14-qui-peut-faire-quoi)
15. [Déroulé type d'une soirée](#15-déroulé-type-dune-soirée)
16. [Dépannage](#16-dépannage)

---

## 1. Vocabulaire

| Terme | Sens dans l'app |
|---|---|
| **Soirée** | Une session de vente (« Fête du village 2026 »). Une seule est **active** à la fois : c'est sur elle qu'encaissent toutes les caisses. |
| **Carte** | Les produits en vente pour *une* soirée, avec leur stock et éventuellement un prix propre. |
| **Catalogue** | Tous les produits connus, d'une soirée à l'autre (Admin → Produits). |
| **Modèle** | Une carte enregistrée pour être réutilisée (« Carte burgers »). |
| **Station** | Un poste de cuisine (Grill, Friteuse, Froid & desserts). Chaque produit est rattaché à une station. |
| **Poste** | Le rôle d'une tablette : Caisse, Cuisine, Stats ou Admin. |
| **Plat composé** | Un produit qui en contient d'autres (« Burger Frites » contient 1 « Frites »). |
| **Stock illimité (∞)** | Produit qu'on ne compte pas (frites au sac, sirop). |
| **Offert** | Repas donné (bénévole, invité) : compté en stock et en cuisine, pas dans le chiffre d'affaires. |
| **Fond de caisse** | La monnaie déposée dans la boîte avant le service. |
| **Soirée sur réservation** | Soirée à tarifs par personne (adulte, enfant…) avec une liste de réservations à pointer. |
| **Sur place** | Personne venue sans réservation à une soirée sur réservation. |

---

## 2. Démarrer une tablette

1. Ouvrir l'adresse de l'app. Sur iPad ou téléphone, **Partager → Sur l'écran
   d'accueil** pour l'installer comme une application (recommandé : voir
   [Stockage](#stockage-de-la-tablette)).
2. Saisir le **code d'accès** remis par le responsable. Le **PIN admin** est
   facultatif : il ouvre le Journal, les Stats, les Soirées et l'Admin.
3. Choisir le **poste** :
   - **Caisse** : choisir le nom de caisse (Caisse 1, 2, 3) et, si on veut, son
     prénom (il apparaît dans les statistiques).
     ⚠️ Deux tablettes ne doivent pas porter le même nom de caisse : la clôture
     les fusionnerait. Un bandeau rouge le signale.
   - **Cuisine** : choisir sa station. Si aucune n'est proposée, un responsable
     doit les créer dans Admin → Stations cuisine.
   - **Stats** et **Admin** : seulement avec le PIN.
4. **Démarrer.**

En haut à droite, deux boutons sur tous les postes :

- **?** ouvre l'aide ; il devient **✕** pour revenir à l'écran quitté ;
- **⇥** change de poste. Les ventes en attente de la tablette sont conservées.

Les onglets visibles dépendent du poste :

| Poste | Onglets |
|---|---|
| Caisse (sans PIN) | Caisse · (Réservations) · Stock |
| Cuisine | — (un seul écran) |
| Stats | — (un seul écran) |
| Avec le PIN / Admin | Caisse · (Réservations) · Cuisine · Stock · Journal · Stats · Soirées · Admin |

L'onglet **Réservations** n'apparaît que si la soirée active est sur
réservation. Si elle ne vend *que* des réservations (aucun produit à la carte),
Caisse, Cuisine et Stock disparaissent. Quand il ne reste qu'un seul écran, la
barre d'onglets est masquée pour laisser la place au travail.

---

## 3. L'en-tête : indicateurs et bandeaux

Sous le nom du poste, l'**indicateur de synchro** :

| Affichage | Signification | Que faire |
|---|---|---|
| 🟢 **En ligne** | Tout est transmis. | Rien. |
| 🟠 **Envoi de N…** | Des ventes partent vers le serveur. | Rien, ça passe en quelques secondes. |
| 🔴 **N bloqués** | Connecté, mais l'envoi n'avance plus depuis 20 s. | Prévenir un responsable ; ne pas vider le cache. Recharger l'app relance souvent l'envoi. |
| 🔴 **Hors ligne · N en attente** | Pas de réseau ; N ventes sont **uniquement** sur cette tablette. | Continuer à encaisser, **ne pas éteindre** la tablette. |

Bandeaux possibles sous l'en-tête :

- **Orange « MODE ENTRAÎNEMENT »** : la soirée active est une soirée
  d'entraînement, les ventes ne comptent pas. On peut le masquer (✕) ; une
  pastille « Entraînement » reste alors à côté du nom du poste, un tap la
  réaffiche.
- **Rouge « Une autre tablette est aussi Caisse N »** : changer de poste et
  prendre un autre numéro.

L'écran **ne se met pas en veille** tant que l'app est ouverte : brancher les
tablettes.

---

## 4. Caisse

### Encaisser

1. Toucher les produits (une fois par article). La tuile passe en orange avec la
   quantité. Les onglets en haut filtrent par catégorie.
2. Corriger avec **− / +** dans le panier, ou la corbeille sur une ligne.
3. **Encaisser**, puis choisir :
   - **Espèces** : saisir le montant donné (ou toucher un billet proposé) →
     l'app affiche le **rendu**. Valider sans rien saisir si le compte est juste.
     Le clavier marche aussi sur ordinateur (chiffres, virgule, Entrée).
   - **Carte** : attendre que le terminal accepte, puis confirmer.
   - **Chèque** : proposé seulement aux soirées sur réservation.
   - **Offert (bénévole, invité)** : voir plus bas.
4. Un message « Encaissé 12,00 € · espèces » confirme. Sur un poste avec le PIN,
   il propose **Annuler** pendant 8 secondes.

### Les petites erreurs

- **« Vider » par erreur** : toucher **Rétablir** dans le message, le panier
  revient.
- **Stock insuffisant** : l'app demande confirmation (« Vendre quand même »). On
  peut toujours vendre — un stock initial mal saisi ne doit pas bloquer la
  caisse — et le négatif sera visible dans Stock.
- **Le client change d'avis après paiement** : un responsable corrige dans le
  [Journal](#8-journal-pin).

### Repas offerts

**Offert** enregistre la commande avec ses vrais prix, mais **hors chiffre
d'affaires** : le stock est décrémenté et la cuisine voit le plat à sortir.
L'offert n'entre ni dans le CA, ni dans le panier moyen, ni dans la clôture de
caisse. Les Stats affichent une tuile **Offert** (montant et nombre d'articles).

### Carte vide / aucune soirée

- « Aucune soirée active » : un responsable doit activer une soirée (Soirées).
- « Carte vide pour cette soirée » : ajouter des produits via Soirées → Carte.

---

## 5. Cuisine

1. La station est choisie au démarrage (retenue sur la tablette).
2. Chaque carte affiche **Vendu / Préparé / À faire**. Le grand chiffre est ce
   qu'il reste à produire ; il monte tout seul à chaque encaissement.
3. Après chaque sortie : **+1 / +5 / +10**. Mauvais bouton → **Annuler** dans le
   message.

À savoir :

- **Les accompagnements inclus comptent** : 3 « Burger Frites » vendus = 3
  barquettes de frites de plus à la Friteuse, avec la mention « dont 3 en menu ».
- Les produits sans aucune vente sont regroupés sous **« Voir tous les produits
  du poste »**, pour préparer en avance.
- **« Épuisé vers 21h40 »** : au rythme des 20 dernières minutes, le produit va
  manquer. S'affiche à moins d'une heure de la rupture, en rouge sous 20 minutes,
  et jamais en tout début de service (moins de 5 minutes de ventes) ni pour un
  stock illimité. C'est le signal pour lancer une fournée.

---

## 6. Stock

Une ligne par produit de la carte : stock initial, vendu, restant, et la
prévision de rupture. Trois actions :

| Bouton | Usage | Saisie |
|---|---|---|
| **Réappro** | On sort un carton de la réserve. | Le nombre **ajouté**, pas le nouveau total. |
| **Perte** | Tombé, brûlé, jeté. | Le nombre perdu. Explique les écarts de fin de soirée. |
| **Recompter** | Vérifier le stock réel. | Ce qu'il reste **vraiment** ; l'app enregistre l'écart comme une correction. |

Les produits en **∞ stock illimité** n'ont ni compteur, ni alerte, ni boutons de
réappro : ils restent comptés dans les ventes, les stats et la cuisine.

---

## 7. Réservations

Pour les repas à tarif par personne (raclette, paella…). Trois onglets :
**Accueil** (toutes les caisses), **Suivi**, **Gestion** (PIN).

### Préparer (responsable)

1. **Soirées → Nouvelle soirée**, cocher **Sur réservation** et saisir les tarifs
   adulte / enfant. D'autres tarifs (Étudiant…) s'ajoutent ensuite dans
   **Réservations → Gestion → Ajouter un tarif**.
2. **Gestion → Importer un CSV** (aperçu avant validation, doublons détectés —
   détail dans [import-reservations.md](import-reservations.md)), ou **Ajouter**
   une à une : nom, personnes par tarif, téléphone, remarque, *payé d'avance*.
3. Juste avant l'ouverture : **Imprimer la liste** (liste papier de secours, une
   case à cocher par réservation).

Si la soirée a aussi des produits à la carte (boissons, desserts), la Caisse
reste disponible à côté.

### À l'accueil

1. **Rechercher** : quelques lettres du nom (fautes et accents tolérés) ou au
   moins 3 chiffres du téléphone.
2. Toucher la réservation. Lire la **remarque en jaune** (table, allergie).
   Ajuster le nombre de personnes par tarif si besoin, le montant suit.
3. Encaisser (espèces, carte, chèque, offert). La ligne passe **Arrivé** sur
   toutes les tablettes.
4. **Payé d'avance** : rien à encaisser, **Marquer arrivé**. S'ils sont plus
   nombreux, ajouter les personnes : seul le supplément est encaissé.
5. **Sans réservation** : **Encaisser en sur place** (nom facultatif).

**Erreur de pointage** : toucher la ligne → **Annuler l'arrivée**. La tablette qui
a pointé peut le faire seule pendant **10 minutes** ; ensuite, il faut le PIN.

**Deux caisses sur la même réservation** (souvent hors ligne) : la première
arrivée au serveur compte. L'autre tablette affiche un message et demande si de
l'argent a été reçu : si oui (c'étaient d'autres personnes), il est gardé en
sur-place.

### Suivi et bilan

- **Suivi** : arrivés (dont sur place), couverts restants, réservations
  arrivées, encaissé ce soir, répartition par tarif, par moyen de paiement et par
  caisse.
- **Gestion → Exporter le bilan** : un CSV avec une ligne par réservation (prévus
  / venus par tarif, statut, montants, paiement, caisse, heure).
- **Gestion → Vider la liste** : supprime les réservations non arrivées (pour
  réimporter une liste corrigée). Les arrivées sont conservées.

---

## 8. Journal (PIN)

Toutes les ventes, les plus récentes en premier. Filtres : soirée, moyen de
paiement, statut (payées / annulées), recherche.

Toucher une vente ouvre le **ticket** :

- **Modifier** : changer les quantités, ajouter des produits, changer le moyen de
  paiement (y compris passer en **Offert**, ou l'inverse).
- **Annuler la vente** : avec confirmation.

Rien n'est jamais effacé en silence : une vente modifiée ou annulée reste visible
et marquée comme telle.

---

## 9. Statistiques et clôture de caisse (PIN)

Choisir la portée en haut : une soirée ou **Toutes soirées** (les soirées
d'entraînement en sont exclues).

- **Tuiles** : chiffre d'affaires (avec l'écart au service précédent, ex.
  « +18 % vs 14 juin »), commandes, panier moyen, articles vendus, offert.
- **Graphiques** : évolution du CA, affluence par heure, moyens de paiement, top
  produits, comparaison entre soirées.
- **Export CSV** des ventes, et bouton **Récapitulatif**.

### Clôture de caisse (rapport Z)

| | |
|---|---|
| **Fond de caisse** | la monnaie déposée dans le poste **avant** le service |
| **Attendu** | fond + espèces encaissées |
| **Compté** | ce qu'on trouve dans la boîte en fin de service |
| **Écart** | compté − attendu. Négatif = il manque |

- **Fond de caisse** (en début de service) et **Compter** (en fin) ouvrent le
  même formulaire « Faire la caisse ». Laisser un champ vide pour ne pas y
  toucher ; un recomptage **remplace** le précédent. Une note est possible
  (« un billet de 20 manquant »).
- Carte et chèques n'entrent pas dans l'attendu : ils ne sont pas en espèces
  dans la boîte. Les **payés d'avance** non plus.
- Un poste non compté affiche `—`, jamais `0,00 €`. L'écart total ne porte que
  sur les postes comptés.

---

## 10. Récapitulatif imprimable (PIN)

**Stats → Récapitulatif**, ou **Soirées → Récap** sur une soirée. Une page :
chiffres clés, moyens de paiement, caisses (fond, compté, écart), produits
vendus, offerts, pertes et annulations. **Imprimer / PDF** → choisir une
imprimante ou « Enregistrer au format PDF » pour le trésorier.

Le récapitulatif reflète ce que *cette* tablette a reçu : vérifier que tous les
postes sont « En ligne » avant de l'imprimer.

---

## 11. Soirées (PIN)

### Créer une soirée

**Nouvelle soirée** : nom, date, et **Partir de** :

- **Carte vide** ;
- un **modèle** (carte enregistrée) ;
- **copier une soirée** existante (sa carte, sans ses ventes).

Options : **Soirée d'entraînement**, **Sur réservation** (avec tarifs).
**Créer et activer** bascule immédiatement toutes les caisses dessus.

### Régler la carte

Bouton **Carte** sur une soirée : cocher les produits en vente et, pour chacun,
le **stock initial**, **∞ illimité**, et un **prix propre à la soirée** (vide =
prix catalogue). **Enregistrer comme modèle** garde cette carte pour la
réutiliser.

### Cycle de vie

| Bouton | Effet |
|---|---|
| **Activer** | Toutes les caisses, la cuisine et le stock basculent sur cette soirée (confirmation si une autre est en cours). |
| **Clôturer** | La soirée n'est plus active ; ses ventes sont conservées. |
| **Récap** | Ouvre son récapitulatif. |
| **🗑 Supprimer** | Sans commande : simple confirmation. Avec commandes : il faut retaper son nom, et ses ventes disparaissent des stats. Irréversible. |

### Soirée d'entraînement

Pour former les bénévoles : tout fonctionne exactement comme une vraie soirée,
mais ses ventes sont exclues des totaux « toutes soirées » et de la comparaison
avec le service précédent. Bandeau orange sur tous les postes, badge
**Entraînement** dans la liste.

⚠️ **Activer la vraie soirée avant le service** : une vente réelle encaissée
sur une soirée d'entraînement ne sera pas dans les comptes. Les ventes
d'entraînement restent dans le miroir Google Sheet et les dumps (journaux
d'audit).

---

## 12. Admin (PIN)

### Produits

**Nouveau produit** ou toucher un produit existant :

- **Nom, prix, catégorie** (onglet de la caisse), **station cuisine**.
- **Stock initial** : valeur *proposée* quand le produit est ajouté à une carte.
  Le stock d'une soirée en cours se règle dans Soirées → Carte ou dans Stock.
- **Stock illimité** : pour ce qu'on ne compte pas.
- **Contient** : composants d'un plat composé (« Burger Frites » contient
  1 « Frites »). Un seul niveau est développé.
- **Visuel** : une icône de la bibliothèque, un caractère libre (emoji), ou une
  **image** (Photo : recadrée et compressée ; Icône ou logo : fond transparent).
  La taille dans la tuile se règle après coup. L'envoi d'image demande d'être
  connecté.
- **Couleur du ticket** : repère visuel de la tuile.
- **Visible en caisse** : décocher pour masquer un produit sans le supprimer.

**Ordre des catégories** : l'ordre des onglets en haut de la caisse.

### Stations cuisine

Créer « Grill », « Friteuse », « Froid & desserts »… puis rattacher chaque
produit à une station.

### Remise à zéro

En tête : **Postes connectés** (rôle, depuis quand, **ventes en attente** de
chacun) et **Stockage de cette tablette**.

| Bouton | Efface | Conserve |
|---|---|---|
| **Effacer les ventes** | commandes, mouvements de stock, préparations | la carte (produits, stations) |
| **Tout effacer** | tout, y compris produits, stations et images | rien |
| **Vider le cache local** | seulement les données de *cette* tablette | le serveur et les autres postes |

Confirmation par saisie (`EFFACER` / `TOUT EFFACER`), puis tous les postes se
rechargent seuls. Une remise à zéro est définitive dans l'app ; les dumps et le
Google Sheet gardent la trace. Récupérer les stats **avant**.

#### Stockage de la tablette

- **Persistant** : le navigateur ne peut pas effacer les ventes hors ligne.
- **Non garanti** : installer l'app sur l'écran d'accueil puis revenir (iOS 17+
  et Chrome l'accordent aux apps installées).

---

## 13. Réseau coupé et ventes en attente

**Continuer à encaisser normalement.** Les ventes sont gardées sur la tablette et
envoyées dès le retour du réseau, sans doublon.

- Tant que l'indicateur n'est pas revenu à **En ligne**, ces ventes n'existent
  que sur cette tablette : **ne pas l'éteindre, ne pas vider le cache**.
- Le stock affiché ne tient pas compte des ventes des autres caisses hors ligne :
  deux caisses peuvent vendre la dernière unité.
- Les réservations encaissées hors ligne sont vérifiées au retour du réseau
  (voir [conflit](#à-laccueil)).

### L'app refuse de détruire des ventes non transmises

Si une purge (vider le cache, remise à zéro depuis un autre poste, reconnexion à
un serveur réinitialisé) toucherait des ventes en attente, un écran bloquant
propose :

- **Réessayer la synchro** (seulement pour une purge demandée sur ce poste) ;
- **Télécharger puis effacer** : un fichier JSON des ventes, rejouable. À garder
  si la soirée comptait ;
- **Annuler** : rien n'est détruit, la caisse continue.

---

## 14. Qui peut faire quoi

Le serveur vérifie le PIN : ce n'est pas qu'une question d'onglets visibles.

| Action | Code d'accès seul | Avec PIN |
|---|---|---|
| Vendre, pointer une réservation | ✅ | ✅ |
| Réappro, perte, recomptage | ✅ | ✅ |
| Marquer préparé (cuisine) | ✅ | ✅ |
| Annuler sa propre arrivée de réservation (< 10 min) | ✅ | ✅ |
| Annuler / modifier une vente | — | ✅ |
| Fond de caisse, comptage | — | ✅ |
| Soirées, carte, modèles, réservations (gestion) | — | ✅ |
| Produits, stations, images, remise à zéro | — | ✅ |
| Stats, récapitulatif, journal | — | ✅ |

---

## 15. Déroulé type d'une soirée

**La veille / avant l'ouverture (responsable)**

1. Soirées → **Nouvelle soirée** à partir d'un modèle ou d'une soirée passée.
2. **Carte** : vérifier prix et stocks.
3. Optionnel : une **soirée d'entraînement** pour les nouveaux, puis **activer la
   vraie soirée**.
4. Soirée sur réservation : importer la liste, puis **Imprimer la liste**.
5. Démarrer chaque tablette (un nom de caisse différent par caisse), les brancher.
6. Stats → **Fond de caisse** pour chaque caisse.

**Pendant le service**

- Caisses : encaisser. Cuisine : +1 / +5 / +10. Stock : réappro et pertes.
- Surveiller les « Épuisé vers… ».

**En fin de service**

1. Vérifier que tous les postes sont **En ligne** (Admin → Remise à zéro → Postes
   connectés).
2. Stats → **Compter** chaque caisse.
3. **Récapitulatif** → Imprimer / PDF ; export CSV si besoin.
4. Soirées → **Clôturer**.

---

## 16. Dépannage

| Problème | Solution |
|---|---|
| Retour à l'écran de code d'accès | Le code ou le PIN a changé : ressaisir. Les ventes en attente sont conservées. |
| « Code d'accès invalide » à répétition | Attendre une minute : 10 essais maximum par minute. |
| Pas de station proposée en Cuisine | Créer les stations dans Admin → Stations cuisine. |
| « Aucune soirée active » | Soirées → Activer (PIN). |
| Carte vide | Soirées → Carte de la soirée active. |
| L'app n'a pas la nouvelle version | Recharger la page, ou fermer et rouvrir l'app. |
| « N bloqués » qui ne diminue pas | Recharger l'app ; si ça persiste, Admin → Postes connectés pour voir ce qui est retenu. Ne pas vider le cache. |
| Bandeau « Une autre tablette est aussi Caisse N » | Changer de poste et choisir un autre numéro. |
| Stockage « Non garanti » | Installer l'app sur l'écran d'accueil. |
| Réservation « déjà encaissée par une autre caisse » | Répondre au message : si de l'argent a été reçu, il est gardé en sur-place. |
