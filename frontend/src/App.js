import { io } from 'socket.io-client';
import React, { useEffect, useState, createContext } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom'; // ✅ ajout de useNavigate
import { Navbar, Nav } from 'react-bootstrap';
import Caisse from './pages/Caisse';
import BilanTickets from './pages/BilanTickets';
import LoginPage from './pages/LoginPage';
import OuvertureCaisse from './pages/ouvertureCaisse';
import FermetureCaisse from './pages/FermetureCaisse';
import JournalCaisse from './pages/JournalCaisse';
import RequireSession from './components/RequireSession';
import './styles/App.scss';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const socket = io('http://localhost:3001');
export const ModeTactileContext = createContext();

function App() {
  const navigate = useNavigate(); // ✅ pour gérer les redirections
  const vendeur = JSON.parse(localStorage.getItem('vendeur') || '{}');
  const [bilanJour, setBilanJour] = useState(null);
  const [modeTactile, setModeTactile] = useState(() => {
    const saved = localStorage.getItem('modeTactile');
    return saved ? JSON.parse(saved) : false;
  });
  const [caisseOuverte, setCaisseOuverte] = useState(false);

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

    fetchEtat(); // premier chargement

    socket.on('etatCaisseUpdated', fetchEtat); // écoute socket

    return () => {
      socket.off('etatCaisseUpdated', fetchEtat); // nettoyage à la sortie
    };
  }, []);


  return (
    <ModeTactileContext.Provider value={{ modeTactile, setModeTactile }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <Navbar bg="dark" variant="dark" expand={false} className="px-3">
          <Navbar.Brand as={Link} to="/">Caisse</Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
            <Nav className="flex-column">
              <Nav.Link as={Link} to="/">Caisse</Nav.Link>
              <Nav.Link as={Link} to="/bilan">Bilan tickets</Nav.Link>
              {caisseOuverte ? (
                <Nav.Link as={Link} to="/fermeture-caisse">Fermeture Caisse</Nav.Link>
              ) : (
                <Nav.Link as={Link} to="/ouverture-caisse">Ouverture Caisse</Nav.Link>
              )}
              <Nav.Link as={Link} to="/journal-caisse">Journal caisse</Nav.Link>
            </Nav>
          </Navbar.Collapse>


          {bilanJour && (
            <div className="container-fluid d-flex justify-content-center mt-2">
              <table className="table table-borderless table-sm text-white text-center mb-0" style={{ fontSize: '0.75rem', width: 'auto' }}>
                <thead>
                  <tr>
                    <th>Ventes</th>
                    <th>Total</th>
                    <th>Espèces</th>
                    <th>Carte</th>
                    <th>Chèque</th>
                    <th>Virement</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{bilanJour.nombre_vente ?? 0}</td>
                    <td>{((bilanJour.prix_total ?? 0) / 100).toFixed(2)} €</td>
                    <td>{((bilanJour.prix_total_espece ?? 0) / 100).toFixed(2)} €</td>
                    <td>{((bilanJour.prix_total_carte ?? 0) / 100).toFixed(2)} €</td>
                    <td>{((bilanJour.prix_total_cheque ?? 0) / 100).toFixed(2)} €</td>
                    <td>{((bilanJour.prix_total_virement ?? 0) / 100).toFixed(2)} €</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="ms-auto d-flex align-items-center text-white">
            {vendeur.nom && (
              <>
                <span className="me-3">Bienvenue, <strong>{vendeur.nom}</strong></span>
                <button
                  className="btn btn-sm btn-outline-warning me-2"
                  onClick={async () => {
                    const confirmReset = window.confirm('⚠️ Cette action va supprimer tous les tickets, paiements et bilans. Continuer ?');
                    if (confirmReset) {
                      try {
                        const res = await fetch('http://localhost:3001/api/reset', { method: 'POST' });
                        const result = await res.json();
                        if (result.success) {
                          alert('Base réinitialisée avec succès.');
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
                  Reset base
                </button>
              </>
            )}
            <button
              className="btn btn-sm btn-outline-success me-2"
              onClick={async () => {
                try {
                  const res = await fetch('http://localhost:3001/api/sync/', {
                    method: 'POST'
                  });
                  const result = await res.json();
                  if (result.success) {
                    alert('✅ Synchronisation réussie !');
                  } else {
                    alert('❌ Échec de la synchronisation : ' + (result.message || result.error));
                  }
                } catch (err) {
                  console.error(err);
                  alert('❌ Erreur lors de la synchronisation.');
                }
              }}
            >
              🔄 Synchroniser
            </button>

            <button
              className="btn btn-sm btn-outline-light"
              onClick={() => {
                localStorage.removeItem('vendeur');
                fetch('http://localhost:3001/api/session', { method: 'DELETE' });
                navigate('/login'); // ✅ redirection propre
              }}
            >
              Déconnexion
            </button>

            <div className="form-check form-switch ms-3">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="modeTactileSwitch"
                checked={modeTactile}
                onChange={() => setModeTactile(prev => !prev)}
              />
              <label className="form-check-label" htmlFor="modeTactileSwitch">
                Mode tactile
              </label>
            </div>
          </div>
        </Navbar>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RequireSession><Caisse /></RequireSession>} />
            <Route path="/bilan" element={<RequireSession><BilanTickets /></RequireSession>} />
            <Route path="/ouverture-caisse" element={<RequireSession><OuvertureCaisse /></RequireSession>} />
            <Route path="/fermeture-caisse" element={<RequireSession><FermetureCaisse /></RequireSession>} />
            <Route path="/journal-caisse" element={<RequireSession><JournalCaisse /></RequireSession>} />

          </Routes>
        </div>
        

      </div>
    </ModeTactileContext.Provider>
  );
}

export default App;
