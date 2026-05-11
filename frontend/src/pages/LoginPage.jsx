import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SignupModal from '../components/SignupModal';
import { useSession } from '../contexts/SessionContext'; // ✅
import { useActiveSession } from '../contexts/SessionCaisseContext'; // ✅ pour vérifier si une caisse est ouverte
import ResponsableForm from "../components/ResponsableForm";
import { toast } from 'react-toastify';


function LoginPage() {
  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const activeSession = useActiveSession(); // ✅ pour vérifier si une caisse est ouverte
  //const sessionOuverte = activeSession?.sessionCaisseOuverte || activeSession?.caisseSecondaireActive || false ; // ✅ pour savoir si la caisse est ouverte
  //const [sessionOuverte, setSessionOuverte] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const navigate = useNavigate();
  const { login } = useSession(); // ✅

  console.log('Session ouverte:', activeSession); // Pour déboguer

  /* useEffect(() => {
    fetch('http://localhost:3001/api/session/etat-caisse', {
      credentials: 'include' // 🔑 pour envoyer le cookie de session
      })
      .then(res => res.json())
      .then(data => setSessionOuverte(data.ouverte))
      .catch(err => console.error('Erreur état caisse:', err));
  }, []); */

  const handleLogin = async () => {
    setMessage('');
    if (!pseudo || !password) {
      setMessage('Tous les champs doivent être remplis');
      return;
    }

   try {
  // ✅ Appelle le login centralisé (qui fait POST /api/session + setUser)
  await login({ pseudo, mot_de_passe: password });

  // ✅ Si une caisse est ouverte, on ajoute le caissier
  if (activeSession) {
    try {
      await fetch('http://localhost:3001/api/session/ajouter-caissier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // 🔑 pour transmettre la session
        body: JSON.stringify({ nom: pseudo }) // ou nom réel si dispo
      });
    } catch (err) {
      console.error('Erreur mise à jour caissiers:', err);
    }

    navigate('/caisse'); // Redirige vers la page caisse

  } else {
    navigate('/caisse-non-ouverte'); // Redirige vers la page caisse non ouverte si pas de session caisse
  }

} catch (err) {
  toast.error('Erreur de connexion : ' + err.message);
}
  };

  return (
    <div className="container mt-5">
  <h2 className="text-center">
    {activeSession ? 'Alors, on change de caissier, qui prend la place ?' : "Bonjour, qui est là aujourd'hui ?"}
  </h2>

  <ResponsableForm
    title="Identifiez-vous"
    responsablePseudo={pseudo}
    setResponsablePseudo={setPseudo}
    motDePasse={password}
    setMotDePasse={setPassword}
    onSubmit={handleLogin}
  />

  {/* Bouton centré */}
  <div className="mt-3 d-flex justify-content-center">
    <button className="btn btn-primary px-4" onClick={handleLogin}>Se connecter</button>
  </div>

  {/* Message d'erreur centré (si présent) */}
  {message && <p className="text-danger mt-2 text-center">{message}</p>}

  {/* Lien centré */}
  <p className="mt-3 text-center">
    <button type="button" className="btn btn-link p-0" onClick={() => setShowSignup(true)}>
      Je n'ai pas de compte
    </button>
  </p>

  <SignupModal show={showSignup} onHide={() => setShowSignup(false)} />
</div>

  );
}

export default LoginPage;
