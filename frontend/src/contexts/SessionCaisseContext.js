import React, { createContext, useState, useEffect, useContext } from 'react';

const SessionCaisseContext = createContext();
const SessionCaisseSecondaireContext = createContext();

// CONTEXTE PRINCIPAL
export function SessionCaisseProvider({ children }) {
  const [uuidSessionCaisse, setUuidSessionCaisse] = useState(null);
  const [sessionCaisseOuverte, setSessionCaisseOuverte] = useState(false);

  const refreshSessionCaisse = () => {
    fetch('/api/session/etat-caisse', {
  credentials: 'include',
})
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


// CONTEXTE SECONDAIRE (mutuellement exclusif)
export function SessionCaisseSecondaireProvider({ children }) {
  const sessionCaisse = useSessionCaisse(); // peut être undefined
  const sessionCaisseOuverte = sessionCaisse?.sessionCaisseOuverte || false;

  const [uuidCaisseSecondaire, setUuidCaisseSecondaire] = useState(null);
  const [caisseSecondaireActive, setCaisseSecondaireActive] = useState(false);

  const refreshCaisseSecondaire = () => {
    fetch('/api/session/etat-caisse-secondaire', {
  credentials: 'include',
})
      

      .then(res => res.json())
      .then(data => {
        if (data.ouverte && !sessionCaisseOuverte) {
          setUuidCaisseSecondaire(data.id_session);
          setCaisseSecondaireActive(true);
        } else {
          setUuidCaisseSecondaire(null);
          setCaisseSecondaireActive(false);
        }
      })
      .catch(() => {
        setUuidCaisseSecondaire(null);
        setCaisseSecondaireActive(false);
      });
  };

  useEffect(() => {
    refreshCaisseSecondaire();
  }, [sessionCaisseOuverte]);

  return (
    <SessionCaisseSecondaireContext.Provider value={{
      uuidCaisseSecondaire,
      caisseSecondaireActive,
      refreshCaisseSecondaire
    }}>
      {children}
    </SessionCaisseSecondaireContext.Provider>
  );
}


export function useSessionCaisseSecondaire() {
  return useContext(SessionCaisseSecondaireContext);
}



export function useActiveSession() {
  const principale = useSessionCaisse?.() || {};
  const secondaire = useSessionCaisseSecondaire?.() || {};

  if (principale?.sessionCaisseOuverte) {
    return {
      ...principale,
      type: 'principale',
      uuid_session: principale.uuidSessionCaisse
    };
  }

  if (secondaire?.caisseSecondaireActive) {
    return {
      ...secondaire,
      type: 'secondaire',
      uuid_session: secondaire.uuidCaisseSecondaire
    };
  }

  return null;
}
