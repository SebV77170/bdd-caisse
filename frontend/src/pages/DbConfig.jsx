import React, { useEffect, useState } from 'react';
import { Form, Button } from 'react-bootstrap';

const DbConfig = () => {
  const [config, setConfig] = useState({ host: '', user: '', password: '', database: '' });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('http://localhost:3001/api/dbconfig')
      .then(res => res.json())
      .then(data => { setConfig(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setMessage('');
    try {
      const res = await fetch('http://localhost:3001/api/dbconfig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        setMessage('Configuration enregistrée');
      } else {
        setMessage(data.error || 'Erreur');
      }
    } catch {
      setMessage('Erreur');
    }
  };

  if (loading) return <div>Chargement...</div>;

  return (
    <div className="container mt-3">
      <h3>Configuration MySQL</h3>
      <Form>
        <Form.Group className="mb-2">
          <Form.Label>Hôte</Form.Label>
          <Form.Control value={config.host} onChange={e => setConfig({ ...config, host: e.target.value })} />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Utilisateur</Form.Label>
          <Form.Control value={config.user} onChange={e => setConfig({ ...config, user: e.target.value })} />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Mot de passe</Form.Label>
          <Form.Control type="password" value={config.password} onChange={e => setConfig({ ...config, password: e.target.value })} />
        </Form.Group>
        <Form.Group className="mb-2">
          <Form.Label>Base</Form.Label>
          <Form.Control value={config.database} onChange={e => setConfig({ ...config, database: e.target.value })} />
        </Form.Group>
        <Button onClick={save}>Sauvegarder</Button>
      </Form>
      {message && <div className="mt-2">{message}</div>}
    </div>
  );
};

export default DbConfig;
