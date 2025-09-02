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
import { toast } from 'react-toastify';
import FactureModal from '../components/factureModal';
import SiCaissePrincipale from '../utils/SiCaissePrincipale';

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
  const [triPaiement, setTriPaiement] = useState('none'); 
  const [triTotal, setTriTotal] = useState('none'); 
  const [triDate, setTriDate] = useState('none'); 


  const normalizeMoyen = (raw) => {
  if (!raw) return 'autre';
  const s = String(raw).trim().toLowerCase();
  if (['espece', 'espèces', 'especes', 'espèce', 'cash', 'liquide', 'liquides'].includes(s)) return 'especes';
  if (['carte', 'cb', 'cb bancaire', 'cb bancaire (visa/mastercard)', 'credit card', 'debit card'].includes(s)) return 'carte';
  if (['cheque', 'chèque', 'cheques', 'chèques'].includes(s)) return 'cheque';
  if (['virement', 'transfert', 'transfer', 'sepa'].includes(s)) return 'virement';
  if (['mixte', 'mix', 'multiple', 'multi', 'multi-pay', 'paiement mixte'].includes(s)) return 'mixte';
  return s || 'autre';
};

const labelMoyen = (norm) => {
  switch (norm) {
    case 'especes': return 'Espèces';
    case 'carte': return 'Carte';
    case 'cheque': return 'Chèque';
    case 'virement': return 'Virement';
    case 'mixte': return 'Mixte';
    default: return 'Autre';
  }
};

// Ordre "caisse" : ce qui sert le plus remonte en premier
const ordreCaisse = ['especes', 'carte', 'cheque', 'virement', 'mixte', 'autre'];

