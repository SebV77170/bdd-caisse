// ✅ Composant React : affichage d'un ticket avec paiements mixtes
import React, { useEffect, useState } from 'react';

function TicketDetail({ id_ticket }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!id_ticket) return;

    fetch(`http://localhost:3001/api/bilan/${id_ticket}/details`)
      .then(res => res.json())
      .then(setData)
      .catch(err => console.error('Erreur chargement détails ticket :', err));
  }, [id_ticket]);

  if (!data) return <div>Chargement...</div>;

  const { ticket, objets, paiementMixte } = data;

  return (
    <div className="p-3 border bg-white rounded">
      <h4>Ticket #{ticket.id_ticket}</h4>
      {ticket.flag_correction === 1 && ticket.correction_de && (
        <p className="text-danger">⚠️ Ce ticket annule le ticket #{ticket.correction_de}</p>
      )}
     {ticket.corrige_le_ticket && (
        <p className="text-warning">✏️ Ce ticket corrige le ticket #{ticket.corrige_le_ticket}</p>
      )}


      <p><strong>Date :</strong> {ticket.date_achat_dt}</p>
      <p><strong>Vendeur :</strong> {ticket.nom_vendeur}</p>
      <p><strong>Total :</strong> {(ticket.prix_total / 100).toFixed(2)} €</p>
      <p><strong>Mode de paiement :</strong> {ticket.moyen_paiement}</p>

      {paiementMixte && (
        <div className="mt-3">
          <h5>Détails du paiement mixte :</h5>
          <ul>
            {paiementMixte.espece > 0 && <li>Espèces : {(paiementMixte.espece / 100).toFixed(2)} €</li>}
            {paiementMixte.carte > 0 && <li>Carte : {(paiementMixte.carte / 100).toFixed(2)} €</li>}
            {paiementMixte.cheque > 0 && <li>Chèque : {(paiementMixte.cheque / 100).toFixed(2)} €</li>}
            {paiementMixte.virement > 0 && <li>Virement : {(paiementMixte.virement / 100).toFixed(2)} €</li>}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <h5>Objets vendus :</h5>
        <ul className="list-group">
         {objets.map((obj, index) => (
            <li className="list-group-item d-flex justify-content-between" key={`${obj.nom}-${index}`}>

              <span>{obj.nbr} x {obj.nom} ({obj.categorie})</span>
              <span>{(obj.prix * obj.nbr / 100).toFixed(2)} €</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default TicketDetail;
