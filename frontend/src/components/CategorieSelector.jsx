import React from 'react';

function CategorieSelector({ categories, active, onSelect }) {
  return (
    <div>
      <h5 className="mb-3">Catégories</h5>
      <div className="d-flex flex-column gap-2">
        {categories.map((cat, i) => {
          const isActive = active === cat.nom;
          const variant = cat.color || 'secondary';
          return (
            <button
              key={i}
              type="button"
              className={`btn btn-${variant} text-start shadow-sm w-100`}
              style={{
                textTransform: 'capitalize',
                borderLeft: isActive
                  ? `5px solid var(--bs-${variant})`
                  : '5px solid transparent',
                transition: 'all 0.2s ease',
                fontWeight: isActive ? 'bold' : 'normal'
              }}
              onClick={() => onSelect(cat.nom)}
            >
              {cat.nom}
              {isActive && (
                <span className="badge bg-light text-primary ms-2">Actif</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CategorieSelector;
