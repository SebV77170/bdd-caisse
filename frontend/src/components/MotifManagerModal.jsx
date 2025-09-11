import React, { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { toast } from 'react-toastify';

function MotifManagerModal({ show, onHide, motifs = [], refreshMotifs }) {
  const [newMotif, setNewMotif] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const handleAdd = async () => {
    const motif = newMotif.trim();
    if (!motif) return;
    try {
      const res = await fetch('/api/motifs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motif })
      });
      if (!res.ok) throw new Error('Erreur serveur');
      setNewMotif('');
      await refreshMotifs();
      toast.success('Motif ajouté');
    } catch (err) {
      toast.error('Impossible d\'ajouter le motif');
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      const res = await fetch('/api/motifs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (!res.ok) throw new Error('Erreur serveur');
      setSelectedIds(new Set());
      await refreshMotifs();
      toast.success('Motif(s) supprimé(s)');
    } catch (err) {
      toast.error('Impossible de supprimer');
    }
  };

  const onClose = () => {
    setNewMotif('');
    setSelectedIds(new Set());
    onHide();
  };

  return (
    <Modal show={show} onHide={onClose} backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Gestion des motifs</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={(e) => { e.preventDefault(); handleAdd(); }}>
          <Form.Group className="mb-3">
            <Form.Label>Nouveau motif</Form.Label>
            <Form.Control
              type="text"
              value={newMotif}
              onChange={(e) => setNewMotif(e.target.value)}
              placeholder="Saisir un motif"
            />
          </Form.Group>
          <Button variant="primary" onClick={handleAdd} disabled={!newMotif.trim()}>Ajouter</Button>
        </Form>
        <hr />
        <Form>
          {motifs.map(m => (
            <Form.Check
              key={m.id}
              type="checkbox"
              label={m.motif}
              checked={selectedIds.has(m.id)}
              onChange={() => toggleSelect(m.id)}
            />
          ))}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="danger" onClick={handleDelete} disabled={!selectedIds.size}>
          Supprimer sélection
        </Button>
        <Button variant="secondary" onClick={onClose}>Fermer</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default MotifManagerModal;
