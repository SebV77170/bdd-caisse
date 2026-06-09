const os = require('os');
const fetch = require('node-fetch');

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
  try {
    const { response, data } = await fetchJsonWithTimeout(
      `http://${ip}:3001/api/sync/recevoir-de-secondaire/status`,
      {},
      timeoutMs
    );
    return response.ok
      && data.role === 'caisse-principale'
      && data.principalSessionOpen === true;
  } catch {
    return false;
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
  buildSubnetCandidates,
  isPrincipalCandidate,
  discoverPrincipalCandidates
};
