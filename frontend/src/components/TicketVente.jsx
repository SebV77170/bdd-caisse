import React, { useRef, useContext } from 'react';
import TactileInput from './TactileInput';
import { ModeTactileContext } from '../contexts/ModeTactileContext';

function TicketVente({ ticket, onChange, onDelete, onSave }) {
  const prixRef = useRef({});
  const nbrRef = useRef({});
  const { modeTactile } = useContext(ModeTactileContext);

  const handleSavePrix = async (id, rawValue) => {
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
    const parsed = parseInt(rawValue);
    if (!isNaN(parsed) && parsed > 0 && parsed < 100000) {
      const article = ticket.find(t => t.id === id);
      const prixCents = article?.prix ?? Math.round(article.prixt / (article.nbr || 1));
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
          const prixAfficheTactile = (prixCents / 100).toFixed(2).replace('.', ',');

          return (
            <li key={item.id} className="list-group-item ticket-item">
              {/* Ligne du haut : nom + corbeille */}
              <div className="ticket-name-top">
                <button
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => {
                    if (window.confirm(`Supprimer "${item.nom}" ?`)) onDelete(item.id);
                  }}
                >
                  🗑️
                </button>
                {item.nom}
              </div>

              {/* Ligne du bas : quantité / prix / total */}
              <div className="ticket-row-below">
                {/* Quantité */}
                {modeTactile ? (
                  <TactileInput
                    type="number"
                    value={item.nbr}
                    isDecimal={false}
                    onChange={(e) => handleSaveQuantite(item.id, e.target.value)}
                    className="form-control ticket-input"
                  />
                ) : (
                  <input
                    type="number"
                    defaultValue={item.nbr}
                    ref={el => nbrRef.current[item.id] = el}
                    onBlur={() => handleSaveQuantite(item.id, nbrRef.current[item.id].value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveQuantite(item.id, nbrRef.current[item.id].value);
                    }}
                    className="form-control ticket-input"
                  />
                )}

                {/* Prix unitaire */}
                {modeTactile ? (
                  <TactileInput
                    type="number"
                    value={prixAfficheTactile}
                    isDecimal={true}
                    onChange={(e) => handleSavePrix(item.id, e.target.value)}
                    className="form-control ticket-input"
                  />
                ) : (
                  <>
                    <input
                      type="text"
                      defaultValue={prixAfficheTactile}
                      ref={el => prixRef.current[item.id] = el}
                      onBlur={() => handleSavePrix(item.id, prixRef.current[item.id].value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSavePrix(item.id, prixRef.current[item.id].value);
                      }}
                      className="form-control ticket-input"
                    />
                    <button
                      className="btn btn-sm btn-outline-success ms-1 px-2 py-0"
                      style={{ fontSize: '0.75rem', height: '30px' }}
                      onClick={() => handleSavePrix(item.id, prixRef.current[item.id].value)}
                      title="Sauvegarder prix"
                    >
                      💾
                    </button>
                  </>
                )}

                {/* Total */}
                <div className="ticket-prix">
                  {(item.prixt / 100).toFixed(2)} €
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
