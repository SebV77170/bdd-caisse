const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { createTutorialOutput } = require('./tutorial-output');

const root = path.resolve(__dirname, '../..');
const runtimeRoot = path.join(root, '.tutorial-runtime');
const outputDir = path.join(root, 'tutorial-output', 'parcours-standard');
const backendNode = path.join(root, 'electron-app', 'vendor', 'node.exe');
const backendEntry = path.join(root, 'backend', 'index.js');
const seedScript = path.join(root, 'scripts', 'e2e', 'seed-production-db.js');
const preloadScript = path.join(root, 'scripts', 'e2e', 'preload.js');
const backendPort = 3101;
const appUrl = `http://localhost:${backendPort}`;
const logPath = path.join(runtimeRoot, 'tutorial.log');

let backendProcess;
let mainWindow;

function writeLog(message) {
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.appendFileSync(logPath, `${message}\n`, 'utf8');
}

const tutorial = createTutorialOutput({
  outputDir,
  title: 'Parcours standard : de l’ouverture à la fermeture de la caisse',
  introduction: 'Ce tutoriel présente une journée de caisse simple : identification, ouverture, vente, encaissement et clôture.'
});

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
    env: { ...process.env, BDD_CAISSE_E2E_ROOT: runtimeRoot },
    encoding: 'utf8',
    windowsHide: true
  });
  assert(result.status === 0, result.stderr || 'La base de démonstration n’a pas pu être créée.');
}

