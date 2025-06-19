import React, { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

const DevModeModal = ({ show, onClose, onSuccess, password = 'devpass' }) => {
  const [input, setInput] = useState('');

  const handleValidate = () => {
    if (input === password) {
      onSuccess();
    }
    onClose();
    setInput('');
  };

  const handleCancel = () => {
    onClose();
    setInput('');
  };

  return (
    <Modal show={show} onHide={handleCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>Mot de passe développeur</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Control
          type="password"
          placeholder="Entrez le mot de passe"
          value={input}
          onChange={e => setInput(e.target.value)}
          autoFocus
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleCancel}>
          Annuler
        </Button>
        <Button variant="primary" onClick={handleValidate}>
          Valider
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DevModeModal;
