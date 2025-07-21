// src/components/ModalSyncSecondaire.js
import React from 'react';
import { useSyncModal } from '../contexts/SyncModalContext';
import './ModalSyncSecondaire.css';

export default function ModalSyncSecondaire() {
  const { demande, setDemande } = useSyncModal();

  if (!demande) return null;

  const repondre = async (decision) => {
    await fetch('http://localhost:3001/api/sync/recevoir-de-secondaire/valider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision })
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
