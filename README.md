# Gestion de tickets — TP Mise en production & Hébergement (YNOV)

Application web permettant de déclarer un incident informatique, de consulter les tickets existants et de suivre leur résolution.

## URL publiques

- Frontend : _à compléter_
- API : _à compléter_ (test : `<URL API>/health`)

## Architecture trois tiers

```
Navigateur ──HTTPS──▶ Frontend (Scalingo : tickets-front)
     │
     └──HTTPS (fetch JSON)──▶ Backend API (Scalingo : tickets-api)
                                   │
                                   └──SQL──▶ PostgreSQL (addon Scalingo)

GitHub ──push──▶ redéploiement automatique des deux apps
```

| Tier | Techno | Hébergement |
|---|---|---|
| Frontend | HTML / CSS / JS + petit serveur Express statique | Scalingo (`tickets-front`) |
| Backend | Node.js 22, Express, `pg` | Scalingo (`tickets-api`) |
| Base de données | PostgreSQL | Addon PostgreSQL Scalingo |
| Code source | Git | GitHub |

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

Créer le fichier `backend/.env` à partir du modèle (PowerShell : `Copy-Item .env.example .env`), puis y mettre :

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
| GET | `/api/tickets` | Liste des tickets | — | 200 |
| POST | `/api/tickets` | Crée un ticket | `{ "titre": "...", "description": "..." }` | 201, 400 |
| PATCH | `/api/tickets/:id` | Modifie le statut | `{ "statut": "en_cours" }` | 200, 400, 404 |

Statuts autorisés : `ouvert`, `en_cours`, `resolu` (contrôlés par l'API **et** par une contrainte `CHECK` en base).

Tester en PowerShell :

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/tickets -ContentType "application/json" -Body '{"titre":"Test","description":"Depuis PowerShell"}'
Invoke-RestMethod -Method Patch -Uri http://localhost:3000/api/tickets/1 -ContentType "application/json" -Body '{"statut":"en_cours"}'
```

## Déploiement sur Scalingo

1. Créer deux apps Scalingo liées au dépôt GitHub : `tickets-api` et `tickets-front`.
2. **tickets-api** :
   - variable `PROJECT_DIR=backend`
   - ajouter l'addon **PostgreSQL** (crée automatiquement `SCALINGO_POSTGRESQL_URL`)
   - variable `CORS_ORIGIN=<URL du frontend>`
3. **tickets-front** :
   - variable `PROJECT_DIR=frontend`
   - variable `API_URL=<URL de l'API>`
4. Activer le déploiement automatique sur la branche voulue.
5. Vérifier les logs de l'API (`Base de données prête.` puis `API démarrée`) et ouvrir `<URL API>/health`.

## Redéploiement automatique (CI/CD)

1. Modifier un élément visible (ex. : `v1` → `v2` dans le pied de page de `frontend/public/index.html`).
2. `git commit` puis `git push` sur la branche liée à Scalingo.
3. Scalingo lance automatiquement un nouveau déploiement (onglet *Deployments*).
4. Vérifier la modification sur l'URL publique du frontend.

## Variables d'environnement

| App | Variable | Rôle |
|---|---|---|
| API | `SCALINGO_POSTGRESQL_URL` | Connexion à la base en production (créée par l'addon) |
| API | `DATABASE_URL` | Connexion à la base en local (fichier `.env`) |
| API | `CORS_ORIGIN` | Origine(s) autorisée(s) à appeler l'API |
| Front | `API_URL` | URL publique de l'API |
| Les deux | `PORT` | Fourni automatiquement par Scalingo |

## Sécurité

- Aucun secret dans le dépôt : `.env` est ignoré par Git, seul `.env.example` (sans vraies valeurs) est versionné.
- Les identifiants de la base ne sont connus que du backend ; le frontend ne connaît que l'URL de l'API.
- Les entrées sont validées par l'API, les requêtes SQL sont paramétrées.
- CORS limité à l'URL du frontend.
- HTTP redirigé automatiquement vers HTTPS sur les deux apps.
