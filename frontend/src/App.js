import { io } from 'socket.io-client';
import React, { useEffect, useState, createContext, useContext } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Navbar, Nav, Offcanvas } from 'react-bootstrap';
import Caisse from './pages/Caisse';
import BilanTickets from './pages/BilanTickets';
import LoginPage from './pages/LoginPage';
import OuvertureCaisse from './pages/ouvertureCaisse';
import FermetureCaisse from './pages/FermetureCaisse';
import JournalCaisse from './pages/JournalCaisse';
import CompareSchemas from './pages/CompareSchemas';
import DbConfig from './pages/DbConfig';
import Parametres from './pages/Parametres';
import RequireSession from './components/RequireSession';
import './styles/App.scss';
import 'react-toastify/dist/ReactToastify.css';
import { DevModeContext } from './contexts/DevModeContext';
import { useSession } from './contexts/SessionContext';


const socket = io('http://localhost:3001');
export const ModeTactileContext = createContext();

function App() {
  const [syncStatus, setSyncStatus] = useState(null);
  const navigate = useNavigate();
  const [bilanJour, setBilanJour] = useState(null);
  const [modeTactile, setModeTactile] = useState(() => {
    const saved = localStorage.getItem('modeTactile');
    return saved ? JSON.parse(saved) : false;
  });
  const { devMode, setDevMode } = useContext(DevModeContext);
  const [showMenu, setShowMenu] = useState(false);
  const [caisseOuverte, setCaisseOuverte] = useState(false);

  const { user } = useSession();

  
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

  useEffect(() => {
    localStorage.setItem('modeTactile', JSON.stringify(modeTactile));
  }, [modeTactile]);

  useEffect(() => {
    const fetchBilan = () => {
      fetch('http://localhost:3001/api/bilan/jour')
        .then(res => res.json())
        .then(setBilanJour);
    };
    fetchBilan();
    socket.on('bilanUpdated', fetchBilan);
    return () => socket.off('bilanUpdated', fetchBilan);
  }, []);

  useEffect(() => {
    const fetchEtat = () => {
      fetch('http://localhost:3001/api/session/etat-caisse')
        .then(res => res.json())
        .then(data => setCaisseOuverte(data.ouverte))
        .catch(() => setCaisseOuverte(false));
    };
    fetchEtat();
    socket.on('etatCaisseUpdated', fetchEtat);
    return () => socket.off('etatCaisseUpdated', fetchEtat);
  }, []);

  return (
    <ModeTactileContext.Provider value={{ modeTactile, setModeTactile }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
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
                <Nav.Link as={Link} to="/" onClick={() => setShowMenu(false)}>🧾 Caisse</Nav.Link>
                <Nav.Link as={Link} to="/bilan" onClick={() => setShowMenu(false)}>📊 Bilan tickets</Nav.Link>
                {caisseOuverte ? (
                  <Nav.Link as={Link} to="/fermeture-caisse" onClick={() => setShowMenu(false)}>🔒 Fermeture Caisse</Nav.Link>
                ) : (
                  <Nav.Link as={Link} to="/ouverture-caisse" onClick={() => setShowMenu(false)}>🔓 Ouverture Caisse</Nav.Link>
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
                👤 <strong>Bonjour {user.prenom} {user.nom}</strong>
              </span>
            )}
          </div>

          <div className="d-flex align-items-center ms-auto">

            <button
  className="btn btn-sm btn-outline-success me-2"
  onClick={async () => {
    setSyncStatus('loading');
    try {
      const res = await fetch('http://localhost:3001/api/sync?debug=true', { method: 'POST' });
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

          alert(`✅ Synchronisation réussie avec des doublons ignorés :\n\n${doublonsMsg}`);
        } else {
          alert('✅ Synchronisation réussie sans doublons.');
        }

      } else {
        setSyncStatus('error');
        alert('❌ Échec : ' + (result.message || result.error || 'Erreur inconnue'));
      }
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
      alert('❌ Erreur de synchronisation.');
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
                fetch('http://localhost:3001/api/session', { method: 'DELETE' });
                navigate('/login');
              }}
            >
              Changer d'utilisateur 👤
            </button>
          </div>
        </Navbar>


        {bilanJour && (
          <div className="bg-dark text-white px-2 py-1" style={{ fontSize: '0.75rem' }}>
            <div className="d-flex flex-wrap justify-content-center text-center gap-3">
              <div>🧾 Ventes : <strong>{bilanJour.nombre_vente ?? 0}</strong></div>
              <div>💰 Total : <strong>{((bilanJour.prix_total ?? 0) / 100).toFixed(2)} €</strong></div>
              <div>💶 Espèces : {((bilanJour.prix_total_espece ?? 0) / 100).toFixed(2)} €</div>
              <div>💳 Carte : {((bilanJour.prix_total_carte ?? 0) / 100).toFixed(2)} €</div>
              <div>🧾 Chèque : {((bilanJour.prix_total_cheque ?? 0) / 100).toFixed(2)} €</div>
              <div>🏦 Virement : {((bilanJour.prix_total_virement ?? 0) / 100).toFixed(2)} €</div>
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RequireSession><Caisse /></RequireSession>} />
            <Route path="/bilan" element={<RequireSession><BilanTickets /></RequireSession>} />
            <Route path="/ouverture-caisse" element={<RequireSession><OuvertureCaisse /></RequireSession>} />
            <Route path="/fermeture-caisse" element={<RequireSession><FermetureCaisse /></RequireSession>} />
            <Route path="/journal-caisse" element={<RequireSession><JournalCaisse /></RequireSession>} />
            <Route path="/compare-schemas" element={<RequireSession><CompareSchemas /></RequireSession>} />
            <Route path="/parametres" element={<Parametres />} />
            {devMode && (
              <Route path="/db-config" element={<RequireSession><DbConfig /></RequireSession>} />
            )}
          </Routes>
        </div>
      </div>
    </ModeTactileContext.Provider>
  );
}

export default App;
