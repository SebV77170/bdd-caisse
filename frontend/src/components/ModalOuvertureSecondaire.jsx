import React, { useState } from 'react';
import { useSyncModal } from '../contexts/SyncModalContext';
import './ModalSyncSecondaire.css';

export default function ModalOuvertureSecondaire() {
  const { demandeOuverture, setDemandeOuverture } = useSyncModal();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  if (!demandeOuverture) return null;

  const respond = async decision => {
    setSending(true);
    setError('');
    try {
      const response = await fetch(
        'http://localhost:3001/api/sync/recevoir-de-secondaire/ouverture/repondre',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            requestId: demandeOuverture.requestId,
            decision
          })
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setError(data.error || "La réponse n'a pas pu être enregistrée.");
        return;
      }
      setDemandeOuverture(null);
    } catch {
      setError('Erreur de communication avec le serveur local.');
    } finally {
      setSending(false);
    }
  };

  const poste = demandeOuverture.registerNumber
    ? `${demandeOuverture.sourceName} - poste ${demandeOuverture.registerNumber}`
    : demandeOuverture.sourceName;

  return (
    <div className="modal-sync" role="dialog" aria-modal="true">
      <div className="modal-content">
        <h3>Confirmation de caisse principale</h3>
        <p>
          <strong>{poste}</strong> souhaite s’ouvrir comme caisse secondaire.
        </p>
        {demandeOuverture.requestedBy && (
          <p>Demande effectuée par : {demandeOuverture.requestedBy}</p>
        )}
        <p><strong>Êtes-vous bien la caisse principale pour cette session ?</strong></p>
        {error && <div className="alert alert-danger">{error}</div>}
        <div style={{ marginTop: '1em', display: 'flex', gap: '1em' }}>
          <button disabled={sending} onClick={() => respond('accepter')}>
            Oui, autoriser l’ouverture
          </button>
          <button disabled={sending} onClick={() => respond('refuser')}>
            Non, refuser
          </button>
        </div>
      </div>
    </div>
  );
}
