const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const runtimeRoot = process.env.BDD_CAISSE_E2E_ROOT
  || path.join(root, '.e2e-runtime');
const artifactsDir = path.join(root, 'e2e-artifacts');
const backendNode = path.join(root, 'electron-app', 'vendor', 'node.exe');
const backendEntry = path.join(root, 'backend', 'index.js');
const seedScript = path.join(root, 'scripts', 'e2e', 'seed-production-db.js');
const preloadScript = path.join(root, 'scripts', 'e2e', 'preload.js');
const backendPort = 3101;
const appUrl = `http://localhost:${backendPort}`;
const syncPort = 3102;
const syncUrl = `http://127.0.0.1:${syncPort}/sync`;
const successMarker = path.join(runtimeRoot, 'e2e-success');
const logPath = path.join(runtimeRoot, 'e2e.log');
const salePrice = 1234;
const saleCount = 100;
const users = [
  { pseudo: 'e2e-admin', label: 'Test Responsable' },
  { pseudo: 'e2e-alice', label: 'Alice Martin' },
  { pseudo: 'e2e-bob', label: 'Bob Durand' },
  { pseudo: 'e2e-claire', label: 'Claire Bernard' }
];
const paymentCycle = [
  { method: 'especes' },
  { method: 'carte' },
  { method: 'cheque' },
  { method: 'virement' },
  {
    split: [
      { method: 'carte', amount: '5.00' },
      { method: 'especes', amount: '7.34' }
    ]
  }
];
const processStartedAt = Date.now();

let backendProcess;
let mainWindow;
let syncServer;
let finalSyncRequests = 0;
let backendErrorOutput = '';
let applicationOpeningMs = 0;

function writeLog(message) {
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.appendFileSync(logPath, `${message}\n`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isPortOpen(port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function prepareDatabase() {
  const result = spawnSync(backendNode, [seedScript], {
    cwd: root,
    env: {
      ...process.env,
      BDD_CAISSE_E2E_ROOT: runtimeRoot
    },
    encoding: 'utf8',
    windowsHide: true
  });

  if (result.stdout) writeLog(`[seed] ${result.stdout.trimEnd()}`);
  if (result.stderr) writeLog(`[seed-error] ${result.stderr.trimEnd()}`);
  assert(result.status === 0, `Le seed E2E a échoué avec le code ${result.status}.`);
}

function requestJson(pathname) {
  return new Promise((resolve, reject) => {
    http.get(`${appUrl}${pathname}`, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve({
            status: response.statusCode,
            body: JSON.parse(body)
          });
        } catch (error) {
          reject(new Error(`Réponse JSON invalide pour ${pathname}: ${body}`));
        }
      });
    }).on('error', reject);
  });
}

async function waitForBackend(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await requestJson('/api/bilan/jour');
      if (response.status === 200) return;
    } catch {}
    await wait(200);
  }
  throw new Error('Le backend E2E ne répond pas sur le port 3001.');
}

function launchBackend() {
  const homeDir = path.join(runtimeRoot, 'home');
  const environment = {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(backendPort),
    USERPROFILE: homeDir,
    HOME: homeDir,
    BDD_CAISSE_E2E: '1',
    BDD_CAISSE_E2E_ORIGIN: appUrl,
    FINAL_SYNC_URL: syncUrl,
    MYSQL_CONNECT_TIMEOUT: '500'
  };

  backendProcess = spawn(backendNode, [backendEntry], {
    cwd: path.join(root, 'backend'),
    env: environment,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  backendProcess.stdout.on('data', chunk => {
    writeLog(`[backend] ${chunk.toString().trimEnd()}`);
    process.stdout.write(`[backend-e2e] ${chunk}`);
  });
  backendProcess.stderr.on('data', chunk => {
    backendErrorOutput += chunk.toString();
    writeLog(`[backend-error] ${chunk.toString().trimEnd()}`);
    process.stderr.write(`[backend-e2e] ${chunk}`);
  });
}

async function restartBackend() {
  const previousProcess = backendProcess;
  if (previousProcess && !previousProcess.killed) {
    previousProcess.kill();
    await Promise.race([
      new Promise(resolve => previousProcess.once('close', resolve)),
      wait(5000)
    ]);
  }

  backendProcess = null;
  launchBackend();
  await waitForBackend();
}

function launchSyncServer() {
  return new Promise((resolve, reject) => {
    syncServer = http.createServer((request, response) => {
      if (request.method === 'POST' && request.url === '/sync') {
        finalSyncRequests += 1;
        response.writeHead(503, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          success: false,
          error: 'Service MySQL simule indisponible'
        }));
        return;
      }

      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ success: false }));
    });
    syncServer.once('error', reject);
    syncServer.listen(syncPort, '127.0.0.1', resolve);
  });
}

