import React, { useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';

const CompareSchemas = () => {
  const [mysqlChanges, setMysqlChanges] = useState([]);
  const [sqliteChanges, setSqliteChanges] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const runCompare = async () => {
    setLoading(true);
    setMysqlChanges([]);
    setSqliteChanges([]);
    setError(null);
    try {
      const res = await fetch('http://localhost:3001/api/compare-schemas');
      const data = await res.json();
      if (data.success) {
        setMysqlChanges(data.mysqlChanges || []);
        setSqliteChanges(data.sqliteChanges || []);
      } else {
        setError('Erreur : ' + (data.error || 'inconnue'));
      }
    } catch (err) {
      setError('Erreur lors de la requête.');
    }
    setLoading(false);
  };

  return (
    <div className="bilan-scroll-container">
      <div className="container mt-4">
        <h2>Comparaison des schémas</h2>
        <Button onClick={runCompare} disabled={loading} className="mt-2">
          {loading ? (<><Spinner as="span" animation="border" size="sm" role="status" className="me-2"/>Comparaison...</>) : 'Comparer'}
        </Button>
        {error && <div className="alert alert-danger mt-3">{error}</div>}
        {!error && (
          mysqlChanges.length === 0 && sqliteChanges.length === 0 ? (
            <div className="alert alert-success mt-3">Aucune différence détectée.</div>
          ) : (
            <table className="table table-bordered mt-3">
              <thead>
                <tr>
                  <th>À modifier dans MySQL</th>
                  <th>À modifier dans SQLite</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.max(mysqlChanges.length, sqliteChanges.length) }).map((_, idx) => (
                  <tr key={idx}>
                    <td>{mysqlChanges[idx] || ''}</td>
                    <td>{sqliteChanges[idx] || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
};

export default CompareSchemas;
