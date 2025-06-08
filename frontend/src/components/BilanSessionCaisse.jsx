import React from 'react';

function formatEuros(valeur) {
  return `${(valeur / 100).toFixed(2).replace('.', ',')} €`;
}

function BilanSessionCaisse({ nbVentes, totalPaiements }) {
  const totalGlobal = ['espece', 'carte', 'cheque', 'virement'].reduce(
    (acc, moyen) => acc + (totalPaiements?.[moyen] ?? 0), 0
  );

  return (
    <div style={{
      border: '2px solid #ccc',
      borderRadius: 8,
      padding: 16,
      background: '#f0f9f0',
      maxWidth: 600,
      margin: '20px auto'
    }}>
      <h5 style={{ marginBottom: 10 }}>Bilan de la session</h5>

      <p><strong>Nombre de ventes :</strong> {nbVentes}</p>
      <p><strong>Total encaissé :</strong> {formatEuros(totalGlobal)}</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', marginTop: 16 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #999' }}>
            <th>Moyen de paiement</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {['espece', 'carte', 'cheque', 'virement'].map(moyen => (
            <tr key={moyen}>
              <td style={{ textTransform: 'capitalize' }}>{moyen}</td>
              <td>{formatEuros(totalPaiements?.[moyen] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default BilanSessionCaisse;
