// src/components/ModalSyncSecondaire.js
import React, { useState } from 'react';
import { useSyncModal } from '../contexts/SyncModalContext';
import './ModalSyncSecondaire.css';
import { useActiveSession } from '../contexts/SessionCaisseContext';


export default function ModalSyncSecondaire() {
  const { demande, setDemande } = useSyncModal();
  const activeSession = useActiveSession();
  const uuidSessionCaisse = activeSession?.uuid_session || null;
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
 

  if (!demande) return null;

  const repondre = async (decision) => {
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('http://localhost:3001/api/sync/recevoir-de-secondaire/valider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          uuid_session_caisse_principale: uuidSessionCaisse,
          requestId: demande.requestId
        }),
        credentials: 'include'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.details || data.error || 'La synchronisation n’a pas pu être appliquée.');
        return;
      }
      setDemande(null);
    } catch {
      setError('Impossible de communiquer avec le serveur local.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-sync">
      <div className="modal-content">
        <h3>Synchronisation entrante</h3>
        <p>{demande.message}</p>
        {error && <div className="alert alert-danger">{error}</div>}
        <div
          aria-busy={submitting}
          style={{ marginTop: '1em', display: 'flex', gap: '1em' }}
        >
          <button onClick={() => repondre('accepter')}>✅ Accepter</button>
          <button onClick={() => repondre('refuser')}>❌ Refuser</button>
        </div>
      </div>
    </div>
  );
}
