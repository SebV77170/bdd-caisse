import React, { useEffect, useState } from 'react';
import { Form, Button, Collapse } from 'react-bootstrap';
import BoutonsManager from '../components/BoutonsManager';
import ResetButton from '../components/ResetButton';
import DevModeToggle from '../components/DevModeToggle';
import DevModeModal from '../components/DevModeModal';
import { useContext } from 'react';
import { DevModeContext } from '../contexts/DevModeContext';
import TactileInput from '../components/TactileInput';

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

  const [showPassModal, setShowPassModal] = useState(false);
  const { devMode, setDevMode } = useContext(DevModeContext);

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

    fetch('http://localhost:3001/api/network/local-ip')
      .then(res => res.json())
      .then(data => setLocalIp(data.ip || ''))
      .catch(() => {});
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
