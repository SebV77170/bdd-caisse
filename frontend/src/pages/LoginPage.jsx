import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function LoginPage() {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetch('http://localhost:3001/api/users')
      .then(res => res.json())
      .then(setUsers)
      .catch(err => console.error('Erreur chargement utilisateurs:', err));
  }, []);

  const handleLogin = () => {
    if (!selected) return;
    fetch('http://localhost:3001/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pseudo: selected })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          localStorage.setItem('vendeur', JSON.stringify(data.user));
          navigate('/'); // ✅ navigation propre pour Electron
        }
      })
      .catch(() => alert('Erreur de connexion'));
  };

  return (
    <div className="container mt-5">
      <h2>Connexion vendeur</h2>
      <select className="form-select my-3" onChange={e => setSelected(e.target.value)} value={selected}>
        <option value="">-- Choisir un vendeur --</option>
        {users.map(u => (
          <option key={u.id} value={u.pseudo}>{u.pseudo}</option>
        ))}
      </select>
      <button className="btn btn-primary" onClick={handleLogin}>Se connecter</button>
    </div>
  );
}

export default LoginPage;
