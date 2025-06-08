import React from 'react';

function CategorieSelector({ categories, active, onSelect }) {
  return (
    <div>
      <h5 className="mb-3">Catégories</h5>
      <div className="d-flex flex-column gap-2">
        {categories.map((cat, i) => (
          <button
            key={i}
            className={`btn ${active === cat ? 'btn-primary' : 'btn-light'} text-start shadow-sm`}
            style={{
              textTransform: 'capitalize',
              borderLeft: active === cat ? '5px solid #0d6efd' : '5px solid transparent',
              transition: 'all 0.2s ease',
              fontWeight: active === cat ? 'bold' : 'normal'
            }}
            onClick={() => onSelect(cat)}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = active === cat ? '' : '#f0f8ff'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = active === cat ? '' : 'white'}
          >
            {cat}
            {active === cat && (
              <span className="badge bg-light text-primary ms-2">Actif</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default CategorieSelector;
