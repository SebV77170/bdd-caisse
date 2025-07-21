import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SessionContext = createContext();

export const SessionProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // ✅ Chargement initial au démarrage de l'app
  useEffect(() => {
    fetch('http://localhost:3001/api/session', {
      credentials: 'include' // 🔑 Pour que le cookie soit envoyé
    })
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        setUser(data.user);
      })
      .catch(() => {
        setUser(null);
        navigate('/login');
      })
      .finally(() => setLoading(false));
  }, []);

  // ✅ Connexion manuelle (ex: après POST /api/session)
  const login = async (credentials) => {
    const res = await fetch('http://localhost:3001/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credentials)
    });

    if (!res.ok) throw new Error('Échec de la connexion');

    const data = await res.json();
    setUser(data.user);
  };

  // ✅ Déconnexion manuelle
  const logout = () => {
    fetch('http://localhost:3001/api/session', {
      method: 'DELETE',
      credentials: 'include'
    })
      .catch(() => {})
      .finally(() => {
        setUser(null);
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
