// src/contexts/SessionCaisseContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';

const SessionCaisseContext = createContext();

export function SessionCaisseProvider({ children }) {
  const [uuidSessionCaisse, setUuidSessionCaisse] = useState(null);
  const [sessionCaisseOuverte, setSessionCaisseOuverte] = useState(false);

  // Fonction pour rafraîchir manuellement la session caisse (utile après ouverture/fermeture)
  const refreshSessionCaisse = () => {
    fetch('http://localhost:3001/api/session/etat-caisse')
      .then(res => res.json())
      .then(data => {
        if (data.ouverte) {
          setUuidSessionCaisse(data.id_session);
          setSessionCaisseOuverte(true);
        } else {
          setUuidSessionCaisse(null);
          setSessionCaisseOuverte(false);
        }
      })
      .catch(() => {
        setUuidSessionCaisse(null);
        setSessionCaisseOuverte(false);
      });
  };

  // Initial fetch au chargement
  useEffect(() => {
    refreshSessionCaisse();
  }, []);

  return (
    <SessionCaisseContext.Provider value={{
      uuidSessionCaisse,
      sessionCaisseOuverte,
      refreshSessionCaisse
    }}>
      {children}
    </SessionCaisseContext.Provider>
  );
}

export function useSessionCaisse() {
  return useContext(SessionCaisseContext);
}
