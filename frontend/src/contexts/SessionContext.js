import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SessionContext = createContext();

export const SessionProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Chargement initial au démarrage de l'app
  useEffect(() => {
    fetch('/api/session')
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        setUser(data.user);
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem('vendeur');
        navigate('/login');
      })
      .finally(() => setLoading(false));
  }, []);

  // Connexion manuelle (ex : après POST /api/session)
  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('vendeur', JSON.stringify(userData));
  };

  // Déconnexion manuelle
  const logout = () => {
    fetch('/api/session', { method: 'DELETE' })
      .catch(() => {}) // Ignorer les erreurs
      .finally(() => {
        setUser(null);
        localStorage.removeItem('vendeur');
        navigate('/login');
      });
  };

  return (
    <SessionContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => useContext(SessionContext);
