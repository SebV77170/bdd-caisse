#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const readline = require('readline');
const { spawnSync } = require('child_process');

const args = new Set(process.argv.slice(2));
const appDir = path.resolve(__dirname, '..');
const distDir = path.join(appDir, 'dist');
const packageJson = require(path.join(appDir, 'package.json'));

function parseDotEnvValue(value) {
  const trimmed = String(value).trim();
  if (!trimmed) return '';

  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed[trimmed.length - 1] === quote) {
    const unquoted = trimmed.slice(1, -1);
    return quote === '"'
      ? unquoted.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      : unquoted;
  }

  return trimmed;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/);
    if (!match) continue;

    const [, key, rawValue = ''] = match;
    if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    process.env[key] = parseDotEnvValue(rawValue);
  }
}

function loadReleaseEnv() {
  const repoDir = path.resolve(appDir, '..');
  [
    path.join(repoDir, '.env'),
    path.join(repoDir, 'backend', '.env'),
    path.join(appDir, '.env')
  ].forEach(loadEnvFile);
}

function normalizeUrlPath(pathValue) {
  const normalized = String(pathValue || '').trim();
  if (!normalized) return '/releases';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function joinUrlPath(baseUrl, pathValue) {
  const url = new URL(baseUrl);
  const currentPath = url.pathname.replace(/\/+$/, '');
  const nextPath = normalizeUrlPath(pathValue).replace(/^\/+/, '');
  url.pathname = `${currentPath}/${nextPath}`.replace(/\/+/g, '/');
  return url.toString();
}

function loadWebdavEndpoints() {
  const raw = process.env.WEBDAV_ENDPOINTS || process.env.WEBDAV_CONFIG;
  if (!raw) return {};

  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('WEBDAV_ENDPOINTS doit être un objet JSON de profils WebDAV.');
  }

  return parsed;
}

function applyWebdavReleaseDefaults() {
  if (process.env.BDD_CAISSE_UPDATE_URL) return;

  const endpoints = loadWebdavEndpoints();
  const profileName = process.env.BDD_CAISSE_RELEASE_WEBDAV_PROFILE
    || process.env.WEBDAV_PROFILE
    || Object.keys(endpoints)[0];
  const profile = profileName ? endpoints[profileName] : null;

  if (!profile || typeof profile !== 'object' || !profile.url) return;

  const releasePath = process.env.BDD_CAISSE_RELEASE_WEBDAV_PATH
    || process.env.BDD_CAISSE_UPDATE_PATH
    || profile.releasePath
    || profile.updatePath
    || '/releases';

  process.env.BDD_CAISSE_UPDATE_URL = profile.releaseUrl || profile.updateUrl || joinUrlPath(profile.url, releasePath);

  if (!process.env.BDD_CAISSE_WEBDAV_USER && !process.env.WEBDAV_USERNAME && profile.username) {
    process.env.BDD_CAISSE_WEBDAV_USER = profile.username;
  }
  if (!process.env.BDD_CAISSE_WEBDAV_PASSWORD && !process.env.WEBDAV_PASSWORD && profile.password) {
    process.env.BDD_CAISSE_WEBDAV_PASSWORD = profile.password;
  }

  console.log(`ℹ️ BDD_CAISSE_UPDATE_URL dérivée du profil WEBDAV_ENDPOINTS "${profileName}" (${process.env.BDD_CAISSE_UPDATE_URL}).`);
}

loadReleaseEnv();

