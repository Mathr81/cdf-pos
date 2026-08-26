# 🍔 CDF POS — Caisse & cuisine pour comité des fêtes

Application web / **PWA** (installable sur iPad, téléphone, ordinateur) pour gérer
la vente de repas lors d'un événement :

- **Caisse** (plusieurs postes en simultané) : composer une commande, calculer le
  total, encaisser (espèces avec **rendu monnaie**, ou carte), voir le **stock** en direct.
- **Cuisine** (plusieurs postes) : chaque station voit **Vendu / Préparé / Reste à faire**
  en temps réel pour savoir quoi produire — y compris les accompagnements
  **inclus dans les plats** (un « Burger Frites » vendu = une barquette de frites à sortir).
- **Inventaire** : stock initial, restant, réappro/pertes, alertes stock bas, et
  **stock illimité** pour ce qu'on ne compte pas (frites au sac, sirop…).
- **Statistiques** : chiffre d'affaires, panier moyen, affluence par heure, top produits,
  répartition par caisse et moyen de paiement.

Le tout **temps réel** entre tous les appareils, **offline-first** (les caisses
continuent d'encaisser même sans réseau, puis se resynchronisent), avec
**sauvegarde continue** (miroir Google Sheet + dumps PostgreSQL).

---

## 🏗️ Architecture

| Couche | Techno |
|---|---|
| Frontend | React + Vite + TypeScript, Tailwind CSS, PWA (service worker), Recharts |
| Temps réel / offline | Socket.IO + IndexedDB (Dexie) : outbox + projection locale |
| Backend | Node + Fastify + Socket.IO |
| Base de données | PostgreSQL + Prisma |
| Sauvegarde | Google Sheets API (miroir) + `pg_dump` (dumps) |
| Déploiement | Docker Compose + Nginx (derrière Nginx Proxy Manager pour le TLS) |

**Principe central — event-sourcing léger.** Chaque action (vente, ajustement de
stock, préparation…) est un **événement immuable** identifié par un UUID généré
côté client. Ce journal est à la fois la source de vérité pour la synchro
multi-appareils (idempotence par `id`), la piste d'audit pour les stats, et ce qui
est sauvegardé. Voir `packages/shared/src/events.ts` et `projection.ts`.

```
apps/
  web/       PWA React (caisse, cuisine, inventaire, stats, admin)
  server/    Fastify + Socket.IO + Prisma
packages/
  shared/    Types + schémas d'événements (zod) + réducteur de projection + stats
docker/      Dockerfiles, docker-compose, nginx.conf, backup-cron
```

---

## 🚀 Développement local

**Prérequis :** Node ≥ 20, pnpm ≥ 10, et un PostgreSQL accessible (local ou Docker).

```bash
# 1. Dépendances
pnpm install

# 2. Configuration
cp .env.example .env        # puis éditez DATABASE_URL, APP_ACCESS_CODE, ADMIN_PIN…

# 3. Base de données (migrations + carte du soir)
pnpm db:migrate             # crée les tables
pnpm db:seed                # charge la carte du soir (voir prisma/menu.ts)

# 4. Lancer serveur + web en parallèle
pnpm dev
```

- Web : http://localhost:5173 (proxy `/api` et `/socket.io` vers le serveur)
- API : http://localhost:3001

Au lancement, l'app demande le **code d'accès** (`APP_ACCESS_CODE`). Pour accéder à
**Admin / Stats**, renseignez aussi le **PIN admin** (`ADMIN_PIN`).

### Commandes utiles

```bash
pnpm typecheck       # vérifie tous les packages
pnpm build           # build shared + server + web
pnpm db:migrate      # nouvelle migration en dev
pnpm db:seed         # (re)charge la carte — `-- --force` pour écraser l'existante
pnpm db:reset        # efface les ventes — `-- --all` pour tout effacer
```

---

## 🖥️ Déploiement sur VPS (Docker + Nginx Proxy Manager)

Le domaine et le TLS sont gérés par **Nginx Proxy Manager (NPM)**, déjà en place sur
ton VPS. La stack expose simplement le conteneur `web` (nginx) sur un port hôte ;
NPM proxifie le domaine vers ce port.

1. **Configuration** : sur le VPS, clone le repo, puis :

   ```bash
   cp .env.example .env
   ```

   Édite au minimum : `WEB_PORT` (port exposé, défaut `8080`), `PUBLIC_ORIGIN`
   (l'URL publique finale, ex. `https://pos.mondomaine.fr`), `POSTGRES_PASSWORD`,
   `APP_ACCESS_CODE`, `ADMIN_PIN`.
   Mets `SEED_ON_START=true` pour charger la carte du soir au 1er lancement
   (voir [La carte](#-la-carte)) ; sans effet si des produits existent déjà.

2. **Lancement** :

   ```bash
   cd docker
   docker compose --env-file ../.env up -d --build
   ```

   Le conteneur serveur applique automatiquement les migrations Prisma au démarrage.
   Le conteneur `web` écoute sur `http://<ip-vps>:${WEB_PORT}` (défaut 8080).

3. **Nginx Proxy Manager** — crée un *Proxy Host* :
   - **Domain Names** : `pos.mondomaine.fr`
   - **Forward Hostname/IP** : l'IP du VPS (ou le nom du conteneur `web` si NPM
     partage le réseau Docker de la stack)
   - **Forward Port** : `8080` (= `WEB_PORT`)
   - ✅ **Websockets Support** (indispensable pour le temps réel Socket.IO)
   - onglet **SSL** : demande un certificat Let's Encrypt + *Force SSL*

   Assure-toi que `PUBLIC_ORIGIN` dans `.env` correspond exactement à ce domaine
   (`https://…`), sinon le WebSocket sera bloqué (CORS).

4. Ouvre `https://pos.mondomaine.fr` → **Ajouter à l'écran d'accueil** sur iPad/mobile
   pour l'installer comme application.

> 💡 Le WebSocket traverse deux proxys (NPM → nginx interne → serveur) : les deux
> gèrent l'`upgrade`. Vérifie juste que « Websockets Support » est coché côté NPM.

### Mise à jour

Un `git pull` seul **ne suffit pas** : il récupère les sources, mais les conteneurs
tournent sur des images déjà construites. Il faut donc reconstruire :

```bash
cd /chemin/vers/cdf-pos
./scripts/update.sh
```

Le script fait exactement ceci — tu peux aussi le taper à la main :

```bash
git pull                                              # 1. récupérer le code
cd docker
docker compose --env-file ../.env up -d --build       # 2. rebuild + redémarrage
```

- Les **migrations Prisma** sont appliquées automatiquement au démarrage du
  conteneur serveur : rien à lancer de plus.
- **Aucune donnée n'est perdue** : le volume PostgreSQL survit à la mise à jour.
- Sur les tablettes, l'application étant une **PWA**, recharge la page (ou ferme et
  rouvre l'app) pour récupérer la nouvelle version — le service worker se met à jour
  tout seul en quelques secondes.

En développement local (sans Docker), l'équivalent est :

```bash
git pull
pnpm install        # si des dépendances ont changé
pnpm db:migrate     # si le schéma a changé
pnpm dev
```

---

## 🔄 Remise à zéro

Après une soirée de test, ou pour repartir d'une base vierge avant le service.

> ℹ️ Vider la base du serveur ne suffit pas : chaque tablette garde une copie du
> journal d'événements dans son navigateur. C'est pourquoi le serveur gère un
> **`epoch`** — un identifiant de « session de données ». Une remise à zéro en
> génère un nouveau, et chaque appareil qui le découvre **purge son cache local
> et se recharge automatiquement**. Rien à faire sur les tablettes.

### Depuis l'application (le plus simple)

**Admin → Remise à zéro** (PIN admin requis). Trois options :

| Bouton | Efface | Conserve |
|---|---|---|
| **Effacer les ventes** | commandes, mouvements de stock, préparations | **la carte** (produits, stations) |
| **Tout effacer** | tout, y compris produits et stations | rien — l'app repart vide |
| **Vider le cache local** | seulement les données de *cette* tablette | le serveur et les autres postes |

Une confirmation par saisie (`EFFACER` / `TOUT EFFACER`) est demandée, puis tous les
postes connectés se rechargent.

**Pour ton cas** (mode démo testé, tu veux tout ressaisir) : **Tout effacer**, puis
recrée stations et produits dans Admin. Si tu préfères repartir de la carte du soir
plutôt que d'une page blanche, fais **Tout effacer** puis relance le seed :

```bash
cd docker && docker compose exec server pnpm run db:seed
```

### En ligne de commande

Utile si l'écran admin est inaccessible.

```bash
# Sur le VPS (Docker)
cd docker
docker compose exec server pnpm run db:reset             # efface les ventes
docker compose exec server pnpm run db:reset -- --all    # efface tout

# En dev local
pnpm db:reset
pnpm db:reset -- --all
```

Puis recharger la carte si besoin :

```bash
docker compose exec server pnpm run db:seed              # ne fait rien si des produits existent
docker compose exec server pnpm run db:seed -- --force   # réapplique la carte par-dessus
```

> ⚠️ Une remise à zéro est **définitive** côté application. Les dumps PostgreSQL
> (`./backups/`) et le miroir Google Sheet, eux, gardent la trace de ce qui a été
> effacé — pense à récupérer les stats **avant** si la soirée comptait.

### Ventes non synchronisées : l'app refuse de les détruire

Une tablette hors ligne détient des ventes qui n'existent **nulle part ailleurs**.
Aucune purge ne peut donc les effacer en silence : les trois chemins possibles
(bouton admin, remise à zéro lancée depuis un autre poste, reconnexion à un
serveur déjà réinitialisé) s'arrêtent et affichent un écran bloquant.

Cet écran propose :

- **Réessayer la synchro** — seulement pour une purge demandée sur ce poste. Après
  une remise à zéro, ce bouton n'apparaît pas : repousser ces ventes les ferait
  réapparaître dans une base que l'admin vient justement de vider.
- **Télécharger puis effacer** — écrit un fichier JSON des ventes en attente, puis
  purge. Le fichier contient les événements bruts du journal : illisible tel quel,
  mais **rejouable**. Garde-le si la soirée comptait.
- **Annuler** — referme l'écran sans rien détruire. La caisse continue de
  fonctionner ; l'indicateur d'en-tête garde le compte des ventes en attente.

Il reste donc préférable de vérifier que tous les postes sont « En ligne » avant un
reset — simplement, l'oublier ne coûte plus les ventes.

---

## 💾 Sauvegarde & restauration

### Miroir Google Sheet (secours lisible en temps réel)

Chaque vente est ajoutée en **nouvelle ligne** d'un Google Sheet — si la prod tombe,
vous gardez un journal lisible des ventes.

#### Où récupérer le fichier JSON du compte Google

Le fichier attendu est la **clé d'un compte de service** Google Cloud. Ce n'est pas
ton compte Gmail personnel : c'est un « robot » à qui tu donnes accès au tableur.
C'est gratuit, et l'API Sheets est incluse dans le quota gratuit.

1. Va sur **[console.cloud.google.com](https://console.cloud.google.com)** et
   connecte-toi avec ton compte Google.
2. En haut à gauche, ouvre le sélecteur de projet → **Nouveau projet**. Nomme-le
   par exemple `cdf-pos`, puis **Créer**. Vérifie qu'il est bien sélectionné.
3. Menu ☰ → **API et services** → **Bibliothèque**. Cherche **Google Sheets API**,
   ouvre-la et clique **Activer**.
4. Menu ☰ → **API et services** → **Identifiants** → **+ Créer des identifiants** →
   **Compte de service**.
   - Nom : `cdf-pos-backup` → **Créer et continuer**.
   - Rôle : tu peux laisser vide (les droits viendront du partage du tableur) →
     **Continuer** → **OK**.
5. Dans la liste **Comptes de service**, clique sur celui que tu viens de créer,
   onglet **Clés** → **Ajouter une clé** → **Créer une clé** → format **JSON** →
   **Créer**. Le fichier `.json` se télécharge **immédiatement** (c'est la seule
   fois où Google te le donne — s'il est perdu, il faut créer une nouvelle clé).
6. Renomme-le et dépose-le sur le VPS dans le dossier `secrets/` du projet :

   ```bash
   # depuis ton ordinateur
   scp ~/Téléchargements/cdf-pos-xxxxx.json \
       user@mon-vps:/chemin/vers/cdf-pos/secrets/google-service-account.json
   ```

   Le chemin exact attendu est **`secrets/google-service-account.json`** (déjà
   monté en lecture seule dans le conteneur serveur, et ignoré par git).

7. Ouvre le fichier et repère la ligne `"client_email"` : c'est une adresse du type
   `cdf-pos-backup@cdf-pos.iam.gserviceaccount.com`.
8. Crée un **Google Sheet** vierge, clique **Partager**, colle cette adresse et
   donne-lui le rôle **Éditeur**. **Sans cette étape, rien ne s'écrira** (erreur 403).
9. Récupère l'**ID du tableur** dans son URL :
   `https://docs.google.com/spreadsheets/d/`**`1AbC…xyz`**`/edit` → l'ID est la
   partie en gras.
10. Dans `.env` :

    ```bash
    BACKUP_SHEETS_ENABLED=true
    BACKUP_SHEETS_ID=1AbC…xyz
    ```

11. Redémarre : `cd docker && docker compose --env-file ../.env up -d`.

Vérifie que ça marche : encaisse une vente de test, puis regarde le tableur — une
ligne doit apparaître en quelques secondes. Sinon, `docker compose logs -f server`
affiche l'erreur (`[backup] …`).

> 🔒 Ce fichier JSON est un **secret** : il donne accès aux documents partagés avec
> ce compte. Ne le commite jamais (`secrets/` est déjà dans `.gitignore`).

Le worker gère une **file de retry** : si l'API Google est momentanément
indisponible, les ventes sont renvoyées automatiquement au tick suivant.

### Dumps PostgreSQL (restauration propre)

Le conteneur `backup-cron` écrit un dump compressé toutes les `BACKUP_INTERVAL`
secondes dans `./backups/` (rétention : `BACKUP_KEEP` fichiers).

Restaurer un dump :

```bash
# Copier le dump dans le conteneur postgres puis restaurer
docker compose cp ../backups/cdfpos-YYYYMMDD-HHMMSS.dump postgres:/tmp/restore.dump
docker compose exec postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean /tmp/restore.dump
```

> 💡 Le journal d'événements permet aussi de **reconstruire** les projections
> (commandes, stock) si nécessaire.

---

## 🍽️ La carte

La carte de départ est décrite dans **`apps/server/prisma/menu.ts`** et chargée par
`pnpm db:seed`. Tout reste modifiable ensuite dans **Admin → Produits** : le seed
n'est là que pour éviter de tout saisir à la main la première fois.

| Produit | Prix | Catégorie | Station | Stock |
|---|---|---|---|---|
| Oignon ring's | 3,00 € | Entrées | Friteuse | 60 |
| Camembert braisé | 5,00 € | Entrées | Grill | 30 |
| Salade fraîcheur | 3,00 € | Entrées | Froid & desserts | 30 |
| Frites | 3,00 € | Accompagnements | Friteuse | **∞ illimité** |
| Saucisse Frites | 6,00 € | Plats | Grill | 80 · *contient 1 Frites* |
| Poulet Tandoori Frites | 8,00 € | Plats | Grill | 60 · *contient 1 Frites* |
| Burger Frites | 8,00 € | Plats | Grill | 80 · *contient 1 Frites* |
| Glaces | 2,00 € | Desserts | Froid & desserts | 80 |
| Panna Cotta | 3,00 € | Desserts | Froid & desserts | 40 |
| Mr Freeze | 1,00 € | Desserts | Froid & desserts | 150 |

> ⚠️ **Les prix et les quantités sont des valeurs par défaut** — vérifie-les dans
> Admin → Produits avant le service.

### Stock illimité

Coche **« Stock illimité »** dans la fiche produit pour tout ce dont on ne suit pas
le stock à l'unité — typiquement les **frites**, qui sortent d'un sac et dont les
barquettes sont remplies à la louche.

Un produit en stock illimité :

- affiche `∞` en caisse au lieu d'un compteur, et n'est **jamais marqué « épuisé »** ;
- n'apparaît pas dans les alertes de stock bas et n'a pas de boutons réappro/perte ;
- reste **compté normalement** dans les ventes, les stats et le « reste à préparer »
  de la cuisine.

### Plats composés (« … Frites »)

Un produit peut **contenir** d'autres produits : dans la fiche de « Burger Frites »,
la section **Contient** indique `1× Frites`.

Concrètement, quand une caisse vend 3 « Burger Frites » :

- le poste **Friteuse** voit **3 barquettes de plus** à préparer, même si personne
  n'a acheté de frites seules (l'écran précise « dont 3 inclus dans un plat ») ;
- le **stock** du composant est décrémenté d'autant — sans effet ici puisque les
  frites sont en illimité, mais utile pour un ingrédient qu'on compte (pains,
  barquettes…).

Un seul niveau de composition est développé : un composant n'est pas lui-même
décomposé.

---

## 📱 Utilisation

- **Caisse** : touchez les produits pour les ajouter au panier, ajustez les quantités,
  puis **Encaisser** → espèces (avec calcul du rendu) ou carte.
- **Cuisine** : sélectionnez votre poste ; les compteurs **Reste à faire** se mettent
  à jour en direct. Marquez les articles préparés avec `+1 / +5 / +10`.
- **Inventaire** : réapprovisionnez ou déclarez des pertes ; le stock restant est
  recalculé partout.
- **Admin** (PIN requis) : créez/modifiez produits & stations cuisine, et **remise à zéro**.
- **Stats** (PIN requis) : tableau de bord live (fonctionne aussi hors-ligne).

### Comportement hors-ligne

Si le réseau tombe, les caisses **continuent de fonctionner** (les ventes sont
stockées localement). L'indicateur passe « Hors ligne · N en attente ». Dès le
retour du réseau, tout se **resynchronise** automatiquement, sans doublon
(idempotence par UUID).

Ces ventes en attente sont protégées : voir
[Ventes non synchronisées](#ventes-non-synchronisées--lapp-refuse-de-les-détruire).

### Écran et stockage

- **L'écran ne s'éteint pas** pendant le service (Screen Wake Lock), sur tous les
  écrans de l'app. Le verrou est repris automatiquement après un passage en
  arrière-plan. Branche quand même les tablettes : un écran allumé toute la soirée
  vide une batterie.
- **Stockage persistant** demandé au démarrage, pour que le navigateur ne puisse pas
  évincer les ventes hors ligne s'il manque d'espace. Le statut réel de chaque
  tablette est affiché dans **Admin → Remise à zéro → Stockage de cette tablette**.
  S'il indique « Non garanti », installe l'app sur l'écran d'accueil puis reviens :
  iOS 17+ et Chrome accordent la permission aux apps installées.

---

## 🔐 Sécurité

- **Code d'accès** partagé (`APP_ACCESS_CODE`) demandé au lancement — évite que
  n'importe qui sur le domaine utilise la caisse.
- **PIN admin** (`ADMIN_PIN`) pour l'administration et les statistiques.
- Changez impérativement `POSTGRES_PASSWORD`, `APP_ACCESS_CODE` et `ADMIN_PIN`
  avant la mise en production.
- La route de vérification `/api/auth/check` est **limitée à 10 tentatives par
  minute et par IP** : sans cela, un code d'accès court se devine par force brute.

> ℹ️ Le modèle est volontairement simple : un secret partagé entre bénévoles,
> pas de comptes individuels ni de sessions signées. Il protège d'un passant qui
> tomberait sur le domaine, pas d'un attaquant déterminé — et il n'a jamais
> prétendu faire mieux.
