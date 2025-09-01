import React, { useEffect, useMemo, useState } from 'react';

const API_BASE =
  (typeof process !== 'undefined' && process.env?.REACT_APP_API_BASE) ||
  'http://localhost:3001';

function ModificationDetails({ modifications }) {
  const [friendlyMap, setFriendlyMap] = useState({}); // { uuid: friendly }
  const [loadingFriendly, setLoadingFriendly] = useState(false);
  const [friendlyError, setFriendlyError] = useState(null);

  // Liste unique de tous les UUID présents
  const allUuids = useMemo(() => {
    if (!Array.isArray(modifications) || modifications.length === 0) return [];
    const set = new Set();
    for (const m of modifications) {
      if (m?.uuid_ticket_original) set.add(m.uuid_ticket_original);
      if (m?.uuid_ticket_annulation) set.add(m.uuid_ticket_annulation);
      if (m?.uuid_ticket_correction) set.add(m.uuid_ticket_correction);
    }
    return Array.from(set);
  }, [modifications]);

  // Appel batch pour récupérer les friendly IDs
  useEffect(() => {
    if (!allUuids.length) return;

    const controller = new AbortController();
    const run = async () => {
      try {
        setLoadingFriendly(true);
        setFriendlyError(null);

        const res = await fetch(`${API_BASE}/api/friendly/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uuids: allUuids }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} ${text}`);
        }

        const data = await res.json();
        const map = {};
        for (const item of data.items || []) {
          if (item?.uuid && item?.friendly) {
            map[item.uuid] = item.friendly;
          }
        }
        setFriendlyMap(map);
      } catch (e) {
        if (e.name !== 'AbortError') {
          setFriendlyError(e.message || 'Erreur de récupération des friendly IDs');
        }
      } finally {
        setLoadingFriendly(false);
      }
    };

    run();
    return () => controller.abort();
  }, [allUuids]);

  if (!modifications) return <div>Chargement...</div>;
  if (modifications.length === 0) return <div>Aucune modification</div>;

  const showId = (uuid) => friendlyMap[uuid] || uuid;

  return (
    <div className="mt-3">
      <h5>Modifications</h5>

      {loadingFriendly && (
        <p className="text-muted mb-2" style={{ fontStyle: 'italic' }}>
          Résolution des identifiants lisibles…
        </p>
      )}
      {friendlyError && (
        <p className="text-danger mb-2">
          Impossible de récupérer les friendly IDs : {friendlyError}
        </p>
      )}

      <ul className="list-group">
        {modifications.map((mod, idx) => (
          <li
            key={mod.id ?? `${mod.uuid_ticket_original ?? 'row'}-${idx}`}
            className="list-group-item"
          >
            <div><strong>Date :</strong> {mod.date_correction}</div>
            <div><strong>Utilisateur :</strong> {mod.utilisateur}</div>
            {mod.motif && <div><strong>Motif :</strong> {mod.motif}</div>}
            <div>
              Ticket original #{showId(mod.uuid_ticket_original)}
              {mod.uuid_ticket_annulation && ` — annulé par #${showId(mod.uuid_ticket_annulation)}`}
              {mod.uuid_ticket_correction && ` — corrigé par #${showId(mod.uuid_ticket_correction)}`}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ModificationDetails;
