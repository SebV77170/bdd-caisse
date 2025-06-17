import React, { useRef, useState, useContext } from 'react';
import TactileInput from './TactileInput';
import ClavierNumeriqueModal from './clavierNumeriqueModal';
import { ModeTactileContext } from '../App';

function TicketVente({ ticket, onChange, onDelete, onSave }) {
  const prixRef = useRef({});
  const nbrRef = useRef({});
  const { modeTactile } = useContext(ModeTactileContext);

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
          const prixAfficheTactile = (prixCents / 100).toFixed(2).replace('.', ',');
          const prixAfficheStandard = (prixCents / 100).toFixed(2);

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
                  {/* Quantité */}
                  {modeTactile ? (
                    <TactileInput
                      type="number"
                      value={item.nbr}
                      isDecimal={false}
                      onChange={(e) => handleSaveQuantite(item.id, e.target.value)}
                      className="form-control form-control-sm mx-1"
                      style={{ width: "50px" }}
                    />
                  ) : (
                    <input
                      type="number"
                      defaultValue={item.nbr}
                      ref={el => nbrRef.current[item.id] = el}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveQuantite(item.id, nbrRef.current[item.id].value);
                        }
                      }}
                      className="form-control form-control-sm mx-1"
                      style={{ width: "50px" }}
                    />
                  )}

                  {/* Prix */}
                  {modeTactile ? (
                    <TactileInput
                      type="number"
                      value={prixAfficheTactile}
                      isDecimal={true}
                      onChange={(e) => handleSavePrix(item.id, e.target.value)}
                      className="form-control form-control-sm"
                      style={{ width: "70px" }}
                    />
                  ) : (
                    <>
                      <input
                        type="text"
                        defaultValue={prixAfficheTactile}
                        ref={el => prixRef.current[item.id] = el}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSavePrix(item.id, prixRef.current[item.id].value);
                          }
                        }}
                        className="form-control form-control-sm"
                        style={{ width: "70px" }}
                      />
                      
                    </>
                  )}

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
