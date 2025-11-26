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

  // 1) On veut que basePath soit /tickets
  const base = (basePath || '/tickets').replace(/\/$/, '');
  const dirPath = base; // /tickets
  const filePath = base + '/test-upload.txt';

  const dirUrl = new URL(dirPath.replace(/^\//, ''), url.endsWith('/') ? url : url + '/').toString();
  const fileUrl = new URL(filePath.replace(/^\//, ''), url.endsWith('/') ? url : url + '/').toString();

  console.log('URL MKCOL :', dirUrl);
  console.log('URL PUT   :', fileUrl);

  // 1) MKCOL /tickets
  try {
    const res = await axios({
      method: 'MKCOL',
      url: dirUrl,
      headers,
      validateStatus: () => true
    });
    console.log('MKCOL /tickets -> status', res.status);
  } catch (err) {
    console.log('❌ NETWORK ERROR MKCOL', err.code || err.message);
    process.exit(1);
  }

  // 2) PUT /tickets/test-upload.txt
  const content = 'Hello WebDAV ' + new Date().toISOString();
  try {
    const res = await axios.put(fileUrl, content, { headers, timeout: 15000 });
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
