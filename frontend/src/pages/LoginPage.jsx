import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TactileInput from '../components/TactileInput';


function LoginPage() {
  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [sessionOuverte, setSessionOuverte] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('http://localhost:3001/api/session/etat-caisse')
      .then(res => res.json())
      .then(data => setSessionOuverte(data.ouverte))
      .catch(err => console.error('Erreur état caisse:', err));
  }, []);

  const handleLogin = async () => {
    setMessage('');
    if (!pseudo || !password) {
      setMessage('Tous les champs doivent être remplis');
      return;
    }
    try {
      const res = await fetch('http://localhost:3001/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo, mot_de_passe: password })
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
      <h2>{sessionOuverte ? 'Alors, on change de caissier, qui prend la place ?' : "Bonjour, qui est là aujourd'hui ?"}</h2>
      <TactileInput
        type="text"
        className="form-control my-3"
        placeholder="Pseudo"
        value={pseudo}
        onChange={e => setPseudo(e.target.value)}
      />
      <TactileInput
        type="password"
        className="form-control mb-3"
        placeholder="Mot de passe"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <button className="btn btn-primary" onClick={handleLogin}>Se connecter</button>
      {message && <p className="text-danger mt-2">{message}</p>}
    </div>
  );
}

export default LoginPage;
