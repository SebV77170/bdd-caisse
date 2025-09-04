// components/ResponsableFields.jsx
import React, { useState, useEffect } from 'react';

export default function ResponsableFields({
  responsablePseudo,
  setResponsablePseudo,
  motDePasse,
  setMotDePasse,
  title = 'Identifiez-vous',
  withCard = true,
  idPrefix = 'resp',
  allowClearHistory = true,
}) {
  const [showPwd, setShowPwd] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const STORAGE_KEY = 'rb_pseudo_history_v1';
  const TOP_N = 8;

  const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

  const loadHistory = () => {
    if (!isBrowser) return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = JSON.parse(raw || '[]');
      // sécurité : structure attendue
      return Array.isArray(arr) ? arr.filter(x => x && x.norm && x.value) : [];
    } catch {
      return [];
    }
  };

  const saveHistory = (arr) => {
    if (!isBrowser) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch {
      // quota plein ou interdit => on ignore
    }
  };

  const recordPseudo = (raw) => {
    if (!isBrowser) return;
    const value = (raw || '').trim();
    if (value.length < 2) return; // évite les entrées trop courtes
    const norm = value.toLowerCase();

    const list = loadHistory();
    const idx = list.findIndex((x) => x.norm === norm);
    if (idx >= 0) {
      // incrémente et met à jour la casse visible + lastUsed
      list[idx] = {
        ...list[idx],
        value, // dernière casse saisie
        count: (list[idx].count || 1) + 1,
        lastUsed: Date.now(),
      };
    } else {
      list.push({ value, norm, count: 1, lastUsed: Date.now() });
    }

    // limite la taille (garde les plus utiles)
    const pruned = list
      .sort((a, b) => (b.count - a.count) || (b.lastUsed - a.lastUsed))
      .slice(0, 50);

    saveHistory(pruned);
    setSuggestions(pruned);
  };

  const clearHistory = () => {
    if (!isBrowser) return;
    localStorage.removeItem(STORAGE_KEY);
    setSuggestions([]);
  };

  useEffect(() => {
    setSuggestions(loadHistory());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const content = (
    <>
      {title && <h5 className="card-title mb-4 d-flex align-items-center justify-content-between">
        <span>{title}</span>
        {allowClearHistory && suggestions.length > 0 && (
          <button
            type="button"
            className="btn btn-sm btn-link p-0"
            onClick={clearHistory}
            title="Effacer l'historique des identifiants"
          >
            Effacer l’historique
          </button>
        )}
      </h5>}

      {/* Pseudo */}
      <div className="mb-3">
        <label htmlFor={`${idPrefix}-pseudo`} className="form-label">
          Identifiant / Pseudo
        </label>
        <div className="input-group input-group-lg">
          <span className="input-group-text" id={`${idPrefix}-addon-pseudo`}>@</span>
          <input
            id={`${idPrefix}-pseudo`}
            type="text"
            className="form-control"
            placeholder="tapez votre identifiant"
            aria-describedby={`${idPrefix}-addon-pseudo`}
            value={responsablePseudo}
            onChange={(e) => setResponsablePseudo(e.target.value)}
            onBlur={() => recordPseudo(responsablePseudo)}
            list={`${idPrefix}-pseudos`}
            autoComplete="username"
            autoFocus
          />
          <datalist id={`${idPrefix}-pseudos`}>
            {suggestions
              .sort((a, b) => (b.count - a.count) || (b.lastUsed - a.lastUsed))
              .slice(0, TOP_N)
              .map((s) => (
                <option key={s.norm} value={s.value} />
              ))}
          </datalist>
        </div>
      </div>

      {/* Mot de passe */}
      <div className="mb-2">
        <label htmlFor={`${idPrefix}-password`} className="form-label">
          Mot de passe
        </label>
        <div className="input-group input-group-lg">
          <input
            id={`${idPrefix}-password`}
            type={showPwd ? 'text' : 'password'}
            className="form-control"
            placeholder="••••••••"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setShowPwd((s) => !s)}
            aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            {showPwd ? 'Masquer' : 'Afficher'}
          </button>
        </div>
      </div>

      <hr className="mt-4 mb-0" style={{ opacity: 0.1 }} />
    </>
  );

  if (!withCard) {
    return <fieldset className="border-0 p-0 m-0">{content}</fieldset>;
  }

  return (
    <div className="card shadow-sm border-0 rounded-4 mx-auto mt-4" style={{ maxWidth: 520 }}>
      <div className="card-body p-4 p-md-5">{content}</div>
    </div>
  );
}
