const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { getActiveCredentials } = require('./webdavConfig');

const baseDir = path.join(os.homedir(), '.bdd-caisse');
const ticketsDir = path.join(baseDir, 'tickets');

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

  if (fs.existsSync(rootDir)) {
    await walk(rootDir);
  }

  return results;
}

function buildAuthHeader(username, password) {
  const token = Buffer.from(`${username}:${password}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

function normalizeRemotePath(basePathValue, relativePath) {
  const normalizedBase = basePathValue.startsWith('/') ? basePathValue : `/${basePathValue}`;
  return path.posix.join(normalizedBase, relativePath.split(path.sep).join('/'));
}

function buildRemoteUrl(baseUrl, remotePath) {
  const sanitizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const cleanPath = remotePath.startsWith('/') ? remotePath.slice(1) : remotePath;
  return new URL(cleanPath, sanitizedBase).toString();
}

async function ensureRemoteDir(baseUrl, headers, remotePath) {
  if (!remotePath || remotePath === '/') return;
  const segments = remotePath.split('/').filter(Boolean);
  let current = '';
  for (const segment of segments) {
    current += `/${segment}`;
    const targetUrl = buildRemoteUrl(baseUrl, current);
    await axios({
      method: 'MKCOL',
      url: targetUrl,
      headers,
      validateStatus: status => [200, 201, 301, 302, 405, 207].includes(status)
    });
  }
}

async function uploadTickets() {
  const credentials = getActiveCredentials();
  if (!credentials) {
    throw new Error('Aucun profil WebDAV actif trouvé. Vérifiez la variable d’environnement WEBDAV_ENDPOINTS.');
  }

  const { url, username, password, basePath } = credentials;
  const headers = buildAuthHeader(username, password);

  const files = await listLocalFiles(ticketsDir);
  for (const file of files) {
    const remotePath = normalizeRemotePath(basePath || '/tickets', file.relPath);
    const remoteDir = path.posix.dirname(remotePath);
    await ensureRemoteDir(url, headers, remoteDir);
    const targetUrl = buildRemoteUrl(url, remotePath);
    const stream = fs.createReadStream(file.absPath);
    await axios.put(targetUrl, stream, {
      headers: { ...headers, 'Content-Type': 'application/pdf' },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
  }

  return files.length;
}

module.exports = { uploadTickets };
