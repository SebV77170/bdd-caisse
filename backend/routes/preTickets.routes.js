const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { sqlite } = require('../db');

const router = express.Router();

const STATUTS = new Set(['brouillon', 'en_attente', 'pris_en_charge', 'converti', 'annule']);

function nowIso() {
  return new Date().toISOString();
}

function requireUser(req, res) {
  const user = req.session?.user;
  if (!user) {
    res.status(401).json({ error: 'Utilisateur non connecte' });
    return null;
  }
  return user;
}

function emitPreTicket(req, event, payload) {
  const io = req.app.get('socketio');
  if (io) io.emit(event, payload);
}

function getPreTicket(uuid) {
  return sqlite.prepare('SELECT * FROM pre_tickets WHERE uuid_pre_ticket = ?').get(uuid);
}

function getItems(uuid) {
  return sqlite.prepare(`
    SELECT *
    FROM pre_ticket_items
    WHERE uuid_pre_ticket = ?
    ORDER BY id ASC
  `).all(uuid);
}

function getSummary(uuid) {
  const preTicket = getPreTicket(uuid);
  if (!preTicket) return null;
  const totals = sqlite.prepare(`
    SELECT
      COUNT(*) AS lignes,
      COALESCE(SUM(nbr), 0) AS articles,
      COALESCE(SUM(prixt), 0) AS total
    FROM pre_ticket_items
    WHERE uuid_pre_ticket = ?
  `).get(uuid);
  return { ...preTicket, ...totals };
}

function assertEditable(preTicket) {
  if (!preTicket) {
    const error = new Error('Pre-ticket introuvable');
    error.statusCode = 404;
    throw error;
  }
  if (!['brouillon', 'en_attente'].includes(preTicket.statut)) {
    const error = new Error('Ce pre-ticket ne peut plus etre modifie');
    error.statusCode = 409;
    throw error;
  }
}

