const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const testFilePattern = /\.(test|spec)\.[cm]?[jt]sx?$/;
const ignoredDirectories = new Set([
  '.git',
  '.tmp-test',
  '.tmp-build',
  'build',
  'coverage',
  'dist',
  'node_modules'
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...walk(fullPath));
      }
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function relative(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function printSection(title, items) {
  console.log('');
  console.log(title);
  console.log('-'.repeat(title.length));

  if (items.length === 0) {
    console.log('  Aucun element trouve.');
    return;
  }

  for (const item of items) {
    console.log(`  ${item}`);
  }
}

function listRootTestCommands() {
  const packageJson = readJson(path.join(root, 'package.json'));
  const scripts = packageJson.scripts || {};
  const entries = Object.entries(scripts)
    .filter(([name]) => name === 'test' || name.startsWith('test:'))
    .sort(([first], [second]) => first.localeCompare(second));
  const commandWidth = Math.max(...entries.map(([name]) => `npm run ${name}`.length));

  return entries.map(([name, command]) => `${`npm run ${name}`.padEnd(commandWidth)}  ${command}`);
}

function listPackageTestCommands(packageDirectory) {
  const packageJsonPath = path.join(root, packageDirectory, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return [];

  const packageJson = readJson(packageJsonPath);
  const scripts = packageJson.scripts || {};

  return Object.entries(scripts)
    .filter(([name]) => name === 'test' || name.startsWith('test:'))
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([name, command]) => `(cd ${packageDirectory} && npm run ${name})  ${command}`);
}

function listTestFiles(packageDirectory) {
  const directory = path.join(root, packageDirectory);
  if (!fs.existsSync(directory)) return [];

  return walk(directory)
    .filter(filePath => testFilePattern.test(path.basename(filePath)))
    .map(relative)
    .sort((first, second) => first.localeCompare(second));
}

function listHelperScripts() {
  return fs
    .readdirSync(__dirname, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .filter(name => /^test-.+\.(ps1|js)$/.test(name))
    .map(name => relative(path.join(__dirname, name)))
    .sort((first, second) => first.localeCompare(second));
}

const backendTests = listTestFiles('backend');
const frontendTests = listTestFiles('frontend');

console.log('Inventaire des tests');
console.log('====================');
console.log(`Backend : ${backendTests.length} fichier(s)`);
console.log(`Frontend : ${frontendTests.length} fichier(s)`);
console.log(`Total : ${backendTests.length + frontendTests.length} fichier(s)`);

printSection('Commandes de test racine', listRootTestCommands());
printSection('Commandes de test backend', listPackageTestCommands('backend'));
printSection('Commandes de test frontend', listPackageTestCommands('frontend'));
printSection('Fichiers de test backend', backendTests);
printSection('Fichiers de test frontend', frontendTests);
printSection('Scripts de test auxiliaires', listHelperScripts());
