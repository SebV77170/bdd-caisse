import React from 'react';
import { formatParisDateTime } from '../utils/dateTime';

const PAYMENT_LABELS = {
  espece: 'Espèces',
  carte: 'Carte',
  cheque: 'Chèque',
  virement: 'Virement',
};

function formatAmount(cents) {
  return `${(Number(cents || 0) / 100).toFixed(2)} €`;
}

function ticketLabel(snapshot, fallbackUuid) {
  return snapshot?.ticket?.id_friendly || fallbackUuid || 'inconnu';
}

function articleKey(article) {
  return `${article.nom || ''}|||${article.categorie || ''}`;
}

function aggregateArticles(articles = []) {
  const aggregated = new Map();

  for (const article of articles) {
    const key = articleKey(article);
    const current = aggregated.get(key) || {
      nom: article.nom,
      categorie: article.categorie,
      nbr: 0,
      prix: Number(article.prix || 0),
    };
    current.nbr += Number(article.nbr || 0);
    current.prix = Number(article.prix || 0);
    aggregated.set(key, current);
  }

  return aggregated;
}

function getArticleChanges(originalArticles, correctedArticles) {
  const original = aggregateArticles(originalArticles);
  const corrected = aggregateArticles(correctedArticles);
  const keys = new Set([...original.keys(), ...corrected.keys()]);

  return Array.from(keys).flatMap(key => {
    const before = original.get(key);
    const after = corrected.get(key);

    if (!before && after) {
      return [{ type: 'Ajout', article: after }];
    }
    if (before && !after) {
      return [{ type: 'Suppression', article: before }];
    }
    if (before.nbr !== after.nbr || before.prix !== after.prix) {
      return [{ type: 'Modification', before, after }];
    }
    return [];
  });
}

function getPaymentChanges(originalPayment, correctedPayment) {
  return Object.keys(PAYMENT_LABELS).flatMap(method => {
    const before = Number(originalPayment?.[method] || 0);
    const after = Number(correctedPayment?.[method] || 0);
    return before === after ? [] : [{ method, before, after }];
  });
}

function ArticleChanges({ entry }) {
  if (!entry.correction) {
    const cancelledArticles = entry.original?.objets || [];
    return (
      <div>
        <strong>Articles annulés :</strong>
        {cancelledArticles.length === 0 ? (
          <span className="text-muted"> aucun article retrouvé</span>
        ) : (
          <ul className="mb-0 mt-1">
            {cancelledArticles.map((article, index) => (
              <li key={`${article.uuid_objet || article.nom}-${index}`}>
                {article.nbr} × {article.nom} : {formatAmount(article.prix * article.nbr)}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const changes = getArticleChanges(entry.original?.objets, entry.correction?.objets);
  if (changes.length === 0) {
    return <div className="text-muted">Aucune modification d’article.</div>;
  }

  return (
    <ul className="mb-0">
      {changes.map((change, index) => {
        if (change.type === 'Ajout') {
          return (
            <li key={`add-${index}`}>
              <strong>Ajout :</strong> {change.article.nbr} × {change.article.nom} à{' '}
              {formatAmount(change.article.prix)}
            </li>
          );
        }
        if (change.type === 'Suppression') {
          return (
            <li key={`remove-${index}`}>
              <strong>Suppression :</strong> {change.article.nbr} × {change.article.nom}
            </li>
          );
        }
        return (
          <li key={`change-${index}`}>
            <strong>Modification :</strong> {change.before.nom}, quantité{' '}
            {change.before.nbr} → {change.after.nbr}, prix{' '}
            {formatAmount(change.before.prix)} → {formatAmount(change.after.prix)}
          </li>
        );
      })}
    </ul>
  );
}

function TicketHistory({ historique = [] }) {
  if (historique.length === 0) {
    return (
      <div className="mt-4">
        <h5>Historique des modifications</h5>
        <p className="text-muted mb-0">Aucune modification enregistrée pour ce ticket.</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h5>Historique des modifications</h5>
      <div className="d-flex flex-column gap-3">
        {historique.map(entry => {
          const originalTotal = entry.original?.ticket?.prix_total;
          const correctedTotal = entry.correction?.ticket?.prix_total;
          const paymentChanges = getPaymentChanges(
            entry.original?.paiement,
            entry.correction?.paiement
          );

          return (
            <div className="border rounded p-3 bg-light" key={entry.id}>
              <div>
                <strong>Date :</strong>{' '}
                {formatParisDateTime(entry.date_correction)}
              </div>
              <div><strong>Utilisateur :</strong> {entry.utilisateur || 'Non renseigné'}</div>
              {entry.motif && <div><strong>Motif :</strong> {entry.motif}</div>}
              <div className="mt-2">
                <strong>Tickets associés :</strong>{' '}
                original #{ticketLabel(entry.original, entry.uuid_ticket_original)}
                {entry.annulation && (
                  <> · annulation #{ticketLabel(entry.annulation, entry.uuid_ticket_annulation)}</>
                )}
                {entry.correction && (
                  <> · correction #{ticketLabel(entry.correction, entry.uuid_ticket_correction)}</>
                )}
              </div>

              <div className="mt-2">
                <strong>Modifications associées :</strong>
                <ArticleChanges entry={entry} />
              </div>

              {entry.correction && originalTotal !== correctedTotal && (
                <div className="mt-2">
                  <strong>Total :</strong> {formatAmount(originalTotal)} →{' '}
                  {formatAmount(correctedTotal)}
                </div>
              )}

              {entry.correction && paymentChanges.length > 0 && (
                <div className="mt-2">
                  <strong>Paiements :</strong>
                  <ul className="mb-0">
                    {paymentChanges.map(change => (
                      <li key={change.method}>
                        {PAYMENT_LABELS[change.method]} : {formatAmount(change.before)} →{' '}
                        {formatAmount(change.after)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TicketHistory;
