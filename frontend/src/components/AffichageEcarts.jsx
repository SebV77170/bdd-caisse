import React from 'react';

function formatEuros(valeur) {
  return `${(valeur / 100).toFixed(2).replace('.', ',')} €`;
}

function AffichageEcarts({ attendu, reel, fondInitial }) {
  const ecart = {
    espece: (reel?.espece ?? 0) - (attendu?.espece ?? 0),
    carte: (reel?.carte ?? 0) - (attendu?.carte ?? 0),
    cheque: (reel?.cheque ?? 0) - (attendu?.cheque ?? 0),
    virement: (reel?.virement ?? 0) - (attendu?.virement ?? 0),
  };

  return (
    <div style={{
      border: '2px solid #ccc',
      borderRadius: 8,
      padding: 16,
      background: '#f9f9f9',
      maxWidth: 600,
      margin: '20px auto'
    }}>
      <h5 style={{ marginBottom: 10 }}>Écarts de caisse</h5>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #999' }}>
            <th>Moyen</th>
            <th>Attendu</th>
            <th>Réel</th>
            <th>Écart</th>
          </tr>
        </thead>
        <tbody>
          {['espece', 'carte', 'cheque', 'virement'].map(moyen => (
            <tr key={moyen}>
              <td style={{ textTransform: 'capitalize' }}>{moyen}</td>
              <td>{formatEuros(attendu?.[moyen] ?? 0)}</td>
              <td>{formatEuros(reel?.[moyen] ?? 0)}</td>
              <td style={{ color: ecart[moyen] === 0 ? 'black' : (ecart[moyen] < 0 ? 'red' : 'green') }}>
                {formatEuros(ecart[moyen])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AffichageEcarts;
