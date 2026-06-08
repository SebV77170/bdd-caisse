// src/contexts/DevModeContext.js
import React, { createContext, useEffect, useState } from 'react';

export const DevModeContext = createContext();

export const DevModeProvider = ({ children }) => {
  const [devMode, setDevMode] = useState(() => {
    const saved = localStorage.getItem('devMode');
    if (!saved) return false;
    try {
      return JSON.parse(saved);
    } catch {
      return false;
    }
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
