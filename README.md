# Gestion de tickets — TP Mise en production & Hébergement (YNOV)

> TP Mise en production & Hébergement — 19 novembre 2026

Application web permettant de déclarer un incident informatique, de consulter les tickets existants et de suivre leur résolution.

**Équipe :**

| Nom | Contribution |
|-----|--------------|
| Loïc SERVAJEAN | Mise en ligne |
| Nicolas CAILLOL | Documentation |
| Theodore NAJMAN | Dev |

## Liens utiles

| Élément | URL |
|---------|-----|
| Frontend | https://frontend-app.osc-fr1.scalingo.io/ |
| API | https://backend-app.osc-fr1.scalingo.io/api/tickets |
| Santé de l'API | https://backend-app.osc-fr1.scalingo.io/health |
| Dépôt GitHub | https://github.com/Loloroark/TP_creation_dapp |

## Architecture trois tiers

```mermaid
flowchart LR
    U[Navigateur] -->|HTTPS| F["Frontend<br/>Scalingo : frontend-app"]
    U -->|"HTTPS (fetch JSON)"| B["Backend API<br/>Scalingo : backend-app"]
    B -->|SQL| D[("PostgreSQL<br/>addon Scalingo")]
    G[GitHub] -.->|"push : redéploiement auto"| F
    G -.->|"push : redéploiement auto"| B
```

| Tier | Technologies | Hébergement |
|------|--------------|-------------|
| Frontend | HTML / CSS / JavaScript natif (sans framework), servi par un petit serveur Node.js 22 + Express 4. L'URL de l'API est transmise au navigateur via `/config.js`. | Scalingo (`frontend-app`) |
| Backend | Node.js 22, Express 4, `pg` (accès PostgreSQL), `cors`, `dotenv` (configuration locale) | Scalingo (`backend-app`) |
| Base de données | PostgreSQL | Addon PostgreSQL Scalingo |
| Code source | Git | GitHub |
| Déploiement | `Procfile` dans chaque dossier, redéploiement automatique à chaque push | GitHub → Scalingo |

## Fonctionnalités

Application complète : affichage, création et changement de statut des tickets, avec persistance en base.

Fonctionnalités facultatives réalisées :

- Supprimer un ticket (les identifiants des tickets restants sont renumérotés)
- Date de création affichée pour chaque ticket

## Modèle de données

Table `tickets`, créée automatiquement au démarrage de l'API (`backend/db/schema.sql`) :

| Champ | Type | Description |
|-------|------|-------------|
| `id` | `SERIAL` (entier auto-incrémenté), clé primaire | Identifiant unique |
| `titre` | `VARCHAR(200)`, obligatoire | Titre du ticket |
| `description` | `TEXT`, vide par défaut | Description de la demande |
| `statut` | `VARCHAR(20)`, `ouvert` par défaut | `ouvert`, `en_cours` ou `resolu` |
| `created_at` | `TIMESTAMP`, `NOW()` par défaut | Date de création |

Les statuts sont contrôlés par l'API **et** par une contrainte `CHECK` en base.

## Structure du dépôt

```
backend/
  server.js         API Express (routes, validation, CORS)
  db/schema.sql     Création de la table tickets
  Procfile          Commande de démarrage pour Scalingo
  .env.example      Modèle de configuration locale
frontend/
  server.js         Serveur des fichiers statiques + /config.js (URL de l'API)
  public/           index.html, app.js, style.css
  Procfile          Commande de démarrage pour Scalingo
```

## Lancer l'application en local

### Prérequis

