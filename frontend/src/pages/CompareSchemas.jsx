import React, { useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';

const CompareSchemas = () => {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);

  const runCompare = async () => {
    setLoading(true);
    setLines([]);
    try {
      const res = await fetch('http://localhost:3001/api/compare-schemas');
      const data = await res.json();
      if (data.success) {
        setLines(data.lines);
      } else {
        setLines(['Erreur : ' + (data.error || 'inconnue')]);
      }
    } catch (err) {
      setLines(['Erreur lors de la requête.']);
    }
    setLoading(false);
  };

  return (
    <div className="container mt-4">
      <h2>Comparaison des schémas</h2>
      <Button onClick={runCompare} disabled={loading} className="mt-2">
        {loading ? (<><Spinner as="span" animation="border" size="sm" role="status" className="me-2"/>Comparaison...</>) : 'Comparer'}
      </Button>
      <pre className="mt-3" style={{ whiteSpace: 'pre-wrap' }}>
        {lines.map((l, idx) => (<div key={idx}>{l}</div>))}
      </pre>
    </div>
  );
};

export default CompareSchemas;
