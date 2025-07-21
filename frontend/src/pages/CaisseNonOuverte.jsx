import React from 'react';
import { Link } from 'react-router-dom';

function CaisseNonOuverte() {
  return (
    <div style={{ padding: 30, textAlign: 'center' }}>
      <h2>🚫 Aucune caisse n’est ouverte</h2>
      <p>Vous devez ouvrir une session de caisse principale ou secondaire pour accéder à cette fonctionnalité.</p>
      <Link to="/ouverture-caisse" className="btn btn-primary mt-3">
        Ouvrir une caisse
      </Link>
    </div>
  );
}

export default CaisseNonOuverte;
