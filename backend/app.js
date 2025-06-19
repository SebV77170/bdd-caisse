// backend/app.js - application Express exportable pour tests et production
const express = require('express');
const cors = require('cors');
const app = express();
const path = require('path');

// Middlewares globaux
app.use(cors());
app.use(express.json());

// Import des routes
const validerVenteRoutes = require('./routes/validerVente.routes');
const ventesRoutes = require('./routes/ventes.routes');
const produitsRoutes = require('./routes/produits');
const ticketRoutes = require('./routes/ticket.routes');
const bilanRoutes = require('./routes/bilan.routes');
const correctionRoutes = require('./routes/correction.routes');
const sessionRoutes = require('./routes/session.routes');
const usersRoutes = require('./routes/users.routes');
const resetRoutes = require('./routes/reset.routes');
const syncRoutes = require('./routes/sync.routes');
const envoiTicket = require('./routes/envoiTicket.routes');
const compareSchemasRoutes = require('./routes/compareSchemas.routes');
const dbConfigRoutes = require('./routes/dbconfig.routes');
const syncConfigRoutes = require('./routes/syncConfig.routes');
const factureRoutes = require('./routes/facture.routes');







// Montage des routes API
app.use('/api/produits', produitsRoutes);
app.use('/api/ticket', ticketRoutes);
app.use('/api/valider', validerVenteRoutes);
app.use('/api/ventes', ventesRoutes);
app.use('/api/bilan', bilanRoutes);
app.use('/api/correction', correctionRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reset', resetRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/envoieticket', envoiTicket);
app.use('/api/facture', factureRoutes);
app.use('/api/caisse', require('./routes/ouvertureCaisse.routes'));
app.use('/api/caisse/fermeture', require('./routes/FermetureCaisse.routes'));
app.use('/api/compare-schemas', compareSchemasRoutes);
app.use('/api/dbconfig', dbConfigRoutes);
app.use('/api/sync-config', syncConfigRoutes);
app.use('/factures', express.static(path.join(__dirname, '../factures')));




module.exports = app;
