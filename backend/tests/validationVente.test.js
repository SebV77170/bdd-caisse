jest.mock('../session', () => ({
    getUser: jest.fn(() => ({ id: 1, nom: 'Testeur' }))
  }));
  const session = require('../session'); // <== important pour accéder au mock
  
  const request = require('supertest');
  const app = require('../app');
  const { sqlite } = require('../db');;
  const fs = require('fs');
  const path = require('path');
  
  function initTables() {
    const schemaPath = path.join(__dirname, '../schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    sqlite.exec(schema);
  }
  
  describe('Tests de la validation de vente', () => {
    const vendeur = { id: 1, nom: 'Testeur' };
    const articles = [
      { nom: 'Produit A', prix: 1000, prixt: 1000, nbr: 1, categorie: 'Test', souscat: 'Standard', poids: 2 },
      { nom: 'Produit B', prix: 500, prixt: 1000, nbr: 2, categorie: 'Test', souscat: 'Standard', poids: 1 },
    ];
    let id_temp_vente;
  
    beforeEach(async () => {
      initTables();
      const resVente = await request(app).post('/api/ventes/').send();
      id_temp_vente = resVente.body.id_temp_vente.toString();
  
      const insert = sqlite.prepare(`
        INSERT INTO ticketdecaissetemp (id_temp_vente, nom, prix, prixt, nbr, categorie, souscat, poids)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const a of articles) {
        insert.run(id_temp_vente, a.nom, a.prix, a.prixt, a.nbr, a.categorie, a.souscat, a.poids);
      }
    });
  
    test('1. Vente normale sans réduction - paiement carte', async () => {
      const res = await request(app).post('/api/valider').send({
        id_temp_vente,
        reductionType: '',
        paiements: [{ moyen: 'carte', montant: 2000 }]
      });
  
      expect(res.body.success).toBe(true);
      const bilan = sqlite.prepare('SELECT * FROM bilan').get();
      expect(bilan.prix_total_carte).toBe(2000);
    });
  
    test('2. Vente avec réduction bénévole - paiement espèces', async () => {
      const res = await request(app).post('/api/valider').send({
        id_temp_vente,
        reductionType: 'trueBene',
        paiements: [{ moyen: 'espèce', montant: 1000 }]
      });
  
      expect(res.body.success).toBe(true);
      const bilan = sqlite.prepare('SELECT * FROM bilan').get();
      expect(bilan.prix_total).toBe(3000);
      expect(bilan.prix_total_espece).toBe(1000);
    });
  
    test('3. Vente avec réduction gros panier bénévole - paiement chèque', async () => {
      const res = await request(app).post('/api/valider').send({
        id_temp_vente,
        reductionType: 'trueGrosPanierBene',
        paiements: [{ moyen: 'chèque', montant: 1600 }]
      });
  
      expect(res.body.success).toBe(true);
      const bilan = sqlite.prepare('SELECT * FROM bilan').get();
      expect(bilan.prix_total).toBe(4600);
      expect(bilan.prix_total_cheque).toBe(1600);
    });
  
    test('4. Vente gratuite avec réduction excessive - aucun paiement', async () => {
      // Supprime la vente déjà créée dans beforeEach()
      await request(app).delete(`/api/ventes/${id_temp_vente}`);
  
      // Crée une vente de 8 € avec un article unique
      const resVente = await request(app).post('/api/ventes/').send();
      id_temp_vente = resVente.body.id_temp_vente.toString();
  
      sqlite.prepare(`
        INSERT INTO ticketdecaissetemp (id_temp_vente, nom, prix, prixt, nbr, categorie, souscat, poids)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id_temp_vente, 'Petit article', 800, 800, 1, 'Divers', 'Test', 1);
  
      const res = await request(app).post('/api/valider').send({
        id_temp_vente,
        reductionType: 'trueBene',
        paiements: [{ moyen: 'espèce', montant: 0 }]
      });
  
      expect(res.body.success).toBe(true);
      const bilan = sqlite.prepare('SELECT * FROM bilan').get();
      expect(bilan.prix_total).toBe(4600);
    });
  
    test('5. Erreur : ticket vide', async () => {
      sqlite.prepare('DELETE FROM ticketdecaissetemp WHERE id_temp_vente = ?').run(id_temp_vente);
  
      const res = await request(app).post('/api/valider').send({
        id_temp_vente,
        reductionType: '',
        paiements: [{ moyen: 'carte', montant: 2000 }]
      });
  
      expect(res.body.error).toMatch(/aucun article/i);
    });
  
    test('6. Erreur : pas de session utilisateur', async () => {
      session.getUser.mockReturnValueOnce(null);
  
      const res = await request(app).post('/api/valider').send({
        id_temp_vente,
        reductionType: '',
        paiements: [{ moyen: 'carte', montant: 2000 }]
      });
  
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/aucun utilisateur/i);
    });
  });
  