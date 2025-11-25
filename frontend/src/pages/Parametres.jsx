import React, { useEffect, useState } from 'react';
import { Form, Button, Collapse } from 'react-bootstrap';
import BoutonsManager from '../components/BoutonsManager';
import ResetButton from '../components/ResetButton';
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

  const [showPassModal, setShowPassModal] = useState(false);
  const { devMode, setDevMode } = useContext(DevModeContext);

  const [motifs, setMotifs] = useState([]);
  const [showMotifManager, setShowMotifManager] = useState(false);

  const [ticketInterval, setTicketInterval] = useState('30');
  const [ticketAutoEnabled, setTicketAutoEnabled] = useState(true);
  const [ticketHost, setTicketHost] = useState('');
  const [ticketPort, setTicketPort] = useState('22');
  const [ticketUsername, setTicketUsername] = useState('');
  const [ticketPassword, setTicketPassword] = useState('');
  const [ticketRemotePath, setTicketRemotePath] = useState('/tickets');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketStatus, setTicketStatus] = useState(null);

  const formatDateTime = iso => {
    if (!iso) return 'Jamais';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

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

    fetch('http://localhost:3001/api/ticket-sync/config')
      .then(res => res.json())
      .then(data => {
        setTicketInterval(String(data.interval ?? '30'));
        setTicketAutoEnabled(Boolean(data.enabled));
        setTicketHost(data.host || '');
        setTicketPort(String(data.port ?? '22'));
        setTicketUsername(data.username || '');
        setTicketPassword(data.password || '');
        setTicketRemotePath(data.remoteBasePath || '/tickets');
      })
      .catch(() => {});

    fetch('http://localhost:3001/api/ticket-sync/status')
      .then(res => res.json())
      .then(data => setTicketStatus(data))
      .catch(() => {});

    fetch('http://localhost:3001/api/network/local-ip')
      .then(res => res.json())
      .then(data => setLocalIp(data.ip || ''))
      .catch(() => {});

    refreshMotifs();
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

  const refreshTicketStatus = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/ticket-sync/status');
      const data = await res.json();
      setTicketStatus(data);
    } catch {
      setTicketStatus(null);
    }
  };

  const saveTicketSync = async () => {
    setTicketMessage('');
    try {
      const intervalValue = parseInt(ticketInterval, 10);
      const portValue = parseInt(ticketPort, 10);
      const res = await fetch('http://localhost:3001/api/ticket-sync/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interval: Number.isNaN(intervalValue) ? undefined : intervalValue,
          enabled: ticketAutoEnabled,
          host: ticketHost,
          port: Number.isNaN(portValue) ? undefined : portValue,
          username: ticketUsername,
          password: ticketPassword,
          remoteBasePath: ticketRemotePath
        })
      });
      const data = await res.json();
      if (data.success) {
        setTicketMessage('✅ Paramètres sauvegardés');
      } else {
        setTicketMessage('❌ ' + (data.error || 'Erreur'));
      }
    } catch {
      setTicketMessage('❌ Erreur de sauvegarde');
    }
  };

  const runTicketSync = async () => {
    setTicketMessage('');
    setTicketStatus(prev => ({ ...(prev || {}), running: true }));
    try {
      const res = await fetch('http://localhost:3001/api/ticket-sync/run', { method: 'POST' });
      const data = await res.json();
      if (res.status === 202 && data.success) {
        setTicketMessage('🚀 Synchronisation lancée');
      } else if (res.status === 409) {
        setTicketMessage('⏳ Une synchronisation est déjà en cours');
      } else {
        setTicketMessage('❌ ' + (data.error || 'Erreur lors du démarrage'));
      }
    } catch {
      setTicketMessage('❌ Erreur lors du démarrage');
    }

    setTimeout(() => {
      refreshTicketStatus();
    }, 1500);
  };

  useEffect(() => {
  console.log('🧪 window.electron:', window.electron);
}, []);


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

        <h3>🧾 Synchronisation des tickets PDF</h3>
        <Form>
          <Form.Group className="mb-2">
            <Form.Label>Adresse du serveur SFTP</Form.Label>
            <TactileInput value={ticketHost} onChange={e => setTicketHost(e.target.value)} />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Port</Form.Label>
            <TactileInput
              type="number"
              value={ticketPort}
              onChange={e => setTicketPort(e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Utilisateur</Form.Label>
            <TactileInput value={ticketUsername} onChange={e => setTicketUsername(e.target.value)} />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Mot de passe</Form.Label>
            <TactileInput
              type="password"
              value={ticketPassword}
              onChange={e => setTicketPassword(e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Dossier distant de base</Form.Label>
            <TactileInput value={ticketRemotePath} onChange={e => setTicketRemotePath(e.target.value)} />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Période automatique (minutes)</Form.Label>
            <TactileInput
              type="number"
              value={ticketInterval}
              onChange={e => setTicketInterval(e.target.value)}
            />
          </Form.Group>

          <Form.Group className="form-check form-switch mb-3">
            <Form.Check
              type="switch"
              id="ticketSyncEnabledSwitch"
              label="Synchronisation automatique des tickets"
              checked={ticketAutoEnabled}
              onChange={() => setTicketAutoEnabled(prev => !prev)}
            />
          </Form.Group>

          <div className="d-flex flex-wrap gap-2">
            <Button onClick={saveTicketSync}>💾 Sauvegarder</Button>
            <Button variant="secondary" onClick={runTicketSync}>🚀 Lancer maintenant</Button>
            <Button variant="outline-secondary" onClick={refreshTicketStatus}>🔄 Rafraîchir le statut</Button>
          </div>
        </Form>

        {ticketMessage && <div className="mt-2">{ticketMessage}</div>}

        {ticketStatus && (
          <div className="mt-2">
            <p>Dernière exécution : {formatDateTime(ticketStatus.lastRunAt)}</p>
            {ticketStatus.running && <p>⏳ Synchronisation en cours…</p>}
            {ticketStatus.lastError && <p className="text-danger">❌ {ticketStatus.lastError}</p>}
            {ticketStatus.lastResult && (
              <ul>
                <li>Total détectés : {ticketStatus.lastResult.total}</li>
                <li>Transférés : {ticketStatus.lastResult.uploaded}</li>
                <li>Déjà présents : {ticketStatus.lastResult.skipped}</li>
                {ticketStatus.lastResult.errors && ticketStatus.lastResult.errors.length > 0 && (
                  <li className="text-danger">Erreurs : {ticketStatus.lastResult.errors.length}</li>
                )}
              </ul>
            )}
            {ticketStatus.lastResult?.errors?.length > 0 && (
              <details>
                <summary>Détails des erreurs</summary>
                <ul>
                  {ticketStatus.lastResult.errors.map((err, idx) => (
                    <li key={idx}>{err.file} : {err.message}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

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
