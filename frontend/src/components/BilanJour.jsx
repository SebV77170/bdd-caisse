import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

function BilanJour() {
  const [bilanJour, setBilanJour] = useState(null);

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

  return (
    <>
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
    </>
  );
}

export default BilanJour;