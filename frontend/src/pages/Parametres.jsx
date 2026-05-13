import React, { useEffect, useState } from 'react';
import { Form, Button, Collapse } from 'react-bootstrap';
import BoutonsManager from '../components/BoutonsManager';
import DevModeToggle from '../components/DevModeToggle';
import DevModeModal from '../components/DevModeModal';
import { useContext } from 'react';
import { DevModeContext } from '../contexts/DevModeContext';
import TactileInput from '../components/TactileInput';
import MotifManagerModal from '../components/MotifManagerModal';

const Parametres = () => {
  const [interval, setIntervalValue] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState('');
  const [localName, setLocalName] = useState('');
  const [registerNumber, setRegisterNumber] = useState('');
const [storeMessage, setStoreMessage] = useState('');
const [showBoutons, setShowBoutons] = useState(false);

  const [principalIp, setPrincipalIp] = useState('');
  const [ipMessage, setIpMessage] = useState('');
  const [localIp, setLocalIp] = useState('');
  const [devices, setDevices] = useState([]);
  const [scanned, setScanned] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  const [usersDiff, setUsersDiff] = useState(null);
  const [usersMsg, setUsersMsg] = useState('');
  const [usersError, setUsersError] = useState('');

  const [webdavInterval, setWebdavInterval] = useState('');
  const [webdavEnabled, setWebdavEnabled] = useState(false);
  const [webdavMode, setWebdavMode] = useState('');
  const [webdavMessage, setWebdavMessage] = useState('');
  const [webdavModes, setWebdavModes] = useState([]);
  const [webdavState, setWebdavState] = useState(null);
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateChecking, setUpdateChecking] = useState(false);

  const [showPassModal, setShowPassModal] = useState(false);
  const { devMode, setDevMode } = useContext(DevModeContext);

  const [motifs, setMotifs] = useState([]);
  const [showMotifManager, setShowMotifManager] = useState(false);

  const refreshMotifs = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/motifs');
      const data = await res.json();
      setMotifs(Array.isArray(data) ? data : []);
    } catch {
      // ignore errors
    }
  };

  useEffect(() => {
    fetch('http://localhost:3001/api/sync-config')
      .then(res => res.json())
      .then(data => {
        setIntervalValue(String(data.interval));
        setEnabled(data.enabled);
      })
      .catch(() => {});

    fetch('http://localhost:3001/api/store-config')
      .then(res => res.json())
      .then(data => {
        setLocalName(data.localName || '');
        setRegisterNumber(String(data.registerNumber || ''));
      })
      .catch(() => {});

    fetch('http://localhost:3001/api/principal-ip')
      .then(res => res.json())
      .then(data => {
        setPrincipalIp(data.ip || '');
      })
      .catch(() => {});

    fetch('http://localhost:3001/api/webdav/config')
      .then(res => res.json())
      .then(data => {
        setWebdavInterval(String(data.interval || ''));
        setWebdavEnabled(Boolean(data.enabled));
        setWebdavMode(data.mode || '');
        setWebdavModes(Array.isArray(data.availableModes) ? data.availableModes : []);
      })
      .catch(() => {});

    fetch('http://localhost:3001/api/webdav/state')
      .then(res => res.json())
      .then(data => setWebdavState(data))
      .catch(() => {});

    fetch('http://localhost:3001/api/network/local-ip')
      .then(res => res.json())
      .then(data => setLocalIp(data.ip || ''))
      .catch(() => {});

    refreshMotifs();
  }, []);

  useEffect(() => {
    if (!window.electron?.onUpdateStatus) return undefined;

    return window.electron.onUpdateStatus((status) => {
      if (!status?.message) return;
      const prefix = status.success === false ? '❌' : 'ℹ️';
      setUpdateMessage(`${prefix} ${status.message}`);
      setUpdateChecking(['checking', 'download-started', 'update-available', 'download-progress'].includes(status.status));
    });
  }, []);

  const save = async () => {
    setMessage('');
    try {
      const res = await fetch('http://localhost:3001/api/sync-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval: parseInt(interval, 10), enabled })
      });
      const data = await res.json();
      if (data.success) {
        setMessage('✅ Période sauvegardée');
      } else {
        setMessage('❌ ' + (data.error || 'Erreur'));
      }
    } catch {
      setMessage('❌ Erreur de sauvegarde');
    }
  };

  const saveStore = async () => {
    setStoreMessage('');
    try {
      const res = await fetch('http://localhost:3001/api/store-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localName, registerNumber: parseInt(registerNumber, 10) })
      });
      const data = await res.json();
      if (data.success) {
        setStoreMessage('✅ Enregistré');
      } else {
        setStoreMessage('❌ ' + (data.error || 'Erreur'));
      }
    } catch {
      setStoreMessage('❌ Erreur de sauvegarde');
    }
  };

  const saveIp = async () => {
    setIpMessage('');
    try {
      const res = await fetch('http://localhost:3001/api/principal-ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: principalIp })
      });
      const data = await res.json();
      if (data.success) setIpMessage('✅ IP sauvegardée');
      else setIpMessage('❌ ' + (data.error || 'Erreur'));
    } catch {
      setIpMessage('❌ Erreur de sauvegarde');
    }
  };

  const scanNetwork = async () => {
    setScanMessage('');
    setScanned(false);
    try {
      const res = await fetch('http://localhost:3001/api/network/scan');
      const data = await res.json();
      setDevices(data.devices || []);
      setScanned(true);
      if ((data.devices || []).length === 0) setScanMessage('Aucun appareil trouvé');
    } catch {
      setDevices([]);
      setScanned(true);
      setScanMessage('Erreur de scan');
    }
  };

  const compareUsers = async () => {
    setUsersError('');
    setUsersMsg('');
    try {
      const res = await fetch('http://localhost:3001/api/users/compare');
      const data = await res.json();
      if (data.success) {
        setUsersDiff({
          missing: data.missing.length,
          extra: data.extra.length,
          different: data.different.length
        });
      } else {
        setUsersError(data.error || 'Erreur');
      }
    } catch {
      setUsersError('Erreur lors de la comparaison');
    }
  };

  const syncUsers = async () => {
    setUsersError('');
    setUsersMsg('');
    try {
      const res = await fetch('http://localhost:3001/api/users/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setUsersMsg(`Mise à jour effectuée (${data.count} utilisateurs).`);
        setUsersDiff(null);
      } else {
        setUsersError(data.error || 'Erreur');
      }
    } catch {
      setUsersError('Erreur lors de la mise à jour');
    }
  };

  const saveWebdav = async () => {
    setWebdavMessage('');
    try {
      const res = await fetch('http://localhost:3001/api/webdav/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interval: parseInt(webdavInterval, 10),
          enabled: webdavEnabled,
          mode: webdavMode
        })
      });
      const data = await res.json();
      if (data.success) {
        setWebdavMessage('✅ Paramètres WebDAV enregistrés');
      } else {
        setWebdavMessage('❌ ' + (data.error || 'Erreur de sauvegarde'));
      }
    } catch {
      setWebdavMessage('❌ Erreur de sauvegarde');
    }
  };

  const triggerWebdavSync = async () => {
    setWebdavMessage('');
    try {
      const res = await fetch('http://localhost:3001/api/webdav/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setWebdavMessage(`✅ Synchronisation lancée (${data.count} fichiers envoyés)`);
      } else {
        setWebdavMessage('❌ ' + (data.error || 'Erreur pendant la synchronisation'));
      }
    } catch {
      setWebdavMessage('❌ Erreur pendant la synchronisation');
    }
  };
  const checkForAppUpdates = async () => {
    setUpdateMessage('🔎 Recherche de mise à jour en cours...');
    setUpdateChecking(true);
    if (!window.electron?.checkForUpdates) {
      setUpdateMessage("❌ Vérification indisponible hors application Electron packagée.");
      setUpdateChecking(false);
      return;
    }

    try {
      const result = await window.electron.checkForUpdates();
      if (result?.success) {
        const prefix = result.status === 'update-declined' ? 'ℹ️' : '✅';
        setUpdateMessage(`${prefix} ${result.message || `Vérification terminée (version distante: ${result.version || 'inconnue'}).`}`);
        setUpdateChecking(result.status === 'update-available');
      } else {
        setUpdateMessage(`❌ ${result?.message || 'Impossible de vérifier la mise à jour.'}`);
        setUpdateChecking(false);
      }
    } catch {
      setUpdateMessage('❌ Erreur lors de la vérification de mise à jour.');
      setUpdateChecking(false);
    }
  };

  useEffect(() => {
  console.log('🧪 window.electron:', window.electron);
}, []);

  useEffect(() => {
    if (!webdavMode && webdavModes.length > 0) {
      setWebdavMode(webdavModes[0].key);
    }
  }, [webdavModes, webdavMode]);


  return (
    <div className="bilan-scroll-container">
      <div className="container mt-3">

        <h3>⚙️ Paramètres de synchronisation</h3>
        <Form>
          <Form.Group className="mb-2">
            <Form.Label>Période de synchronisation (minutes)</Form.Label>
            <TactileInput
              type="number"
              value={interval}
              onChange={e => setIntervalValue(e.target.value)}
            />
          </Form.Group>

          <Form.Group className="form-check form-switch mb-2">
            <Form.Check
              type="switch"
              id="syncEnabledSwitch"
              label="Synchronisation automatique"
              checked={enabled}
              onChange={() => setEnabled(prev => !prev)}
            />
          </Form.Group>

        <Button onClick={save}>💾 Sauvegarder</Button>
      </Form>

      {message && <div className="mt-2">{message}</div>}

      <hr />

      <h3>☁️ Synchronisation WebDAV</h3>
      <Form>
        <Form.Group className="mb-2">
          <Form.Label>Période d'envoi (minutes)</Form.Label>
          <TactileInput
            type="number"
            value={webdavInterval}
            onChange={e => setWebdavInterval(e.target.value)}
          />
        </Form.Group>

        <Form.Group className="form-check form-switch mb-2">
          <Form.Check
            type="switch"
            id="webdavEnabledSwitch"
            label="Envoi automatique des tickets"
            checked={webdavEnabled}
            onChange={() => setWebdavEnabled(prev => !prev)}
          />
        </Form.Group>

        <Form.Group className="mb-2">
          <Form.Label>Mode WebDAV</Form.Label>
          <Form.Select
            value={webdavMode}
            onChange={e => setWebdavMode(e.target.value)}
            disabled={webdavModes.length === 0}
          >
            {webdavModes.length === 0 && <option>Aucun profil disponible</option>}
            {webdavModes.map(mode => (
              <option key={mode.key} value={mode.key}>
                {mode.label} ({mode.url})
              </option>
            ))}
          </Form.Select>
          <div className="form-text">Les profils proviennent de la variable d'environnement WEBDAV_ENDPOINTS.</div>
        </Form.Group>

        <div className="d-flex gap-2">
          <Button onClick={saveWebdav} disabled={webdavModes.length === 0}>💾 Sauvegarder</Button>
          <Button variant="secondary" onClick={triggerWebdavSync} disabled={webdavModes.length === 0}>⏫ Lancer maintenant</Button>
        </div>
      </Form>
      {webdavMessage && <div className="mt-2">{webdavMessage}</div>}
      {webdavState && webdavState.lastRun && (
        <div className="mt-2">
          <small>Dernier envoi : {new Date(webdavState.lastRun).toLocaleString()} {webdavState.lastResult === 'error' && `- ${webdavState.error || ''}`}</small>
        </div>
      )}

      <hr />

      <h3>⬆️ Mise à jour application</h3>
      <p className="mb-2">Vérifie immédiatement s'il existe une nouvelle version sur le serveur de release WebDAV.</p>
      <Button variant="secondary" onClick={checkForAppUpdates} disabled={updateChecking}>
        {updateChecking ? '🔎 Recherche en cours...' : '🔎 Rechercher une mise à jour'}
      </Button>
      {updateMessage && <div className="mt-2">{updateMessage}</div>}

      <hr />

        <h3>🏠 Informations magasin</h3>
        <Form>
          <Form.Group className="mb-2">
            <Form.Label>Nom du local</Form.Label>
            <TactileInput value={localName} onChange={e => setLocalName(e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Numéro de poste de caisse</Form.Label>
            <TactileInput type="number" value={registerNumber} onChange={e => setRegisterNumber(e.target.value)} />
          </Form.Group>
          <Button onClick={saveStore}>💾 Sauvegarder</Button>
        </Form>

        {storeMessage && <div className="mt-2">{storeMessage}</div>}

        <hr />

        <h3>📡 Réseau</h3>
        <Form>
          <Form.Group className="mb-2">
            <Form.Label>Adresse IP de la caisse principale</Form.Label>
            <TactileInput value={principalIp} onChange={e => setPrincipalIp(e.target.value)} />
          </Form.Group>
          <Button onClick={saveIp}>💾 Sauvegarder</Button>
        </Form>
        {ipMessage && <div className="mt-2">{ipMessage}</div>}

        <div className="mt-3">
          <p>Mon adresse IP : {localIp || ' inconnue'}</p>
          <Button variant="secondary" onClick={scanNetwork}>Scanner le réseau</Button>
          {scanned && devices.length === 0 && (
            <div className="mt-2">{scanMessage}</div>
          )}
          {devices.length > 0 && (
            <ul className="mt-2">
              {devices.map(d => (
                <li key={d.ip}>{d.ip} {d.mac ? `(${d.mac})` : ''}</li>
              ))}
            </ul>
          )}
        </div>

        <hr />

        <h3>👥 Synchronisation utilisateurs</h3>
        <div className="mb-3">
          <Button onClick={compareUsers} className="me-2">Comparer</Button>
          {usersDiff && (
            <div className="mt-2">
              <p>À ajouter: {usersDiff.missing} – À supprimer: {usersDiff.extra} – Différents: {usersDiff.different}</p>
              <Button variant="secondary" onClick={syncUsers} className="mt-2">
                Mettre à jour la base locale
              </Button>
            </div>
          )}
          {usersError && <div className="mt-2 text-danger">{usersError}</div>}
          {usersMsg && <div className="mt-2">{usersMsg}</div>}
        </div>

        <hr />

        <h4>🧩 Gestion des boutons produits</h4>
        <Button
          variant="secondary"
          className="mb-2"
          onClick={() => setShowBoutons(prev => !prev)}
          aria-controls="boutons-collapse"
          aria-expanded={showBoutons}
        >
          {showBoutons ? 'Masquer les boutons' : 'Afficher les boutons'}
        </Button>

        <Collapse in={showBoutons}>
          <div id="boutons-collapse">
            <BoutonsManager />
          </div>
        </Collapse>

        <hr />

        <h4>✏️ Motifs de correction</h4>
        <Button
          variant="secondary"
          className="mb-2"
          onClick={() => setShowMotifManager(true)}
        >
          Gérer les motifs
        </Button>
        <MotifManagerModal
          show={showMotifManager}
          onHide={() => setShowMotifManager(false)}
          motifs={motifs}
          refreshMotifs={refreshMotifs}
        />

        <hr />

        <h4>🧪 Outils développeur</h4>
        <p>Passer en mode développeur</p>
        <DevModeToggle
          devMode={devMode}
          setDevMode={setDevMode}
          setShowPassModal={setShowPassModal}
        />
        <DevModeModal
          show={showPassModal}
          onClose={() => setShowPassModal(false)}
          onSuccess={() => setDevMode(true)}
        />

       {/*  {devMode && (
          <>
            <p>Reset les bases de données</p>
            <ResetButton />
          </> 
        )} */}

        {devMode && window.electron && (
          <>
            <Button onClick={() =>{ 
              console.log('🖱️ Bouton cliqué');
              window.electron.ouvrirDevTools()
              }}>
              
              Ouvrir les DevTools
            </Button>
          </>
)}
      </div>
    </div>
  );
};

export default Parametres;
