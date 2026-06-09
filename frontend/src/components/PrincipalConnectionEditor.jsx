import React, { useEffect, useState } from 'react';

export default function PrincipalConnectionEditor({
  initialIp = '',
  onVerified = () => {}
}) {
  const [ip, setIp] = useState(initialIp);
  const [message, setMessage] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (initialIp) {
      setIp(initialIp);
      return;
    }

    fetch('http://localhost:3001/api/principal-ip')
      .then(response => response.json())
      .then(data => setIp(data.ip || ''))
      .catch(() => setMessage("Impossible de lire l'adresse actuellement configurée."));
  }, [initialIp]);

  const testAndSave = async () => {
    const candidate = ip.trim();
    if (!candidate) {
      setMessage("Saisissez l'adresse IP de la caisse principale.");
      return;
    }

    setTesting(true);
    setMessage(`Test de la caisse principale à l'adresse ${candidate}...`);
    try {
      const response = await fetch('http://localhost:3001/api/principal-ip/test-and-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: candidate })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setMessage(`${data.error || 'Connexion impossible'} ${data.details || ''}`.trim());
        return;
      }
      setMessage(data.message || 'Connexion vérifiée et adresse enregistrée.');
      onVerified(candidate);
    } catch {
      setMessage("Le service local n'a pas pu effectuer le test de connexion.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="border rounded p-3 bg-light">
      <label className="form-label" htmlFor="principal-recovery-ip">
        Adresse IP de la caisse principale
      </label>
      <div className="d-flex gap-2">
        <input
          id="principal-recovery-ip"
          className="form-control"
          value={ip}
          onChange={event => {
            setIp(event.target.value);
            setMessage('');
          }}
          disabled={testing}
          placeholder="Exemple : 192.168.1.20"
        />
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={testAndSave}
          disabled={testing}
        >
          {testing ? 'Test...' : 'Tester et enregistrer'}
        </button>
      </div>
      {message && <div className="small mt-2">{message}</div>}
    </div>
  );
}
