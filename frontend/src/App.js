import { io } from 'socket.io-client';
import React, { useEffect, useState, createContext } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Navbar, Nav, Offcanvas } from 'react-bootstrap';
import Caisse from './pages/Caisse';
import BilanTickets from './pages/BilanTickets';
import LoginPage from './pages/LoginPage';
import OuvertureCaisse from './pages/ouvertureCaisse';
import FermetureCaisse from './pages/FermetureCaisse';
import JournalCaisse from './pages/JournalCaisse';
import CompareSchemas from './pages/CompareSchemas';
import RequireSession from './components/RequireSession';
import './styles/App.scss';
import 'react-toastify/dist/ReactToastify.css';

const socket = io('http://localhost:3001');
export const ModeTactileContext = createContext();

function App() {
  const navigate = useNavigate();
  const vendeur = JSON.parse(localStorage.getItem('vendeur') || '{}');
  const [bilanJour, setBilanJour] = useState(null);
  const [modeTactile, setModeTactile] = useState(() => {
    const saved = localStorage.getItem('modeTactile');
    return saved ? JSON.parse(saved) : false;
  });
  const [caisseOuverte, setCaisseOuverte] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

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
    socket.on('bilanUpdated', () => {
      console.log('🧾 Mise à jour du bilan reçue via WebSocket');
      fetchBilan();
    });
    return () => socket.off('bilanUpdated');
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
                <Nav.Link as={Link} to="/compare-schemas" onClick={() => setShowMenu(false)}>🗄️ Schémas</Nav.Link>
              </Nav>
            </Offcanvas.Body>
          </Navbar.Offcanvas>

          <div className="d-flex align-items-center justify-content-center flex-grow-1 text-white">
            {vendeur.nom && (
              <span className="text-center">
                👤 <strong>Bonjour {vendeur.prenom} {vendeur.nom}</strong>
              </span>
            )}
          </div>

          <div className="d-flex align-items-center ms-auto">
            <button
              className="btn btn-sm btn-outline-warning me-2"
              onClick={async () => {
                const confirmReset = window.confirm('⚠️ Cette action va supprimer tous les tickets, paiements et bilans. Continuer ?');
                if (confirmReset) {
                  try {
                    const res = await fetch('http://localhost:3001/api/reset', { method: 'POST' });
                    const result = await res.json();
                    if (result.success) {
                      alert(result.message);
                      window.location.reload();
                    } else {
                      alert('Erreur : ' + result.error);
                    }
                  } catch (err) {
                    console.error(err);
                    alert('Erreur lors de la réinitialisation.');
                  }
                }
              }}
            >
              Reset
            </button>

            <button
              className="btn btn-sm btn-outline-success me-2"
              onClick={async () => {
                try {
                  const res = await fetch('http://localhost:3001/api/sync/', { method: 'POST' });
                  const result = await res.json();
                  if (result.success) {
                    alert('✅ Synchronisation réussie !');
                  } else {
                    alert('❌ Échec : ' + (result.message || result.error));
                  }
                } catch (err) {
                  console.error(err);
                  alert('❌ Erreur de synchronisation.');
                }
              }}
            >
              🔄
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

            <div className="form-check form-switch ms-2">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="modeTactileSwitch"
                checked={modeTactile}
                onChange={() => setModeTactile(prev => !prev)}
              />
              <label className="form-check-label text-white" htmlFor="modeTactileSwitch">
                🖐️
              </label>
            </div>
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
          </Routes>
        </div>
      </div>
    </ModeTactileContext.Provider>
  );
}

export default App;
