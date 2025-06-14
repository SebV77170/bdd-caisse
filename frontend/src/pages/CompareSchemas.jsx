import React, { useState } from 'react';
import { Button, Spinner, Form } from 'react-bootstrap';

const describe = c => {
  if (!c) return '';
  if (c.action === 'createTable') return `Créer la table '${c.table}'`;
  if (c.action === 'addColumn') return `Ajouter la colonne '${c.column}' dans '${c.table}'`;
  if (c.action === 'dropColumn') return `Supprimer la colonne '${c.column}' de '${c.table}'`;
  return '';
};

const CompareSchemas = () => {
  const [mysqlChanges, setMysqlChanges] = useState([]);
  const [sqliteChanges, setSqliteChanges] = useState([]);
  const [selMysql, setSelMysql] = useState([]);
  const [selSqlite, setSelSqlite] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const runCompare = async () => {
    setLoading(true);
    setMysqlChanges([]);
    setSqliteChanges([]);
    setSelMysql([]);
    setSelSqlite([]);
    setError(null);
    try {
      const res = await fetch('http://localhost:3001/api/compare-schemas');
      const data = await res.json();
      if (data.success) {
        setMysqlChanges(data.mysqlChanges || []);
        setSqliteChanges(data.sqliteChanges || []);
        setSelMysql(new Array((data.mysqlChanges || []).length).fill(false));
        setSelSqlite(new Array((data.sqliteChanges || []).length).fill(false));
      } else {
        setError('Erreur : ' + (data.error || 'inconnue'));
      }
    } catch {
      setError('Erreur lors de la requête.');
    }
    setLoading(false);
  };

  const selectAll = () => {
    setSelMysql(new Array(mysqlChanges.length).fill(true));
    setSelSqlite(new Array(sqliteChanges.length).fill(true));
  };

  const applySelected = async () => {
    setApplying(true);
    setError(null);
    try {
      const selectedMysql = mysqlChanges.filter((_, i) => selMysql[i]);
      const selectedSqlite = sqliteChanges.filter((_, i) => selSqlite[i]);
      const res = await fetch('http://localhost:3001/api/compare-schemas/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mysqlChanges: selectedMysql, sqliteChanges: selectedSqlite })
      });
      const data = await res.json();
      if (data.success) {
        await runCompare();
      } else {
        setError('Erreur : ' + (data.error || 'inconnue'));
      }
    } catch {
      setError('Erreur lors de la requête.');
    }
    setApplying(false);
  };

  const hasChanges = mysqlChanges.length > 0 || sqliteChanges.length > 0;

  return (
    <div className="bilan-scroll-container">
      <div className="mt-3">
        <div className="d-flex gap-2 mb-3">
          <Button onClick={runCompare} disabled={loading || applying}>
            {loading ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" className="me-2" />
                Comparaison...
              </>
            ) : (
              'Comparer'
            )}
          </Button>
          <Button onClick={selectAll} disabled={!hasChanges || loading || applying}>Sélectionner tout</Button>
          <Button onClick={applySelected} disabled={!hasChanges || loading || applying}>Appliquer</Button>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {!hasChanges && !loading && (
          <div className="alert alert-success">Aucune différence détectée.</div>
        )}

        {hasChanges && (
          <table className="table table-bordered">
            <thead>
              <tr>
                <th>À modifier dans MySQL</th>
                <th>À modifier dans SQLite</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(mysqlChanges.length, sqliteChanges.length) }).map((_, idx) => (
                <tr key={idx}>
                  <td>
                    {mysqlChanges[idx] && (
                      <Form.Check
                        type="checkbox"
                        checked={selMysql[idx] || false}
                        onChange={e =>
                          setSelMysql(prev => prev.map((v, i) => (i === idx ? e.target.checked : v)))
                        }
                        label={describe(mysqlChanges[idx])}
                      />
                    )}
                  </td>
                  <td>
                    {sqliteChanges[idx] && (
                      <Form.Check
                        type="checkbox"
                        checked={selSqlite[idx] || false}
                        onChange={e =>
                          setSelSqlite(prev => prev.map((v, i) => (i === idx ? e.target.checked : v)))
                        }
                        label={describe(sqliteChanges[idx])}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CompareSchemas;
