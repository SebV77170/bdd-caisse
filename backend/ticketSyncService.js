const fs = require('fs');
const path = require('path');
const os = require('os');
const SftpClient = require('ssh2-sftp-client');
const { getTicketSyncConfig } = require('./ticketSyncConfig');

const localTicketsBaseDir = path.join(os.homedir(), '.bdd-caisse', 'tickets');

let isRunning = false;
let lastRunAt = null;
let lastResult = null;
let lastError = null;

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function collectLocalFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectLocalFiles(fullPath));
    } else if (entry.isFile()) {
      const stat = fs.statSync(fullPath);
      results.push({
        path: fullPath,
        size: stat.size,
        mtimeMs: stat.mtimeMs
      });
    }
  }
  return results;
}

async function ensureRemoteDir(sftp, dir, cache) {
  const normalized = dir.endsWith('/') ? dir.slice(0, -1) : dir;
  if (cache.has(normalized)) return;
  try {
    await sftp.mkdir(normalized, true);
  } catch (err) {
    if (err.code !== 4 && err.code !== 11 && err.message?.includes('Failure') === false) {
      throw err;
    }
  }
  cache.add(normalized);
}

async function uploadFile(sftp, localFile, remoteBase, cache) {
  const relative = path.relative(localTicketsBaseDir, localFile.path);
  const remotePath = toPosix(path.posix.join(remoteBase, toPosix(relative)));
  const remoteDir = path.posix.dirname(remotePath);

  await ensureRemoteDir(sftp, remoteDir, cache);

  let skip = false;
  try {
    const stat = await sftp.stat(remotePath);
    if (stat && stat.size === localFile.size) {
      skip = true;
    }
  } catch (err) {
    if (err.code !== 2 && !/No such file/i.test(err.message || '')) {
      throw err;
    }
  }

  if (skip) {
    return { skipped: true, remotePath };
  }

  await sftp.fastPut(localFile.path, remotePath);
  return { skipped: false, remotePath };
}

async function runSyncJob({ source = 'manual' } = {}) {
  const config = getTicketSyncConfig();
  const summary = {
    source,
    uploaded: 0,
    skipped: 0,
    total: 0
  };

  if (!fs.existsSync(localTicketsBaseDir)) {
    return summary;
  }

  const files = collectLocalFiles(localTicketsBaseDir);
  summary.total = files.length;

  if (files.length === 0) {
    return summary;
  }

  if (!config.host || !config.username || !config.remoteBasePath) {
    throw new Error('Configuration SFTP incomplète (hôte, utilisateur ou chemin distant manquant).');
  }

  const sftp = new SftpClient();
  const createdDirs = new Set();
  try {
    await sftp.connect({
      host: config.host,
      port: config.port || 22,
      username: config.username,
      password: config.password || undefined
    });

    const remoteBaseRaw = config.remoteBasePath.replace(/\\/g, '/');
    const remoteBase = remoteBaseRaw === '/' ? '/' : remoteBaseRaw.replace(/\/$/, '');

    for (const file of files) {
      try {
        const result = await uploadFile(sftp, file, remoteBase, createdDirs);
        if (result.skipped) summary.skipped += 1;
        else summary.uploaded += 1;
      } catch (err) {
        if (!summary.errors) summary.errors = [];
        summary.errors.push({ file: file.path, message: err.message });
      }
    }
  } finally {
    try {
      await sftp.end();
    } catch {}
  }

  return summary;
}

function triggerTicketSync({ force = false, source = 'manual' } = {}) {
  const config = getTicketSyncConfig();
  if (!force && !config.enabled) {
    return { started: false, reason: 'disabled' };
  }

  if (isRunning) {
    return { started: false, reason: 'running' };
  }

  isRunning = true;
  lastError = null;

  setImmediate(async () => {
    try {
      const summary = await runSyncJob({ source });
      lastResult = summary;
    } catch (err) {
      lastError = err.message || String(err);
      lastResult = null;
      console.error('Erreur de synchronisation des tickets :', err);
    } finally {
      lastRunAt = new Date().toISOString();
      isRunning = false;
    }
  });

  return { started: true };
}

function getTicketSyncStatus() {
  return {
    running: isRunning,
    lastRunAt,
    lastResult,
    lastError
  };
}

module.exports = {
  triggerTicketSync,
  getTicketSyncStatus,
  runSyncJob
};
