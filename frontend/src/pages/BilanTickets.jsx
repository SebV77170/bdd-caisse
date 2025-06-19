import { io } from 'socket.io-client';
import React, { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import './BilanTickets.css';
import TicketDetail from '../components/TicketDetail';
import CorrectionModal from '../components/CorrectionModal';
import TactileInput from '../components/TactileInput';
import { Button } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import FactureModal from '../components/factureModal';



const socket = io('http://localhost:3001');

const BilanTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [filtreDate, setFiltreDate] = useState(new Date());
  const [datesDisponibles, setDatesDisponibles] = useState([]);
  const [details, setDetails] = useState({});
  const [ticketActif, setTicketActif] = useState(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [ticketPourCorrection, setTicketPourCorrection] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
const [ticketPourEmail, setTicketPourEmail] = useState(null);
const [emailDestinataire, setEmailDestinataire] = useState('');
const location = useLocation();
const [showFactureModal, setShowFactureModal] = useState(false);
const [ticketPourFacture, setTicketPourFacture] = useState(null);
const [raisonSociale, setRaisonSociale] = useState('');
const [adresseFacturation, setAdresseFacturation] = useState('');



  useEffect(() => {
    const fetchBilan = () => {
      fetch('http://localhost:3001/api/bilan')
        .then(res => res.json())
        .then(data => {
          setTickets(data);
          const dates = Array.from(
            new Set(data.map(ticket => new Date(ticket.date_achat_dt).toDateString()))
          ).map(d => new Date(d));
          setDatesDisponibles(dates);
        })
        .catch(err => console.error('Erreur chargement tickets :', err));
    };
    fetchBilan();


    socket.on('ticketsmisajour', fetchBilan);
    return () => socket.off('ticketsmisajour');
  }, []);

  useEffect(() => {
    if (location.state?.toastMessage) {
      toast.success(location.state.toastMessage);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const aReduction = (ticket) => {
    return ticket.reducbene || ticket.reduclient || ticket.reducgrospanierclient || ticket.reducgrospanierbene;
  };

  const isSameDay = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const ticketsFiltres = tickets.filter(ticket =>
    isSameDay(new Date(ticket.date_achat_dt), filtreDate)
  );

  const chargerObjets = (id_ticket) => {
    if (details[id_ticket]) {
      setTicketActif(ticketActif === id_ticket ? null : id_ticket);
      return;
    }

    fetch(`http://localhost:3001/api/bilan/${id_ticket}/details`)
      .then(res => res.json())
      .then(data => {
        setDetails(prev => ({ ...prev, [id_ticket]: data }));
        setTicketActif(id_ticket);
      })
      .catch(err => console.error('Erreur chargement détails ticket:', err));
  };

  const supprimerTicket = async (id_ticket) => {
    if (!window.confirm("Confirmer la suppression de ce ticket ?")) return;
    try {
      const res = await fetch(`http://localhost:3001/api/correction/${id_ticket}/supprimer`, {
        method: 'POST'
      });
      const result = await res.json();
      if (!result.success) throw new Error('Échec suppression');
    } catch (err) {
      alert('Erreur lors de la suppression.');
      console.error(err);
    }
  };

  return (
    
    <div className="bilan-scroll-container">
      <div className="container">
        <h2>Bilan des tickets de caisse</h2>

<div className="my-4 p-3 border rounded bg-light shadow-sm">
  <h5 className="mb-3 text-center">📅 Filtrer par date</h5>
  <div className="d-flex justify-content-center">
    <DatePicker
      selected={filtreDate}
      onChange={(date) => setFiltreDate(date)}
      highlightDates={[{ 'react-datepicker__day--highlighted-custom': datesDisponibles }]}
      inline
      calendarClassName="border rounded"
    />
  </div>
</div>


        {ticketsFiltres.length === 0 ? (
          <div className="alert alert-info mt-4">Aucun ticket pour la date sélectionnée.</div>
        ) : (
          <table className="table table-striped mt-3">
            <thead>
              <tr>
                <th>#</th>
                <th>Vendeur</th>
                <th>Date</th>
                <th>Mode Paiement</th>
                <th>Total</th>
                <th>Réduction</th>
                <th>Type</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ticketsFiltres.map((ticket) => (
                <React.Fragment key={ticket.id_ticket}>
                  <tr
                    onClick={() => chargerObjets(ticket.id_ticket)}
                    style={{ cursor: 'pointer' }}
                    className={ticketActif === ticket.id_ticket ? 'table-active' : ''}
                  >
                    <td>{ticket.id_ticket}</td>
                    <td>{ticket.nom_vendeur || '—'}</td>
                    <td>{new Date(ticket.date_achat_dt).toLocaleString()}</td>
                    <td>{ticket.moyen_paiement || '—'}</td>
                    <td>
                      {typeof ticket.prix_total === 'number'
                        ? `${(ticket.prix_total / 100).toFixed(2)} €`
                        : '—'}
                    </td>
                    <td>{aReduction(ticket) ? '✅' : '—'}</td>
                    <td>
                      {ticket.flag_correction ? (
                        <span className="badge bg-danger">Annulation de #{ticket.annulation_de}</span>
                      ) : ticket.corrige_le_ticket ? (
                        <span className="badge bg-info text-dark">Correction de #{ticket.correction_de}</span>
                      ) : ticket.correction_de ? (
                        <span className="badge bg-warning text-dark">Correctif</span>
                      ) : ticket.cloture === 1 ? (
                        <span className="badge bg-success text-white">Cloture Caisse</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      {!ticket.flag_correction && !ticket.ticket_corrige && !ticket.cloture &&  (
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            supprimerTicket(ticket.id_ticket);
                          }}
                        >
                          ✖
                        </Button>
                      )}
                      <Button
  variant="outline-secondary"
  size="sm"
  onClick={(e) => {
    e.stopPropagation();
    setTicketPourFacture(ticket);
    setRaisonSociale('');
    setAdresseFacturation('');
    setShowFactureModal(true);
  }}
>
  📄
</Button>


                      <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTicketPourEmail(ticket);
                        setShowEmailModal(true);
                      }}
                    >
                      ✉️
                    </Button>
                    </td>
                  </tr>

                  {ticketActif === ticket.id_ticket && details[ticket.id_ticket] && (
                    <tr>
                      <td colSpan="8">
                        <TicketDetail id_ticket={ticket.id_ticket} />
                        {!ticket.flag_correction && !ticket.ticket_corrige && (
                          <Button
                            variant="outline-warning"
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                              setTicketPourCorrection(details[ticket.id_ticket]);
                              setShowCorrection(true);
                            }}
                          >
                            Corriger
                          </Button>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}

        {ticketPourCorrection && (
          <CorrectionModal
            show={showCorrection}
            onHide={() => setShowCorrection(false)}
            ticketOriginal={ticketPourCorrection}
            onSuccess={() => {
              setDetails({});
              setTicketActif(null);
            }}
          />
        )}
      </div>
      {ticketPourEmail && (
  <div className={`modal fade ${showEmailModal ? 'show d-block' : ''}`} tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
    <div className="modal-dialog">
      <div className="modal-content">
        <div className="modal-header">
          <h5 className="modal-title">Envoyer le ticket #{ticketPourEmail.id_ticket}</h5>
          <button type="button" className="btn-close" onClick={() => setShowEmailModal(false)}></button>
        </div>
        <div className="modal-body">
          <label className="form-label">Adresse e-mail :</label>
          <TactileInput
            type="email"
            className="form-control"
            value={emailDestinataire}
            onChange={(e) => setEmailDestinataire(e.target.value)}
            placeholder="exemple@domaine.com"
          />
        </div>
        <div className="modal-footer">
          {/* Bouton pour annuler l'envoi de l'email */}
          <Button variant="secondary" onClick={() => setShowEmailModal(false)}>
            Annuler
          </Button>
          {/* Bouton pour envoyer le ticket par email */}
          <Button
            variant="primary"
            onClick={async () => {
              try {
                // Appel API pour envoyer le ticket par email
                const res = await fetch(
                  `http://localhost:3001/api/envoieticket/${ticketPourEmail.uuid_ticket}/envoyer`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailDestinataire })
                  }
                );
                const result = await res.json();
                if (result.success) {
                  alert('Ticket envoyé !');
                  setShowEmailModal(false);
                } else {
                  alert('Échec de l\'envoi');
                }
              } catch (err) {
                alert('Erreur de communication');
                console.error(err);
              }
            }}
          >
            Envoyer
          </Button>
        </div>
      </div>
    </div>
  </div>
  // Fin de la modale d'envoi d'email
)}
<ToastContainer position="top-center" autoClose={3000} />
<FactureModal
  show={showFactureModal}
  onClose={() => setShowFactureModal(false)}
  ticket={ticketPourFacture}
  raisonSociale={raisonSociale}
  adresseFacturation={adresseFacturation}
  setRaisonSociale={setRaisonSociale}
  setAdresseFacturation={setAdresseFacturation}
  onSuccess={(lien) => {
    setShowFactureModal(false);
     // Attendre un petit délai que la modale soit fermée proprement
     // Appel au backend Electron pour ouvrir le PDF
  setTimeout(() => {
    window.electron?.openPdf?.(lien); // 👈 ajout ici
  }, 300);
  }}
/>


    </div>
  );
};

export default BilanTickets;