const compareTickets = (a, b) => {
  // --- helpers ---
  const tsA = new Date(a.date_achat_dt).getTime() || 0;
  const tsB = new Date(b.date_achat_dt).getTime() || 0;

  // --- TRI PAR MOYEN DE PAIEMENT ---
  if (triPaiement !== 'none') {
    const A = normalizeMoyen(a.moyen_paiement);
    const B = normalizeMoyen(b.moyen_paiement);

    if (triPaiement === 'az') {
      const cmp = labelMoyen(A).localeCompare(labelMoyen(B), 'fr');
      if (cmp !== 0) return cmp;
    } else if (triPaiement === 'za') {
      const cmp = labelMoyen(B).localeCompare(labelMoyen(A), 'fr');
      if (cmp !== 0) return cmp;
    } else if (triPaiement === 'ordre') {
      const ia = ordreCaisse.indexOf(A) === -1 ? ordreCaisse.length : ordreCaisse.indexOf(A);
      const ib = ordreCaisse.indexOf(B) === -1 ? ordreCaisse.length : ordreCaisse.indexOf(B);
      if (ia !== ib) return ia - ib;
    }
  }

  // --- TRI PAR TOTAL ---
  if (triTotal !== 'none') {
    const A = a.prix_total ?? 0;
    const B = b.prix_total ?? 0;
    if (A !== B) return triTotal === 'asc' ? A - B : B - A;
  }

  // --- TRI PAR DATE ---
  if (triDate !== 'none') {
    if (tsA !== tsB) return triDate === 'asc' ? tsA - tsB : tsB - tsA;
  }

  // --- fallback stable : par #id friendly (ou timestamp) pour éviter des sauts visuels
  return tsA - tsB;
};


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
    return ticket.reducbene || ticket.reducclient || ticket.reducgrospanierclient || ticket.reducgrospanierbene;
  };

  const isSameDay = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const ticketsFiltres = tickets
  .filter(ticket => isSameDay(new Date(ticket.date_achat_dt), filtreDate))
  .sort(compareTickets);




  const chargerObjets = (uuid_ticket) => {
    if (details[uuid_ticket]) {
      setTicketActif(ticketActif === uuid_ticket ? null : uuid_ticket);
      console.log('Détails déjà chargés :', details[uuid_ticket]); // 👈 ici
      return;
    }

    fetch(`http://localhost:3001/api/bilan/${uuid_ticket}/details`)
      .then(res => res.json())
      .then(data => {
        setDetails(prev => ({ ...prev, [uuid_ticket]: data }));
        setTicketActif(uuid_ticket);
      })
      .catch(err => console.error('Erreur chargement détails ticket:', err));
  };

  const supprimerTicket = async (uuid_ticket) => {
    if (!window.confirm("Confirmer la suppression de ce ticket ?")) return;
    try {
      const res = await fetch(`http://localhost:3001/api/correction/${uuid_ticket}/supprimer`, {
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
        <div className="d-flex flex-wrap align-items-center gap-3 mt-3">
  <div className="d-flex align-items-center gap-2">
    <label className="form-label mb-0">Paiement</label>
    <select
      className="form-select"
      style={{ maxWidth: 200 }}
      value={triPaiement}
      onChange={(e) => setTriPaiement(e.target.value)}
    >
      <option value="none">Aucun</option>
      <option value="az">A → Z</option>
      <option value="za">Z → A</option>
      <option value="ordre">Ordre caisse</option>
    </select>
  </div>

  <div className="d-flex align-items-center gap-2">
    <label className="form-label mb-0">Total</label>
    <select
      className="form-select"
      style={{ maxWidth: 160 }}
      value={triTotal}
      onChange={(e) => setTriTotal(e.target.value)}
    >
      <option value="none">Aucun</option>
      <option value="asc">↑</option>
      <option value="desc">↓</option>
    </select>
  </div>

  <div className="d-flex align-items-center gap-2">
    <label className="form-label mb-0">Date</label>
    <select
      className="form-select"
      style={{ maxWidth: 180 }}
      value={triDate}
      onChange={(e) => setTriDate(e.target.value)}
    >
      <option value="none">Aucun</option>
      <option value="asc">Ancien → Récent</option>
      <option value="desc">Récent → Ancien</option>
    </select>
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
                <th
                  role="button"
                  onClick={() => setTriDate(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                  title="Cliquer pour trier par date"
                >
                  Date {triDate === 'asc' ? '↑' : triDate === 'desc' ? '↓' : ''}
                </th>
                <th
                  role="button"
                  onClick={() => setTriPaiement(prev => (prev === 'az' ? 'za' : 'az'))}
                  title="Cliquer pour trier A→Z / Z→A"
                >
                  Mode Paiement {triPaiement === 'az' ? '↑' : triPaiement === 'za' ? '↓' : ''}
                </th>

                <th
                  role="button"
                  onClick={() => setTriTotal(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                  title="Cliquer pour trier par montant"
                >
                  Total {triTotal === 'asc' ? '↑' : triTotal === 'desc' ? '↓' : ''}
                </th>
                <th>Réduction</th>
                <th>Type</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ticketsFiltres.map((ticket) => (
                <React.Fragment key={ticket.uuid_ticket}>
                  <tr
                    onClick={() => chargerObjets(ticket.uuid_ticket)}
                    style={{ cursor: 'pointer' }}
                    className={ticketActif === ticket.uuid_ticket ? 'table-active' : ''}
                  >
                    <td>{ticket.id_friendly}</td>
                    <td>{ticket.nom_vendeur || '—'}</td>
                    <td>{new Date(ticket.date_achat_dt).toLocaleString('fr-FR')}</td>                    
                    <td>{labelMoyen(normalizeMoyen(ticket.moyen_paiement))}</td>
                    <td>
                      {typeof ticket.prix_total === 'number'
                        ? `${(ticket.prix_total / 100).toFixed(2)} €`
                        : '—'}
                    </td>
                    <td>{aReduction(ticket) ? '✅' : '—'}</td>
                    <td>
                      {ticket.flag_annulation ? (
                        <span className="badge bg-danger">Annulation de #{ticket.id_friendly_annule}</span>
                      ) : ticket.corrige_le_ticket ? (
                        <span className="badge bg-info text-dark">Correction de #{ticket.id_friendly_corrige}</span>
                      ) : ticket.annulation_de ? (
                        <span className="badge bg-warning text-dark">Correctif</span>
                      ) : ticket.cloture === 1 ? (
                        <span className="badge bg-success text-white">Cloture Caisse</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      {!ticket.flag_annulation && !ticket.ticket_corrige && !ticket.cloture &&  (
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            supprimerTicket(ticket.uuid_ticket);
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
                  {ticketActif === ticket.uuid_ticket && details[ticket.uuid_ticket] && (
                    <tr>
                      <td colSpan="8">
                        <TicketDetail
                          uuid_ticket={ticket.uuid_ticket}
                          id_friendly={ticket.id_friendly}
                          id_friendly_annule={ticket.id_friendly_annule}
                          id_friendly_corrige={ticket.id_friendly_corrige}
                        />
                        {!ticket.flag_annulation && !ticket.ticket_corrige && !ticket.cloture &&(
                        
                            <Button
                              variant="outline-warning"
                              size="sm"
                              className="mt-2"
                              onClick={() => {
                                setTicketPourCorrection(details[ticket.uuid_ticket]);
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
      {showEmailModal && ticketPourEmail && (
        <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true"
         style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Envoyer le ticket #{ticketPourEmail.id_ticket}</h5>
                <button type="button" className="btn-close" onClick={() => { setShowEmailModal(false); setTicketPourEmail(null); }}></button>
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
                        toast.success('Ticket envoyé !');
                        setShowEmailModal(false);
                        setTicketPourEmail(null);
                      } else {
                        toast.error('Échec de l\'envoi');
                      }
                    } catch (err) {
                      toast.error('Erreur de communication');
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
