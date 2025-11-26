const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { getActiveCredentials } = require('./webdavConfig');

const baseDir = path.join(os.homedir(), '.bdd-caisse');
const ticketsDir = path.join(baseDir, 'tickets');

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
async function uploadWithRetry(url, stream, headers, attempt = 1) {
  try {
    await axios.put(url, stream, {
      headers: { ...headers, 'Content-Type': 'application/pdf' },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 30000
    });
    return true;
  } catch (err) {
    if (err.response) {
      console.log(`❌ HTTP ERROR ${err.response.status} sur ${url}`);
    } else {
      console.log(`❌ NETWORK ERROR sur ${url}`, err.code || err.message);
    }

    if (attempt < 3) {
      console.log(`Retry ${attempt}/3 : ${url}`);
      // IMPORTANT : recréer le stream, sinon il est "consommé"
      const fs = require('fs');
      const newStream = fs.createReadStream(new URL(url).pathname.replace(/^.*tickets/, path.join(ticketsDir)));
      return uploadWithRetry(url, newStream, headers, attempt + 1);
    }

    return false;
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
      // petite pause optionnelle pour ménager le serveur
      await new Promise(r => setTimeout(r, 50));
    }
  }

  const workers = Array.from({ length: limit }, runOne);
  await Promise.all(workers);

  return results;
}


// -------- 7. Version optimisée de uploadTickets --------
async function uploadTickets() {
  const credentials = getActiveCredentials();
  if (!credentials) throw new Error('Aucun profil WebDAV actif.');

  const { url, username, password, basePath } = credentials;
  const headers = buildAuthHeader(username, password);

  const files = await listLocalFiles(ticketsDir);
  console.log(`📦 ${files.length} fichiers détectés en local.`);

  const results = await runWithConcurrency(
  files,
  2, // 2 uploads simultanés seulement
  async file => {
    const remotePath = normalizeRemotePath(basePath || '/tickets', file.relPath);
    const remoteDir = path.posix.dirname(remotePath);
    await ensureRemoteDir(url, headers, remoteDir);

    const targetUrl = buildRemoteUrl(url, remotePath);
    const stream = fs.createReadStream(file.absPath);

    return uploadWithRetry(targetUrl, stream, headers);
  }
);


  const success = results.filter(r => r === true).length;
  const failed = results.filter(r => r === false).length;

  console.log(`✅ Upload OK : ${success} fichiers`);
  console.log(`❌ Échecs : ${failed}`);

  return { success, failed };
}

module.exports = { uploadTickets };
