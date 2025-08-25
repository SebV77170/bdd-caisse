// src/components/ModalSyncSecondaire.js
import React from 'react';
import { useSyncModal } from '../contexts/SyncModalContext';
import './ModalSyncSecondaire.css';
import { useActiveSession } from '../contexts/SessionCaisseContext';


export default function ModalSyncSecondaire() {
  const { demande, setDemande } = useSyncModal();
  const activeSession = useActiveSession();
  const uuidSessionCaisse = activeSession?.uuid_session || null;
 

  if (!demande) return null;

  const repondre = async (decision) => {
    await fetch('http://localhost:3001/api/sync/recevoir-de-secondaire/valider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, uuid_session_caisse_principale: uuidSessionCaisse }),
      credentials: 'include'
    });
    setDemande(null);
  };

  return (
    <div className="modal-sync">
      <div className="modal-content">
        <h3>Synchronisation entrante</h3>
        <p>{demande.message}</p>
        <div style={{ marginTop: '1em', display: 'flex', gap: '1em' }}>
          <button onClick={() => repondre('accepter')}>✅ Accepter</button>
          <button onClick={() => repondre('refuser')}>❌ Refuser</button>
        </div>
      </div>
    </div>
  );
}
