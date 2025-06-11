import React, { useEffect, useState } from 'react';



import SessionDetails from '../components/SessionDetails';
import ModificationDetails from '../components/ModificationDetails';
import 'bootstrap/dist/css/bootstrap.min.css';
import './BilanTickets.css';


function formatEuros(val) {
  return val != null ? `${(val / 100).toFixed(2)} €` : '—';
}

const JournalCaisse = () => {
  const [sessions, setSessions] = useState([]);
  const [details, setDetails] = useState({});
  const [modifs, setModifs] = useState({});
  const [active, setActive] = useState(null);




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
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <React.Fragment key={s.id_session}>
                <tr
                  onClick={() => chargerDetails(s)}
                  style={{ cursor: 'pointer' }}
                  className={active === s.id_session ? 'table-active' : ''}
                >
                  <td>{s.date_ouverture} {s.heure_ouverture}</td>
                  <td>{s.date_fermeture ? `${s.date_fermeture} ${s.heure_fermeture}` : '—'}</td>
                  <td>{s.responsable_ouverture || '—'}</td>
                  <td>{s.responsable_fermeture || '—'}</td>
                  <td>{s.ecart != null ? formatEuros(s.ecart) : '—'}</td>
                </tr>
                {active === s.id_session && details[s.id_session] && (
                  <tr>
                    <td colSpan="5">
                      <SessionDetails session={s} bilan={details[s.id_session]} />
                      <ModificationDetails modifications={modifs[s.id_session]} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default JournalCaisse;
