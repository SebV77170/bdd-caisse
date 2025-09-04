import React, { createContext, useEffect, useState } from 'react';
export const ModeTactileContext = createContext();

export const ModeTactileProvider = ({ children }) => {
  const [modeTactile, setModeTactile] = useState(() => {
    const saved = localStorage.getItem('modeTactile');
    return saved ? JSON.parse(saved) : false;
  });

   // 🔁 Persiste à chaque changement
  useEffect(() => {
    try {
      localStorage.setItem('modeTactile', JSON.stringify(modeTactile));
    } catch {}
  }, [modeTactile]);

  return (
      <ModeTactileContext.Provider value={{ modeTactile, setModeTactile }}>
        {children}
      </ModeTactileContext.Provider>
    );
  };