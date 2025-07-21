// src/contexts/SyncModalContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
// socket.js
import { io } from 'socket.io-client';
export const socket = io('http://localhost:3001');

const SyncModalContext = createContext();

export const SyncModalProvider = ({ children }) => {
  const [demande, setDemande] = useState(null);

  useEffect(() => {
    const handler = (data) => {
      setDemande(data); // data = { type: 'DEMANDE_SYNC', message: '...' }
    };

    socket.on('demande-sync-secondaire', handler);

    return () => socket.off('demande-sync-secondaire', handler);
  }, []);

  return (
    <SyncModalContext.Provider value={{ demande, setDemande }}>
      {children}
    </SyncModalContext.Provider>
  );
};

export const useSyncModal = () => useContext(SyncModalContext);