- [Node.js 22](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (pour la base PostgreSQL), ou un PostgreSQL installé

### 1. Démarrer la base de données

Lancer Docker Desktop, puis (première fois seulement) :

```bash
docker run -d --name tickets-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tickets -p 5432:5432 postgres:16
```

Les fois suivantes :

```bash
docker start tickets-db
```

### 2. Démarrer l'API (terminal 1)

```bash
cd backend
npm install
```

Créer le fichier `backend/.env` à partir du modèle (`cp .env.example .env`, ou en PowerShell `Copy-Item .env.example .env`), puis y mettre :

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/tickets
CORS_ORIGIN=http://localhost:5173
PORT=3000
```

```bash
npm start
```

Le terminal doit afficher `Base de données prête.` puis `API démarrée sur le port 3000`. La table `tickets` est créée automatiquement au démarrage.

### 3. Démarrer le frontend (terminal 2)

```bash
cd frontend
npm install
npm start
```

Ouvrir **http://localhost:5173**.

### 4. Vérifier

| Adresse | Résultat attendu |
|---|---|
| http://localhost:3000/health | `{"status":"ok","database":"ok"}` |
| http://localhost:3000/api/tickets | Liste des tickets en JSON |
| http://localhost:5173 | Interface : créer un ticket, changer son statut |

> `http://localhost:3000/` renvoie `{"error":"Route introuvable."}` : c'est normal, les routes de l'API sont sous `/api/` et `/health`.

### Erreurs fréquentes

| Message | Cause | Solution |
|---|---|---|
| `aucune URL de base de données` | Pas de fichier `backend/.env` | Créer le `.env` (étape 2) |
| `ECONNREFUSED ... 5432` | PostgreSQL ne tourne pas | Lancer Docker Desktop puis `docker start tickets-db` |
| `Impossible de charger les tickets` dans la page | L'API n'est pas lancée, ou mauvais `CORS_ORIGIN` | Vérifier le terminal 1 et la valeur de `CORS_ORIGIN` |

## API

| Méthode | Route | Rôle | Corps de la requête | Codes |
|---|---|---|---|---|
| GET | `/health` | Vérifie l'API et la base | — | 200, 503 |
| GET | `/api/tickets` | Liste des tickets (triés par identifiant croissant) | — | 200 |
| POST | `/api/tickets` | Crée un ticket | `{ "titre": "...", "description": "..." }` | 201, 400 |
| PATCH | `/api/tickets/:id` | Modifie le statut | `{ "statut": "en_cours" }` | 200, 400, 404 |
| DELETE | `/api/tickets/:id` | Supprime le ticket et renumérote les ID | — | 200, 400, 404 |

Toutes les réponses sont au format JSON. Les erreurs renvoient `{ "error": "message" }`.

**Renumérotation des ID :** après une suppression, les ID restent continus. Avec les tickets 1, 2, 3, supprimer le 1 donne 1, 2 (l'ancien 2 devient 1, l'ancien 3 devient 2), et le prochain ticket créé prendra l'ID 3. La suppression et la renumérotation se font dans une seule transaction SQL, avec la table verrouillée pendant l'opération : soit tout réussit, soit rien n'est modifié. Comme un ID peut changer, le frontend recharge la liste après chaque suppression.

Tester l'API en ligne (bash) :

```bash
curl -X POST https://backend-app.osc-fr1.scalingo.io/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"titre": "Imprimante en panne", "description": "Étage 2"}'
```

Tester l'API en local (PowerShell) :

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/tickets -ContentType "application/json" -Body '{"titre":"Test","description":"Depuis PowerShell"}'
Invoke-RestMethod -Method Patch -Uri http://localhost:3000/api/tickets/1 -ContentType "application/json" -Body '{"statut":"en_cours"}'
Invoke-RestMethod -Method Delete -Uri http://localhost:3000/api/tickets/1
```

## Déploiement sur Scalingo

1. Créer deux apps Scalingo liées au dépôt GitHub : `backend-app` et `frontend-app`.
2. **backend-app** :
   - variable `PROJECT_DIR=backend`
   - ajouter l'addon **PostgreSQL** (crée automatiquement `SCALINGO_POSTGRESQL_URL`)
   - variable `CORS_ORIGIN=<URL du frontend>`
3. **frontend-app** :
   - variable `PROJECT_DIR=frontend`
   - variable `API_URL=<URL de l'API>`
4. Activer le déploiement automatique sur la branche `main`.
5. Vérifier les logs de l'API (`Base de données prête.` puis `API démarrée`) et ouvrir `<URL API>/health`.

## Redéploiement automatique (CI/CD)

1. Modifier un élément visible (ex. : `v1` → `v2` dans le pied de page de `frontend/public/index.html`).
2. `git commit` puis `git push` sur la branche liée à Scalingo.
3. Scalingo lance automatiquement un nouveau déploiement (onglet *Deployments*).
4. Vérifier la modification sur l'URL publique du frontend.

**Résultat du test :** _à compléter (commit effectué, déploiement observé, modification visible en ligne)._

## Variables d'environnement

| App | Variable | Rôle |
|---|---|---|
| API | `SCALINGO_POSTGRESQL_URL` | Connexion à la base en production (créée par l'addon) |
| API | `DATABASE_URL` | Connexion à la base en local (fichier `.env`) |
| API | `CORS_ORIGIN` | Origine(s) autorisée(s) à appeler l'API |
| Front | `API_URL` | URL publique de l'API, transmise au navigateur via `/config.js` |
| Les deux | `PORT` | Fourni automatiquement par Scalingo |
| Les deux | `PROJECT_DIR` | Sous-dossier à déployer (`backend` ou `frontend`) |

## Sécurité

- Aucun secret dans le dépôt : `.env` est ignoré par Git, seul `.env.example` (sans vraies valeurs) est versionné.
- Les identifiants de la base ne sont connus que du backend ; le frontend ne connaît que l'URL de l'API.
- Les entrées sont validées par l'API (titre obligatoire de 200 caractères maximum, description de 5000 maximum, statut parmi les trois valeurs, identifiant entier) et les requêtes SQL sont paramétrées.
- CORS limité à l'URL du frontend grâce à `CORS_ORIGIN` (sans cette variable, l'API accepte toutes les origines).
- Services exposés en HTTPS : toute requête HTTP est redirigée vers HTTPS sur les deux apps.
- Les erreurs internes sont journalisées côté serveur, sans détail renvoyé au client.