async function evaluate(expression) {
  return mainWindow.webContents.executeJavaScript(expression, true);
}

async function rendererRequest(pathname) {
  return evaluate(`
    fetch(${JSON.stringify(`http://localhost:3001${pathname}`)}, {
      credentials: 'include'
    }).then(async response => ({
      status: response.status,
      body: await response.json()
    }))
  `);
}

async function waitForCondition(expression, message, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await wait(100);
  }
  throw new Error(message);
}

async function waitForText(text, timeoutMs = 10000) {
  await waitForCondition(
    `document.body && document.body.innerText.includes(${JSON.stringify(text)})`,
    `Texte introuvable dans l'interface : ${text}`,
    timeoutMs
  );
}

async function waitForApi(check, message, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await wait(150);
  }
  throw new Error(message);
}

async function clickButton(text) {
  const clicked = await evaluate(`
    (() => {
      const text = ${JSON.stringify(text)};
      const element = [...document.querySelectorAll('button, a')]
        .find(node => (node.innerText || '').trim().includes(text));
      if (!element) return false;
      element.click();
      return true;
    })()
  `);
  assert(clicked, `Bouton ou lien introuvable : ${text}`);
}

async function clickButtonExact(text) {
  const clicked = await evaluate(`
    (() => {
      const text = ${JSON.stringify(text)};
      const element = [...document.querySelectorAll('button, a')]
        .find(node => (node.innerText || '').trim() === text);
      if (!element) return false;
      element.click();
      return true;
    })()
  `);
  assert(clicked, `Bouton ou lien exact introuvable : ${text}`);
}

async function doubleClickButtonExact(text) {
  const clicked = await evaluate(`
    (() => {
      const text = ${JSON.stringify(text)};
      const element = [...document.querySelectorAll('button, a')]
        .find(node => (node.innerText || '').trim() === text);
      if (!element) return false;
      element.click();
      element.click();
      return true;
    })()
  `);
  assert(clicked, `Bouton ou lien exact introuvable pour double activation : ${text}`);
}