router.get('/', (req, res) => {
  if (!requireUser(req, res)) return;

  const statut = req.query.statut;
  if (statut && !STATUTS.has(statut)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  try {
    const rows = sqlite.prepare(`
      SELECT
        pt.*,
        COUNT(pi.id) AS lignes,
        COALESCE(SUM(pi.nbr), 0) AS articles,
        COALESCE(SUM(pi.prixt), 0) AS total
      FROM pre_tickets pt
      LEFT JOIN pre_ticket_items pi ON pi.uuid_pre_ticket = pt.uuid_pre_ticket
      WHERE (? IS NULL OR pt.statut = ?)
      GROUP BY pt.id
      ORDER BY pt.updated_at DESC
    `).all(statut || null, statut || null);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const uuid = uuidv4();
  const now = nowIso();
  const createdByName = user.nom || user.pseudo || user.prenom || '';
  const {
    device_name = null,
    client_label = null,
    commentaire = null
  } = req.body || {};

  try {
    sqlite.prepare(`
      INSERT INTO pre_tickets (
        uuid_pre_ticket, statut, created_at, updated_at,
        created_by, created_by_name, device_name, client_label, commentaire
      ) VALUES (?, 'brouillon', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuid,
      now,
      now,
      user.uuid_user,
      createdByName,
      device_name,
      client_label,
      commentaire
    );

    const summary = getSummary(uuid);
    emitPreTicket(req, 'preTicketUpdated', summary);
    res.status(201).json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:uuid', (req, res) => {
  if (!requireUser(req, res)) return;

  try {
    const preTicket = getSummary(req.params.uuid);
    if (!preTicket) return res.status(404).json({ error: 'Pre-ticket introuvable' });
    res.json({ ...preTicket, items: getItems(req.params.uuid) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:uuid', (req, res) => {
  if (!requireUser(req, res)) return;

  const { client_label = null, commentaire = null, device_name = null } = req.body || {};
  try {
    const preTicket = getPreTicket(req.params.uuid);
    assertEditable(preTicket);

    sqlite.prepare(`
      UPDATE pre_tickets
      SET client_label = ?, commentaire = ?, device_name = COALESCE(?, device_name), updated_at = ?
      WHERE uuid_pre_ticket = ?
    `).run(client_label, commentaire, device_name, nowIso(), req.params.uuid);

    const summary = getSummary(req.params.uuid);
    emitPreTicket(req, 'preTicketUpdated', summary);
    res.json(summary);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/:uuid/items', (req, res) => {
  if (!requireUser(req, res)) return;

  const { id_produit, quantite = 1 } = req.body || {};
  const qty = Number.parseInt(quantite, 10);
  if (!id_produit || !Number.isInteger(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Produit ou quantite invalide' });
  }

  try {
    const preTicket = getPreTicket(req.params.uuid);
    assertEditable(preTicket);

    const produit = sqlite.prepare(`
      SELECT bv.nom, cat1.category AS categorie, cat2.category AS souscat, bv.prix
      FROM boutons_ventes bv
      LEFT JOIN categories cat1 ON bv.id_cat = cat1.id
      LEFT JOIN categories cat2 ON bv.id_souscat = cat2.id
      WHERE bv.id_bouton = ?
    `).get(id_produit);

    if (!produit) return res.status(404).json({ error: 'Produit introuvable' });

    sqlite.prepare(`
      INSERT INTO pre_ticket_items (
        uuid_pre_ticket, id_produit, nom, categorie, souscat, prix, nbr, prixt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.uuid,
      id_produit,
      produit.nom,
      produit.categorie,
      produit.souscat,
      produit.prix,
      qty,
      produit.prix * qty
    );
    sqlite.prepare('UPDATE pre_tickets SET updated_at = ? WHERE uuid_pre_ticket = ?')
      .run(nowIso(), req.params.uuid);

    const details = { ...getSummary(req.params.uuid), items: getItems(req.params.uuid) };
    emitPreTicket(req, 'preTicketUpdated', details);
    res.status(201).json(details);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.put('/:uuid/items/:id', (req, res) => {
  if (!requireUser(req, res)) return;

  const modifications = req.body || {};
  const champs = Object.keys(modifications).filter(champ => ['prix', 'nbr'].includes(champ));
  if (champs.length === 0) {
    return res.status(400).json({ error: 'Aucun champ modifiable fourni' });
  }

  try {
    const preTicket = getPreTicket(req.params.uuid);
    assertEditable(preTicket);

    const item = sqlite.prepare(`
      SELECT * FROM pre_ticket_items
      WHERE id = ? AND uuid_pre_ticket = ?
    `).get(req.params.id, req.params.uuid);
    if (!item) return res.status(404).json({ error: 'Article introuvable' });

    const nextPrix = champs.includes('prix') ? Number(modifications.prix) : item.prix;
    const nextNbr = champs.includes('nbr') ? Number.parseInt(modifications.nbr, 10) : item.nbr;
    if (!Number.isFinite(nextPrix) || !Number.isInteger(nextNbr) || nextNbr <= 0) {
      return res.status(400).json({ error: 'Prix ou quantite invalide' });
    }

    sqlite.prepare(`
      UPDATE pre_ticket_items
      SET prix = ?, nbr = ?, prixt = ?
      WHERE id = ? AND uuid_pre_ticket = ?
    `).run(nextPrix, nextNbr, nextPrix * nextNbr, req.params.id, req.params.uuid);
    sqlite.prepare('UPDATE pre_tickets SET updated_at = ? WHERE uuid_pre_ticket = ?')
      .run(nowIso(), req.params.uuid);

    const details = { ...getSummary(req.params.uuid), items: getItems(req.params.uuid) };
    emitPreTicket(req, 'preTicketUpdated', details);
    res.json(details);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.delete('/:uuid/items/:id', (req, res) => {
  if (!requireUser(req, res)) return;

  try {
    const preTicket = getPreTicket(req.params.uuid);
    assertEditable(preTicket);
    sqlite.prepare('DELETE FROM pre_ticket_items WHERE id = ? AND uuid_pre_ticket = ?')
      .run(req.params.id, req.params.uuid);
    sqlite.prepare('UPDATE pre_tickets SET updated_at = ? WHERE uuid_pre_ticket = ?')
      .run(nowIso(), req.params.uuid);

    const details = { ...getSummary(req.params.uuid), items: getItems(req.params.uuid) };
    emitPreTicket(req, 'preTicketUpdated', details);
    res.json(details);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/:uuid/envoyer', (req, res) => {
  if (!requireUser(req, res)) return;

  try {
    const preTicket = getPreTicket(req.params.uuid);
    assertEditable(preTicket);
    const itemCount = sqlite.prepare(`
      SELECT COUNT(*) AS count FROM pre_ticket_items WHERE uuid_pre_ticket = ?
    `).get(req.params.uuid).count;
    if (itemCount === 0) {
      return res.status(400).json({ error: 'Impossible d envoyer un pre-ticket vide' });
    }

    sqlite.prepare(`
      UPDATE pre_tickets
      SET statut = 'en_attente', updated_at = ?
      WHERE uuid_pre_ticket = ?
    `).run(nowIso(), req.params.uuid);

    const summary = getSummary(req.params.uuid);
    emitPreTicket(req, 'preTicketCreated', summary);
    emitPreTicket(req, 'preTicketUpdated', summary);
    res.json(summary);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/:uuid/annuler', (req, res) => {
  if (!requireUser(req, res)) return;

  try {
    const preTicket = getPreTicket(req.params.uuid);
    if (!preTicket) return res.status(404).json({ error: 'Pre-ticket introuvable' });
    if (preTicket.statut === 'converti') {
      return res.status(409).json({ error: 'Ce pre-ticket est deja converti' });
    }

    sqlite.prepare(`
      UPDATE pre_tickets
      SET statut = 'annule', updated_at = ?
      WHERE uuid_pre_ticket = ?
    `).run(nowIso(), req.params.uuid);

    const summary = getSummary(req.params.uuid);
    emitPreTicket(req, 'preTicketUpdated', summary);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:uuid/convertir', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  try {
    let idTempVente;
    const convert = sqlite.transaction(() => {
      const preTicket = getPreTicket(req.params.uuid);
      if (!preTicket) {
        const error = new Error('Pre-ticket introuvable');
        error.statusCode = 404;
        throw error;
      }
      if (preTicket.statut === 'converti' && preTicket.converted_id_temp_vente) {
        idTempVente = preTicket.converted_id_temp_vente;
        return;
      }
      if (!['en_attente', 'pris_en_charge'].includes(preTicket.statut)) {
        const error = new Error('Seul un pre-ticket en attente peut etre recupere');
        error.statusCode = 409;
        throw error;
      }

      const items = getItems(req.params.uuid);
      if (items.length === 0) {
        const error = new Error('Impossible de recuperer un pre-ticket vide');
        error.statusCode = 400;
        throw error;
      }

      const nowUtc = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const sale = sqlite.prepare('INSERT INTO vente (dateheure) VALUES (?)').run(nowUtc);
      idTempVente = sale.lastInsertRowid;

      const insertItem = sqlite.prepare(`
        INSERT INTO ticketdecaissetemp (
          id_temp_vente, nom, categorie, souscat, prix, nbr, prixt
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of items) {
        insertItem.run(
          idTempVente,
          item.nom,
          item.categorie,
          item.souscat,
          item.prix,
          item.nbr,
          item.prixt
        );
      }

      sqlite.prepare(`
        UPDATE pre_tickets
        SET statut = 'converti',
            claimed_by = ?,
            claimed_at = COALESCE(claimed_at, ?),
            converted_id_temp_vente = ?,
            updated_at = ?
        WHERE uuid_pre_ticket = ?
      `).run(user.uuid_user, nowIso(), idTempVente, nowIso(), req.params.uuid);
    });

    convert();
    const summary = getSummary(req.params.uuid);
    emitPreTicket(req, 'preTicketConverted', {
      uuid_pre_ticket: req.params.uuid,
      id_temp_vente: idTempVente
    });
    emitPreTicket(req, 'preTicketUpdated', summary);
    res.json({ success: true, id_temp_vente: idTempVente, pre_ticket: summary });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

module.exports = router;