function ask(question, defaultValue = '') {
  if (!process.stdin.isTTY || args.has('--yes')) return Promise.resolve(defaultValue);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

function runElectronBuilder() {
  console.log('🏗️ Construction des artefacts Electron avec electron-builder...');
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(npx, ['electron-builder', '--publish', 'never'], {
    cwd: appDir,
    stdio: 'inherit',
    shell: false
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  console.log('✅ Artefacts Electron générés dans electron-app/dist/.');
}

function getReleaseNotes() {
  const notesFileArg = process.argv.find((arg) => arg.startsWith('--notes-file='));
  const notesFile = notesFileArg ? notesFileArg.split('=').slice(1).join('=') : process.env.BDD_CAISSE_RELEASE_NOTES_FILE;

  if (notesFile) {
    return fs.readFileSync(path.resolve(process.cwd(), notesFile), 'utf8').trim();
  }

  if (process.env.BDD_CAISSE_RELEASE_NOTES) {
    return process.env.BDD_CAISSE_RELEASE_NOTES.trim();
  }

  return `Mise à jour ${packageJson.version}`;
}

function escapeYamlString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function injectReleaseNotes(releaseNotes) {
  const latestPath = path.join(distDir, 'latest.yml');
  if (!fs.existsSync(latestPath)) {
    throw new Error(`latest.yml introuvable dans ${distDir}`);
  }

  let latest = fs.readFileSync(latestPath, 'utf8').trimEnd();
  if (!/^releaseName:/m.test(latest)) {
    latest += `\nreleaseName: "Version ${escapeYamlString(packageJson.version)}"`;
  }
  if (!/^releaseNotes:/m.test(latest)) {
    const formattedNotes = releaseNotes
      .split(/\r?\n/)
      .map((line) => `  ${line}`)
      .join('\n');
    latest += `\nreleaseNotes: |-\n${formattedNotes}`;
  }
  latest += '\n';

  fs.writeFileSync(latestPath, latest, 'utf8');
}

function getFilesToUpload() {
  if (!fs.existsSync(distDir)) {
    throw new Error(`Dossier dist introuvable : ${distDir}`);
  }

  return fs.readdirSync(distDir)
    .filter((fileName) => {
      const fullPath = path.join(distDir, fileName);
      if (!fs.statSync(fullPath).isFile()) return false;
      return /\.(exe|yml|blockmap|zip)$/i.test(fileName);
    })
    .sort((a, b) => {
      if (a === 'latest.yml') return 1;
      if (b === 'latest.yml') return -1;
      return a.localeCompare(b);
    })
    .map((fileName) => ({ fileName, fullPath: path.join(distDir, fileName) }));
}

function uploadFile(baseUrl, file) {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(encodeURIComponent(file.fileName), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
    const client = targetUrl.protocol === 'https:' ? https : http;
    const headers = { 'Content-Length': fs.statSync(file.fullPath).size };
    const username = process.env.BDD_CAISSE_WEBDAV_USER || process.env.WEBDAV_USERNAME;
    const password = process.env.BDD_CAISSE_WEBDAV_PASSWORD || process.env.WEBDAV_PASSWORD;

    if (username || password) {
      headers.Authorization = `Basic ${Buffer.from(`${username || ''}:${password || ''}`).toString('base64')}`;
    }

    const request = client.request(targetUrl, { method: 'PUT', headers }, (response) => {
      response.resume();
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`Upload ${file.fileName} refusé (${response.statusCode})`));
        }
      });
    });

    const timeoutMs = Number(process.env.BDD_CAISSE_UPLOAD_TIMEOUT_MS || 120000);
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Upload ${file.fileName} interrompu après ${timeoutMs / 1000}s sans réponse.`));
    });

    request.on('error', reject);
    fs.createReadStream(file.fullPath).pipe(request);
  });
}

async function publishToWebdav() {
  applyWebdavReleaseDefaults();

  const updateUrl = process.env.BDD_CAISSE_UPDATE_URL;
  if (!updateUrl) {
    throw new Error('BDD_CAISSE_UPDATE_URL doit pointer vers le dossier WebDAV de release.');
  }

  console.log(`🌐 Publication WebDAV vers ${updateUrl}`);

  const releaseNotes = getReleaseNotes();
  injectReleaseNotes(releaseNotes);

  const files = getFilesToUpload();
  if (files.length === 0) {
    throw new Error(`Aucun artefact à publier dans ${distDir}`);
  }

  for (const file of files) {
    process.stdout.write(`⬆️  Upload ${file.fileName}... `);
    await uploadFile(updateUrl, file);
    process.stdout.write('OK\n');
  }
}

async function main() {
  let shouldPublish = args.has('--publish');
  if (args.has('--no-publish')) shouldPublish = false;

  if (shouldPublish) applyWebdavReleaseDefaults();

  if (shouldPublish && !process.env.BDD_CAISSE_UPDATE_URL) {
    throw new Error('BDD_CAISSE_UPDATE_URL doit pointer vers le dossier WebDAV de release avant de lancer --publish. Utilise npm run package:no-publish pour construire sans publier.');
  }

  runElectronBuilder();

  if (!args.has('--publish') && !args.has('--no-publish')) {
    const answer = await ask('Publier cette mise à jour sur le serveur WebDAV ? [o/N] ', 'n');
    shouldPublish = ['o', 'oui', 'y', 'yes'].includes(answer.toLowerCase());
  }

  if (!shouldPublish) {
    console.log('ℹ️ Publication WebDAV ignorée. Les artefacts sont disponibles dans electron-app/dist/.');
    return;
  }

  applyWebdavReleaseDefaults();

  await publishToWebdav();
  console.log('✅ Mise à jour publiée sur le serveur WebDAV.');
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
