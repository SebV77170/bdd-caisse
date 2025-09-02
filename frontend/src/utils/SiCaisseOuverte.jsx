import React, { useEffect, useMemo, useState } from "react";
import { useActiveSession } from "../contexts/SessionCaisseContext";

/**
 * Utilitaire: formate la date locale en YYYY-MM-DD (sans fuseau)
 */
function formatLocalYYYYMMDD(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Hook: récupère les sessions fermées du jour via l'API.
 * - endpoint: ex. "/api/sessions/closed"
 * - renvoie { data, loading, error }
 */
function useClosedSessionsToday(endpoint = "/api/sessions/closed") {
  const [data, setData] = useState(null);   // null | Array
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // null | Error

  const today = useMemo(() => formatLocalYYYYMMDD(new Date()), []);

  useEffect(() => {
    const ac = new AbortController();

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const url = `${endpoint}?date=${encodeURIComponent(today)}`;
        const res = await fetch(url, { signal: ac.signal });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        // On tolère que l’API renvoie autre chose que [] en le normalisant
        const arr = Array.isArray(json) ? json : (Array.isArray(json?.sessions) ? json.sessions : []);
        setData(arr);
      } catch (e) {
        if (e.name !== "AbortError") {
          setError(e);
        }
      } finally {
        setLoading(false);
      }
    }

    run();
    return () => ac.abort();
  }, [endpoint, today]);

  return { data, loading, error };
}

/**
 * Affiche les enfants uniquement si le ticket est corrigeable :
 * - Case A : session active == session du ticket ET session active ouverte
 * - Case B : session du ticket fermée ET la session fermée référence la session active via
 *            uuid_caisse_principale_si_secondaire ET session active ouverte
 *
 * @param {object} props
 * @param {string} props.uuidSessionCaisseTicket - UUID de la session liée au ticket
 * @param {string} [props.endpoint="/api/session/closed"] - Endpoint pour récupérer les sessions fermées du jour
 * @param {React.ReactNode} props.children
 */
export default function SiCaisseOuverte({
  uuidSessionCaisseTicket,
  endpoint = "/api/session/closed",
  children,
}) {
  const activeSession = useActiveSession();
  const { data: closedSessions, loading } = useClosedSessionsToday(endpoint);

  // Pas de session active -> rien
  if (!activeSession) {
    return null;
  }
console.log(activeSession);
  const activeUuid = activeSession.uuidSessionCaisse || activeSession.uuidCaisseSecondaire;
  const activeEstFermee = Boolean(activeSession.closed_at || activeSession.closed_at_utc);
  const activeEstOuverte = !activeEstFermee;

   // Case A : même session ET ouverte
  const memeSession = activeUuid === uuidSessionCaisseTicket;
  if (memeSession && activeEstOuverte) {
    return children;
  }

  // Tant qu'on charge la liste du jour, on ne s'avance pas
  if (loading) {
    return null;
  }

 

  // Case B : session du ticket fermée aujourd'hui ET rattachée à la session active -> afficher si active ouverte
  if (Array.isArray(closedSessions)) {
    const sessionTicketFermee = closedSessions.find(
      (s) => s && s.uuid_session_caisse === uuidSessionCaisseTicket
    );

    if (sessionTicketFermee) {
      const rattacheeALaPrincipaleActive =
        sessionTicketFermee.uuid_caisse_principale_si_secondaire === activeUuid;

      if (rattacheeALaPrincipaleActive && activeEstOuverte) {
        return children;
      }
    }
  }

  // Sinon, ne pas afficher
  return null;
}
