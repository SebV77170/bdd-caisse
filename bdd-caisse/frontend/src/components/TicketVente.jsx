import React, { useRef, useState } from 'react';
import ClavierNumeriqueModal from './clavierNumeriqueModal';

function TicketVente({ ticket, onChange, onDelete, onSave }) {
  const total = ticket.reduce((sum, item) => sum + (item.prixt || 0), 0);
  const prixRef = useRef({});
  const nbrRef = useRef({});
  const [modal, setModal] = useState({ show: false, id: null, type: null }); // type: 'prix' | 'nbr'

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
      <h5>Ticket</h5>
      <ul className="list-group">
        {ticket.map(item => {
          const prixCents = item.prix ?? Math.round(item.prixt / (item.nbr || 1));
          const prixAffiché = (prixCents / 100).toFixed(2).replace('.', ',');

          return (
            <li key={item.id} className="list-group-item">
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
                  <input
                    type="text"
                    readOnly
                    value={item.nbr}
                    ref={el => nbrRef.current[item.id] = el}
                    onClick={() => setModal({ show: true, id: item.id, type: 'nbr' })}
                    className="form-control form-control-sm mx-1"
                    style={{ width: "50px", cursor: 'pointer' }}
                  />

                  {/* Champ prix */}
                  <input
                    type="text"
                    readOnly
                    value={prixAffiché}
                    ref={el => prixRef.current[item.id] = el}
                    onClick={() => setModal({ show: true, id: item.id, type: 'prix' })}
                    className="form-control form-control-sm"
                    style={{ width: "70px", cursor: 'pointer' }}
                  />

                  {/* Bouton sauvegarde */}
                  <button
                    className="btn btn-sm btn-success ms-1"
                    onClick={() => {
                      const rawValue = prixRef.current[item.id]?.value;
                      handleSavePrix(item.id, rawValue);
                    }}
                    title="Sauvegarder prix"
                  >
                    💾
                  </button>
                  <span className="ms-2">{(item.prixt / 100).toFixed(2)} €</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <h5 className="mt-3">Total : {(total / 100).toFixed(2)} €</h5>

      {/* Modale clavier numérique */}
      <ClavierNumeriqueModal
        show={modal.show}
        onClose={() => setModal({ show: false, id: null, type: null })}
        isDecimal={modal.type === 'prix'}
        initial=""
        onValider={async (val) => {
          const id = modal.id;
          if (modal.type === 'prix') {
            await handleSavePrix(id, val);
          } else if (modal.type === 'nbr') {
            await handleSaveQuantite(id, val);
          }
          setModal({ show: false, id: null, type: null });
        }}
      />
    </>
  );
}

export default TicketVente;
