const os = require('os');
const fetch = require('node-fetch');

function normalizePrincipalHost(value) {
  const input = String(value || '').trim();
  if (!input) return '';

  try {
    const url = new URL(input.includes('://') ? input : `http://${input}`);
    return url.hostname;
  } catch {
    return input
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .split(':')[0]
      .trim();
  }
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 800) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

function getLocalIpv4Addresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter(info => info?.family === 'IPv4' && !info.internal)
    .map(info => info.address);
}

function buildSubnetCandidates(localAddresses = getLocalIpv4Addresses()) {
  const candidates = new Set();
  for (const address of localAddresses) {
    const parts = address.split('.');
    if (parts.length !== 4) continue;
    const prefix = parts.slice(0, 3).join('.');
    for (let host = 1; host <= 254; host += 1) {
      const candidate = `${prefix}.${host}`;
      if (candidate !== address) candidates.add(candidate);
    }
  }
  return [...candidates];
}

async function isPrincipalCandidate(ip, timeoutMs = 500) {
  const diagnostic = await inspectPrincipalCandidate(ip, timeoutMs);
  return diagnostic.isPrincipalOpen;
}

async function inspectPrincipalCandidate(ip, timeoutMs = 500) {
  const host = normalizePrincipalHost(ip);
  if (!host) {
    return {
      host,
      reachable: false,
      isPrincipal: false,
      isPrincipalOpen: false,
      reason: 'Adresse de caisse principale vide ou invalide.'
    };
  }

  try {
    const { response, data } = await fetchJsonWithTimeout(
      `http://${host}:3001/api/sync/recevoir-de-secondaire/status`,
      {},
      timeoutMs
    );
    const isPrincipal = response.ok && data.role === 'caisse-principale';
    const isPrincipalOpen = isPrincipal && data.principalSessionOpen === true;
    let reason = null;
    if (!response.ok) {
      reason = `Le poste ${host} a répondu avec le statut HTTP ${response.status}.`;
    } else if (!isPrincipal) {
      reason = `Le poste ${host} répond, mais son service n'est pas identifié comme une caisse principale.`;
    } else if (!isPrincipalOpen) {
      reason = `Le poste ${host} répond comme caisse principale, mais aucune session principale n'y est ouverte.`;
    }
    return {
      host,
      reachable: true,
      isPrincipal,
      isPrincipalOpen,
      reason,
      remote: data
    };
  } catch (error) {
    return {
      host,
      reachable: false,
      isPrincipal: false,
      isPrincipalOpen: false,
      reason: error.name === 'AbortError'
        ? `Le poste ${host} ne répond pas sur le port 3001 dans le délai prévu.`
        : `Impossible de joindre ${host}:3001 (${error.message}).`
    };
  }
}

async function discoverPrincipalCandidates({
  candidates = buildSubnetCandidates(),
  concurrency = 32,
  timeoutMs = 500
} = {}) {
  const found = [];
  let cursor = 0;

  async function worker() {
    while (cursor < candidates.length) {
      const index = cursor;
      cursor += 1;
      const ip = candidates[index];
      if (await isPrincipalCandidate(ip, timeoutMs)) found.push(ip);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, Math.max(candidates.length, 1)) },
      () => worker()
    )
  );
  return found;
}

module.exports = {
  fetchJsonWithTimeout,
  normalizePrincipalHost,
  buildSubnetCandidates,
  inspectPrincipalCandidate,
  isPrincipalCandidate,
  discoverPrincipalCandidates
};
