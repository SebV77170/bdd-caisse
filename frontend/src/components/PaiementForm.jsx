import React from 'react';

function PaiementForm({ paiement, onChange, onValider }) {
  return (
    <div className="mb-3">
      <label className="form-label">Mode de paiement</label>
      <select className="form-select" value={paiement} onChange={e => onChange(e.target.value)}>
        <option value="">-- Choisir --</option>
        <option value="espèces">Espèces</option>
        <option value="carte">Carte</option>
        <option value="chèque">Chèque</option>
        <option value="virement">Virement</option>
      </select>
      <button className="btn btn-success mt-2 w-100" onClick={onValider}>
        Valider la vente
      </button>
    </div>
  );
}

export default PaiementForm;
