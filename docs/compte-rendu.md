# Compte rendu technique

**Projet :** application web de gestion de tickets — TP Mise en production & Hébergement (YNOV, 18–19 novembre 2026)
**Groupe :** _à compléter (3 membres)_

## 1. Rôles dans le groupe

| Membre | Rôle | Contribution |
|---|---|---|
| _à compléter_ | Développement | Backend (API Express), frontend, schéma SQL, tests locaux |
| _à compléter_ | Hébergement Scalingo | Création des apps, addon PostgreSQL, variables d'environnement, déploiement continu |
| _à compléter_ | Documentation | README, schéma d'architecture, compte rendu, préparation de la démonstration |

## 2. Architecture et choix techniques

L'application suit une architecture **trois tiers** (voir [architecture.svg](architecture.svg)) :

| Tier | Rôle | Technologie | Hébergement |
|---|---|---|---|
| Présentation | Interface utilisateur | HTML, CSS, JavaScript (sans framework) servis par un petit serveur Express | App Scalingo `tickets-front` |
| Logique métier | API REST, validation, accès aux données | Node.js 22, Express, `pg` | App Scalingo `tickets-api` |
| Données | Stockage persistant | PostgreSQL | Addon PostgreSQL Scalingo |
| Code source | Versionnement | Git | GitHub |

**Justification des choix :**

- **Scalingo** : un seul fournisseur pour les trois tiers (PaaS français, données hébergées en France, région `osc-fr1`). Il gère le HTTPS, le build Node.js et le déploiement automatique depuis GitHub, sans serveur à administrer.
- **Deux apps séparées** (front et API) : chaque tier est déployé, configuré et redémarré indépendamment. On obtient les deux URL publiques demandées, et la séparation des responsabilités est visible.
- **Addon PostgreSQL rattaché à l'API** : seul le backend reçoit l'URL de connexion. Le frontend ne peut pas accéder à la base (identifiants privilégiés jamais exposés).
- **JavaScript sans framework** : l'objectif du TP est le déploiement, pas l'interface. Aucune étape de build côté front, donc moins de risques de panne au déploiement.
- **Express** : framework minimal et très répandu, idéal pour trois routes REST.

## 3. Principales configurations

### App `tickets-api` (backend)

| Paramètre | Valeur | Rôle |
|---|---|---|
| `PROJECT_DIR` | `backend` | Le dépôt contient deux projets : Scalingo ne déploie que ce sous-dossier |
| Addon PostgreSQL | plan gratuit / sandbox | Crée la base et la variable `SCALINGO_POSTGRESQL_URL` |
| `CORS_ORIGIN` | URL publique du front | Seul le frontend peut appeler l'API depuis un navigateur |
| `Procfile` | `web: node server.js` | Commande de démarrage |
| `engines.node` | `22.x` (package.json) | Version de Node.js utilisée au build |

### App `tickets-front` (frontend)

| Paramètre | Valeur | Rôle |
|---|---|---|
| `PROJECT_DIR` | `frontend` | Ne déploie que le sous-dossier du front |
| `API_URL` | URL publique de l'API | Transmise au navigateur via `/config.js`, modifiable sans toucher au code |
| `Procfile` | `web: node server.js` | Commande de démarrage |

### Points communs

- `PORT` est fourni par Scalingo : les deux serveurs écoutent sur `process.env.PORT`.
- Redirection automatique de HTTP vers HTTPS (en-tête `x-forwarded-proto`).
- Déploiement automatique à chaque `git push` sur la branche liée à Scalingo.
- La table `tickets` est créée automatiquement au démarrage de l'API (`CREATE TABLE IF NOT EXISTS`), ce qui évite une étape manuelle.

## 4. Sécurité

- **Aucun secret dans le dépôt** : `.env` est exclu par `.gitignore`, seul `.env.example` (valeurs factices) est versionné.
- **Identifiants de la base** uniquement dans les variables d'environnement de l'API.
- **Validation des entrées** : titre obligatoire (200 caractères max), description (5000 max), statut limité à `ouvert`, `en_cours`, `resolu`. Contrôle doublé par une contrainte `CHECK` en base.
- **Requêtes SQL paramétrées** (`$1`, `$2`) : protection contre l'injection SQL.
- **Affichage via `textContent`** dans le front : protection contre l'injection de HTML (XSS).
- **CORS** limité à l'URL du frontend ; taille des requêtes limitée à 10 ko.
- **Messages d'erreur** génériques côté client (le détail n'apparaît que dans les logs).

## 5. Problème rencontré et résolution

**Problème :** au premier lancement de l'API en local (`npm start`), le serveur s'arrêtait immédiatement avec :

```
ERREUR : aucune URL de base de données (SCALINGO_POSTGRESQL_URL ou DATABASE_URL).
```

**Cause :** l'API lit l'adresse de la base dans une variable d'environnement. En local, aucune n'était définie : le fichier `.env` n'existait pas (seul `.env.example` est fourni, et il n'est pas lu), et aucune base PostgreSQL ne tournait sur la machine.

**Résolution :**

- **En production**, l'addon PostgreSQL ajouté à l'app `tickets-api` crée automatiquement `SCALINGO_POSTGRESQL_URL`, que le code lit en priorité : le problème disparaît sans modifier le code.
- **En local**, il suffit de copier `.env.example` en `.env` et d'y renseigner l'URL d'une base PostgreSQL locale.

**Ce que nous en retenons :** le code ne contient aucune adresse ni mot de passe ; chaque environnement (local, production) fournit sa propre configuration. C'est ce qui permet de publier le dépôt sans exposer de secret. L'arrêt volontaire avec un message clair a permis de comprendre le problème immédiatement.

_Autres problèmes rencontrés pendant le déploiement : à compléter._

## 6. Test du redéploiement automatique (CI/CD)

1. Modification visible : texte du pied de page `v1` → `v2` dans `frontend/public/index.html`.
2. `git commit` puis `git push`.
3. Scalingo détecte le push et lance un nouveau déploiement (visible dans l'onglet *Deployments*).
4. Après le déploiement, l'URL publique affiche `v2`.

_Résultat observé et durée du déploiement : à compléter._

## 7. URL de l'application

- Frontend : _à compléter_
- API : _à compléter_ — test : `<URL API>/health`
