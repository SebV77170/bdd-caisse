import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SessionCaisseProvider, SessionCaisseSecondaireProvider } from './SessionCaisseContext';
import { useSession } from './SessionContext';

function SessionCaisseAutoProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSession();
  const [mode, setMode] = useState(null); // 'principale' | 'secondaire' | 'aucune'

  useEffect(() => {
    const detectCaisse = async () => {
      try {
        const [resP, resS] = await Promise.all([
          fetch('http://localhost:3001/api/session/etat-caisse',{credentials: 'include'}),
          fetch('http://localhost:3001/api/session/etat-caisse-secondaire',{credentials: 'include'})
        ]);
        const [dataP, dataS] = await Promise.all([resP.json(), resS.json()]);

        if (dataP.ouverte) setMode('principale');
        else if (dataS.ouverte) setMode('secondaire');
        else setMode('aucune');
      } catch (err) {
        console.error('Erreur détection session caisse :', err);
        setMode('aucune');
      }
    };

    detectCaisse();
  }, []);

  useEffect(() => {
    if (mode === 'aucune') {
      if (user === undefined) return;
      if (!user) {
        if (location.pathname !== '/login') 
          navigate('/login');
        return;
      }
      if (location.pathname !== '/caisse-non-ouverte') {
        navigate('/caisse-non-ouverte');
      }
    }
  }, [mode, user, navigate, location.pathname]);

  if (mode === null || user === undefined) {
    return <div>Chargement de la session…</div>;
  }

  if (mode === 'principale') {
    return <SessionCaisseProvider>{children}</SessionCaisseProvider>;
  }

  if (mode === 'secondaire') {
    return <SessionCaisseSecondaireProvider>{children}</SessionCaisseSecondaireProvider>;
  }

  return null;
}

export default SessionCaisseAutoProvider;
