import React, { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import TactileInput from './TactileInput';

function SignupModal({ show, onHide }) {
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [mail, setMail] = useState('');
  const [tel, setTel] = useState('');
  const [message, setMessage] = useState('');

  const resetFields = () => {
    setPrenom('');
    setNom('');
    setPseudo('');
    setPassword('');
    setMail('');
    setTel('');
    setMessage('');
  };

  const handleClose = () => {
    resetFields();
    onHide();
  };

  const handleSubmit = async () => {
    setMessage('');
    if (!prenom || !nom || !pseudo || !password) {
      setMessage('Champs requis manquants');
      return;
    }
    try {
      const res = await fetch('http://localhost:3001/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prenom, nom, pseudo, mot_de_passe: password, mail, tel })
      });
      const data = await res.json();
      if (data.success) {
        handleClose();
        alert('Compte créé !');
      } else {
        setMessage(data.error || 'Erreur');
      }
    } catch (err) {
      setMessage('Erreur serveur');
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Créer un compte</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <TactileInput className="form-control mb-2" placeholder="Prénom" value={prenom} onChange={e => setPrenom(e.target.value)} />
        <TactileInput className="form-control mb-2" placeholder="Nom" value={nom} onChange={e => setNom(e.target.value)} />
        <TactileInput className="form-control mb-2" placeholder="Pseudo" value={pseudo} onChange={e => setPseudo(e.target.value)} />
        <TactileInput type="password" className="form-control mb-2" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} />
        <TactileInput className="form-control mb-2" placeholder="Email" value={mail} onChange={e => setMail(e.target.value)} />
        <TactileInput className="form-control mb-2" placeholder="Téléphone" value={tel} onChange={e => setTel(e.target.value)} />
        {message && <div className="text-danger">{message}</div>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>Annuler</Button>
        <Button variant="primary" onClick={handleSubmit}>Créer</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default SignupModal;
