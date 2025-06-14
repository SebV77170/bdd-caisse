import React from 'react';

function formatEuros(valeur) {
  return `${(valeur / 100).toFixed(2).replace('.', ',')} €`;
}

function BilanReductionsSession({ reductions }) {
  const rows = [
    { key: 'client', label: 'Fidélité client' },
    { key: 'bene', label: 'Fidélité bénévole' },
    { key: 'gros_panier_client', label: 'Gros panier client' },
    { key: 'gros_panier_bene', label: 'Gros panier bénévole' }
  ];

  return (
    <div style={{
      border: '2px solid #ccc',
      borderRadius: 8,
      padding: 16,
      background: '#f0f9f0',
      maxWidth: 600,
      margin: '20px auto'
    }}>
      <h5 style={{ marginBottom: 10 }}>Réductions de la session</h5>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #999' }}>
            <th>Type</th>
            <th>Nombre</th>
            <th>Montant total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td>{reductions[`nb_${r.key}`] || 0}</td>
              <td>{formatEuros(reductions[`montant_${r.key}`] || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default BilanReductionsSession;
