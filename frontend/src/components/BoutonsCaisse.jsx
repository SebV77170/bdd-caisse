import React from 'react';

function BoutonsCaisse({ produits, onClick }) {
  const buttonStyle = {
    width: 160,
    minHeight: 80, // hauteur minimale, mais pas bloquante
    fontSize: '1.1rem',
    padding: '0.5rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    borderRadius: 12,
    whiteSpace: 'normal',     // autorise les retours à la ligne
    wordWrap: 'break-word',
  };

  const priceStyle = {
    fontWeight: 'bold',
    marginBottom: 4,
  };

  return (
    <>
      {Object.entries(produits).map(([sousCat, items], i) => (
        <div key={i}>
          <h6 className="mt-3">{sousCat}</h6>
          <div className="d-flex flex-wrap align-items-stretch">
            {items.map((prod) => (
              <button
                key={prod.id_bouton}
                className={`btn btn-${prod.color || 'secondary'} m-1 text-start`}
                onClick={() => onClick(prod)}
                style={buttonStyle}
              >
                <div style={priceStyle}>{(prod.prix / 100).toFixed(2)} €</div>
                <div>{prod.nom}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export default BoutonsCaisse;
