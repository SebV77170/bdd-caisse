import React, { createContext, useCallback, useEffect, useState } from 'react';
import { apiUrl } from '../utils/apiBase';
import socket from '../utils/socket';

export const PreTicketQueueVisibilityContext = createContext();

export const PreTicketQueueVisibilityProvider = ({ children }) => {
  const [pendingPreTicketCount, setPendingPreTicketCount] = useState(0);
  const [preTicketQueueVisible, setPreTicketQueueVisible] = useState(() => {
    const saved = localStorage.getItem('preTicketQueueVisible');
    if (!saved) return true;
    try {
      return JSON.parse(saved);
    } catch {
      return true;
    }
  });

  const refreshPendingPreTicketCount = useCallback(() => {
    fetch(apiUrl('/api/pre-tickets?statut=en_attente'), { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Chargement impossible');
        return res.json();
      })
      .then(data => setPendingPreTicketCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {
        setPendingPreTicketCount(0);
      });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('preTicketQueueVisible', JSON.stringify(preTicketQueueVisible));
    } catch {}
  }, [preTicketQueueVisible]);

  useEffect(() => {
    refreshPendingPreTicketCount();

    socket.on('preTicketCreated', refreshPendingPreTicketCount);
    socket.on('preTicketUpdated', refreshPendingPreTicketCount);
    socket.on('preTicketConverted', refreshPendingPreTicketCount);

    return () => {
      socket.off('preTicketCreated', refreshPendingPreTicketCount);
      socket.off('preTicketUpdated', refreshPendingPreTicketCount);
      socket.off('preTicketConverted', refreshPendingPreTicketCount);
    };
  }, [refreshPendingPreTicketCount]);

  return (
    <PreTicketQueueVisibilityContext.Provider
      value={{
        preTicketQueueVisible,
        setPreTicketQueueVisible,
        pendingPreTicketCount,
        refreshPendingPreTicketCount,
      }}
    >
      {children}
    </PreTicketQueueVisibilityContext.Provider>
  );
};
