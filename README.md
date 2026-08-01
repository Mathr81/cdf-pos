# 🍔 CDF POS — Caisse & cuisine pour comité des fêtes

Application web / **PWA** (installable sur iPad, téléphone, ordinateur) pour gérer
la vente de repas lors d'un événement :

- **Caisse** (plusieurs postes en simultané) : composer une commande, calculer le
  total, encaisser (espèces avec **rendu monnaie**, ou carte), voir le **stock** en direct.
- **Cuisine** (plusieurs postes) : chaque station voit **Vendu / Préparé / Reste à faire**
  en temps réel pour savoir quoi produire.
- **Inventaire** : stock initial, restant, réappro/pertes, alertes stock bas.
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

# 3. Base de données (migrations + données de démo)
pnpm db:migrate             # crée les tables
pnpm db:seed                # produits & stations d'exemple (optionnel)

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
   `APP_ACCESS_CODE`, `ADMIN_PIN`, `JWT_SECRET`.
   Mets `SEED_ON_START=true` pour peupler des produits de démo au 1er lancement
   (repasse-le à `false` ensuite).

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

```bash
git pull
cd docker && docker compose --env-file ../.env up -d --build
```

---

## 💾 Sauvegarde & restauration

### Miroir Google Sheet (secours lisible en temps réel)

Chaque vente est ajoutée en **nouvelle ligne** d'un Google Sheet — si la prod tombe,
vous gardez un journal lisible des ventes.

1. Dans **Google Cloud Console** : créez un projet, activez **Google Sheets API**,
   créez un **compte de service** et téléchargez sa clé **JSON**.
2. Placez ce fichier dans `secrets/google-service-account.json`.
3. Créez un Google Sheet, récupérez son **ID** (dans l'URL
   `/spreadsheets/d/<ID>/edit`), et **partagez-le en éditeur** avec l'adresse email
   du compte de service (`...@...iam.gserviceaccount.com`).
4. Dans `.env` : `BACKUP_SHEETS_ENABLED=true` et `BACKUP_SHEETS_ID=<ID>`.
5. Redémarrez : `docker compose --env-file ../.env up -d`.

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

## 📱 Utilisation

- **Caisse** : touchez les produits pour les ajouter au panier, ajustez les quantités,
  puis **Encaisser** → espèces (avec calcul du rendu) ou carte.
- **Cuisine** : sélectionnez votre poste ; les compteurs **Reste à faire** se mettent
  à jour en direct. Marquez les articles préparés avec `+1 / +5 / +10`.
- **Inventaire** : réapprovisionnez ou déclarez des pertes ; le stock restant est
  recalculé partout.
- **Admin** (PIN requis) : créez/modifiez produits & stations cuisine.
- **Stats** (PIN requis) : tableau de bord live (fonctionne aussi hors-ligne).

### Comportement hors-ligne

Si le réseau tombe, les caisses **continuent de fonctionner** (les ventes sont
stockées localement). L'indicateur passe « Hors ligne · N en attente ». Dès le
retour du réseau, tout se **resynchronise** automatiquement, sans doublon
(idempotence par UUID).

---

## 🔐 Sécurité

- **Code d'accès** partagé (`APP_ACCESS_CODE`) demandé au lancement — évite que
  n'importe qui sur le domaine utilise la caisse.
- **PIN admin** (`ADMIN_PIN`) pour l'administration et les statistiques.
- Changez impérativement `JWT_SECRET`, `POSTGRES_PASSWORD`, `APP_ACCESS_CODE` et
  `ADMIN_PIN` avant la mise en production.
