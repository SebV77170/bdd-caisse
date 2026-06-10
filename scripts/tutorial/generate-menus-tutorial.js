const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { createTutorialOutput } = require('./tutorial-output');

const root = path.resolve(__dirname, '../..');
const runtimeRoot = path.join(root, '.tutorial-runtime-menus');
const outputDir = path.join(root, 'tutorial-output', 'presentation-menus');
const backendNode = path.join(root, 'electron-app', 'vendor', 'node.exe');
const backendEntry = path.join(root, 'backend', 'index.js');
const seedScript = path.join(root, 'scripts', 'e2e', 'seed-production-db.js');
const preloadScript = path.join(root, 'scripts', 'e2e', 'preload.js');
const backendPort = 3101;
const appUrl = `http://localhost:${backendPort}`;
const logPath = path.join(runtimeRoot, 'tutorial.log');

let backendProcess;
let mainWindow;

const tutorial = createTutorialOutput({
  outputDir,
  title: 'Présentation des menus et des options',
  introduction: 'Ce tutoriel présente le menu principal, les raccourcis de la barre supérieure et les principaux écrans de consultation et de configuration.'
});

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeLog(message) {
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.appendFileSync(logPath, `${message}\n`, 'utf8');
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
  backendProcess.stdout.on('data', chunk => process.stdout.write(`[tutoriel-menus] ${chunk}`));
  backendProcess.stderr.on('data', chunk => process.stderr.write(`[tutoriel-menus] ${chunk}`));
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

async function clickSelector(selector) {
  const clicked = await evaluate(`
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return false;
      element.click();
      return true;
    })()
  `);
  assert(clicked, `Élément introuvable : ${selector}`);
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

async function navigate(hash, expectedText) {
  await evaluate(`location.hash = ${JSON.stringify(hash)}`);
  await waitForText(expectedText);
}

async function openMainMenu() {
  await clickSelector('.navbar-toggler');
  await waitForText('Menu principal');
  await waitForCondition(
    `document.querySelector('#main-nav')?.classList.contains('show')`,
    'Le menu principal ne s’est pas ouvert.'
  );
  await wait(500);
  await mainWindow.webContents.capturePage();
  await wait(100);
}

async function prepareDemonstration() {
  await mainWindow.loadURL(appUrl);
  await waitForText("Bienvenue sur l'application de gestion caisse");
  await clickText('Commencer');
  await waitForText("Bonjour, qui est");
  await fill('#resp-pseudo', 'e2e-admin');
  await fill('#resp-password', 'e2e-secret');
  await clickText('Se connecter');
  await waitForText('Aucune caisse');
  await clickText('Ouvrir une caisse');
  await waitForText('Ouverture de caisse');
  await fill('#fond-initial', '100');
  await fill('#resp-pseudo', 'e2e-admin');
  await fill('#resp-password', 'e2e-secret');
  await clickText('Ouvrir la caisse principale');
  await waitForText('Nouvelle vente', 15000);
  await clickText('Nouvelle vente');
  await waitForText('Article E2E');
  await clickText('Article E2E');
  await waitForText('Total : 12.34');
  await clickText('Valider la vente');
  await waitForText('Finaliser la vente');
  await clickText('Valider la vente', true);
  await waitForCondition(
    `!document.body.innerText.includes('Finaliser la vente')`,
    'La vente de démonstration n’a pas été validée.'
  );
}

async function runScenario() {
  await prepareDemonstration();

  await openMainMenu();
  await capture(1, 'menu-principal', 'Ouvrir le menu principal',
    'Le bouton en haut à gauche ouvre la navigation vers toutes les fonctions de l’application.',
    { selector: '#main-nav', padding: 0 });
  await capture(2, 'menu-caisse', 'Caisse',
    'Ce menu revient à l’écran de vente pour créer un ticket, ajouter des articles et encaisser.',
    { targetText: 'Caisse' });
  await capture(3, 'menu-bilan', 'Bilan tickets',
    'Le bilan permet de retrouver les tickets, les trier, afficher leur détail, les corriger, créer une facture ou les envoyer par e-mail.',
    { targetText: 'Bilan tickets' });
  await capture(4, 'menu-fermeture', 'Fermeture Caisse',
    'Lorsque la caisse est ouverte, cette option conduit au contrôle des montants et à la clôture de la session.',
    { targetText: 'Fermeture Caisse' });
  await capture(5, 'menu-journal', 'Journal caisse',
    'Le journal présente l’historique des sessions, leurs responsables, leurs horaires et les éventuels écarts.',
    { targetText: 'Journal caisse' });
  await capture(6, 'menu-parametres', 'Paramètres',
    'Cette rubrique regroupe les réglages de synchronisation, du poste, du réseau et des produits.',
    { targetText: 'Paramètres' });

  await clickSelector('.btn-close');
  await waitForCondition(
    `!document.querySelector('#main-nav')?.classList.contains('show')`,
    'Le menu principal ne s’est pas refermé.'
  );

  await capture(7, 'mode-tactile', 'Mode tactile',
    'L’interrupteur avec la main active les claviers tactiles pour faciliter les saisies sur un écran tactile.',
    { selector: '#modeTactileSwitch', padding: 12 });
  await capture(8, 'mode-paiement', 'Présentation des paiements',
    'L’interrupteur avec la carte alterne entre des boutons de paiement rapides et le formulaire détaillé.',
    { selector: '#modePaiementBoutonsSwitch', padding: 12 });
  await capture(9, 'synchronisation-rapide', 'Synchronisation manuelle',
    'Le bouton avec le sablier lance une synchronisation immédiate. Son icône indique ensuite la réussite ou l’échec.',
    { selector: '.btn-outline-success', padding: 10 });
  await capture(10, 'changer-utilisateur', 'Changer d’utilisateur',
    'Ce bouton déconnecte le caissier courant sans fermer la session de caisse.',
    { targetText: "Changer d'utilisateur" });

  await navigate('#/bilan', 'Bilan des tickets de caisse');
  await capture(11, 'bilan-filtres', 'Filtrer et trier les tickets',
    'Choisissez une date, puis triez la liste par paiement, montant ou date.',
    { selector: '.my-4.p-3.border.rounded', padding: 8 });
  await waitForText('Mode Paiement');
  await capture(12, 'bilan-actions', 'Actions disponibles sur un ticket',
    'Cliquez sur une ligne pour afficher le détail. Les boutons permettent notamment de préparer une facture ou un envoi par e-mail.',
    { selector: 'table.table', padding: 6 });

  await navigate('#/journal-caisse', 'Journal de caisse');
  await capture(13, 'journal-sessions', 'Consulter les sessions',
    'Chaque ligne correspond à une session. Cliquez dessus pour afficher son bilan et les modifications associées.',
    { selector: 'table.table', padding: 6 });

  await navigate('#/parametres', 'Paramètres de synchronisation');
  await capture(14, 'parametres-synchronisation', 'Synchronisation automatique',
    'Définissez ici la fréquence de synchronisation et activez ou désactivez son fonctionnement automatique.',
    { targetText: 'Paramètres de synchronisation' });
  await capture(15, 'parametres-webdav', 'Tickets et mises à jour',
    'La section WebDAV gère l’envoi des tickets. La section suivante permet de rechercher une nouvelle version de l’application.',
    { targetText: 'Synchronisation WebDAV' });
  await capture(16, 'parametres-magasin', 'Informations du poste',
    'Le nom du local et le numéro de caisse identifient ce poste dans les échanges et les documents.',
    { targetText: 'Informations magasin' });
  await capture(17, 'parametres-reseau', 'Réseau et caisse principale',
    'Sur une caisse secondaire, indiquez l’adresse de la caisse principale. Le scanner aide à repérer les appareils du réseau.',
    { targetText: 'Réseau' });
  await capture(18, 'parametres-utilisateurs', 'Utilisateurs',
    'Ces commandes comparent les utilisateurs locaux avec la source centrale et permettent leur mise à jour.',
    { targetText: 'Synchronisation utilisateurs' });
  await capture(19, 'parametres-produits', 'Produits et corrections',
    'Les dernières sections servent à organiser les boutons produits et à gérer les motifs proposés lors d’une correction.',
    { targetText: 'Gestion des boutons produits' });
  await capture(20, 'outils-developpeur', 'Outils développeur',
    'Cette zone est réservée à la maintenance technique. Elle ne doit pas être activée pendant l’utilisation courante.',
    { targetText: 'Outils développeur' });

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
    writeLog(`Démarrage du tutoriel des menus sur ${appUrl}`);
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
