import React, { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';

function ClavierNumeriqueModal({ show, onClose, onValider, initial = '', isDecimal = false }) {
  const [value, setValue] = useState(initial);

  const handleInput = (char) => {
    if (char === '←') {
      setValue(prev => prev.slice(0, -1));
    } else if (char === ',' && !value.includes(',')) {
      setValue(prev => prev + ',');
    } else if (/^\d$/.test(char)) {
      setValue(prev => prev + char);
    }
  };

  const touches = ['1','2','3','4','5','6','7','8','9','0', ...(isDecimal ? [','] : []), '←'];

  const valider = () => {
    onValider(value);
    onClose();
    setValue('');
  };

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Saisie</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="display-5 text-center mb-3">{value || ' '}</div>
        <div className="d-flex flex-wrap justify-content-center">
          {touches.map((t, i) => (
            <Button
              key={i}
              className="m-1"
              variant="outline-primary"
              style={{ width: 60, height: 60, fontSize: '1.5rem' }}
              onClick={() => handleInput(t)}
            >
              {t}
            </Button>
          ))}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="success" onClick={valider}>Valider</Button>
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ClavierNumeriqueModal;
