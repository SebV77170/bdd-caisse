const express = require('express');
const os = require('os');
const router = express.Router();
const { getConfig: getPrincipalConfig, updateConfig } = require('../principalIpConfig');
const { getConfig: getStoreConfig } = require('../storeConfig');
const {
  fetchJsonWithTimeout,
  normalizePrincipalHost,
  isPrincipalCandidate,
  discoverPrincipalCandidates
} = require('../utils/principalDiscovery');
const { createSecondaryOpeningGrant } = require('../secondaryOpeningAuthorization');

async function requestHumanConfirmation(ip, source) {
  const request = await fetchJsonWithTimeout(
    `http://${ip}:3001/api/sync/recevoir-de-secondaire/ouverture/demande`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(source)
    },
    3000
  );

  if (!request.response.ok || !request.data.requestId) {
    return { success: false, message: request.data.error || 'Demande refusée par le poste distant.' };
  }

  const result = await fetchJsonWithTimeout(
    `http://${ip}:3001/api/sync/recevoir-de-secondaire/ouverture/attente`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: request.data.requestId })
    },
    35000
  );

  return result.data;
}

router.post('/authorize', async (req, res) => {
  const user = req.session.user;
  if (!user) {
    return res.status(401).json({ success: false, error: 'Aucun utilisateur connecté.' });
  }

  const configuredIp = normalizePrincipalHost(getPrincipalConfig().ip);
  const store = getStoreConfig();
  const source = {
    sourceId: process.env.CASH_REGISTER_ID || os.hostname(),
    sourceName: store.localName,
    registerNumber: store.registerNumber,
    requestedBy: user.nom
  };

  try {
    const candidates = [];
    let configuredIpReachable = false;
    if (configuredIp) {
      configuredIpReachable = await isPrincipalCandidate(configuredIp, 4000);
      if (!configuredIpReachable) {
        await new Promise(resolve => setTimeout(resolve, 250));
        configuredIpReachable = await isPrincipalCandidate(configuredIp, 4000);
      }
    }

    if (configuredIpReachable) {
      candidates.push(configuredIp);
    } else {
      candidates.push(...await discoverPrincipalCandidates({
        timeoutMs: 1000,
        concurrency: 48
      }));
    }

    if (candidates.length === 0) {
      const configuredHint = configuredIp
        ? ` La caisse configurée (${configuredIp}:3001) ne répond pas comme une caisse principale ouverte. Vérifiez que les deux postes sont sur le même réseau et que le pare-feu autorise le port TCP 3001 sur la caisse principale.`
        : '';
      return res.status(404).json({
        success: false,
        code: 'PRINCIPAL_NOT_FOUND',
        configuredIp,
        diagnostic: configuredHint.trim(),
        error: "Aucune caisse principale ouverte n'a été trouvée sur le réseau."
      });
    }

    const uniqueCandidates = [...new Set(candidates)];
    for (const ip of uniqueCandidates) {
      try {
        const confirmation = await requestHumanConfirmation(ip, source);
        if (confirmation.success) {
          updateConfig(ip);
          const authorizationToken = createSecondaryOpeningGrant(ip);
          return res.json({
            success: true,
            principalIp: ip,
            authorizationToken,
            message: `La caisse principale ${ip} a confirmé le rattachement.`
          });
        }
        if (confirmation.decision === 'refused') {
          return res.status(403).json({
            success: false,
            code: 'PRINCIPAL_REFUSED',
            principalIp: ip,
            error: 'La caisse principale a refusé l’ouverture de cette caisse secondaire.'
          });
        }
      } catch {
        // Le poste a pu disparaître entre la découverte et la confirmation.
      }
    }

    return res.status(504).json({
      success: false,
      code: 'PRINCIPAL_CONFIRMATION_TIMEOUT',
      error: "Aucune caisse principale n'a confirmé la demande dans le délai prévu."
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: 'PRINCIPAL_DISCOVERY_ERROR',
      error: 'La recherche de la caisse principale a échoué.',
      details: error.message
    });
  }
});

module.exports = router;
