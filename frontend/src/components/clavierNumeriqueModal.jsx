import React, { useState } from 'react';
import { Modal, Button, Row, Col } from 'react-bootstrap';

function ClavierNumeriqueModal({ show, onClose, onValider, initial = '', isDecimal = false }) {
  const [value, setValue] = useState(initial);

  const handleInput = (char) => {
    if (char === '←') {
      setValue((prev) => prev.slice(0, -1));
    } else if (char === ',' && !value.includes(',')) {
      setValue((prev) => prev + ',');
    } else if (/^\d$/.test(char)) {
      setValue((prev) => prev + char);
    }
  };

  const valider = () => {
    onValider(value);
    onClose();
    setValue('');
  };

  const renderButton = (char, options = {}) => (
    <Button
      variant={options.variant || 'outline-primary'}
      style={{
        width: options.wide ? 130 : 60,
        height: 60,
        fontSize: '1.5rem',
        borderRadius: 10,
      }}
      onClick={() => handleInput(char)}
      className="m-1"
    >
      {char}
    </Button>
  );

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Clavier numérique</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="display-5 text-center mb-3 border p-2 rounded bg-light">
          {value || ' '}
        </div>

        <div className="d-flex flex-column align-items-center">
          <div className="d-flex">
            {['1', '2', '3'].map((n) => renderButton(n))}
          </div>
          <div className="d-flex">
            {['4', '5', '6'].map((n) => renderButton(n))}
          </div>
          <div className="d-flex">
            {['7', '8', '9'].map((n) => renderButton(n))}
          </div>
          <div className="d-flex justify-content-center">
            {isDecimal ? renderButton(',') : <div style={{ width: 62, margin: '0.25rem' }} />}
            {renderButton('0', { wide: true })}
            {renderButton('←', { variant: 'outline-danger' })}
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="success" onClick={valider}>
          Valider
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Annuler
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ClavierNumeriqueModal;
