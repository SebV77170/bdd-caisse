import { io } from 'socket.io-client';
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import Caisse from './pages/Caisse';
import BilanTickets from './pages/BilanTickets';
import LoginPage from './pages/LoginPage';
import RequireSession from './components/RequireSession';

const socket = io('http://localhost:3001');

function App() {
  const vendeur = JSON.parse(localStorage.getItem('vendeur') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('vendeur');
    fetch('http://localhost:3001/api/session', { method: 'DELETE' });
    window.location.href = '/login';
  };

  const [bilanJour, setBilanJour] = useState(null);

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
  


  return (
    <Router>
      <nav className="navbar navbar-expand navbar-dark bg-dark px-3">
        <Link className="navbar-brand" to="/">Caisse</Link>
        <Link className="nav-link text-white" to="/bilan">Bilan tickets</Link>
        {bilanJour && (
  <div className="container-fluid d-flex justify-content-center mt-2">
    <table
      className="table table-borderless table-sm text-white text-center mb-0"
      style={{ fontSize: '0.85rem', width: 'auto' }}
    >
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




        <div className="ms-auto text-white">
        {vendeur.nom && (
        <>
          <span className="me-3">
            Bienvenue, <strong>{vendeur.nom}</strong>
          </span>
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

          <button className="btn btn-sm btn-outline-light" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>
      </nav>

      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireSession><Caisse /></RequireSession>} />
        <Route path="/bilan" element={<RequireSession><BilanTickets /></RequireSession>} />
      </Routes>
    </Router>
  );
}

export default App;
