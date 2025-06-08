import React from 'react';
import { Button } from 'react-bootstrap';

const VenteSelector = ({ ventes, venteActive, onSelect, onNew }) => {
  return (
    <>
      <Button
        variant="outline-success"
        size="sm"
        className="me-2"
        onClick={onNew}
      >
        + Nouvelle vente
      </Button>

      {ventes.map((vente) => (
        <Button
          key={vente.id_temp_vente}
          variant={vente.id_temp_vente === venteActive ? 'primary' : 'outline-secondary'}
          size="sm"
          className="me-2"
          onClick={() => onSelect(vente.id_temp_vente)}
        >
          Vente #{vente.id_temp_vente}
        </Button>
      ))}
    </>
  );
};

export default VenteSelector;
