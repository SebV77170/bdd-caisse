import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import TactileInput from './TactileInput';
import { toast } from 'react-toastify';

const FactureModal = ({
  show,
  onClose,
  ticket,
  raisonSociale,
  adresseFacturation,
  setRaisonSociale,
  setAdresseFacturation,
  onSuccess
}) => {
  const [emailClient, setEmailClient] = useState('');

  if (!ticket) return null;

  const handleSubmit = async () => {
    if (!raisonSociale || !adresseFacturation) {
      toast.error("Veuillez remplir tous les champs.");
      return;
    }

    try {
      const res = await fetch(`http://localhost:3001/api/facture/${ticket.uuid_ticket}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raison_sociale: raisonSociale,
          adresse: adresseFacturation,
          email: emailClient || undefined
        })
      });

      const result = await res.json();
      if (result.success) {
        if (emailClient) {
          if (result.emailSent === false) {
            toast.warn("Facture créée localement, mais l'e-mail n'a pas été envoyé.");
          } else {
            toast.success("Facture créée et envoyée");
            toast.info(`📧 Facture envoyée à ${emailClient}`);
          }
        } else {
          toast.success("Facture créée");
        }
        if (onSuccess) onSuccess(result.lien);
      } else {
        toast.error('Échec création facture');
      }
    } catch (err) {
      toast.error('Erreur serveur');
      console.error('Erreur génération facture :', err);
    }
  };

  return (
    <div className={`modal fade ${show ? 'show d-block' : ''}`} tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Créer une facture pour le ticket #{ticket.id_ticket}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <label className="form-label">Raison sociale :</label>
            <TactileInput
              type="text"
              className="form-control mb-2"
              value={raisonSociale}
              onChange={(e) => setRaisonSociale(e.target.value)}
              placeholder="Nom de l'entreprise"
            />
            <label className="form-label">Adresse :</label>
            <TactileInput
              type="text"
              className="form-control mb-2"
              value={adresseFacturation}
              onChange={(e) => setAdresseFacturation(e.target.value)}
              placeholder="Adresse complète"
            />
            <label className="form-label">Adresse e-mail (facultative) :</label>
            <TactileInput
              type="email"
              className="form-control"
              value={emailClient}
              onChange={(e) => setEmailClient(e.target.value)}
              placeholder="exemple@client.com"
            />
          </div>
          <div className="modal-footer">
            <Button variant="secondary" onClick={onClose}>Annuler</Button>
            <Button variant="primary" onClick={handleSubmit}>Générer</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FactureModal;
