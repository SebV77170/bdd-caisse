import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import CompteEspeces from '../components/compteEspeces';
import { useSessionCaisse } from '../contexts/SessionCaisseContext';




function OuvertureCaisse() {
  const [fondInitial, setFondInitial] = useState('');
  const [responsablePseudo, setResponsablePseudo] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const { refreshSessionCaisse } = useSessionCaisse();
  

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fondInitial || !responsablePseudo || !motDePasse) {
      setMessage('Tous les champs sont obligatoires.');
      return;
    }

    try {
      const res = await fetch('http://localhost:3001/api/caisse/ouverture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fond_initial: parseFloat(fondInitial)*100,
          responsable_pseudo: responsablePseudo,
          mot_de_passe: motDePasse
        })
      });
      refreshSessionCaisse(); // pour recharger l’uuid de la session caisse dans le contexte


      const data = await res.json();

      if (data.success) {
        navigate('/', {
        state: { toastMessage: 'Caisse ouverte avec succès !' }
    });
      }
    } catch (err) {
      console.error(err);
      setMessage('Erreur de communication avec le serveur.');
    }
  };

  return (

    <div style={{ padding: 20, maxWidth: 400, margin: 'auto' }}>
      <h2>Ouverture de caisse</h2>
      <form onSubmit={handleSubmit}>
         {/* ✅ Intégration du tableau des espèces */}
        <CompteEspeces onChangeTotal={(total) => setFondInitial(total)} />
        <div>
          <label>Fond de caisse initial (€) :</label><br />
          <input
            type="number"
            value={fondInitial}
            onChange={(e) => setFondInitial(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Pseudo du responsable :</label><br />
          <input
            type="text"
            value={responsablePseudo}
            onChange={(e) => setResponsablePseudo(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Mot de passe du responsable :</label><br />
          <input
            type="password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            required
          />
        </div>
        <button type="submit" style={{ marginTop: 10 }}>Ouvrir la caisse</button>
      </form>
      {message && <p style={{ marginTop: 10, color: 'red' }}>{message}</p>}
    </div>
  );
}

export default OuvertureCaisse;
