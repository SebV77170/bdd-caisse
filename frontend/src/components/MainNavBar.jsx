import React, { useContext, useState, useEffect } from 'react';
import { Navbar, Nav, Offcanvas } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { DevModeContext } from '../contexts/DevModeContext';
import { useActiveSession } from '../contexts/SessionCaisseContext';
import { useSession } from '../contexts/SessionContext';
import { ModePaiementBoutonsContext } from '../contexts/ModePaiementBoutonsContext';
import { PreTicketQueueVisibilityContext } from '../contexts/PreTicketQueueVisibilityContext';
import ModeTactileToggle from './ModeTactileToggle';
import { toast } from 'react-toastify';
import { apiUrl } from '../utils/apiBase';
import socket from '../utils/socket';

function MainNavbar() {
  const activeSession = useActiveSession();
  const { devMode } = useContext(DevModeContext);
  const [showMenu, setShowMenu] = useState(false);
  const { user } = useSession();
  const [syncStatus, setSyncStatus] = useState(null);
  const navigate = useNavigate();
  const { modePaiementBoutons, setModePaiementBoutons } = useContext(ModePaiementBoutonsContext);
  const { preTicketQueueVisible, setPreTicketQueueVisible } = useContext(PreTicketQueueVisibilityContext);

  useEffect(() => {
    const startHandler = () => {
      setSyncStatus('loading');
    };
    const endHandler = (result) => {
      if (result?.success === true) {
        setSyncStatus('success');
      } else if (result?.success === false) {
        setSyncStatus('error');
      } else {
        setSyncStatus(null);
      }
    };
    socket.on('syncStart', startHandler);
    socket.on('syncEnd', endHandler);
    return () => {
      socket.off('syncStart', startHandler);
      socket.off('syncEnd', endHandler);
    };
  }, []);


  return (
    <Navbar bg="dark" variant="dark" expand={false} className="px-3 py-1">
      <Navbar.Toggle
        aria-controls="main-nav"
        className="me-auto border-0 text-white"
        onClick={() => setShowMenu(true)}
      >
        <span style={{ fontSize: '1.5rem' }}>☰</span>
      </Navbar.Toggle>

      <Navbar.Offcanvas
        id="main-nav"
        placement="start"
        show={showMenu}
        onHide={() => setShowMenu(false)}
      >
        <Offcanvas.Header closeButton closeVariant="white" className="bg-dark text-white">
          <Offcanvas.Title>Menu principal</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="bg-dark text-white">
          <Nav className="flex-column">
            <Nav.Link as={Link} to="/caisse" onClick={() => setShowMenu(false)}>🧾 Caisse</Nav.Link>
            <Nav.Link as={Link} to="/bilan" onClick={() => setShowMenu(false)}>📊 Bilan tickets</Nav.Link>
            {!activeSession ? (
              <Nav.Link as={Link} to="/ouverture-caisse" onClick={() => setShowMenu(false)}>🔓 Ouverture Caisse</Nav.Link>
            ) : (
              <Nav.Link as={Link} to="/fermeture-caisse" onClick={() => setShowMenu(false)}>🔒 Fermeture Caisse</Nav.Link>
            )}
            <Nav.Link as={Link} to="/journal-caisse" onClick={() => setShowMenu(false)}>📖 Journal caisse</Nav.Link>
            {devMode && (
              <>
                <Nav.Link as={Link} to="/compare-schemas" onClick={() => setShowMenu(false)}>🗄️ Schémas</Nav.Link>
                <Nav.Link as={Link} to="/db-config" onClick={() => setShowMenu(false)}>⚙️ DB</Nav.Link>
              </>
            )}
            <Nav.Link as={Link} to="/parametres" onClick={() => setShowMenu(false)}>🛠️ Paramètres</Nav.Link>
          </Nav>
        </Offcanvas.Body>
      </Navbar.Offcanvas>

          <div className="d-flex align-items-center justify-content-center flex-grow-1 text-white">
            {user && (
              <span className="text-center">
                👤 <strong>Bonjour {user.prenom} {user.nom} </strong>
              </span>
            )}
          </div>

          <div className="d-flex align-items-center ms-auto">
            <ModeTactileToggle />
            <div className="form-check form-switch text-white me-2" title="Afficher les pre-tickets en attente">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="preTicketQueueSwitch"
                checked={preTicketQueueVisible}
                onChange={() => setPreTicketQueueVisible(prev => !prev)}
              />
              <label className="form-check-label" htmlFor="preTicketQueueSwitch">
                PT
              </label>
            </div>
            <div className="form-check form-switch text-white me-2">
              <input
                className="form-check-input"
                type="checkbox"
                id="modePaiementBoutonsSwitch"
                checked={modePaiementBoutons}
                onChange={() => setModePaiementBoutons(prev => !prev)}
              />
              <label className="form-check-label" htmlFor="modePaiementBoutonsSwitch">
                💳
              </label>
            </div>

            <button
  className="btn btn-sm btn-outline-success me-2"
  onClick={async () => {
    setSyncStatus('loading');
    try {
      const res = await fetch(apiUrl('/api/sync?debug=true'), { method: 'POST', credentials: 'include' });
      const result = await res.json();

      if (result.debug) {
  console.log("🪵 Logs debug :\n" + result.debug.join('\n'));
}


      if (result && result.success === true) {
        setSyncStatus('success');

        if (result.doublons && result.doublons.length > 0) {
          const doublonsMsg = result.doublons
            .map(d => `• ${d.type} (${d.uuid})`)
            .join('\n');

          toast.warn(`✅ Synchronisation réussie avec des doublons ignorés :\n\n${doublonsMsg}`);
        } else {
          toast.success('✅ Synchronisation réussie sans doublons.');
        }

      } else {
        setSyncStatus('error');
        toast.error('❌ Échec : ' + (result.message || result.error || 'Erreur inconnue'));
      }
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
      toast.error('❌ Erreur de synchronisation.');
    }
  }}
>
              {syncStatus === 'loading' && <span className="spin">⏳</span>}
              {syncStatus === 'success' && '✅'}
              {syncStatus === 'error' && '❌'}
              {syncStatus === null && '⏳'}
            </button>

            <button
              className="btn btn-sm btn-outline-light me-2"
              onClick={() => {
                localStorage.removeItem('vendeur');
                fetch(apiUrl('/api/session'), { method: 'DELETE', credentials: 'include' });
                navigate('/login');
              }}
            >
              Changer d'utilisateur 👤
            </button>
          </div>
        </Navbar>
  );
}

export default MainNavbar;
