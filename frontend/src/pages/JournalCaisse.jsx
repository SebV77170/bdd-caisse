import React, { useEffect, useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

function formatEuros(val) {
  return val != null ? `${(val / 100).toFixed(2)} €` : '—';
}

const JournalCaisse = () => {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3001/api/caisse/journal')
      .then(res => res.json())
      .then(setSessions)
      .catch(err => console.error('Erreur chargement journal caisse:', err));
  }, []);

  return (
    <div className="container mt-3">
      <h2>Journal de caisse</h2>
      <table className="table table-striped">
        <thead>
          <tr>
            <th>Ouverture</th>
            <th>Fermeture</th>
            <th>Resp. ouverture</th>
            <th>Resp. fermeture</th>
            <th>Fond initial</th>
            <th>Montant réel</th>
            <th>Écart</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map(s => (
            <tr key={s.id_session}>
              <td>{s.date_ouverture} {s.heure_ouverture}</td>
              <td>{s.date_fermeture ? `${s.date_fermeture} ${s.heure_fermeture}` : '—'}</td>
              <td>{s.responsable_ouverture || '—'}</td>
              <td>{s.responsable_fermeture || '—'}</td>
              <td>{formatEuros(s.fond_initial)}</td>
              <td>{s.montant_reel != null ? formatEuros(s.montant_reel) : '—'}</td>
              <td>{s.ecart != null ? formatEuros(s.ecart) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default JournalCaisse;
