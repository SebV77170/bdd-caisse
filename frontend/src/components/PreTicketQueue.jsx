import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { apiUrl } from '../utils/apiBase';
import socket from '../utils/socket';

function formatEuros(cents) {
  return (cents / 100).toFixed(2).replace('.', ',');
}

function labelFor(preTicket) {
  if (preTicket.client_label) return preTicket.client_label;
  return `Pre-ticket #${preTicket.id}`;
}

function PreTicketQueue({ onRecovered }) {
  const [preTickets, setPreTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [convertingUuid, setConvertingUuid] = useState(null);

  const chargerPreTickets = useCallback(() => {
    setLoading(true);
    fetch(apiUrl('/api/pre-tickets?statut=en_attente'), { credentials: 'include' })
      .then(res => res.json())
      .then(data => setPreTickets(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Impossible de charger les pre-tickets'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    chargerPreTickets();

    const refresh = () => chargerPreTickets();
    socket.on('preTicketCreated', refresh);
    socket.on('preTicketUpdated', refresh);
    socket.on('preTicketConverted', refresh);

    return () => {
      socket.off('preTicketCreated', refresh);
      socket.off('preTicketUpdated', refresh);
      socket.off('preTicketConverted', refresh);
    };
  }, [chargerPreTickets]);

  const recuperer = async (uuid) => {
    if (convertingUuid) return;
    setConvertingUuid(uuid);
    try {
      const res = await fetch(apiUrl(`/api/pre-tickets/${uuid}/convertir`), {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Recuperation impossible');
      toast.success('Pre-ticket recupere');
      setPreTickets(current => current.filter(ticket => ticket.uuid_pre_ticket !== uuid));
      onRecovered(data.id_temp_vente);
    } catch (err) {
      toast.error(err.message);
      chargerPreTickets();
    } finally {
      setConvertingUuid(null);
    }
  };

  const annuler = async (uuid) => {
    try {
      const res = await fetch(apiUrl(`/api/pre-tickets/${uuid}/annuler`), {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Annulation impossible');
      setPreTickets(current => current.filter(ticket => ticket.uuid_pre_ticket !== uuid));
      toast.info('Pre-ticket annule');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="border-bottom bg-white px-3 py-2">
      <div className="d-flex align-items-center justify-content-between gap-3">
        <strong>Pre-tickets en attente</strong>
        <button className="btn btn-sm btn-outline-secondary" onClick={chargerPreTickets} disabled={loading}>
          Actualiser
        </button>
      </div>

      {preTickets.length === 0 ? (
        <div className="text-muted small mt-2">
          Aucun pre-ticket en attente.
        </div>
      ) : (
        <div className="d-flex gap-2 overflow-auto pt-2 pb-1">
          {preTickets.map(preTicket => (
            <div
              key={preTicket.uuid_pre_ticket}
              className="border rounded p-2 flex-shrink-0"
              style={{ width: 230 }}
            >
              <div className="fw-bold text-truncate">{labelFor(preTicket)}</div>
              <div className="small text-muted">
                {preTicket.articles} article(s) - {formatEuros(preTicket.total)} EUR
              </div>
              {preTicket.commentaire && (
                <div className="small text-truncate">{preTicket.commentaire}</div>
              )}
              <div className="d-flex gap-2 mt-2">
                <button
                  className="btn btn-sm btn-primary flex-fill"
                  disabled={convertingUuid === preTicket.uuid_pre_ticket}
                  onClick={() => recuperer(preTicket.uuid_pre_ticket)}
                >
                  Recuperer
                </button>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => annuler(preTicket.uuid_pre_ticket)}
                >
                  Annuler
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PreTicketQueue;
