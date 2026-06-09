const { randomUUID } = require('crypto');

const grants = new Map();
const GRANT_TTL_MS = 2 * 60 * 1000;

function purgeExpiredGrants() {
  const now = Date.now();
  for (const [token, grant] of grants) {
    if (grant.expiresAt <= now) grants.delete(token);
  }
}

function createSecondaryOpeningGrant(principalIp) {
  purgeExpiredGrants();
  const token = randomUUID();
  grants.set(token, {
    principalIp,
    expiresAt: Date.now() + GRANT_TTL_MS
  });
  return token;
}

function consumeSecondaryOpeningGrant(token) {
  purgeExpiredGrants();
  if (!token) return null;
  const grant = grants.get(token);
  if (!grant) return null;
  grants.delete(token);
  return grant;
}

module.exports = {
  createSecondaryOpeningGrant,
  consumeSecondaryOpeningGrant
};
