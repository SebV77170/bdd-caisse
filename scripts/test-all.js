const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const tempDir = path.join(root, '.tmp-test');

fs.mkdirSync(tempDir, { recursive: true });

const environment = {
  ...process.env,
  CI: 'true',
  NODE_ENV: 'test',
  TEMP: tempDir,
  TMP: tempDir
};

const suites = [
  {
    name: 'backend',
    color: '\x1b[34m',
    cwd: path.join(root, 'backend'),
    script: path.join(root, 'backend', 'node_modules', 'jest', 'bin', 'jest.js'),
    args: ['--runInBand', '--no-cache']
  },
  {
    name: 'frontend',
    color: '\x1b[35m',
    cwd: path.join(root, 'frontend'),
    script: path.join(
      root,
      'frontend',
      'node_modules',
      'react-scripts',
      'scripts',
      'test.js'
    ),
    args: ['--watchAll=false', '--runInBand']
  }
];

function prefixOutput(stream, suite, target) {
  let pending = '';

  return new Promise(resolve => {
    stream.setEncoding('utf8');
    stream.on('data', chunk => {
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop();

      for (const line of lines) {
        target.write(`${suite.color}[${suite.name}]\x1b[0m ${line}\n`);
      }
    });

    stream.on('end', () => {
      if (pending) {
        target.write(`${suite.color}[${suite.name}]\x1b[0m ${pending}\n`);
      }
      resolve();
    });
  });
}

console.log('Lancement des tests backend et frontend en parallele...');

const startedAt = Date.now();
const results = new Map();

const children = suites.map(suite => {
  if (!fs.existsSync(suite.script)) {
    throw new Error(`Dependance manquante pour ${suite.name}: ${suite.script}`);
  }

  const suiteStartedAt = Date.now();
  const child = spawn(process.execPath, [suite.script, ...suite.args], {
    cwd: suite.cwd,
    env: environment,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const outputDone = Promise.all([
    prefixOutput(child.stdout, suite, process.stdout),
    prefixOutput(child.stderr, suite, process.stderr)
  ]);
  return { suite, child, outputDone, suiteStartedAt };
});

let completed = 0;
let exitCode = 0;

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function printSummary() {
  const totalDuration = formatDuration(Date.now() - startedAt);
  const lines = suites.map(suite => {
    const result = results.get(suite.name);
    const code = result ? result.code : 'inconnu';
    const duration = result ? formatDuration(result.duration) : '-';
    const status = result && result.code === 0 ? 'OK' : 'ECHEC';

    return `  ${suite.name.padEnd(8)} ${status.padEnd(5)} code ${String(code).padEnd(7)} ${duration}`;
  });

  process.stderr.write('\n');
  process.stderr.write('Bilan des tests\n');
  process.stderr.write('----------------\n');
  for (const line of lines) process.stderr.write(`${line}\n`);
  process.stderr.write(`  total    ${exitCode === 0 ? 'OK' : 'ECHEC'}          ${totalDuration}\n`);
}

function finish() {
  printSummary();
  fs.rmSync(tempDir, { recursive: true, force: true });
  process.exitCode = exitCode;
}

for (const { suite, child, outputDone, suiteStartedAt } of children) {
  child.on('error', error => {
    console.error(`[${suite.name}] Impossible de lancer les tests: ${error.message}`);
    exitCode = 1;
    results.set(suite.name, {
      code: 'erreur',
      duration: Date.now() - suiteStartedAt
    });
  });

  child.on('close', async code => {
    await outputDone;
    completed += 1;
    if (code !== 0) exitCode = 1;
    results.set(suite.name, {
      code,
      duration: Date.now() - suiteStartedAt
    });
    process.stderr.write(`[${suite.name}] termine avec le code ${code}.\n`);

    if (completed === children.length) finish();
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const { child } of children) {
      if (!child.killed) child.kill();
    }
    exitCode = 1;
  });
}
