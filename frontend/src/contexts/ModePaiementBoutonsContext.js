import React, { createContext, useEffect, useState } from 'react';

export const ModePaiementBoutonsContext = createContext();

export const ModePaiementBoutonsProvider = ({ children }) => {
  const [modePaiementBoutons, setModePaiementBoutons] = useState(() => {
    const saved = localStorage.getItem('modePaiementBoutons');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    try {
      localStorage.setItem('modePaiementBoutons', JSON.stringify(modePaiementBoutons));
    } catch {}
  }, [modePaiementBoutons]);

  return (
    <ModePaiementBoutonsContext.Provider value={{ modePaiementBoutons, setModePaiementBoutons }}>
      {children}
    </ModePaiementBoutonsContext.Provider>
  );
};

