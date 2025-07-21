import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import CompteEspeces from '../components/compteEspeces';
import TactileInput from '../components/TactileInput';
import { useSessionCaisse } from '../contexts/SessionCaisseContext';
import { useSessionCaisseSecondaire } from '../contexts/SessionCaisseContext';


function OuvertureCaisse() {
  const [fondInitial, setFondInitial] = useState('');
  const [responsablePseudo, setResponsablePseudo] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [message, setMessage] = useState('');
  const [isSecondaire, setIsSecondaire] = useState(false); // ✅ nouveau state
  const navigate = useNavigate();
  const { refreshSessionCaisse } = useSessionCaisse() || {};
const { refreshCaisseSecondaire } = useSessionCaisseSecondaire() || {};


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
        credentials: 'include', // ✅ AJOUT ICI

        body: JSON.stringify({
          fond_initial: parseFloat(fondInitial) * 100,
          responsable_pseudo: responsablePseudo,
          mot_de_passe: motDePasse,
          secondaire: isSecondaire // ✅ switch transmis
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage = data.error || 'Erreur inconnue lors de l’ouverture de caisse.';
        setMessage(errorMessage);
        return;
      }

      if (data.success) {
  if (data.secondaire) {
    refreshCaisseSecondaire?.(); // sécurise l'appel
  } else {
    refreshSessionCaisse?.(); // sécurise l'appel
  }

  navigate('/caisse', {
    state: {
      toastMessage: data.secondaire
        ? 'Caisse secondaire ouverte avec succès !'
        : 'Caisse principale ouverte avec succès !'
    }
  });
}


    } catch (err) {
      console.error(err);
      setMessage('Erreur de communication avec le serveur.');
    }
  };

  return (
    <div className='bilan-scroll-container'>  
    <div style={{ padding: 20, maxWidth: 400, margin: 'auto' }}>
      <h2>Ouverture de caisse</h2>
      <form onSubmit={handleSubmit}>
        <CompteEspeces onChangeTotal={(total) => setFondInitial(total)} />

        <div>
          <label>Fond de caisse initial (€) :</label><br />
          <TactileInput
            type="number"
            value={fondInitial}
            onChange={(e) => setFondInitial(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Pseudo du responsable :</label><br />
          <TactileInput
            type="text"
            value={responsablePseudo}
            onChange={(e) => setResponsablePseudo(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Mot de passe du responsable :</label><br />
          <TactileInput
            type="password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            required
          />
        </div>

        {/* ✅ Switch caisse secondaire */}
        <div style={{ marginTop: 10 }}>
          <label>
            <input
              type="checkbox"
              checked={isSecondaire}
              onChange={(e) => setIsSecondaire(e.target.checked)}
              style={{ marginRight: 5 }}
            />
            Ouvrir en tant que caisse secondaire
          </label>
        </div>

        <button type="submit" style={{ marginTop: 15 }}>
          Ouvrir la caisse
        </button>
      </form>

      {message && <p style={{ marginTop: 10, color: 'red' }}>{message}</p>}
    </div>
    </div>
  );
}

export default OuvertureCaisse;
