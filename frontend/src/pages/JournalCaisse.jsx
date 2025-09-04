import React, { useEffect, useState } from 'react';

import SessionDetails from '../components/SessionDetails';
import ModificationDetails from '../components/ModificationDetails';
import 'bootstrap/dist/css/bootstrap.min.css';
import './BilanTickets.css';

function formatEuros(val) {
  return val != null ? `${(val / 100).toFixed(2)} €` : '—';
}

// Helpers d'affichage local depuis un ISO UTC
const toLocalParts = (utcIso) => {
  if (!utcIso) return null;
  const d = new Date(utcIso);
  const date = d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  const time = d.toLocaleTimeString('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return { date, time };
};

const JournalCaisse = () => {
  const [sessions, setSessions] = useState([]);
  const [details, setDetails] = useState({});
  const [modifs, setModifs] = useState({});
  const [active, setActive] = useState(null);

  // ---- état du modal de rattrapage ----
  const [showModal, setShowModal] = useState(false);
  const [modalSession, setModalSession] = useState(null);
  const [respPseudo, setRespPseudo] = useState('');
  const [respPassword, setRespPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [modalMsg, setModalMsg] = useState('');

  useEffect(() => {
    fetch('http://localhost:3001/api/caisse/journal')
      .then(res => res.json())
      .then(setSessions)
      .catch(err => console.error('Erreur chargement journal caisse:', err));
  }, []);

  const chargerDetails = (session) => {
    const id = session.id_session;
    if (details[id]) {
      setActive(active === id ? null : id);
      return;
    }
    Promise.all([
      fetch(`http://localhost:3001/api/bilan/bilan_session_caisse?uuid_session_caisse=${id}`)
        .then(res => res.json()),
      fetch(`http://localhost:3001/api/caisse/modifications?uuid_session_caisse=${id}`)
        .then(res => res.json())
    ])
      .then(([bilan, mods]) => {
        setDetails(prev => ({ ...prev, [id]: bilan }));
        setModifs(prev => ({ ...prev, [id]: mods }));
        setActive(id);
      })
      .catch(err => console.error('Erreur chargement bilan/modifs session:', err));
  };

  // --- ouvrir le modal pour une session secondaire fermée ---
  const openResendModal = (s) => {
    if (!s.closed_at_utc) {
      return alert("La session n'est pas fermée : impossible de borner la fenêtre d'envoi.");
    }
    setModalSession(s);
    setRespPseudo('');
    setRespPassword('');
    setModalMsg('');
    setShowModal(true);
  };

  const closeModal = () => {
    if (sending) return;
    setShowModal(false);
    setModalSession(null);
    setRespPseudo('');
    setRespPassword('');
    setModalMsg('');
  };

  // --- submit modal: envoi vers principale (mode resendWindow) ---
  const submitResend = async (e) => {
    e?.preventDefault?.();
    if (!modalSession) return;

    if (!respPseudo || !respPassword) {
      setModalMsg('Pseudo et mot de passe responsables requis.');
      return;
    }

    const s = modalSession;
    // On utilise la fenêtre UTC directement depuis la DB
    // (Si besoin, ajoute un buffer ±60s côté back)
    const startISO = s.opened_at_utc;
    const endISO = s.closed_at_utc;

    setSending(true);
    setModalMsg('Envoi en cours…');

    try {
      const res = await fetch('http://localhost:3001/api/sync/envoyer-secondaire-vers-principal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mode: 'resendWindow',
          uuid_session_caisse: s.id_session, // trace côté serveur
          responsable_pseudo: respPseudo,
          mot_de_passe: respPassword,
          window: { startISO, endISO }
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setModalMsg(`✅ Envoi effectué. Lignes validées : ${json.ids?.length || 0}`);
        // Optionnel : rafraîchir la liste
        // const refreshed = await fetch('http://localhost:3001/api/caisse/journal').then(r=>r.json());
        // setSessions(refreshed);
      } else {
        setModalMsg(`❌ Échec : ${json.message || json.error || 'Erreur inconnue'}`);
      }
    } catch (err) {
      console.error('Erreur renvoi vers principale:', err);
      setModalMsg('❌ Erreur réseau.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bilan-scroll-container">
      <div className="container">
        <h2>Journal de caisse</h2>
        <table className="table table-striped mt-3">
          <thead>
            <tr>
              <th>Ouverture</th>
              <th>Fermeture</th>
              <th>Resp. ouverture</th>
              <th>Resp. fermeture</th>
              <th>Écart total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => {
              const o = toLocalParts(s.opened_at_utc);
              const c = toLocalParts(s.closed_at_utc);
              return (
                <React.Fragment key={s.id_session}>
                  <tr
                    onClick={() => chargerDetails(s)}
                    style={{ cursor: 'pointer' }}
                    className={active === s.id_session ? 'table-active' : ''}
                  >
                    <td>{o ? `${o.date} ${o.time}` : '—'}</td>
                    <td>{c ? `${c.date} ${c.time}` : '—'}</td>
                    <td>{s.responsable_ouverture || '—'}</td>
                    <td>{s.responsable_fermeture || '—'}</td>
                    <td>{s.ecart != null ? formatEuros(s.ecart) : '—'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {(s.issecondaire === 1 || s.type === 'secondaire') ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          disabled={!s.closed_at_utc}
                          title={s.closed_at_utc ? 'Renvoyer vers la caisse principale' : 'Session non fermée'}
                          onClick={() => openResendModal(s)}
                        >
                          ↗ Envoyer à la principale
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                  {active === s.id_session && details[s.id_session] && (
                    <tr>
                      <td colSpan="6">
                        <SessionDetails session={s} bilan={details[s.id_session]} />
                        <ModificationDetails modifications={modifs[s.id_session]} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ------- Modal simple (sans JS Bootstrap) ------- */}
      {showModal && (
        <div
          className="modal d-block"
          tabIndex="-1"
          role="dialog"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={closeModal}
        >
          <div
            className="modal-dialog"
            role="document"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <form onSubmit={submitResend}>
                <div className="modal-header">
                  <h5 className="modal-title">Envoyer à la caisse principale</h5>
                  <button type="button" className="btn-close" onClick={closeModal} disabled={sending} />
                </div>
                <div className="modal-body">
                  {modalSession && (
                    <p className="mb-2">
                      Session <code>{modalSession.id_session}</code> ·{' '}
                      <strong>
                        {toLocalParts(modalSession.opened_at_utc)?.date} {toLocalParts(modalSession.opened_at_utc)?.time}
                      </strong> →{' '}
                      <strong>
                        {toLocalParts(modalSession.closed_at_utc)?.date} {toLocalParts(modalSession.closed_at_utc)?.time}
                      </strong>
                    </p>
                  )}

                  <div className="mb-3">
                    <label className="form-label">Pseudo du responsable</label>
                    <input
                      type="text"
                      className="form-control"
                      value={respPseudo}
                      onChange={(e) => setRespPseudo(e.target.value)}
                      required
                      disabled={sending}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label">Mot de passe du responsable</label>
                    <input
                      type="password"
                      className="form-control"
                      value={respPassword}
                      onChange={(e) => setRespPassword(e.target.value)}
                      required
                      disabled={sending}
                    />
                  </div>

                  {!!modalMsg && (
                    <div className="small mt-2">
                      {modalMsg}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={closeModal} disabled={sending}>
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={sending}>
                    {sending ? 'Envoi…' : 'Envoyer maintenant'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* ------- Fin modal ------- */}
    </div>
  );
};

export default JournalCaisse;
