import React, { createContext, useEffect, useState } from 'react';

export const PreTicketQueueVisibilityContext = createContext();

export const PreTicketQueueVisibilityProvider = ({ children }) => {
  const [preTicketQueueVisible, setPreTicketQueueVisible] = useState(() => {
    const saved = localStorage.getItem('preTicketQueueVisible');
    if (!saved) return true;
    try {
      return JSON.parse(saved);
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('preTicketQueueVisible', JSON.stringify(preTicketQueueVisible));
    } catch {}
  }, [preTicketQueueVisible]);

  return (
    <PreTicketQueueVisibilityContext.Provider value={{ preTicketQueueVisible, setPreTicketQueueVisible }}>
      {children}
    </PreTicketQueueVisibilityContext.Provider>
  );
};
