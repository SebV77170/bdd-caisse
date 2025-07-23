import React, { createContext, useState, useEffect, useContext } from 'react';
import socket from '../utils/socket'; // Assurez-vous que le chemin est correct

const SessionCaisseContext = createContext();
const SessionCaisseSecondaireContext = createContext();

export function waitUntilSessionRefIsReady(ref, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (ref.current) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("Session non active"));
      setTimeout(check, 50);
    };
    check();
  });
}


// CONTEXTE PRINCIPAL
export function SessionCaisseProvider({ children }) {
  const [uuidSessionCaisse, setUuidSessionCaisse] = useState(null);
  const [sessionCaisseOuverte, setSessionCaisseOuverte] = useState(false);

  const refreshSessionCaisse = () => {
    fetch('http://localhost:3001/api/session/etat-caisse', {
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

  const handler = (data) => {
    if (data?.type === 'principale') {
      console.log("🔄 [Socket] Mise à jour caisse principale détectée");
      refreshSessionCaisse();
    }
  };

  socket.on('etatCaisseUpdated', handler);

  return () => {
    socket.off('etatCaisseUpdated', handler);
  };
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
    fetch('http://localhost:3001/api/session/etat-caisse-secondaire', {
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

  const handler = (data) => {
    if (data?.type === 'secondaire') {
      console.log("🔄 [Socket] Mise à jour caisse secondaire détectée");
      refreshCaisseSecondaire();
    }
  };

  socket.on('etatCaisseUpdated', handler);

  return () => {
    socket.off('etatCaisseUpdated', handler);
  };
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

  console.log("🧩 useActiveSession debug", {
    principale,
    secondaire
  });

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
