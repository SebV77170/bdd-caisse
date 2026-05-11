// src/contexts/SessionCaisseContext.jsx
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import socket from '../utils/socket';

const SessionCaisseContext = createContext();
const SessionCaisseSecondaireContext = createContext();

// ── util ─────────────────────────────────────────────
export function waitUntilSessionRefIsReady(getterOrRef, timeoutMs = 8000, intervalMs = 50) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const get = typeof getterOrRef === 'function'
      ? getterOrRef
      : () => getterOrRef?.current;

    const check = () => {
      const v = get();
      if (v && v.uuid_session) return resolve(v);
      if (Date.now() - start > timeoutMs) return reject(new Error("Session non active (timeout)"));
      setTimeout(check, intervalMs);
    };
    check();
  });
}

// ── Provider PRINCIPAL ──────────────────────────────
export function SessionCaisseProvider({ children }) {
  const [uuidSessionCaisse, setUuidSessionCaisse] = useState(null);
  const [sessionCaisseOuverte, setSessionCaisseOuverte] = useState(false);
  const [isReady, setIsReady] = useState(false); // ✅ NEW

  const refreshSessionCaisse = useCallback(() => {
    // on retourne la Promise pour pouvoir await dans useEffect
    return fetch('http://localhost:3001/api/session/etat-caisse', { credentials: 'include' })
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
  }, []);

  useEffect(() => {
    (async () => {
      await refreshSessionCaisse();
      setIsReady(true); // ✅ on marque prêt après le premier fetch
    })();

    const handler = (data) => {
      if (data?.type === 'principale') {
        console.log("🔄 [Socket] Mise à jour caisse principale détectée");
        // On rafraîchit sans toucher isReady (il reste true)
        refreshSessionCaisse();
      }
    };

    socket.on('etatCaisseUpdated', handler);
    return () => socket.off('etatCaisseUpdated', handler);
  }, [refreshSessionCaisse]);

  return (
    <SessionCaisseContext.Provider value={{
      uuidSessionCaisse,
      sessionCaisseOuverte,
      refreshSessionCaisse,
      isReady, // ✅ exposé
    }}>
      {children}
    </SessionCaisseContext.Provider>
  );
}

export function useSessionCaisse() {
  return useContext(SessionCaisseContext);
}

// ── Provider SECONDAIRE ─────────────────────────────
export function SessionCaisseSecondaireProvider({ children }) {
  const principale = useSessionCaisse(); // nécessite d’être sous le provider principal
  const sessionCaisseOuverte = principale?.sessionCaisseOuverte || false;
  const principaleReady = !!principale?.isReady; // ✅ on attend que le principal soit prêt

  const [uuidCaisseSecondaire, setUuidCaisseSecondaire] = useState(null);
  const [caisseSecondaireActive, setCaisseSecondaireActive] = useState(false);
  const [isReady, setIsReady] = useState(false); // ✅ NEW

  const refreshCaisseSecondaire = useCallback(() => {
    return fetch('http://localhost:3001/api/session/etat-caisse-secondaire', { credentials: 'include' })
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
  }, [sessionCaisseOuverte]);

  useEffect(() => {
    if (!principaleReady) return; // ✅ tant que le principal n’a pas fini son 1er fetch, on attend
    (async () => {
      await refreshCaisseSecondaire();
      setIsReady(true); // ✅ prêt après 1er fetch secondaire
    })();

    const handler = (data) => {
      if (data?.type === 'secondaire') {
        console.log("🔄 [Socket] Mise à jour caisse secondaire détectée");
        refreshCaisseSecondaire();
      }
    };

    socket.on('etatCaisseUpdated', handler);
    return () => socket.off('etatCaisseUpdated', handler);
  }, [principaleReady, sessionCaisseOuverte, refreshCaisseSecondaire]);

  const markSecondaryOpen = (id) => {
  setUuidCaisseSecondaire(id);
  setCaisseSecondaireActive(true);
  setIsReady(true); // on est certain de l’état local
};

return (
  <SessionCaisseSecondaireContext.Provider value={{
    uuidCaisseSecondaire,
    caisseSecondaireActive,
    refreshCaisseSecondaire,
    isReady,
    markSecondaryOpen, // ✅ expose
  }}>
    {children}
  </SessionCaisseSecondaireContext.Provider>
);
}

export function useSessionCaisseSecondaire() {
  return useContext(SessionCaisseSecondaireContext);
}

// ── Hook de session active ──────────────────────────
export function useActiveSession() {
  const principale = useSessionCaisse() || {};
  const secondaire = useSessionCaisseSecondaire() || {};

  // ⏳ tant que l’un des deux n’a pas terminé son 1er fetch, on renvoie undefined (chargement)
  if (!principale.isReady || !secondaire.isReady) return undefined;

  if (principale.sessionCaisseOuverte) {
    return {
      ...principale,
      type: 'principale',
      uuid_session: principale.uuidSessionCaisse,
    };
  }

  if (secondaire.caisseSecondaireActive) {
    return {
      ...secondaire,
      type: 'secondaire',
      uuid_session: secondaire.uuidCaisseSecondaire,
    };
  }

  return null; // prêt, mais aucune session active
}
