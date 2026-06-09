const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { getActiveCredentials } = require('./webdavConfig');

const baseDir = path.join(os.homedir(), '.bdd-caisse');
const ticketsDir = path.join(baseDir, 'tickets');
const facturesDir = path.join(baseDir, 'factures');

function getRequestTimeout() {
  const configured = Number(process.env.WEBDAV_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 30000;
}

// -------- 1. Fonction récursive pour lister tous les fichiers --------
async function listLocalFiles(rootDir) {
  const results = [];
  async function walk(current, prefix = '') {
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absPath = path.join(current, entry.name);
      const relPath = path.join(prefix, entry.name);
      if (entry.isDirectory()) {
        await walk(absPath, relPath);
      } else if (entry.isFile()) {
        results.push({ absPath, relPath });
      }
    }
  }
  if (fs.existsSync(rootDir)) await walk(rootDir);
  return results;
}

// -------- 2. BASIC AUTH --------
function buildAuthHeader(username, password) {
  const token = Buffer.from(`${username}:${password}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

// -------- 3. Normalisation du chemin distant --------
function normalizeRemotePath(basePathValue, relativePath) {
  const normalizedBase = basePathValue.startsWith('/') ? basePathValue : `/${basePathValue}`;
  return path.posix.join(normalizedBase, relativePath.split(path.sep).join('/'));
}

function buildRemoteUrl(baseUrl, remotePath) {
  const sanitizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const cleanPath = remotePath.startsWith('/') ? remotePath.slice(1) : remotePath;
  return new URL(cleanPath, sanitizedBase).toString();
}

// -------- 4. Cache local des dossiers déjà créés --------
const createdDirs = new Set();

function dirDepth(p) {
  return p.split('/').filter(Boolean).length;
}

async function mkcolDir(baseUrl, headers, remoteDir) {
  const targetUrl = buildRemoteUrl(baseUrl, remoteDir);
  const res = await axios({
    method: 'MKCOL',
    url: targetUrl,
    headers,
    timeout: getRequestTimeout(),
    validateStatus: () => true
  });

  console.log(`MKCOL ${remoteDir} -> ${res.status}`);

  // 201 = créé, 405 = existe déjà, 200/301/302/207 possibles
  if ([201, 405, 200, 301, 302, 207].includes(res.status)) {
    createdDirs.add(remoteDir);
    return true;
  }

  if (res.status === 409) {
    console.log(`⚠️ MKCOL 409 (parent manquant) pour ${remoteDir}`);
  } else {
    console.log(`⚠️ MKCOL statut inattendu ${res.status} pour ${remoteDir}`);
  }
  return false;
}

async function createAllRemoteDirs(baseUrl, headers, files, basePathValue) {
  // basePath normalisé ("/tickets" par défaut)
  const base = basePathValue
    ? (basePathValue.startsWith('/') ? basePathValue : '/' + basePathValue)
    : '/tickets';

  const dirsSet = new Set();

  // 1️⃣ Collecter tous les dossiers ET leurs parents
  for (const file of files) {
    const remotePath = normalizeRemotePath(base, file.relPath);
    const remoteDir = path.posix.dirname(remotePath);

    if (!remoteDir || remoteDir === '/') continue;

    // Exemple remoteDir = "/tickets/2025/09/27"
    const segments = remoteDir.split('/').filter(Boolean);
    let current = '';

    for (const seg of segments) {
      current += '/' + seg;          // "/tickets", puis "/tickets/2025", etc.
      dirsSet.add(current);
    }
  }

  // 2️⃣ Trier par profondeur : d'abord /tickets, puis /tickets/2025, etc.
  const dirs = Array.from(dirsSet).sort((a, b) => dirDepth(a) - dirDepth(b));

  console.log(`🗂  ${dirs.length} dossiers à créer côté WebDAV`);

  // 3️⃣ Création séquentielle (on optimise plus tard si besoin)
  for (const dir of dirs) {
    if (createdDirs.has(dir)) continue;
    await mkcolDir(baseUrl, headers, dir);
  }
}

async function ensureRemoteDir(baseUrl, headers, remoteDir) {
  if (!remoteDir || remoteDir === '/') return;

  const segments = remoteDir.split('/').filter(Boolean);
  let current = '';

  for (const segment of segments) {
    current += `/${segment}`;

    if (createdDirs.has(current)) {
      continue;
    }

    const targetUrl = buildRemoteUrl(baseUrl, current);

    try {
      const res = await axios({
        method: 'MKCOL',
        url: targetUrl,
        headers,
        timeout: getRequestTimeout(),
        // on accepte tous les codes, on les analyse ensuite
        validateStatus: () => true
      });

      console.log(`MKCOL ${current} -> ${res.status}`);

      // OK : créé ou déjà existant
      if ([201, 405, 200, 301, 302, 207].includes(res.status)) {
        createdDirs.add(current);
        continue;
      }

      if (res.status === 409) {
        console.log(`⚠️ MKCOL 409 (parent manquant) pour ${current}`);
        // on continue, mais le PUT sur ce répertoire risque d'échouer
      } else {
        console.log(`⚠️ MKCOL statut inattendu ${res.status} pour ${current}`);
      }
    } catch (err) {
      console.log(`❌ NETWORK ERROR MKCOL ${current}`, err.code || err.message);
    }
  }
}

// -------- 5. Upload avec retry (3 tentatives) --------
async function uploadFileOnce(targetUrl, absPath, headers) {
  const stream = fs.createReadStream(absPath);

  await axios.put(targetUrl, stream, {
    headers: { ...headers, 'Content-Type': 'application/pdf' },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: getRequestTimeout()
  });
}

async function uploadWithRetry(targetUrl, absPath, headers, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await uploadFileOnce(targetUrl, absPath, headers);
      return true;
    } catch (err) {
      if (err.response) {
        console.log(`❌ HTTP ERROR ${err.response.status} sur ${targetUrl}`);
      } else {
        console.log(`❌ NETWORK ERROR sur ${targetUrl}`, err.code || err.message);
      }

      if (attempt < maxAttempts) {
        console.log(`Retry ${attempt}/${maxAttempts} : ${targetUrl}`);
        await new Promise(r => setTimeout(r, 500)); // petite pause
      } else {
        console.log(`❌ Abandon après ${maxAttempts} tentatives : ${targetUrl}`);
        return false;
      }
    }
  }
}



// -------- 6. Limiter la concurrence (5 uploads simultanés) --------
async function runWithConcurrency(items, limit, worker) {
  const queue = [...items];
  const results = [];

  async function runOne() {
    while (queue.length > 0) {
      const item = queue.pop();
      results.push(await worker(item));
      // pour ménager le serveur
      await new Promise(r => setTimeout(r, 50));
    }
  }

  const workers = Array.from({ length: limit }, runOne);
  await Promise.all(workers);

  return results;
}


async function uploadDirectory({ label, localDir, baseUrl, headers, remoteBasePath }) {
  const files = await listLocalFiles(localDir);
  console.log(`📦 ${label}: ${files.length} fichiers détectés en local.`);

  if (files.length === 0) {
    return { success: 0, failed: 0, total: 0 };
  }

  // 1) Créer tous les dossiers nécessaires
  await createAllRemoteDirs(baseUrl, headers, files, remoteBasePath);

  // 2) Uploader les fichiers
  const base = remoteBasePath;

  const results = await runWithConcurrency(
    files,
    3, // 3 uploads en parallèle pour commencer
    async file => {
      const remotePath = normalizeRemotePath(base, file.relPath);
      const targetUrl = buildRemoteUrl(baseUrl, remotePath);
      return uploadWithRetry(targetUrl, file.absPath, headers);
    }
  );

  const success = results.filter(r => r === true).length;
  const failed = results.filter(r => r === false).length;

  console.log(`✅ ${label}: Upload OK ${success} fichiers`);
  console.log(`❌ ${label}: Échecs ${failed}`);

  return { success, failed, total: files.length };
}

// -------- 7. Version optimisée de uploadTickets --------
async function uploadTickets() {
  const credentials = getActiveCredentials();
  if (!credentials) {
    throw new Error('Aucun profil WebDAV actif trouvé. Vérifiez WEBDAV_ENDPOINTS.');
  }

  const { url, username, password, basePath } = credentials;
  const headers = buildAuthHeader(username, password);
  const ticketsBasePath = basePath || '/tickets';
  return uploadDirectory({
    label: 'tickets',
    localDir: ticketsDir,
    baseUrl: url,
    headers,
    remoteBasePath: ticketsBasePath
  });
}

async function uploadFactures() {
  const credentials = getActiveCredentials();
  if (!credentials) {
    throw new Error('Aucun profil WebDAV actif trouvé. Vérifiez WEBDAV_ENDPOINTS.');
  }

  const { url, username, password } = credentials;
  const headers = buildAuthHeader(username, password);

  return uploadDirectory({
    label: 'factures',
    localDir: facturesDir,
    baseUrl: url,
    headers,
    remoteBasePath: '/factures'
  });
}

async function uploadTicketsAndFactures() {
  const tickets = await uploadTickets();
  const factures = await uploadFactures();
  return { tickets, factures };
}

module.exports = {
  uploadTickets,
  uploadFactures,
  uploadTicketsAndFactures,
  getRequestTimeout
};