async function fill(selector, value) {
  const changed = await evaluate(`
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return false;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set || Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      setter.call(element, ${JSON.stringify(value)});
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);
  assert(changed, `Champ introuvable : ${selector}`);
}

async function setSelect(selector, value, index = 0) {
  const changed = await evaluate(`
    (() => {
      const element = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
      if (!element) return false;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value'
      ).set;
      setter.call(element, ${JSON.stringify(value)});
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return element.value === ${JSON.stringify(value)};
    })()
  `);
  assert(changed, `Liste introuvable ou valeur invalide : ${selector}[${index}] = ${value}`);
}

async function paymentControl(action, index, value, scope = 'document') {
  const changed = await evaluate(`
    (() => {
      const root = ${scope};
      const selects = [...root.querySelectorAll('select')].filter(select => {
        const values = [...select.options].map(option => option.value);
        const allowed = ['espece', 'especes', 'carte', 'cheque', 'virement'];
        return values.length >= 3 && values.every(item => allowed.includes(item));
      });
      const select = selects[${index}];
      if (!select) return false;
      if (${JSON.stringify(action)} === 'method') {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          'value'
        ).set;
        setter.call(select, ${JSON.stringify(value)});
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      const input = select.parentElement?.querySelector('input');
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);
  assert(changed, `Contrôle de paiement introuvable à l’index ${index}.`);
}

async function waitForPaymentCount(count, scope = 'document') {
  await waitForCondition(
    `(() => {
      const root = ${scope};
      return [...root.querySelectorAll('select')].filter(select => {
        const values = [...select.options].map(option => option.value);
        const allowed = ['espece', 'especes', 'carte', 'cheque', 'virement'];
        return values.length >= 3 && values.every(item => allowed.includes(item));
      }).length === ${count};
    })()`,
    `${count} moyens de paiement n’ont pas été affichés.`
  );
}

async function capture(name) {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const image = await mainWindow.webContents.capturePage();
  fs.writeFileSync(path.join(artifactsDir, name), image.toPNG());
}

async function createSale({ method, split, expectedCount, doubleSubmit = false }) {
  await clickButton('Nouvelle vente');
  await waitForText('Article E2E');
  await clickButton('Article E2E');
  await waitForText('Total : 12.34');
  await clickButton('Valider la vente');
  await waitForText('Finaliser la vente');

  if (split) {
    await clickButton('+ Ajouter un paiement');
    await waitForPaymentCount(2);
    await paymentControl('method', 0, split[0].method);
    await paymentControl('method', 1, split[1].method);
    await paymentControl('amount', 0, split[0].amount);
    await waitForText('Total saisi : 12,34 €');
  } else {
    await paymentControl('method', 0, method);
    await waitForCondition(
      `(() => {
        const selects = [...document.querySelectorAll('select')].filter(select => {
          const values = [...select.options].map(option => option.value);
          const allowed = ['espece', 'especes', 'carte', 'cheque', 'virement'];
          return values.length >= 3 && values.every(item => allowed.includes(item));
        });
        const value = selects[0]?.parentElement?.querySelector('input')?.value;
        return value === '12,34' || value === '12.34';
      })()`,
      `Le montant du paiement ${method} n’est pas prêt.`
    );
  }

  await wait(100);
  if (doubleSubmit) {
    await doubleClickButtonExact('Valider la vente');
  } else {
    await clickButtonExact('Valider la vente');
  }
  await waitForApi(async () => {
    const bilan = await requestJson('/api/bilan/jour');
    return bilan.body.nombre_vente === expectedCount;
  }, `La vente ${method || 'mixte'} n’a pas été enregistrée.`);
  await waitForCondition(
    `!document.body.innerText.includes('Finaliser la vente')`,
    'Le formulaire de vente reste ouvert après validation.'
  );
}

async function switchUser(user) {
  await clickButtonExact("Changer d'utilisateur 👤");
  await waitForText("Alors, on change de caissier");
  await waitForApi(async () => {
    const session = await rendererRequest('/api/session');
    return session.status === 401;
  }, `La déconnexion de ${user.pseudo} n’est pas terminée.`);

  await fill('#resp-pseudo', user.pseudo);
  await fill('#resp-password', 'e2e-secret');
  await clickButtonExact('Se connecter');
  await waitForText(`Bonjour ${user.label}`);
  await waitForText('Nouvelle vente');

  await waitForApi(async () => {
    const session = await rendererRequest('/api/session');
    return session.body.user?.pseudo === user.pseudo;
  }, `La session de ${user.pseudo} n’est pas active.`);
}

async function correctCardSale(correctionNumber) {
  const list = await requestJson('/api/bilan');
  const original = list.body.find(ticket =>
    ticket.moyen_paiement === 'carte'
    && ticket.prix_total === 1234
    && !ticket.flag_correction
    && !ticket.flag_annulation
    && !ticket.ticket_corrige
  );
  assert(original, 'La vente carte à corriger est introuvable.');

  await evaluate(`location.hash = '#/caisse'`);
  await waitForText('Nouvelle vente');
  await evaluate(`location.hash = '#/bilan'`);
  await waitForText('Mode Paiement');
  const rowClicked = await evaluate(`
    (() => {
      const id = ${JSON.stringify(String(original.id_friendly))};
      const row = [...document.querySelectorAll('tbody tr')]
        .find(element => element.querySelector('td')?.textContent.trim() === id);
      if (!row) return false;
      row.click();
      return true;
    })()
  `);
  assert(rowClicked, 'La ligne de la vente carte est introuvable dans le bilan.');
  await waitForText('Corriger');
  await clickButtonExact('Corriger');
  await waitForText('Total avant correction');

  const quantityChanged = await evaluate(`
    (() => {
      const articleRow = document.querySelector('.modal.show .modal-body .d-flex.gap-2.mb-2');
      const input = articleRow?.querySelector('input[type="number"]:not([disabled])');
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      ).set;
      setter.call(input, '2');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);
  assert(quantityChanged, 'La quantité de la vente à corriger est introuvable.');
  await waitForText('Total après correction : 24.68 €');

  await clickButton('+ Ajouter un paiement');
  await waitForPaymentCount(2, `document.querySelector('.modal.show')`);
  await paymentControl('method', 0, 'carte', `document.querySelector('.modal.show')`);
  await paymentControl('method', 1, 'espece', `document.querySelector('.modal.show')`);
  await paymentControl('amount', 0, '10.00', `document.querySelector('.modal.show')`);
  await waitForText('Total saisi pour les paiements : 24.68 €');

  await setSelect(
    '.modal.show select[aria-label="Sélectionnez un motif de correction"]',
    'Erreur E2E'
  );
  await fill('.modal.show #resp-pseudo', 'e2e-admin');
  await fill('.modal.show #resp-password', 'e2e-secret');
  await clickButtonExact('Valider la correction');

  const correctedTickets = await waitForApi(async () => {
    const tickets = await requestJson('/api/bilan');
    const expectedCount = saleCount + correctionNumber * 2;
    return tickets.body.length === expectedCount ? tickets.body : null;
  }, 'Les tickets d’annulation et de correction n’ont pas été créés.');

  const corrected = correctedTickets.find(ticket =>
    ticket.flag_correction === 1 && ticket.corrige_le_ticket === original.uuid_ticket
  );
  const cancellation = correctedTickets.find(ticket =>
    ticket.flag_annulation === 1 && ticket.prix_total === -1234
  );
  assert(corrected?.prix_total === 2468, 'Le total du ticket corrigé est incorrect.');
  assert(cancellation?.prix_total === -1234, 'Le ticket d’annulation est incorrect.');
  assert(corrected.moyen_paiement === 'mixte', 'Le ticket corrigé n’est pas en paiement mixte.');

  const correctedDetails = await requestJson(`/api/bilan/${corrected.uuid_ticket}/details`);
  assert(correctedDetails.body.objets[0].nbr === 2, 'La quantité corrigée n’est pas enregistrée.');
  assert(correctedDetails.body.paiementMixte.carte === 1000, 'La part carte corrigée est incorrecte.');
  assert(correctedDetails.body.paiementMixte.espece === 1468, 'La part espèces corrigée est incorrecte.');

  const originalDetails = await requestJson(`/api/bilan/${original.uuid_ticket}/details`);
  assert(originalDetails.body.historique.length === 1, 'L’historique de correction est absent.');
  assert(originalDetails.body.historique[0].motif === 'Erreur E2E', 'Le motif de correction est incorrect.');

  return { original, corrected, cancellation };
}

async function cancelPendingSale() {
  const before = await requestJson('/api/bilan');
  await evaluate(`location.hash = '#/caisse'`);
  await waitForText('Nouvelle vente');
  await clickButton('Nouvelle vente');
  await waitForText('Article E2E');
  await clickButton('Article E2E');
  await waitForText('Total : 12.34');
  await clickButton('Annuler la vente');
  await waitForText("Confirmer l'annulation de la vente");
  await clickButtonExact('Oui, annuler');
  await waitForText('Merci de cliquer sur');

  const after = await requestJson('/api/bilan');
  assert(after.body.length === before.body.length, 'La vente temporaire annulée a créé un ticket.');
}

async function verifyPendingSaleSurvivesRestart() {
  await evaluate(`location.hash = '#/caisse'`);
  await waitForText('Nouvelle vente');
  await clickButton('Nouvelle vente');
  await waitForText('Article E2E');
  await clickButton('Article E2E');
  await waitForText('Total : 12.34');

  const pendingBefore = await requestJson('/api/ventes');
  assert(pendingBefore.body.length === 1, 'La vente temporaire avant redemarrage est introuvable.');
  const pendingId = pendingBefore.body[0].id_temp_vente;

  await restartBackend();
  await mainWindow.loadURL(appUrl);
  await waitForText("Bienvenue sur l'application de gestion caisse", 15000);
  await clickButton('Commencer');
  await waitForText("Alors, on change de caissier");
  await fill('#resp-pseudo', 'e2e-admin');
  await fill('#resp-password', 'e2e-secret');
  await clickButtonExact('Se connecter');
  await waitForText('Nouvelle vente', 15000);
  await waitForText('Total : 12.34', 15000);

  const pendingAfter = await requestJson('/api/ventes');
  assert(
    pendingAfter.body.some(vente => vente.id_temp_vente === pendingId),
    'La vente temporaire a disparu apres redemarrage.'
  );
  const ticketAfter = await requestJson(`/api/ticket/${pendingId}`);
  assert(ticketAfter.body.length === 1, 'Le contenu du panier a disparu apres redemarrage.');
  assert(ticketAfter.body[0].prixt === salePrice, 'Le total du panier restaure est incorrect.');

  await clickButton('Annuler la vente');
  await waitForText("Confirmer l'annulation de la vente");
  await clickButtonExact('Oui, annuler');
  await waitForText('Merci de cliquer sur');
}

async function runScenario() {
  const openingStartedAt = Date.now();
  await mainWindow.loadURL(appUrl);
  await waitForText("Bienvenue sur l'application de gestion caisse");
  applicationOpeningMs = Date.now() - openingStartedAt;
  assert(
    applicationOpeningMs < 15000,
    `L'ouverture de l'application est trop lente : ${applicationOpeningMs} ms.`
  );
  writeLog(`[performance] ouverture application: ${applicationOpeningMs} ms`);
  await capture('01-welcome.png');

  await clickButton('Commencer');
  await waitForText("Bonjour, qui est");
  await fill('#resp-pseudo', 'e2e-admin');
  await fill('#resp-password', 'e2e-secret');
  await clickButton('Se connecter');

  await waitForText('Aucune caisse');
  await clickButton('Ouvrir une caisse');
  await waitForText('Ouverture de caisse');
  await fill('#fond-initial', '100');
  await fill('#resp-pseudo', 'e2e-admin');
  await fill('#resp-password', 'e2e-secret');
  await clickButton('Ouvrir la caisse principale');

  await waitForText('Nouvelle vente', 15000);
  await capture('02-register-open.png');

  await verifyPendingSaleSurvivesRestart();

  for (let index = 0; index < saleCount; index += 1) {
    if (index > 0 && index % 25 === 0) {
      await switchUser(users[index / 25]);
    }
    await createSale({
      ...paymentCycle[index % paymentCycle.length],
      expectedCount: index + 1,
      doubleSubmit: index === 0
    });
    if ((index + 1) % 10 === 0) {
      writeLog(`[progress] ${index + 1}/${saleCount} ventes validées`);
    }
  }

  let bilan = await requestJson('/api/bilan/jour');
  assert(bilan.status === 200, 'Le bilan journalier est inaccessible.');
  assert(bilan.body.nombre_vente === 100, 'Les cent ventes E2E ne sont pas comptabilisées.');
  assert(bilan.body.prix_total === 123400, 'Le total des cent ventes est incorrect.');
  assert(bilan.body.prix_total_espece === 39360, 'Le total espèces avant correction est incorrect.');
  assert(bilan.body.prix_total_carte === 34680, 'Le total carte avant correction est incorrect.');
  assert(bilan.body.prix_total_cheque === 24680, 'Le total chèque avant correction est incorrect.');
  assert(bilan.body.prix_total_virement === 24680, 'Le total virement avant correction est incorrect.');

  const sales = await requestJson('/api/bilan');
  const originalSales = sales.body.filter(ticket =>
    !ticket.flag_correction && !ticket.flag_annulation && !ticket.cloture
  );
  assert(originalSales.length === 100, 'Le nombre de tickets de vente initiaux est incorrect.');
  for (const method of ['espece', 'carte', 'cheque', 'virement', 'mixte']) {
    assert(
      originalSales.filter(ticket => ticket.moyen_paiement === method).length === 20,
      `La répartition des paiements ${method} est incorrecte.`
    );
  }
  const sellerCounts = originalSales.reduce((counts, ticket) => {
    counts[ticket.nom_vendeur] = (counts[ticket.nom_vendeur] || 0) + 1;
    return counts;
  }, {});
  assert(sellerCounts.Responsable === 25, 'Les ventes du responsable sont incorrectes.');
  assert(sellerCounts.Martin === 25, 'Les ventes d’Alice sont incorrectes.');
  assert(sellerCounts.Durand === 25, 'Les ventes de Bob sont incorrectes.');
  assert(sellerCounts.Bernard === 25, 'Les ventes de Claire sont incorrectes.');
  await capture('03-hundred-sales.png');

  const correctionUsers = [users[0], users[1], users[2], users[3], users[0]];
  for (let index = 0; index < correctionUsers.length; index += 1) {
    await switchUser(correctionUsers[index]);
    await correctCardSale(index + 1);
    writeLog(`[progress] correction ${index + 1}/${correctionUsers.length} validée`);
  }

  bilan = await requestJson('/api/bilan/jour');
  assert(bilan.body.nombre_vente === 100, 'Les corrections ne doivent pas augmenter le nombre de ventes.');
  assert(bilan.body.prix_total === 129570, 'Le total après cinq corrections est incorrect.');
  assert(bilan.body.prix_total_espece === 46700, 'Le total espèces après correction est incorrect.');
  assert(bilan.body.prix_total_carte === 33510, 'Le total carte après correction est incorrect.');
  assert(bilan.body.prix_total_cheque === 24680, 'Le total chèque après correction est incorrect.');
  assert(bilan.body.prix_total_virement === 24680, 'Le total virement après correction est incorrect.');

  const correctedList = await requestJson('/api/bilan');
  assert(
    correctedList.body.filter(ticket => ticket.flag_correction === 1).length === 5,
    'Le nombre de tickets corrigés est incorrect.'
  );
  assert(
    correctedList.body.filter(ticket => ticket.flag_annulation === 1).length === 5,
    'Le nombre de tickets d’annulation est incorrect.'
  );
  const journalBeforeClose = await requestJson('/api/caisse/journal');
  const openRegister = journalBeforeClose.body.find(session => !session.closed_at_utc);
  const cashiers = JSON.parse(openRegister?.caissiers || '[]');
  for (const cashier of ['Responsable', 'e2e-admin', 'e2e-alice', 'e2e-bob', 'e2e-claire']) {
    assert(cashiers.includes(cashier), `Le caissier ${cashier} manque dans la session.`);
  }
  await capture('04-five-corrections.png');

  await cancelPendingSale();

  await evaluate(`location.hash = '#/fermeture-caisse'`);
  await waitForText('Fermeture de caisse');
  await waitForCondition(
    `[...document.querySelectorAll('input[type="number"]')].length >= 4`,
    'Les champs de fermeture ne sont pas disponibles.'
  );
  await evaluate(`
    (() => {
      const values = ['567.00', '335.10', '246.80', '246.80'];
      const inputs = [...document.querySelectorAll('input[type="number"]')];
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      ).set;
      inputs.slice(0, 4).forEach((input, index) => {
        setter.call(input, values[index]);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    })()
  `);
  await fill('#resp-pseudo', 'e2e-admin');
  await fill('#resp-password', 'e2e-secret');
  const closureStartedAt = Date.now();
  await clickButton('Fermer la caisse');
  await waitForCondition(
    `location.hash.toLowerCase().includes('/bilan')`,
    'La fermeture de caisse n’a pas redirigé vers le bilan.',
    15000
  );
  const closureResponseMs = Date.now() - closureStartedAt;
  assert(
    closureResponseMs < 5000,
    `La fermeture de caisse est trop lente : ${closureResponseMs} ms.`
  );
  writeLog(`[performance] fermeture locale: ${closureResponseMs} ms`);

  const state = await requestJson('/api/session/etat-caisse');
  assert(state.status === 200 && state.body.ouverte === false, 'La caisse reste ouverte après fermeture.');

  const tickets = await requestJson('/api/bilan');
  const closureTicket = tickets.body.find(ticket => ticket.cloture === 1);
  assert(
    closureTicket,
    'Le ticket de clôture n’a pas été créé.'
  );
  assert(tickets.body.length === 111, 'Le nombre final de tickets est incorrect.');

  await waitForApi(async () => {
    const latestTickets = await requestJson('/api/bilan');
    return latestTickets.body.find(ticket => ticket.cloture === 1)?.lien;
  }, 'Le PDF de clôture n’a pas été généré.', 15000);

  const ticketsWithPdf = await requestJson('/api/bilan');
  const closureTicketWithPdf = ticketsWithPdf.body.find(ticket => ticket.cloture === 1);
  const closurePdfPath = path.resolve(root, closureTicketWithPdf.lien);
  assert(fs.existsSync(closurePdfPath), `Le PDF de clôture est introuvable : ${closurePdfPath}`);
  assert(fs.statSync(closurePdfPath).size > 0, 'Le PDF de clôture généré est vide.');
  const closurePdfMs = Date.now() - closureStartedAt;
  assert(
    closurePdfMs < 15000,
    `La generation du PDF de cloture est trop lente : ${closurePdfMs} ms.`
  );
  writeLog(`[performance] fermeture avec PDF: ${closurePdfMs} ms`);

  const syncDeadline = Date.now() + 10000;
  while (finalSyncRequests < 1 && Date.now() < syncDeadline) {
    await wait(100);
  }
  assert(finalSyncRequests === 1, 'La synchronisation finale n’a pas été appelée exactement une fois.');
  assert(
    backendErrorOutput.includes('Sync HTTP 503'),
    'La panne de synchronisation finale simulée n’a pas été journalisée.'
  );
  assert(
    !backendErrorOutput.includes('Erreur PDF'),
    `Une erreur asynchrone de clôture a été détectée : ${backendErrorOutput}`
  );
  await capture('05-register-closed.png');

  const rendererErrors = await evaluate(`
    window.__e2eRendererErrors || []
  `);
  assert(rendererErrors.length === 0, `Erreurs renderer détectées : ${rendererErrors.join(' | ')}`);
}

async function shutdown(exitCode) {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
  if (syncServer) {
    await new Promise(resolve => syncServer.close(resolve));
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  app.exit(exitCode);
}

app.whenReady().then(async () => {
  try {
    fs.rmSync(successMarker, { force: true });
    fs.rmSync(logPath, { force: true });
    fs.rmSync(artifactsDir, { recursive: true, force: true });
    writeLog(`Démarrage E2E sur ${appUrl}`);
    prepareDatabase();
    if (await isPortOpen(backendPort)) {
      throw new Error(
        'Le port 3001 est déjà utilisé. Fermez l’application de caisse avant le test E2E.'
      );
    }

    if (await isPortOpen(syncPort)) {
      throw new Error(`Le port ${syncPort} est déjà utilisé.`);
    }

    await launchSyncServer();
    launchBackend();
    await waitForBackend();
    process.env.BDD_CAISSE_E2E_ORIGIN = appUrl;

    mainWindow = new BrowserWindow({
      width: 1419,
      height: 1066,
      show: false,
      webPreferences: {
        contextIsolation: false,
        sandbox: false,
        preload: preloadScript
      }
    });

    mainWindow.webContents.on('console-message', (_event, level, message) => {
      if (level >= 2) writeLog(`[renderer-console-${level}] ${message}`);
    });

    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.executeJavaScript(`
        window.__e2eRendererErrors = [];
        window.addEventListener('error', event => {
          window.__e2eRendererErrors.push(event.message || 'window error');
        });
        window.addEventListener('unhandledrejection', event => {
          window.__e2eRendererErrors.push(String(event.reason || 'unhandled rejection'));
        });
      `).catch(() => {});
    });

    await runScenario();
    fs.writeFileSync(successMarker, 'ok');
    writeLog(`[performance] scenario complet: ${Date.now() - processStartedAt} ms`);
    writeLog('E2E production réussi.');
    console.log('E2E production réussi : session caisse complète validée.');
    await shutdown(0);
  } catch (error) {
    fs.rmSync(successMarker, { force: true });
    writeLog(`E2E production échoué : ${error.stack || error.message}`);
    console.error(`E2E production échoué : ${error.stack || error.message}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      await capture('failure.png').catch(() => {});
    }
    await shutdown(1);
  }
});
