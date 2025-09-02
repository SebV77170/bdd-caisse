import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import CompteEspeces from '../components/compteEspeces';
import TactileInput from '../components/TactileInput';
import { useSessionCaisse, useSessionCaisseSecondaire, useActiveSession, waitUntilSessionRefIsReady } from '../contexts/SessionCaisseContext';

function OuvertureCaisse() {
  const [fondInitial, setFondInitial] = useState('');      // € (string)
  const [responsablePseudo, setResponsablePseudo] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [message, setMessage] = useState('');
  const [isSecondaire, setIsSecondaire] = useState(false);
  const [useCompteEspeces, setUseCompteEspeces] = useState(false); // ✅ NEW
  

  const navigate = useNavigate();
  const { refreshSessionCaisse } = useSessionCaisse() || {};
  const { refreshCaisseSecondaire, markSecondaryOpen } = useSessionCaisseSecondaire() || {};

  const activeSession = useActiveSession();
  const activeSessionRef = useRef(activeSession);
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);

  // On mémorise l'ancien fond pour le restaurer si on décoche "secondaire"
  const prevFondRef = useRef('');
  useEffect(() => {
    if (isSecondaire) {
      prevFondRef.current = fondInitial;
      setFondInitial('0');
    } else {
      // on restaure la saisie précédente (ou vide)
      setFondInitial(prevFondRef.current || '');
    }
  }, [isSecondaire]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    // Champs obligatoires
    if (!responsablePseudo || !motDePasse) {
      setMessage('Pseudo du responsable et mot de passe requis.');
      return;
    }
    // Fond requis uniquement si caisse principale
    if (!isSecondaire && (fondInitial === '' || isNaN(Number(fondInitial)))) {
      setMessage('Veuillez saisir/compter le fond de caisse.');
      return;
    }

    // Conversion en centimes (sécurisée)
    const fondCents = Math.round((isSecondaire ? 0 : Number(fondInitial || 0)) * 100);

    try {
      const res = await fetch('http://localhost:3001/api/caisse/ouverture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fond_initial: fondCents,
          responsable_pseudo: responsablePseudo,
          mot_de_passe: motDePasse,
          // compat: selon ton backend, l’un ou l’autre peut être attendu
          secondaire: isSecondaire,
          issecondaire: isSecondaire ? 1 : 0
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        console.error('❌ Erreur parsing JSON :', jsonErr);
        setMessage('Réponse invalide du serveur.');
        return;
      }

      if (!res.ok) {
        setMessage(data.error || 'Erreur inconnue lors de l’ouverture de caisse.');
        return;
      }

      if (data.success) {
        const openedAsSecondary = !!isSecondaire;

        // Optimistic update si secondaire
        if (openedAsSecondary) {
          markSecondaryOpen?.(data.id_session);
        }

        await Promise.all([
          refreshSessionCaisse?.(),
          refreshCaisseSecondaire?.(),
        ]);

        await waitUntilSessionRefIsReady(() => activeSessionRef.current, 8000);

        navigate('/caisse', {
          state: {
            toastMessage: openedAsSecondary
              ? 'Caisse secondaire ouverte avec succès !'
              : 'Caisse principale ouverte avec succès !',
          },
        });
      }
    } catch (err) {
      console.error('❌ Erreur générale :', err);
      if (String(err?.message || '').includes('Session non active')) {
        setMessage("La caisse est ouverte mais l’état met un peu de temps à remonter… Réessaie dans un instant.");
      } else {
        setMessage('Erreur de communication avec le serveur.');
      }
    }
  };

  // Guard pour CompteEspeces: ne prend la main que si non secondaire
  const handleEspecesChange = (total) => {
    if (!isSecondaire) setFondInitial(total);
  };

  return (
    <div className='bilan-scroll-container'>
      <div style={{ padding: 20, maxWidth: 400, margin: 'auto' }}>
        <h2>Ouverture de caisse</h2>

        {/* ✅ Switch secondaire tout en haut */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={isSecondaire}
              onChange={(e) => setIsSecondaire(e.target.checked)}
              style={{ marginRight: 5 }}
            />
            Ouvrir en tant que <strong>caisse secondaire</strong>
          </label>
          <small>
            {isSecondaire
              ? 'Le fond de caisse est automatiquement fixé à 0 € et non requis.'
              : 'Comptez et saisissez le fond de caisse initial.'}
          </small>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Masqué si secondaire */}
          {!isSecondaire && (
            <>
              <div style={{ margin: '12px 0' }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={useCompteEspeces}
                  onChange={(e) => {
                    setUseCompteEspeces(e.target.checked);
                    // Optionnel : si on désactive, on garde la valeur actuelle dans le champ manuel.
                    // Si tu préfères réinitialiser : setMontantReel('');
                  }}
                />
                Utiliser le calculateur d'espèces
              </label>
              <small style={{ opacity: 0.8 }}>
                Coche pour compter les espèces billet/pièce. Décoche pour saisir le montant total à la main.
              </small>
            </div>

            {/* ✅ Affichage conditionnel du composant espèces */}
            {useCompteEspeces && (
              <>
                <CompteEspeces onChangeTotal={(total) => setFondInitial(total)} />
                <div style={{ marginTop: 8 }}>
                  <strong>Fond de caisse (calculé) :</strong>{' '}
                  {fondInitial || '0'}
                </div>
              </>
            )}

              {/* ✅ Saisie manuelle uniquement si le calculateur n'est pas utilisé */}
            {!useCompteEspeces && (
              <div style={{ marginTop: 10 }}>
                <label>Fond de caisse initial (€) :</label><br />
                <TactileInput
                  type="number"
                  value={fondInitial}
                  onChange={(e) => setFondInitial(e.target.value)}
                  required={!useCompteEspeces}     // requis seulement en mode manuel
                />
              </div>
            )}
            </>
          )}

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

          <button type="submit" style={{ marginTop: 15 }}>
            {isSecondaire ? 'Ouvrir la caisse secondaire' : 'Ouvrir la caisse principale'}
          </button>
        </form>

        {message && <p style={{ marginTop: 10, color: 'red' }}>{message}</p>}
      </div>
    </div>
  );
}

export default OuvertureCaisse;
