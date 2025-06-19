import React, { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';

function ClavierTexteModal({ show, onClose, onValider, initial = '' }) {
  const [value, setValue] = useState(initial);

  const handleInput = (char) => {
    if (char === '←') {
      setValue(prev => prev.slice(0, -1));
    } else if (char === 'SPACE') {
      setValue(prev => prev + ' ');
    } else {
      setValue(prev => prev + char);
    }
  };

  const valider = () => {
    onValider(value);
    onClose();
    setValue('');
  };

  const rows = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['A','Z','E','R','T','Y','U','I','O','P'],
    ['Q','S','D','F','G','H','J','K','L','M'],
    ['W','X','C','V','B','N'],
    ['@','.',';',':','!','?'],
    ['gmail.com','orange.fr','free.fr','yahoo.fr','hotmail.fr']
  ];

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Saisie</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="display-6 text-center mb-2">{value || ' '}</div>
        {rows.map((row, idx) => (
          <div key={idx} className="d-flex justify-content-center mb-1">
            {row.map(char => (
  <Button
    key={char}
    className={`m-1 ${idx === 5 ? 'btn-sm rounded-pill px-3' : ''}`}
    variant="outline-primary"
    style={idx !== 5 ? { width: 45 } : undefined}
    onClick={() => handleInput(char)}
  >
    {char}
  </Button>
))}

            
          </div>
        ))}
        <div className="d-flex justify-content-center">
          <Button
            className="m-1"
            variant="outline-primary"
            style={{ width: 90 }}
            onClick={() => handleInput('SPACE')}
          >
            Espace
          </Button>
          <Button
            className="m-1"
            variant="outline-primary"
            style={{ width: 45 }}
            onClick={() => handleInput('←')}
          >
            ←
          </Button>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="success" onClick={valider}>Valider</Button>
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ClavierTexteModal;
