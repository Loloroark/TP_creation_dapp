# Démonstration orale (3 à 5 minutes)

Ordre imposé par le sujet (section 10). Chaque membre présente sa partie et doit pouvoir expliquer l'ensemble du système.

**Avant de passer :** ouvrir `<URL API>/health` pour vérifier que l'API répond, et préparer deux onglets (front et API).

| # | Étape | Qui | Ce qu'on montre / dit | Durée |
|---|---|---|---|---|
| 1 | Architecture technique | Doc | Le schéma `docs/architecture.svg` : les 3 tiers, le sens des appels (navigateur → front → API → base) | 45 s |
| 2 | Choix d'hébergement | Scalingo | Pourquoi Scalingo, les 2 apps + l'addon, les variables d'environnement (sans afficher leur valeur), le déploiement auto depuis GitHub | 45 s |
| 3 | Application en ligne | Dev | L'URL publique du front (en HTTPS), puis `<URL API>/api/tickets` qui renvoie du JSON | 30 s |
| 4 | Création d'un ticket | Dev | Remplir le formulaire, valider : le ticket apparaît. Expliquer le `POST /api/tickets` et la validation | 30 s |
| 5 | Modification du statut | Dev | Passer le ticket de « Ouvert » à « En cours » puis « Résolu » (`PATCH /api/tickets/:id`) | 30 s |
| 6 | Persistance des données | Scalingo | Actualiser la page (F5) : le ticket est toujours là. Option : redémarrer l'app API depuis Scalingo, puis actualiser | 30 s |
| 7 | Redéploiement (bonus) | Doc | Montrer le déploiement déclenché par le push `v1 → v2` dans l'onglet *Deployments* | 30 s |
| 8 | Problème rencontré | Doc | L'erreur de variable d'environnement manquante et sa résolution | 20 s |

## Questions probables et réponses

- **Pourquoi le front n'accède-t-il pas directement à la base ?** Les identifiants de la base seraient visibles dans le navigateur. Seul le backend les connaît, via une variable d'environnement.
- **Où sont stockés les secrets ?** Dans les variables d'environnement de l'app Scalingo `tickets-api`. Le fichier `.env` local est exclu de Git.
- **Comment sont contrôlés les statuts ?** Deux fois : dans l'API (liste des valeurs autorisées, sinon erreur 400) et dans la base (contrainte `CHECK`).
- **Qu'est-ce que le CI/CD ici ?** Chaque push sur GitHub déclenche automatiquement le build et le déploiement sur Scalingo, sans action manuelle.
- **Que se passe-t-il si l'API est en panne ?** Le front affiche un message d'erreur ; `/health` renvoie 503 si la base est injoignable.
- **À quoi sert CORS ?** Le navigateur n'autorise les appels vers l'API que depuis l'URL du frontend déclarée dans `CORS_ORIGIN`.

---

# Checklist avant restitution (section 11 du sujet)

- [ ] Le frontend est accessible (URL publique en HTTPS)
- [ ] Le backend répond (`/health` renvoie `{"status":"ok","database":"ok"}`)
- [ ] Les tickets s'affichent
- [ ] Un nouveau ticket peut être créé
- [ ] Le statut d'un ticket peut être modifié
- [ ] Les données persistent après actualisation (et après redémarrage de l'app)
- [ ] La documentation est disponible et versionnée (README + `docs/` poussés sur GitHub)
- [ ] Une modification peut être redéployée (test `v1 → v2` fait)
- [ ] Aucun secret n'est exposé publiquement (pas de `.env` dans le dépôt, pas d'URL de base dans le front)
- [ ] Le groupe sait expliquer son architecture
- [ ] Les liens et livrables sont prêts (URL front, URL API, schéma, compte rendu)

# Livrables (section 9 du sujet)

| Livrable | Où |
|---|---|
| 1 — Documentation | Dépôt GitHub + `README.md` |
| 2 — Application déployée | URL du front et de l'API dans le `README.md` |
| 3 — Schéma d'architecture | `docs/architecture.svg` |
| 4 — Compte rendu technique | `docs/compte-rendu.md` |
| 5 — Démonstration orale | Ce fichier |
