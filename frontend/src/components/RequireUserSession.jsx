import { useSession } from '../contexts/SessionContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

function RequireUserSession({ children }) {
  const { user, loading } = useSession(); // ✅ déstructuration correcte
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return; // En attente de la session
    if (!user && location.pathname !== '/login') {
      navigate('/login');
    }
  }, [user, loading, location.pathname, navigate]);

  if (loading) return <div>Chargement…</div>;
  if (!user) return null; // Redirigé

  return children;
}

export default RequireUserSession;
