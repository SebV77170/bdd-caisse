import React, { useEffect, useState, useCallback, useRef, useContext } from 'react';
import { Table, Button, Form, Spinner } from 'react-bootstrap';
import TactileInput from '../components/TactileInput';
import { ModeTactileContext } from '../contexts/ModeTactileContext';
import { useConfirm } from "../contexts/ConfirmContext";


const api = 'http://localhost:3001';

function formatEuroFromCents(cents) {
  const n = Number.isFinite(cents) ? cents : 0;
  return (n / 100).toFixed(2).replace('.', ',');
}
function parseCentsFromInput(str) {
  if (str === null || str === undefined) return 0;
  const s = String(str).replace(',', '.').trim();
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

const BoutonsManager = () => {
  const { modeTactile } = useContext(ModeTactileContext);

  const [boutons, setBoutons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newBouton, setNewBouton] = useState({ nom: '', prix: '', id_cat: '', id_souscat: '' });
  const confirm = useConfirm();

  // refs par ligne (par id_bouton)
  const prixRef = useRef({});
  const nomRef = useRef({});
  const catRef = useRef({});
  const souscatRef = useRef({});

  const refetchBoutons = useCallback(() => {
    return fetch(`${api}/api/boutons`)
      .then(r => r.json())
      .then(setBoutons);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      refetchBoutons(),
      fetch(`${api}/api/categories`).then(r => r.json()).then(setCategories),
    ]).finally(() => setLoading(false));
  }, [refetchBoutons]);

  const rootCats = categories.filter(c => c.parent_id === 'parent');
  const subCats = (idCat) => {
    const cat = rootCats.find(c => String(c.id) === String(idCat));
    if (!cat) return [];
    return categories.filter(sc => sc.parent_id === cat.category);
  };

  // --- SAVE helpers (PUT)
  const putUpdate = (id_bouton, partial) => {
  const row = boutons.find(x => x.id_bouton === id_bouton);
  if (!row) return Promise.reject(new Error('Ligne introuvable'));

  const payload = {
    nom: partial.nom ?? row.nom,
    prix: Number.isFinite(partial.prix) ? partial.prix : row.prix, // centimes
    id_cat: partial.id_cat ?? row.id_cat ?? null,
    id_souscat: partial.id_souscat ?? row.id_souscat ?? null,
    // on ne passe pas sous_categorie : le backend la recalcule si besoin
  };

  return fetch(`${api}/api/boutons/${id_bouton}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(r => (r.ok ? r.json() : Promise.reject(r)));
};

  const handleSavePrix = async (bId, raw) => {
    if (raw === undefined || raw === null || String(raw).trim() === '') return;
    const prix = parseCentsFromInput(raw);
    await putUpdate(bId, { prix });
    await refetchBoutons();
  };

  const handleSaveNom = async (bId, raw) => {
    const nom = String(raw ?? '').trim();
    if (!nom) return;
    await putUpdate(bId, { nom });
    await refetchBoutons();
  };

  const handleSaveQuantique = async (bId, field, raw) => {
    // pour id_cat / id_souscat depuis <select>
    const v = raw === '' ? null : parseInt(raw, 10);
    await putUpdate(bId, { [field]: v });
    await refetchBoutons();
  };

  // --- DELETE
 const deleteBouton = async (id) => {
    const ok = await confirm({
      title: "Supprimer le bouton",
      message: "Confirmer la suppression de ce bouton ?",
      confirmText: "Supprimer",
      cancelText: "Annuler",
      variant: "danger",
    });
    if (!ok) return;
    await fetch(`${api}/api/boutons/${id}`, { method: 'DELETE' });
    await refetchBoutons();
  };

  // --- ADD
  const addBouton = async () => {
    const payload = {
      nom: (newBouton.nom || '').trim(),
      prix: parseCentsFromInput(newBouton.prix),
      id_cat: newBouton.id_cat ? parseInt(newBouton.id_cat, 10) : null,
      id_souscat: newBouton.id_souscat ? parseInt(newBouton.id_souscat, 10) : null,
    };
    if (!payload.nom) return;
    await fetch(`${api}/api/boutons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setNewBouton({ nom: '', prix: '', id_cat: '', id_souscat: '' });
    await refetchBoutons();
  };

  return (
    <div className="mt-4">
      <h4>Boutons de caisse</h4>
      {loading ? (
        <div className="py-4"><Spinner animation="border" size="sm" /> Chargement…</div>
      ) : (
        <Table bordered size="sm">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Prix (€)</th>
              <th>Catégorie</th>
              <th>Sous-catégorie</th>
              <th style={{width: 140}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {boutons.map((b) => {
              const prixAff = formatEuroFromCents(b.prix);
              return (
                <tr key={b.id_bouton}>
                  {/* NOM */}
                  <td>
                    {modeTactile ? (
                      <TactileInput
                        type="text"
                        value={b.nom ?? ''}
                        isDecimal={false}
                        onChange={(e) => handleSaveNom(b.id_bouton, e.target.value)}
                        className="form-control"
                      />
                    ) : (
                      <>
                        <input
                          type="text"
                          defaultValue={b.nom ?? ''}
                          ref={el => nomRef.current[b.id_bouton] = el}
                          onBlur={() => handleSaveNom(b.id_bouton, nomRef.current[b.id_bouton].value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveNom(b.id_bouton, nomRef.current[b.id_bouton].value);
                          }}
                          className="form-control"
                        />
                      </>
                    )}
                  </td>

                  {/* PRIX (euros affichés, centimes envoyés) */}
                  <td style={{maxWidth: 140}}>
                    {modeTactile ? (
                      <TactileInput
                        type="number"
                        value={prixAff}
                        isDecimal={true}
                        onChange={(e) => handleSavePrix(b.id_bouton, e.target.value)}
                        className="form-control"
                      />
                    ) : (
                      <>
                        <input
                          type="text"
                          defaultValue={prixAff}
                          ref={el => prixRef.current[b.id_bouton] = el}
                          onBlur={() => handleSavePrix(b.id_bouton, prixRef.current[b.id_bouton].value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSavePrix(b.id_bouton, prixRef.current[b.id_bouton].value);
                          }}
                          className="form-control"
                        />
                        <button
                          className="btn btn-sm btn-outline-success ms-1 px-2 py-0"
                          style={{ fontSize: '0.8rem', height: 30 }}
                          onClick={() => handleSavePrix(b.id_bouton, prixRef.current[b.id_bouton].value)}
                          title="Sauvegarder prix"
                        >
                          💾
                        </button>
                      </>
                    )}
                  </td>

                  {/* CAT */}
                  <td>
                    <Form.Select
                      defaultValue={b.id_cat || ''}
                      ref={el => catRef.current[b.id_bouton] = el}
                      onChange={(e) => handleSaveQuantique(b.id_bouton, 'id_cat', e.target.value)}
                    >
                      <option value="">--</option>
                      {rootCats.map(c => (
                        <option key={c.id} value={c.id}>{c.category}</option>
                      ))}
                    </Form.Select>
                  </td>

                  {/* SOUS-CAT dépendante */}
                  <td>
                    <Form.Select
                      defaultValue={b.id_souscat || ''}
                      ref={el => souscatRef.current[b.id_bouton] = el}
                      onChange={(e) => handleSaveQuantique(b.id_bouton, 'id_souscat', e.target.value)}
                    >
                      <option value="">--</option>
                      {subCats(b.id_cat).map(sc => (
                        <option key={sc.id} value={sc.id}>{sc.category}</option>
                      ))}
                    </Form.Select>
                  </td>

                  {/* ACTIONS */}
                  <td>
                    <Button variant="danger" size="sm" onClick={() => deleteBouton(b.id_bouton)}>🗑</Button>
                  </td>
                </tr>
              );
            })}

            {/* Ligne d’ajout */}
            <tr>
              <td>
                {modeTactile ? (
                  <TactileInput
                    type="text"
                    value={newBouton.nom}
                    isDecimal={false}
                    onChange={(e) => setNewBouton({ ...newBouton, nom: e.target.value })}
                    className="form-control"
                  />
                ) : (
                  <Form.Control
                    value={newBouton.nom}
                    onChange={e => setNewBouton({ ...newBouton, nom: e.target.value })}
                  />
                )}
              </td>
              <td>
                {modeTactile ? (
                  <TactileInput
                    type="number"
                    value={newBouton.prix}
                    isDecimal={true}
                    onChange={(e) => setNewBouton({ ...newBouton, prix: e.target.value })}
                    className="form-control"
                    placeholder="0,00"
                  />
                ) : (
                  <Form.Control
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={newBouton.prix}
                    onChange={e => setNewBouton({ ...newBouton, prix: e.target.value })}
                  />
                )}
              </td>
              <td>
                <Form.Select
                  value={newBouton.id_cat}
                  onChange={e => setNewBouton({ ...newBouton, id_cat: e.target.value, id_souscat: '' })}
                >
                  <option value="">--</option>
                  {rootCats.map(c => (
                    <option key={c.id} value={c.id}>{c.category}</option>
                  ))}
                </Form.Select>
              </td>
              <td>
                <Form.Select
                  value={newBouton.id_souscat}
                  onChange={e => setNewBouton({ ...newBouton, id_souscat: e.target.value })}
                >
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
      )}
    </div>
  );
};

export default BoutonsManager;
