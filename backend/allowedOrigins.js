function isAllowedOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return (
      origin === 'http://localhost:3000' ||
      origin === 'http://127.0.0.1:3000' ||
      url.port === '3001'
    );
  } catch (_err) {
    return false;
  }
}

function corsOrigin(origin, callback) {
  callback(null, isAllowedOrigin(origin));
}

module.exports = {
  corsOrigin,
  isAllowedOrigin
};
