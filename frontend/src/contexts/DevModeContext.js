// src/contexts/DevModeContext.js
import React, { createContext, useEffect, useState } from 'react';

export const DevModeContext = createContext();

export const DevModeProvider = ({ children }) => {
  const [devMode, setDevMode] = useState(() => {
    const saved = localStorage.getItem('devMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Sync localStorage à chaque mise à jour
  useEffect(() => {
    localStorage.setItem('devMode', JSON.stringify(devMode));
  }, [devMode]);

  return (
    <DevModeContext.Provider value={{ devMode, setDevMode }}>
      {children}
    </DevModeContext.Provider>
  );
};
