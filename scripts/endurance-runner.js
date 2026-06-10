const fs = require('fs');
const http = require('http');
const path = require('path');
const request = require('../backend/node_modules/supertest');
const { performance } = require('perf_hooks');

process.env.NODE_ENV = 'test';

const root = path.resolve(__dirname, '..');
const dataDir = process.env.BDD_CAISSE_DATA_DIR
  || path.join(root, '.tmp-endurance');
const durationMinutes = Number(
  process.argv.find(arg => arg.startsWith('--minutes='))?.split('=')[1] || 180
);
const sampleMs = Number(
  process.argv.find(arg => arg.startsWith('--sample-ms='))?.split('=')[1] || 5000
);
const durationMs = durationMinutes * 60 * 1000;

if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
  throw new Error('La duree --minutes doit etre strictement positive.');
}
if (!Number.isFinite(sampleMs) || sampleMs < 100) {
  throw new Error('La frequence --sample-ms doit etre au moins de 100 ms.');
}

fs.mkdirSync(dataDir, { recursive: true });
process.env.BDD_CAISSE_DATA_DIR = dataDir;
process.env.SYNC_SCHEDULER_CRON = durationMinutes < 1
  ? '*/1 * * * * *'
  : '*/1 * * * *';

const app = require('../backend/app');
const { sqlite } = require('../backend/db');
const {
  startScheduler,
  stopScheduler,
  updateConfig
} = require('../backend/syncScheduler');

function directorySize(directory) {
  if (!fs.existsSync(directory)) return 0;
  return fs.readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => {
    const entryPath = path.join(directory, entry.name);
    return total + (
      entry.isDirectory()
        ? directorySize(entryPath)
        : fs.statSync(entryPath).size
    );
  }, 0);
}

function linearSlopePerHour(samples, key) {
  if (samples.length < 2) return 0;
  const firstAt = samples[0].elapsedMs;
  const points = samples.map(sample => ({
    x: (sample.elapsedMs - firstAt) / 3600000,
    y: sample[key]
  }));
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const denominator = points.reduce(
    (sum, point) => sum + ((point.x - meanX) ** 2),
    0
  );
  if (denominator === 0) return 0;
  return points.reduce(
    (sum, point) => sum + ((point.x - meanX) * (point.y - meanY)),
    0
  ) / denominator;
}

function initializeDatabase() {
  sqlite.exec(fs.readFileSync(path.join(root, 'backend', 'schema.sql'), 'utf8'));
  for (const table of [
    'paiement_mixte',
    'objets_vendus',
    'ticketdecaisse',
    'ticketdecaissetemp',
    'vente',
    'bilan',
    'session_caisse',
    'sync_log',
    'users'
  ]) {
    sqlite.prepare(`DELETE FROM ${table}`).run();
  }
  sqlite.prepare(`
    INSERT INTO session_caisse (
      id_session, opened_at_utc, fond_initial, issecondaire, poste
    ) VALUES ('endurance-session', ?, 0, 0, 1)
  `).run(new Date().toISOString());
}

async function main() {
  initializeDatabase();

  let schedulerCalls = 0;
  const probeServer = http.createServer((_incoming, response) => {
    schedulerCalls += 1;
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end('{"success":true}');
  });
  await new Promise(resolve => probeServer.listen(0, '127.0.0.1', resolve));
  const probePort = probeServer.address().port;
  process.env.SYNC_SCHEDULER_URL = `http://127.0.0.1:${probePort}/sync`;

  updateConfig(1, true);
  startScheduler();

  const samples = [];
  const startedAt = performance.now();
  const cpuStarted = process.cpuUsage();
  let balanceMaxMs = 0;

  async function sample() {
    const balanceStarted = performance.now();
    const response = await request(app)
      .get('/api/bilan/bilan_session_caisse')
      .query({ uuid_session_caisse: 'endurance-session' });
    if (response.status !== 200) {
      throw new Error(`Le bilan d'endurance repond avec le statut ${response.status}.`);
    }
    balanceMaxMs = Math.max(balanceMaxMs, performance.now() - balanceStarted);

    const memory = process.memoryUsage();
    const syncLog = sqlite.prepare(`
      SELECT COUNT(*) AS rows, COALESCE(SUM(LENGTH(payload)), 0) AS bytes
      FROM sync_log
    `).get();
    samples.push({
      elapsedMs: performance.now() - startedAt,
      heapMb: memory.heapUsed / 1024 / 1024,
      rssMb: memory.rss / 1024 / 1024,
      journalBytes: syncLog.bytes + directorySize(dataDir)
    });
  }

  await sample();
  let sampling = false;
  let samplingError = null;
  const timer = setInterval(async () => {
    if (sampling || samplingError) return;
    sampling = true;
    try {
      await sample();
    } catch (error) {
      samplingError = error;
    } finally {
      sampling = false;
    }
  }, sampleMs);

  await new Promise(resolve => setTimeout(resolve, durationMs));
  clearInterval(timer);
  while (sampling) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  if (samplingError) throw samplingError;
  await sample();

  stopScheduler();
  await new Promise(resolve => probeServer.close(resolve));

  const elapsedMs = performance.now() - startedAt;
  const cpu = process.cpuUsage(cpuStarted);
  const cpuPercent = ((cpu.user + cpu.system) / 1000 / elapsedMs) * 100;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const heapGrowthMb = last.heapMb - first.heapMb;
  const rssGrowthMb = last.rssMb - first.rssMb;
  const heapSlopeMbPerHour = linearSlopePerHour(samples, 'heapMb');
  const report = {
    durationMinutes: Number((elapsedMs / 60000).toFixed(2)),
    samples: samples.length,
    schedulerCalls,
    balanceMaxMs: Math.round(balanceMaxMs),
    cpuAveragePercent: Number(cpuPercent.toFixed(2)),
    heapGrowthMb: Number(heapGrowthMb.toFixed(2)),
    rssGrowthMb: Number(rssGrowthMb.toFixed(2)),
    heapSlopeMbPerHour: Number(heapSlopeMbPerHour.toFixed(2)),
    journalGrowthKb: Number(
      ((last.journalBytes - first.journalBytes) / 1024).toFixed(2)
    )
  };

  console.log('ENDURANCE_REPORT', JSON.stringify(report, null, 2));

  if (schedulerCalls < 1) {
    throw new Error('Le planificateur ne s est jamais declenche.');
  }
  if (balanceMaxMs >= 3000) {
    throw new Error(`Le bilan a pris jusqu a ${Math.round(balanceMaxMs)} ms.`);
  }
  if (heapGrowthMb >= 96) {
    throw new Error(`La memoire heap a augmente de ${heapGrowthMb.toFixed(1)} Mo.`);
  }
  if (durationMinutes >= 30 && heapSlopeMbPerHour >= 16) {
    throw new Error(
      `La memoire heap derive de ${heapSlopeMbPerHour.toFixed(1)} Mo/heure.`
    );
  }
}

main().catch(error => {
  stopScheduler();
  console.error(`ENDURANCE_FAILED: ${error.stack || error.message}`);
  process.exitCode = 1;
});
