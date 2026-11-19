require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// ---------- Configuration (tout vient des variables d'environnement) ----------
const PORT = process.env.PORT || 3000;

// Sur Scalingo, l'addon PostgreSQL crée automatiquement SCALINGO_POSTGRESQL_URL.
// En local, on utilise DATABASE_URL (fichier .env, jamais commité).
const DATABASE_URL = process.env.SCALINGO_POSTGRESQL_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERREUR : aucune URL de base de données (SCALINGO_POSTGRESQL_URL ou DATABASE_URL).');
  process.exit(1);
}

// URL(s) du frontend autorisée(s) à appeler l'API, séparées par des virgules.
const CORS_ORIGIN = process.env.CORS_ORIGIN;

const STATUTS = ['ouvert', 'en_cours', 'resolu'];

const pool = new Pool({ connectionString: DATABASE_URL });

// ---------- Application ----------
const app = express();

// En production, Scalingo indique le protocole d'origine dans x-forwarded-proto.
// Toute requête arrivée en HTTP est redirigée vers HTTPS (308 conserve la méthode POST/PATCH).
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
  }
  next();
});

app.use(express.json({ limit: '10kb' }));

if (CORS_ORIGIN) {
  app.use(cors({ origin: CORS_ORIGIN.split(',').map((o) => o.trim()) }));
} else {
  console.warn('ATTENTION : CORS_ORIGIN non défini, toutes les origines sont autorisées.');
  app.use(cors());
}

// Vérifie que l'API répond et que la base est joignable
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'ok' });
  } catch (err) {
    console.error(err);
    res.status(503).json({ status: 'error', database: 'unreachable' });
  }
});

// F1 — Lister les tickets
app.get('/api/tickets', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tickets ORDER BY created_at DESC, id DESC');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// F2 — Créer un ticket
app.post('/api/tickets', async (req, res, next) => {
  const { titre, description } = req.body || {};

  if (typeof titre !== 'string' || titre.trim() === '') {
    return res.status(400).json({ error: 'Le titre est obligatoire.' });
  }
  if (titre.trim().length > 200) {
    return res.status(400).json({ error: 'Le titre ne doit pas dépasser 200 caractères.' });
  }
  if (description !== undefined && typeof description !== 'string') {
    return res.status(400).json({ error: 'La description doit être un texte.' });
  }
  if (description && description.length > 5000) {
    return res.status(400).json({ error: 'La description ne doit pas dépasser 5000 caractères.' });
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO tickets (titre, description) VALUES ($1, $2) RETURNING *',
      [titre.trim(), (description || '').trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// F3 — Modifier le statut d'un ticket
app.patch('/api/tickets/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  const { statut } = req.body || {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Identifiant invalide.' });
  }
  if (!STATUTS.includes(statut)) {
    return res.status(400).json({ error: `Statut invalide. Valeurs acceptées : ${STATUTS.join(', ')}.` });
  }

  try {
    const { rows } = await pool.query(
      'UPDATE tickets SET statut = $1 WHERE id = $2 RETURNING *',
      [statut, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Ticket introuvable.' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Route inconnue
app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable.' });
});

// Erreur serveur : on logge le détail, mais on ne l'envoie pas au client
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON invalide.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

// ---------- Démarrage ----------
async function start() {
  // Crée la table si elle n'existe pas encore (sans risque si elle existe déjà)
  const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Base de données prête.');

  app.listen(PORT, () => {
    console.log(`API démarrée sur le port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Impossible de démarrer :', err);
  process.exit(1);
});
