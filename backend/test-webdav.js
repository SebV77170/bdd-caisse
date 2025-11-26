require('dotenv').config();
const axios = require('axios');
const { getActiveCredentials } = require('./webdavConfig');

(async () => {
  const creds = getActiveCredentials();
  console.log('Credentials actifs :', creds);

  if (!creds) {
    console.error('Aucun profil WebDAV actif');
    process.exit(1);
  }

  const { url, username, password, basePath } = creds;

  const token = Buffer.from(`${username}:${password}`).toString('base64');
  const headers = { Authorization: `Basic ${token}` };

  const remotePath = (basePath || '/tickets').replace(/\/$/, '') + '/test-upload.txt';
  const targetUrl = new URL(
    remotePath.replace(/^\//, ''),
    url.endsWith('/') ? url : url + '/'
  ).toString();

  console.log('URL cible :', targetUrl);

  const content = 'Hello WebDAV ' + new Date().toISOString();

  try {
    const res = await axios.put(targetUrl, content, { headers, timeout: 15000 });
    console.log('✅ PUT OK, status =', res.status);
  } catch (err) {
    if (err.response) {
      console.log('❌ HTTP ERROR', err.response.status);
      console.log(String(err.response.data).slice(0, 300));
    } else {
      console.log('❌ NETWORK ERROR', err.code || err.message);
    }
  }
})();
