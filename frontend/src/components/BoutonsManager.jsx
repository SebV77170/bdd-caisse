import React, { useEffect, useState } from 'react';
import { Table, Button, Form } from 'react-bootstrap';

const api = 'http://localhost:3001';

const BoutonsManager = () => {
  const [boutons, setBoutons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newBouton, setNewBouton] = useState({ nom: '', prix: '', id_cat: '', id_souscat: '' });

  const parsePrix = (str) => {
    if (!str) return 0;
    const normalise = str.replace(',', '.');
    const nombre = parseFloat(normalise);
    return isNaN(nombre) ? 0 : Math.round(nombre * 100);
  };

  useEffect(() => {
    fetch(`${api}/api/boutons`)
      .then(res => res.json())
      .then(setBoutons);
    fetch(`${api}/api/categories`)
      .then(res => res.json())
      .then(setCategories);
  }, []);

  const rootCats = categories.filter(c => c.parent_id === 'parent');
  const subCats = idCat => {
    const cat = rootCats.find(c => String(c.id) === String(idCat));
    if (!cat) return [];
    return categories.filter(sc => sc.parent_id === cat.category);
  };

  const handleChange = (index, field, value) => {
    const updated = [...boutons];
    if (field === 'prix') {
      updated[index] = { ...updated[index], prix: parsePrix(value) };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setBoutons(updated);
  };

  const saveBouton = (b) => {
    const payload = {
      nom: b.nom,
      prix: b.prix,
      id_cat: b.id_cat ? parseInt(b.id_cat, 10) : null,
      id_souscat: b.id_souscat ? parseInt(b.id_souscat, 10) : null
    };
    fetch(`${api}/api/boutons/${b.id_bouton}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(() => {});
  };

  const deleteBouton = id => {
    fetch(`${api}/api/boutons/${id}`, { method: 'DELETE' })
      .then(() => setBoutons(boutons.filter(b => b.id_bouton !== id)));
  };

  const addBouton = () => {
    const payload = {
      nom: newBouton.nom,
      prix: parsePrix(newBouton.prix),
      id_cat: newBouton.id_cat ? parseInt(newBouton.id_cat, 10) : null,
      id_souscat: newBouton.id_souscat ? parseInt(newBouton.id_souscat, 10) : null
    };
    fetch(`${api}/api/boutons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (data.id) {
          setBoutons([...boutons, { ...payload, id_bouton: data.id }]);
          setNewBouton({ nom: '', prix: '', id_cat: '', id_souscat: '' });
        }
      });
  };

  return (
    <div className="mt-4">
      <h4>Boutons de caisse</h4>
      <Table bordered size="sm">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Prix (€)</th>
            <th>Catégorie</th>
            <th>Sous-catégorie</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {boutons.map((b, i) => (
            <tr key={b.id_bouton}>
              <td>
                <Form.Control value={b.nom} onChange={e => handleChange(i, 'nom', e.target.value)} />
              </td>
              <td>
                <Form.Control
                  type="text"
                  inputMode="decimal"
                  value={(b.prix / 100).toFixed(2)}
                  onChange={e => handleChange(i, 'prix', e.target.value)}
                />
              </td>
              <td>
                <Form.Select value={b.id_cat || ''} onChange={e => handleChange(i, 'id_cat', e.target.value)}>
                  <option value="">--</option>
                  {rootCats.map(c => (
                    <option key={c.id} value={c.id}>{c.category}</option>
                  ))}
                </Form.Select>
              </td>
              <td>
                <Form.Select value={b.id_souscat || ''} onChange={e => handleChange(i, 'id_souscat', e.target.value)}>
                  <option value="">--</option>
                  {subCats(b.id_cat).map(sc => (
                    <option key={sc.id} value={sc.id}>{sc.category}</option>
                  ))}
                </Form.Select>
              </td>
              <td>
                <Button variant="success" size="sm" onClick={() => saveBouton(b)} className="me-2">💾</Button>
                <Button variant="danger" size="sm" onClick={() => deleteBouton(b.id_bouton)}>🗑</Button>
              </td>
            </tr>
          ))}
          <tr>
            <td>
              <Form.Control value={newBouton.nom} onChange={e => setNewBouton({ ...newBouton, nom: e.target.value })} />
            </td>
            <td>
              <Form.Control
                type="text"
                inputMode="decimal"
                value={newBouton.prix}
                onChange={e => setNewBouton({ ...newBouton, prix: e.target.value })}
              />
            </td>
            <td>
              <Form.Select value={newBouton.id_cat} onChange={e => setNewBouton({ ...newBouton, id_cat: e.target.value, id_souscat: '' })}>
                <option value="">--</option>
                {rootCats.map(c => (
                  <option key={c.id} value={c.id}>{c.category}</option>
                ))}
              </Form.Select>
            </td>
            <td>
              <Form.Select value={newBouton.id_souscat} onChange={e => setNewBouton({ ...newBouton, id_souscat: e.target.value })}>
                <option value="">--</option>
                {subCats(newBouton.id_cat).map(sc => (
                  <option key={sc.id} value={sc.id}>{sc.category}</option>
                ))}
              </Form.Select>
            </td>
            <td>
              <Button variant="primary" size="sm" onClick={addBouton}>Ajouter</Button>
            </td>
          </tr>
        </tbody>
      </Table>
    </div>
  );
};

export default BoutonsManager;
