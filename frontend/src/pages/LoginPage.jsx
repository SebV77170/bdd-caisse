import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function LoginPage() {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState('');
  const [password, setPassword] = useState('');
  const [sessionOuverte, setSessionOuverte] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('http://localhost:3001/api/users')
      .then(res => res.json())
      .then(setUsers)
      .catch(err => console.error('Erreur chargement utilisateurs:', err));

    fetch('http://localhost:3001/api/session/etat-caisse')
      .then(res => res.json())
      .then(data => setSessionOuverte(data.ouverte))
      .catch(err => console.error('Erreur état caisse:', err));
  }, []);

  const handleLogin = async () => {
    if (!selected || !password) return;
    try {
      const res = await fetch('http://localhost:3001/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: selected, mot_de_passe: password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('vendeur', JSON.stringify(data.user));

        try {
          const etatRes = await fetch('http://localhost:3001/api/session/etat-caisse');
          const etat = await etatRes.json();
          if (etat.ouverte) {
            await fetch('http://localhost:3001/api/session/ajouter-caissier', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nom: data.user.nom })
            });
          }
        } catch (err) {
          console.error('Erreur mise à jour caissiers:', err);
        }

        navigate('/'); // ✅ navigation propre pour Electron
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      alert('Erreur de connexion');
    }
  };

  return (
    <div className="container mt-5">
      <h2>{sessionOuverte ? 'Changement de caissier' : 'Connexion vendeur'}</h2>
      <select className="form-select my-3" onChange={e => setSelected(e.target.value)} value={selected}>
        <option value="">-- Choisir un vendeur --</option>
        {users.map(u => (
          <option key={u.id} value={u.pseudo}>{u.pseudo}</option>
        ))}
      </select>
      <input
        type="password"
        className="form-control mb-3"
        placeholder="Mot de passe"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <button className="btn btn-primary" onClick={handleLogin}>Se connecter</button>
    </div>
  );
}

export default LoginPage;
