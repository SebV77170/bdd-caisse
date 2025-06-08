import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function RequireSession({ children }) {
  const navigate = useNavigate();

  useEffect(() => {
    const vendeur = localStorage.getItem('vendeur');
    if (!vendeur) {
      navigate('/login');
    }
  }, [navigate]);

  return children;
}

export default RequireSession;
