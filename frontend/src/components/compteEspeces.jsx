import React, { useState, useEffect } from 'react';
import TactileInput from './TactileInput';

const valeurs = [
  { label: '1 cts', value: 0.01, colonne: 'centimes' },
  { label: '2 cts', value: 0.02, colonne: 'centimes' },
  { label: '5 cts', value: 0.05, colonne: 'centimes' },
  { label: '10 cts', value: 0.10, colonne: 'centimes' },
  { label: '20 cts', value: 0.20, colonne: 'centimes' },
  { label: '50 cts', value: 0.50, colonne: 'centimes' },

  { label: '1 €', value: 1.00, colonne: 'billets' },
  { label: '2 €', value: 2.00, colonne: 'billets' },
  { label: '5 €', value: 5.00, colonne: 'billets' },
  { label: '10 €', value: 10.00, colonne: 'billets' },
  { label: '20 €', value: 20.00, colonne: 'billets' },
  { label: '50 €', value: 50.00, colonne: 'billets' },

  { label: '100 €', value: 100.00, colonne: 'gros' },
  { label: '200 €', value: 200.00, colonne: 'gros' },
  { label: '500 €', value: 500.00, colonne: 'gros' },
];

function CompteEspeces({ onChangeTotal }) {
  const initialState = {};
  valeurs.forEach(({ value }) => {
    initialState[value] = '';
  });

  const [quantites, setQuantites] = useState(initialState);
  const [total, setTotal] = useState(0);
  const [totalPieces, setTotalPieces] = useState(0);
  const [totalBillets, setTotalBillets] = useState(0);

  useEffect(() => {
    const t = Object.entries(quantites).reduce((sum, [valeur, quantite]) => {
      const q = parseInt(quantite, 10);
      const v = parseFloat(valeur);
      return sum + (isNaN(q) ? 0 : q * v);
    }, 0);
    setTotal(t);

    const valeursPieces = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2];
    const tPieces = valeursPieces.reduce((sum, valeur) => {
      const q = parseInt(quantites[valeur], 10);
      return sum + (isNaN(q) ? 0 : q * valeur);
    }, 0);
    setTotalPieces(tPieces);

    const valeursBillets = [5, 10, 20, 50, 100, 200, 500];
    const tBillets = valeursBillets.reduce((sum, valeur) => {
      const q = parseInt(quantites[valeur], 10);
      return sum + (isNaN(q) ? 0 : q * valeur);
    }, 0);
    setTotalBillets(tBillets);

    onChangeTotal && onChangeTotal(t);
  }, [quantites, onChangeTotal]);

  const handleChange = (valeur, qte) => {
    setQuantites(prev => ({ ...prev, [valeur]: qte }));
  };

  const reset = () => {
    const resetState = {};
    Object.keys(quantites).forEach(key => { resetState[key] = ''; });
    setQuantites(resetState);
  };

  const centimes = valeurs.filter(v => v.colonne === 'centimes');
  const billets = valeurs.filter(v => v.colonne === 'billets');
  const gros = valeurs.filter(v => v.colonne === 'gros');
  const maxLignes = Math.max(centimes.length, billets.length, gros.length);

  return (
    <div style={{
      border: '2px solid #ccc',
      borderRadius: 8,
      padding: 16,
      marginTop: 20,
      background: '#f9f9f9',
      maxWidth: 600,
      marginLeft: 'auto',
      marginRight: 'auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h5 style={{ margin: 0 }}>Total : {total.toFixed(2).replace('.', ',')} €</h5>
        <button type="button" onClick={reset} className="btn btn-sm btn-outline-secondary">
          Réinitialiser
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9em', marginTop: 4 }}>
        <span>Pièces : {totalPieces.toFixed(2).replace('.', ',')} €</span>
        <span>Billets : {totalBillets.toFixed(2).replace('.', ',')} €</span>
      </div>

      <table style={{
        marginTop: 10,
        width: '100%',
        borderCollapse: 'collapse'
      }}>
        <thead>
          <tr>
            <th colSpan="2" style={{ borderBottom: '1px solid #999', textAlign: 'center' }}>Centimes</th>
            <th colSpan="2" style={{ borderBottom: '1px solid #999', textAlign: 'center' }}>Billets</th>
            <th colSpan="2" style={{ borderBottom: '1px solid #999', textAlign: 'center' }}>Gros billets</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxLignes }).map((_, i) => (
            <tr key={i}>
              {/* Centimes */}
              <td style={{ width: '70px' }}>{centimes[i]?.label || ''}</td>
              <td>
                {centimes[i] &&
                  <TactileInput
                    type="number"
                    min="0"
                    className="form-control"
                    style={{ width: '50px' }}
                    value={quantites[centimes[i].value]}
                    onChange={(e) => handleChange(centimes[i].value, e.target.value)}
                  />}
              </td>

              {/* Billets */}
              <td style={{ width: '70px', borderLeft: '1px solid #ccc' }}>{billets[i]?.label || ''}</td>
              <td>
                {billets[i] &&
                  <TactileInput
                    type="number"
                    min="0"
                    className="form-control"
                    style={{ width: '50px' }}
                    value={quantites[billets[i].value]}
                    onChange={(e) => handleChange(billets[i].value, e.target.value)}
                  />}
              </td>

              {/* Gros billets */}
              <td style={{ width: '70px', borderLeft: '1px solid #ccc' }}>{gros[i]?.label || ''}</td>
              <td>
                {gros[i] &&
                  <TactileInput
                    type="number"
                    min="0"
                    className="form-control"
                    style={{ width: '50px' }}
                    value={quantites[gros[i].value]}
                    onChange={(e) => handleChange(gros[i].value, e.target.value)}
                  />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default CompteEspeces;
