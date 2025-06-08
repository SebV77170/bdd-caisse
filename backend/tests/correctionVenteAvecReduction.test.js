const request = require('supertest');
const app = require('../app');
const { sqlite } = require('../db');;
const path = require('path');
const fs = require('fs');

// Mock explicite du module session
jest.mock('../session', () => ({
  getUser: jest.fn(),
  setUser: jest.fn()
}));
const { getUser } = require('../session');

function initTables() {
  const schemaPath = path.join(__dirname, '../schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  sqlite.exec(schema);
}

beforeEach(() => {
  initTables();
  getUser.mockReturnValue({ id: 1, nom: 'Testeur' });
});

test('Correction avec prix inférieur à la réduction (prix stoppé à 0€)', async () => {
  // Étape 1 : Création d’une vente à 12€, réduction client de 5€
  const resVente = await request(app).post('/api/ventes/').send();
  const id_temp_vente = resVente.body.id_temp_vente.toString();

  sqlite.prepare(`
    INSERT INTO ticketdecaissetemp (id_temp_vente, nom, prix, prixt, nbr, categorie, souscat, poids)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id_temp_vente, 'Produit X', 1200, 1200, 1, 'TestCat', 'TestSub', 1);

  const resValidation = await request(app).post('/api/valider').send({
    id_temp_vente,
    reductionType: 'trueClient',
    paiements: [{ moyen: 'carte', montant: 700 }]
  });

  expect(resValidation.body.success).toBe(true);
  const id_ticket_original = resValidation.body.id_ticket;

  // Étape 2 : Correction du ticket : on passe le prix à 2€ avec même réduction client
  const correction = await request(app).post('/api/correction').send({
    id_ticket_original,
    motif: 'Prix erroné',
    articles_origine: [
      { nom: 'Produit X', prix: 1200, nbr: 1, categorie: 'TestCat', souscat: 'TestSub' },
      { nom: 'Réduction Fidélité Client', prix: -500, nbr: 1, categorie: 'Réduction' }
    ],
    articles_correction: [
      { nom: 'Produit X', prix: 200, nbr: 1, categorie: 'TestCat', souscat: 'TestSub' }
    ],
    reductionType: 'trueClient',
    moyen_paiement: 'carte',
    paiements: [{ moyen: 'carte', montant: 0 }]
  });

  expect(correction.body.success).toBe(true);

  // Étape 3 : Vérifier le ticket d’annulation (-700)
  const ticketAnnulation = sqlite.prepare(`
    SELECT * FROM ticketdecaisse WHERE id_ticket = ?
  `).get(correction.body.id_ticket_annulation);
  expect(ticketAnnulation.prix_total).toBe(-700);

  // Étape 4 : Vérifier le ticket de correction (0€)
  const ticketCorrection = sqlite.prepare(`
    SELECT * FROM ticketdecaisse WHERE id_ticket = ?
  `).get(correction.body.id_ticket_correction);
  expect(ticketCorrection.prix_total).toBe(0);

  // Étape 5 : Vérifier le bilan final
  const bilan = sqlite.prepare(`SELECT * FROM bilan`).get();
  expect(bilan.prix_total).toBe(0); // 700 - 700 annulé + 0
  expect(bilan.prix_total_carte).toBe(0);
});
