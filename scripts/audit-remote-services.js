const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const backendDir = path.join(root, 'backend');

require(path.join(backendDir, 'node_modules', 'dotenv')).config({
  path: path.join(backendDir, '.env')
});
require(path.join(backendDir, 'node_modules', 'dotenv')).config({
  path: path.join(backendDir, '.env.local')
});

const mysql = require(path.join(backendDir, 'node_modules', 'mysql2', 'promise'));
const nodemailer = require(path.join(backendDir, 'node_modules', 'nodemailer'));
const axiosModule = require(path.join(backendDir, 'node_modules', 'axios'));
const axios = axiosModule.default || axiosModule;

const runId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

function result(service, check, ok, details) {
  return { service, check, ok, details };
}

function printSummary(results) {
  const successes = results.filter(entry => entry.ok);
  const failures = results.filter(entry => !entry.ok);

  process.stdout.write('\n=== Synthèse des tests distants ===\n');
  for (const entry of results) {
    const status = entry.ok ? 'RÉUSSI' : 'ÉCHOUÉ';
    process.stdout.write(`[${status}] ${entry.service} - ${entry.check}\n`);
    if (!entry.ok && entry.details?.message) {
      process.stdout.write(`         ${entry.details.message}\n`);
    }
  }

  process.stdout.write('\n');
  process.stdout.write(`Tests réussis : ${successes.length}\n`);
  process.stdout.write(`Tests échoués : ${failures.length}\n`);
  process.stdout.write(`Total         : ${results.length}\n`);
  process.stdout.write(
    failures.length === 0
      ? 'Résultat global : RÉUSSI\n'
      : 'Résultat global : ÉCHOUÉ\n'
  );
}

function parseRemoteMysqlPreset() {
  const raw = process.env.MYSQL_PRESET_REMOTE;
  if (!raw) throw new Error('MYSQL_PRESET_REMOTE absent');
  const [host, user, password, database, port] = raw.split('|');
  return {
    host,
    user,
    password,
    database,
    port: port ? Number(port) : 3306,
    connectTimeout: 10000
  };
}

function parseWebdavTargets() {
  const raw = process.env.WEBDAV_ENDPOINTS || process.env.WEBDAV_CONFIG;
  if (!raw) throw new Error('WEBDAV_ENDPOINTS absent');
  return JSON.parse(raw);
}

function remoteUrl(baseUrl, remotePath) {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(remotePath.replace(/^\/+/, ''), base).toString();
}

