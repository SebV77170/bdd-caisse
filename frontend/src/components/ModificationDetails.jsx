import React from 'react';

function ModificationDetails({ modifications }) {
  if (!modifications) return <div>Chargement...</div>;
  if (modifications.length === 0) return <div>Aucune modification</div>;

  return (
    <div className="mt-3">
      <h5>Modifications</h5>
      <ul className="list-group">
        {modifications.map(mod => (
          <li key={mod.id} className="list-group-item">
            <div><strong>Date :</strong> {mod.date_correction}</div>
            <div><strong>Utilisateur :</strong> {mod.utilisateur}</div>
            {mod.motif && <div><strong>Motif :</strong> {mod.motif}</div>}
            <div>
              Ticket original #{mod.id_ticket_original}
              {mod.id_ticket_annulation && ` annulé par #${mod.id_ticket_annulation}`}
              {mod.id_ticket_correction && ` corrigé par #${mod.id_ticket_correction}`}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ModificationDetails;
