-- Table des tickets. Idempotent : peut être exécuté plusieurs fois sans erreur.
CREATE TABLE IF NOT EXISTS tickets (
  id          SERIAL PRIMARY KEY,
  titre       VARCHAR(200) NOT NULL,
  description TEXT         NOT NULL DEFAULT '',
  statut      VARCHAR(20)  NOT NULL DEFAULT 'ouvert'
              CHECK (statut IN ('ouvert', 'en_cours', 'resolu')),
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);
