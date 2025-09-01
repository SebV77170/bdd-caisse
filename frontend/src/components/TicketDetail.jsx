// ✅ Composant React : affichage d'un ticket avec paiements mixtes
import React, { useEffect, useState } from 'react';

function TicketDetail({ uuid_ticket,id_friendly, id_friendly_annule, id_friendly_corrige }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!uuid_ticket) return;

    fetch(`http://localhost:3001/api/bilan/${uuid_ticket}/details`)
      .then(res => res.json())
      .then(setData)
      .catch(err => console.error('Erreur chargement détails ticket :', err));
  }, [uuid_ticket]);

  if (!uuid_ticket) return null;

if (data === null) {
  return <div>Chargement...</div>;
}

if (!data.ticket) {
  return <div className="text-danger">⚠️ Ticket introuvable ou erreur de chargement.</div>;
}


  const { ticket, objets, paiementMixte } = data;

  return (
    <div className="p-3 border bg-white rounded">
      <h4>Ticket #{id_friendly}</h4>
      {ticket.flag_annulation === 1 && ticket.annulation_de && (
        <p className="text-danger">⚠️ Ce ticket annule le ticket #{id_friendly_annule || ticket.annulation_de}</p>
      )}
     {ticket.corrige_le_ticket && (
        <p className="text-warning">✏️ Ce ticket corrige le ticket #{id_friendly_corrige || ticket.corrige_le_ticket}</p>
      )}


      <p><strong>Date :</strong> {ticket.date_achat_dt}</p>
      <p><strong>Vendeur :</strong> {ticket.nom_vendeur}</p>

   {(ticket.reducbene || ticket.reducclient || ticket.reducgrospanierclient || ticket.reducgrospanierbene) ? (
  <p className="text-success">
    <strong>Réduction appliquée :</strong>{' '}
    {ticket.reducbene ? 'Fidélité Bénévole' :
      ticket.reducclient ? 'Fidélité Client' :
      ticket.reducgrospanierclient ? 'Gros Panier Client (-10%)' :
      ticket.reducgrospanierbene ? 'Gros Panier Bénévole (-20%)' :
      ''}
  </p>
) : (
  <p className="text-muted">
    <strong>Aucune réduction appliquée</strong>
  </p>
)}



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
