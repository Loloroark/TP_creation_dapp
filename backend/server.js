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
    const { rows } = await pool.query('SELECT * FROM tickets ORDER BY id ASC');
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

// Supprimer un ticket, puis renuméroter les ID pour qu'ils restent continus (1, 2, 3…)
app.delete('/api/tickets/:id', async (req, res, next) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Identifiant invalide.' });
  }

  // Tout se fait dans une transaction : soit tout réussit, soit rien n'est modifié
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Empêche une autre requête d'écrire dans la table pendant la renumérotation
    await client.query('LOCK TABLE tickets IN EXCLUSIVE MODE');

    const { rowCount } = await client.query('DELETE FROM tickets WHERE id = $1', [id]);
    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ticket introuvable.' });
    }

    // Renumérotation en deux temps pour ne jamais créer deux fois le même ID :
    // 1) on passe tous les ID en négatif, 2) on les renumérote 1, 2, 3… dans l'ordre d'origine
    await client.query('UPDATE tickets SET id = -id');
    await client.query(`
      UPDATE tickets t
      SET id = r.nouvel_id
      FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY id DESC) AS nouvel_id FROM tickets) r
      WHERE t.id = r.id
    `);

    // Le prochain ticket créé prendra l'ID suivant le dernier existant
    await client.query(`
      SELECT setval(pg_get_serial_sequence('tickets', 'id'),
                    COALESCE((SELECT MAX(id) FROM tickets), 0) + 1, false)
    `);

    await client.query('COMMIT');
    res.json({ message: 'Ticket supprimé.', id });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
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
