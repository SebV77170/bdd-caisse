// src/components/RequireUserAndCaisseSession.jsx
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';
import { useActiveSession } from '../contexts/SessionCaisseContext';

function RequireUserAndCaisseSession({ children }) {
  const { user } = useSession();
  const activeSession = useActiveSession();
  const navigate = useNavigate();
  const location = useLocation();
console.log("USER:", user);
console.log("ACTIVE SESSION:", activeSession);

  useEffect(() => {
  if (user === undefined || activeSession === undefined) return; // ✅ on attend
  if (!user) {
    navigate('/login');
  } else if (!activeSession) {
    navigate('/caisse-non-ouverte');
  }
}, [user, activeSession, navigate, location.pathname]);

if (user === undefined || activeSession === undefined) return <div>Chargement...</div>;
if (!user || !activeSession) return null;

  return children;
}

export default RequireUserAndCaisseSession;