function launchBackend() {
  const homeDir = path.join(runtimeRoot, 'home');
  backendProcess = spawn(backendNode, [backendEntry], {
    cwd: path.join(root, 'backend'),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(backendPort),
      USERPROFILE: homeDir,
      HOME: homeDir,
      BDD_CAISSE_E2E: '1',
      BDD_CAISSE_E2E_ORIGIN: appUrl,
      FINAL_SYNC_URL: 'http://127.0.0.1:3299/sync',
      MYSQL_CONNECT_TIMEOUT: '500'
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  backendProcess.stdout.on('data', chunk => process.stdout.write(`[tutoriel-backend] ${chunk}`));
  backendProcess.stderr.on('data', chunk => process.stderr.write(`[tutoriel-backend] ${chunk}`));
}

function requestJson(pathname) {
  return new Promise((resolve, reject) => {
    http.get(`${appUrl}${pathname}`, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try {
          resolve({ status: response.statusCode, body: JSON.parse(body) });
        } catch {
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
      if ((await requestJson('/api/bilan/jour')).status === 200) return;
    } catch {}
    await wait(200);
  }
  throw new Error(`Le backend du tutoriel ne répond pas sur le port ${backendPort}.`);
}

async function evaluate(expression) {
  return mainWindow.webContents.executeJavaScript(expression, true);
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
  return waitForCondition(
    `document.body?.innerText.includes(${JSON.stringify(text)})`,
    `Texte introuvable dans l’interface : ${text}`,
    timeoutMs
  );
}

async function clickText(text, exact = false) {
  const clicked = await evaluate(`
    (() => {
      const expected = ${JSON.stringify(text)};
      const element = [...document.querySelectorAll('button, a')]
        .find(node => {
          const value = (node.innerText || '').trim();
          return ${exact ? 'value === expected' : 'value.includes(expected)'};
        });
      if (!element) return false;
      element.click();
      return true;
    })()
  `);
  assert(clicked, `Bouton ou lien introuvable : ${text}`);
}

async function fill(selector, value) {
  const changed = await evaluate(`
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return false;
      const prototype = element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)});
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);
  assert(changed, `Champ introuvable : ${selector}`);
}

async function capture(number, slug, title, comment, target = {}) {
  await tutorial.captureStep(mainWindow.webContents, {
    number,
    slug,
    title,
    comment,
    ...target
  });
}

async function runScenario() {
  await mainWindow.loadURL(appUrl);
  await waitForText("Bienvenue sur l'application de gestion caisse");
  await capture(1, 'accueil', 'Démarrer l’application',
    'Cliquez sur « Commencer » pour accéder à l’identification.', { targetText: 'Commencer' });

  await clickText('Commencer');
  await waitForText("Bonjour, qui est");
  await fill('#resp-pseudo', 'e2e-admin');
  await fill('#resp-password', 'e2e-secret');
  await capture(2, 'identification', 'S’identifier',
    'Saisissez votre pseudo et votre mot de passe, puis cliquez sur « Se connecter ».', { targetText: 'Se connecter' });
  await clickText('Se connecter');

  await waitForText('Aucune caisse');
  await capture(3, 'caisse-fermee', 'Ouvrir une session de caisse',
    'Aucune caisse n’est ouverte. Utilisez ce bouton pour commencer la journée.', { targetText: 'Ouvrir une caisse' });
  await clickText('Ouvrir une caisse');

  await waitForText('Ouverture de caisse');
  await fill('#fond-initial', '100');
  await fill('#resp-pseudo', 'e2e-admin');
  await fill('#resp-password', 'e2e-secret');
  await capture(4, 'fond-initial', 'Déclarer le fond initial',
    'Comptez les espèces présentes au départ et saisissez ici le montant total.', { selector: '#fond-initial', padding: 12 });
  await capture(5, 'validation-ouverture', 'Valider l’ouverture',
    'Le responsable confirme l’ouverture avec ses identifiants.', { targetText: 'Ouvrir la caisse principale' });
  await clickText('Ouvrir la caisse principale');

  await waitForText('Nouvelle vente', 15000);
  await capture(6, 'nouvelle-vente', 'Créer une nouvelle vente',
    'Cliquez sur « Nouvelle vente » avant d’ajouter les articles du client.', { targetText: 'Nouvelle vente' });
  await clickText('Nouvelle vente');

  await waitForText('Article E2E');
  await capture(7, 'ajout-article', 'Ajouter un article',
    'Sélectionnez les articles vendus. Ils apparaissent dans le ticket à droite.', { targetText: 'Article E2E' });
  await clickText('Article E2E');

  await waitForText('Total : 12.34');
  await capture(8, 'valider-panier', 'Vérifier puis finaliser',
    'Contrôlez le ticket et son total, puis ouvrez la zone de validation.', { targetText: 'Valider la vente' });
  await clickText('Valider la vente');

  await waitForText('Finaliser la vente');
  await capture(9, 'paiement', 'Choisir le moyen de paiement',
    'Le montant est calculé automatiquement. Choisissez le moyen de paiement avant de valider.', { selector: '.p-3.bg-white.border.rounded.shadow-sm', padding: 8 });
  await clickText('Valider la vente', true);
  await waitForCondition(
    `!document.body.innerText.includes('Finaliser la vente')`,
    'La vente n’a pas été validée.'
  );

  await evaluate(`location.hash = '#/fermeture-caisse'`);
  await waitForText('Fermeture de caisse');
  await waitForCondition(
    `[...document.querySelectorAll('input[type="number"]')].length >= 4`,
    'Les champs de fermeture ne sont pas disponibles.'
  );
  await fill('input[type="number"]', '100');
  const closureInputsFilled = await evaluate(`
    (() => {
      const inputs = [...document.querySelectorAll('input[type="number"]')];
      const values = ['100', '12.34', '0', '0'];
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      inputs.slice(0, 4).forEach((input, index) => {
        setter.call(input, values[index]);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      return inputs.length >= 4;
    })()
  `);
  assert(closureInputsFilled, 'Les montants de fermeture n’ont pas pu être saisis.');
  await fill('#resp-pseudo', 'e2e-admin');
  await fill('#resp-password', 'e2e-secret');

  await capture(10, 'controle-cloture', 'Contrôler les montants réels',
    'Comparez les montants attendus avec les espèces et paiements réellement constatés.', { targetText: 'Montant réel dans la caisse' });
  await capture(11, 'fermer-caisse', 'Fermer la caisse',
    'Après vérification, le responsable confirme la clôture de la session.', { targetText: 'Fermer la caisse' });
  await clickText('Fermer la caisse');

  await waitForCondition(
    `location.hash.toLowerCase().includes('/bilan')`,
    'La fermeture n’a pas redirigé vers le bilan.',
    15000
  );
  await capture(12, 'bilan-final', 'Consulter le bilan',
    'La caisse est fermée. Le bilan et le ticket de clôture permettent de conserver une trace de la journée.');

  tutorial.finish();
}

async function shutdown(exitCode) {
  if (backendProcess && !backendProcess.killed) backendProcess.kill();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  app.exit(exitCode);
}

app.whenReady().then(async () => {
  try {
    prepareDatabase();
    fs.rmSync(logPath, { force: true });
    writeLog(`Démarrage du générateur sur ${appUrl}`);
    if (await isPortOpen(backendPort)) {
      throw new Error(`Le port ${backendPort} est déjà utilisé.`);
    }
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

    await runScenario();
    writeLog(`Tutoriel généré dans ${outputDir}`);
    console.log(`Tutoriel généré dans ${outputDir}`);
    await shutdown(0);
  } catch (error) {
    writeLog(error.stack || error.message);
    console.error(error.stack || error.message);
    await shutdown(1);
  }
});
