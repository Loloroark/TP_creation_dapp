// URL de l'API, fournie par /config.js (variable d'environnement API_URL côté serveur)
const API_URL = (window.API_URL || 'http://localhost:3000').replace(/\/$/, '');

const STATUTS = {
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  resolu: 'Résolu',
};

const liste = document.getElementById('liste-tickets');
const form = document.getElementById('form-ticket');
const messageForm = document.getElementById('message-form');
const messageListe = document.getElementById('message-liste');

// Appel générique à l'API : renvoie le JSON, ou lève une erreur lisible
async function api(chemin, options = {}) {
  const res = await fetch(API_URL + chemin, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Erreur ${res.status}`);
  }
  return data;
}

function afficherMessage(element, texte, type = '') {
  element.textContent = texte;
  element.className = 'message ' + type;
}

// F1 — Afficher les tickets
async function chargerTickets() {
  afficherMessage(messageListe, 'Chargement… (le premier chargement peut être lent si le serveur se réveille)');
  try {
    const tickets = await api('/api/tickets');
    liste.innerHTML = '';
    if (tickets.length === 0) {
      afficherMessage(messageListe, 'Aucun ticket pour le moment.');
      return;
    }
    afficherMessage(messageListe, '');
    tickets.forEach((t) => liste.appendChild(creerElementTicket(t)));
  } catch (err) {
    afficherMessage(messageListe, `Impossible de charger les tickets : ${err.message}`, 'erreur');
  }
}

// Construit le HTML d'un ticket (textContent = protection contre l'injection HTML)
function creerElementTicket(ticket) {
  const li = document.createElement('li');
  li.className = `ticket statut-${ticket.statut}`;

  const titre = document.createElement('h3');
  titre.textContent = ticket.titre;

  const description = document.createElement('p');
  description.textContent = ticket.description || '(pas de description)';

  const meta = document.createElement('div');
  meta.className = 'meta';

  const date = document.createElement('span');
  date.textContent = 'Créé le ' + new Date(ticket.created_at).toLocaleString('fr-FR');

  // F3 — Changer le statut
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Statut du ticket');
  for (const [valeur, libelle] of Object.entries(STATUTS)) {
    const option = document.createElement('option');
    option.value = valeur;
    option.textContent = libelle;
    option.selected = valeur === ticket.statut;
    select.appendChild(option);
  }
  select.addEventListener('change', async () => {
    select.disabled = true;
    try {
      const maj = await api(`/api/tickets/${ticket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ statut: select.value }),
      });
      li.className = `ticket statut-${maj.statut}`;
      ticket.statut = maj.statut;
    } catch (err) {
      select.value = ticket.statut;
      alert(`Erreur : ${err.message}`);
    } finally {
      select.disabled = false;
    }
  });

  meta.append(date, select);
  li.append(titre, description, meta);
  return li;
}

// F2 — Créer un ticket
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const titre = form.titre.value.trim();
  const description = form.description.value.trim();

  if (!titre) {
    afficherMessage(messageForm, 'Le titre est obligatoire.', 'erreur');
    return;
  }

  const bouton = form.querySelector('button');
  bouton.disabled = true;
  try {
    await api('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ titre, description }),
    });
    form.reset();
    afficherMessage(messageForm, 'Ticket créé.', 'succes');
    await chargerTickets();
  } catch (err) {
    afficherMessage(messageForm, `Erreur : ${err.message}`, 'erreur');
  } finally {
    bouton.disabled = false;
  }
});

document.getElementById('btn-rafraichir').addEventListener('click', chargerTickets);

chargerTickets();
