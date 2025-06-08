import React from 'react';
import TactileInput from './TactileInput';

function TicketVente({ ticket, onChange, onDelete, onSave }) {

  const handleSavePrix = async (id, rawValue) => {
    console.log("✅ Prix utilisé :", rawValue);
    if (!rawValue || rawValue.trim() === '') return;

    const parsed = parseFloat(rawValue.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0 && parsed < 100000) {
      const prixCents = Math.round(parsed * 100);
      const article = ticket.find(t => t.id === id);
      const quantite = article?.nbr || 1;
      const prixt = prixCents * quantite;

      await fetch(`http://localhost:3001/api/ticket/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prix: prixCents, prixt })
      });

      onSave(id);
    }
  };

  const handleSaveQuantite = async (id, rawValue) => {
    console.log("✅ Quantité utilisée :", rawValue);
    const parsed = parseInt(rawValue);
    if (!isNaN(parsed) && parsed > 0 && parsed < 100000) {
      const article = ticket.find(t => t.id === id);
      const prixCents = article?.prix ?? Math.round(article.prixt / article.nbr || 1);
      const prixt = prixCents * parsed;

      await fetch(`http://localhost:3001/api/ticket/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nbr: parsed, prixt })
      });

      onSave(id);
    }
  };

  return (
    <>
      <h5 className="mb-2">Ticket</h5>

      <ul className="list-group mb-2">
        {ticket.map(item => {
          const prixCents = item.prix ?? Math.round(item.prixt / (item.nbr || 1));
          const prixAffiché = (prixCents / 100).toFixed(2).replace('.', ',');

          return (
            <li key={item.id} className="list-group-item py-2">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <button
                    className="btn btn-sm btn-outline-danger me-2"
                    onClick={() => {
                      if (window.confirm(`Supprimer "${item.nom}" ?`)) onDelete(item.id);
                    }}
                  >
                    🗑️
                  </button>
                  <strong>{item.nom}</strong>
                </div>
                <div className="d-flex align-items-center">
                  {/* Champ quantité */}
                  <TactileInput
                    type="number"
                    className="form-control form-control-sm mx-1"
                    style={{ width: "50px" }}
                    value={item.nbr}
                    onChange={(e) => handleSaveQuantite(item.id, e.target.value)}
                  />

                  {/* Champ prix */}
                  <TactileInput
                    type="number"
                    className="form-control form-control-sm"
                    style={{ width: "70px" }}
                    value={prixAffiché}
                    onChange={(e) => handleSavePrix(item.id, e.target.value)}
                  />

                  
                  <span className="ms-2">{(item.prixt / 100).toFixed(2)} €</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      
    </>
  );
}

export default TicketVente;
