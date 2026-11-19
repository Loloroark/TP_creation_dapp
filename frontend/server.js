// Petit serveur qui sert les fichiers statiques du frontend.
// Il ne touche jamais à la base de données : il ne connaît que l'URL publique de l'API.
const path = require('path');
const express = require('express');

const PORT = process.env.PORT || 5173;
const API_URL = process.env.API_URL || 'http://localhost:3000';

const app = express();

// Le navigateur charge /config.js pour connaître l'URL de l'API.
// Changer API_URL dans Scalingo suffit, pas besoin de modifier le code.
app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`window.API_URL = ${JSON.stringify(API_URL)};`);
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Frontend démarré sur le port ${PORT} (API : ${API_URL})`);
});