async function auditMysql() {
  const results = [];
  let connection;
  try {
    const config = parseRemoteMysqlPreset();
    connection = await mysql.createConnection(config);
    const [identity] = await connection.query(
      'SELECT DATABASE() AS db, CURRENT_USER() AS currentUser, VERSION() AS version'
    );
    results.push(result('MySQL', 'connexion distante', true, {
      host: config.host,
      database: identity[0].db,
      currentUser: identity[0].currentUser,
      version: identity[0].version
    }));

    await connection.query(
      'CREATE TEMPORARY TABLE codex_integration_check (id VARCHAR(64) PRIMARY KEY, value_text VARCHAR(64))'
    );
    await connection.execute(
      'INSERT INTO codex_integration_check (id, value_text) VALUES (?, ?)',
      [runId, 'write-ok']
    );
    const [rows] = await connection.execute(
      'SELECT value_text FROM codex_integration_check WHERE id = ?',
      [runId]
    );
    if (rows[0]?.value_text !== 'write-ok') {
      throw new Error('La valeur temporaire relue est incorrecte');
    }
    await connection.query('DROP TEMPORARY TABLE codex_integration_check');
    results.push(result('MySQL', 'écriture temporaire', true, {
      cleanup: 'table temporaire supprimée'
    }));
  } catch (error) {
    results.push(result('MySQL', 'audit réel', false, {
      code: error.code || null,
      message: error.message
    }));
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
  return results;
}

async function auditSmtp() {
  const results = [];
  try {
    const port = Number(process.env.SMTP_PORT || 465);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: process.env.SMTP_SECURE
        ? process.env.SMTP_SECURE === 'true'
        : port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.verify();
    results.push(result('SMTP', 'authentification réelle', true, {
      host: process.env.SMTP_HOST,
      port
    }));

    const recipient = process.env.SMTP_USER;
    const sender = process.env.SMTP_FROM || recipient;
    if (!sender.includes('@')) {
      throw new Error(`SMTP_FROM n'est pas une adresse e-mail valide : ${sender}`);
    }
    const info = await transporter.sendMail({
      from: sender,
      to: recipient,
      subject: `[BDD Caisse] Confirmation SMTP réelle ${runId}`,
      text: [
        'Le service SMTP de BDD Caisse fonctionne.',
        `Expéditeur : ${sender}`,
        `Destinataire : ${recipient}`,
        `Identifiant du test : ${runId}`
      ].join('\n')
    });
    results.push(result('SMTP', 'envoi réel', true, {
      recipient,
      accepted: info.accepted,
      rejected: info.rejected,
      messageId: info.messageId
    }));
    transporter.close();
  } catch (error) {
    results.push(result('SMTP', 'audit réel', false, {
      code: error.code || null,
      message: error.message
    }));
  }
  return results;
}

async function auditWebdavTarget(mode, target) {
  const results = [];
  const auth = {
    username: target.username,
    password: target.password
  };
  const testDir = '/codex-integration-tests';
  const testPath = `${testDir}/${runId}.txt`;
  const directoryUrl = remoteUrl(target.url, testDir);
  const fileUrl = remoteUrl(target.url, testPath);
  let uploaded = false;

  try {
    const propfind = await axios({
      method: 'PROPFIND',
      url: target.url,
      auth,
      headers: { Depth: '0' },
      timeout: 15000,
      validateStatus: () => true
    });
    if (![200, 207].includes(propfind.status)) {
      throw new Error(`PROPFIND HTTP ${propfind.status}`);
    }
    results.push(result(`WebDAV ${mode}`, 'connexion réelle', true, {
      url: target.url,
      status: propfind.status
    }));

    const mkcol = await axios({
      method: 'MKCOL',
      url: directoryUrl,
      auth,
      timeout: 15000,
      validateStatus: () => true
    });
    if (![200, 201, 204, 405].includes(mkcol.status)) {
      throw new Error(`MKCOL HTTP ${mkcol.status}`);
    }

    const content = `BDD Caisse WebDAV integration check ${runId}`;
    const put = await axios.put(fileUrl, content, {
      auth,
      timeout: 15000,
      validateStatus: () => true
    });
    if (![200, 201, 204].includes(put.status)) {
      throw new Error(`PUT HTTP ${put.status}`);
    }
    uploaded = true;

    const get = await axios.get(fileUrl, {
      auth,
      timeout: 15000,
      responseType: 'text',
      validateStatus: () => true
    });
    if (get.status !== 200 || get.data !== content) {
      throw new Error(`GET de contrôle invalide, HTTP ${get.status}`);
    }

    results.push(result(`WebDAV ${mode}`, 'écriture et relecture réelles', true, {
      path: testPath
    }));
  } catch (error) {
    results.push(result(`WebDAV ${mode}`, 'audit réel', false, {
      code: error.code || null,
      message: error.message
    }));
  } finally {
    if (uploaded) {
      const deletion = await axios.delete(fileUrl, {
        auth,
        timeout: 15000,
        validateStatus: () => true
      }).catch(error => ({ status: 0, error }));
      results.push(result(`WebDAV ${mode}`, 'nettoyage', deletion.status === 204, {
        status: deletion.status
      }));
    }
  }
  return results;
}

async function main() {
  const results = [];
  const onlyWebdav = process.argv.includes('--webdav-only');
  const onlySmtp = process.argv.includes('--smtp-only');

  if (!onlyWebdav && !onlySmtp) {
    results.push(...await auditMysql());
    results.push(...await auditSmtp());
  } else if (onlySmtp) {
    results.push(...await auditSmtp());
  }

  if (!onlySmtp) try {
    const targets = parseWebdavTargets();
    for (const mode of ['dev', 'prod']) {
      if (targets[mode]) {
        results.push(...await auditWebdavTarget(mode, targets[mode]));
      } else {
        results.push(result(`WebDAV ${mode}`, 'configuration', false, {
          message: `Profil ${mode} absent`
        }));
      }
    }
  } catch (error) {
    results.push(result('WebDAV', 'configuration', false, {
      message: error.message
    }));
  }

  const failures = results.filter(entry => !entry.ok);
  process.stdout.write(`${JSON.stringify({
    runId,
    success: failures.length === 0,
    results
  }, null, 2)}\n`);
  printSummary(results);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
