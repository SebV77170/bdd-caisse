import React from 'react';

function BoutonsCaisse({ produits, onClick }) {
  return (
    <>
      {Object.entries(produits).map(([sousCat, items], i) => (
        <div key={i}>
          <h6 className="mt-3">{sousCat}</h6>
          <div className="d-flex flex-wrap">
            {items.map(prod => (
              <button
                key={prod.id_bouton}
                className={`btn btn-${prod.color || 'secondary'} m-1`}
                onClick={() => onClick(prod)}
              >
                {(prod.prix / 100).toFixed(2)} € - {prod.nom}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export default BoutonsCaisse;
