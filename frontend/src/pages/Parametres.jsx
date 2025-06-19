import React, { useEffect, useState } from 'react';
import { Form, Button, Collapse } from 'react-bootstrap';
import BoutonsManager from '../components/BoutonsManager';
import ResetButton from '../components/ResetButton';
import DevModeToggle from '../components/DevModeToggle';
import ModeTactileToggle from '../components/ModeTactileToggle';
import DevModeModal from '../components/DevModeModal';

const Parametres = () => {
  const [interval, setIntervalValue] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState('');
  const [showBoutons, setShowBoutons] = useState(false);

  const [devMode, setDevMode] = useState(() => {
    const saved = localStorage.getItem('devMode');
    return saved ? JSON.parse(saved) : false;
  });

  const [showPassModal, setShowPassModal] = useState(false);

  useEffect(() => {
    fetch('http://localhost:3001/api/sync-config')
      .then(res => res.json())
      .then(data => {
        setIntervalValue(String(data.interval));
        setEnabled(data.enabled);
      })
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

  return (
    <div className="bilan-scroll-container">
      <div className="container mt-3">

        <h3>⚙️ Paramètres de synchronisation</h3>
        <Form>
          <Form.Group className="mb-2">
            <Form.Label>Période de synchronisation (minutes)</Form.Label>
            <Form.Control
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

        <h4>🖐️ Options d'affichage</h4>
        <p>Activer le mode tactile</p>
        <div className="d-flex gap-3 mb-3">
          <ModeTactileToggle />
        </div>

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

        {devMode && (
          <>
            <p>Reset les bases de données</p>
            <ResetButton />
          </>
        )}
      </div>
    </div>
  );
};

export default Parametres;
