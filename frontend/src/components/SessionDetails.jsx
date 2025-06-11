import React from 'react';

function formatEuros(val) {
  return val != null ? `${(val / 100).toFixed(2)} €` : '—';
}

const SessionDetails = ({ session, bilan }) => {
  if (!session || !bilan) return <div>Chargement...</div>;

  const caissiers = session.caissiers ? JSON.parse(session.caissiers) : [];

  const attendu = {
    espece: (bilan.prix_total_espece ?? 0) + (session.fond_initial ?? 0),
    carte: bilan.prix_total_carte ?? 0,
    cheque: bilan.prix_total_cheque ?? 0,
    virement: bilan.prix_total_virement ?? 0,
  };

  const ecarts = {
    espece: (session.montant_reel ?? 0) - attendu.espece,
    carte: (session.montant_reel_carte ?? 0) - attendu.carte,
    cheque: (session.montant_reel_cheque ?? 0) - attendu.cheque,
    virement: (session.montant_reel_virement ?? 0) - attendu.virement,
  };

  return (
    <div className="p-3 border bg-white rounded">
      <p><strong>Caissiers :</strong> {caissiers.join(', ') || '—'}</p>
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Moyen</th>
            <th>Attendu</th>
            <th>Réel</th>
            <th>Écart</th>
          </tr>
        </thead>
        <tbody>
          {['espece', 'carte', 'cheque', 'virement'].map(m => (
            <tr key={m}>
              <td style={{ textTransform: 'capitalize' }}>{m}</td>
              <td>{formatEuros(attendu[m])}</td>
              <td>{formatEuros(session[`montant_reel_${m}`] ?? (m === 'espece' ? session.montant_reel : 0))}</td>
              <td>{formatEuros(ecarts[m])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SessionDetails;
