import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import CategorieSelector from './CategorieSelector';
import BoutonsCaisse from './BoutonsCaisse';
import { useSessionCaisse } from '../contexts/SessionCaisseContext';
import TactileInput from './TactileInput';
import { useActiveSession } from '../contexts/SessionCaisseContext';


function CorrectionModal({ show, onHide, ticketOriginal, onSuccess }) {
const activeSession = useActiveSession();

const uuidSessionCaisse = activeSession?.uuid_session || null;
const sessionCaisseOuverte = !!activeSession;

  const [corrections, setCorrections] = useState(
    (ticketOriginal.objets || []).map(obj => ({ ...obj }))
  );
  const [correctionsInitiales, setCorrectionsInitiales] = useState(() =>
    (ticketOriginal.objets || []).map(obj => ({ ...obj }))
  );
  const [articlesSupprimes, setArticlesSupprimes] = useState([]);

  const [motif, setMotif] = useState('');
  const [loading, setLoading] = useState(false);
  // Change moyenPaiement to an array of payment objects, similar to ValidationVente
  const [paiements, setPaiements] = useState(() => {
    // Initialize payments from ticketOriginal if available, otherwise default to a single payment
    if (ticketOriginal.ticket.moyen_paiement && ticketOriginal.ticket.montant_paiements) {
      // Assuming montant_paiements is an array of objects { moyen: string, montant: number (in cents) }
      return ticketOriginal.ticket.montant_paiements.map(p => ({
        moyen: p.moyen,
        montant: (p.montant / 100).toFixed(2).replace('.', ',')
      }));
    } else {
      // Default to one payment, e.g., 'carte' with the initial total
      const initialTotal = (ticketOriginal.objets || []).reduce((sum, a) => sum + a.prix * a.nbr, 0);
      return [{ moyen: 'carte', montant: (initialTotal / 100).toFixed(2).replace('.', ',') }];
    }
  });


  const totalAvant = correctionsInitiales.reduce((sum, a) => sum + a.prix * a.nbr, 0);

  const [reductionOriginale, setReductionOriginale] = useState(() => {
    const reducs = ticketOriginal.objets?.filter(o => o.nom.toLowerCase().includes('réduction'));
    if (reducs && reducs.length === 1) {
      const nom = reducs[0].nom.toLowerCase();
      if (nom.includes('gros panier bénévole')) return 'trueGrosPanierBene';
      if (nom.includes('gros panier client')) return 'trueGrosPanierClient';
      if (nom.includes('fidélité bénévole')) return 'trueBene';
      if (nom.includes('fidélité client')) return 'trueClient';
    }
    return '';
  });

  const [reductionType, setReductionType] = useState('');

  useEffect(() => {
    if (reductionOriginale) setReductionType(reductionOriginale);
  }, [reductionOriginale]);

  // Reset state whenever a new ticket is loaded
  useEffect(() => {
    setCorrections((ticketOriginal.objets || []).map(obj => ({ ...obj })));
    setCorrectionsInitiales((ticketOriginal.objets || []).map(obj => ({ ...obj })));
    setArticlesSupprimes([]);
    setMotif('');
    setLoading(false);

    if (ticketOriginal.ticket.moyen_paiement && ticketOriginal.ticket.montant_paiements) {
      setPaiements(
        ticketOriginal.ticket.montant_paiements.map(p => ({
          moyen: p.moyen,
          montant: (p.montant / 100).toFixed(2).replace('.', ',')
        }))
      );
    } else {
      const initialTotal = (ticketOriginal.objets || []).reduce((sum, a) => sum + a.prix * a.nbr, 0);
      setPaiements([{ moyen: 'carte', montant: (initialTotal / 100).toFixed(2).replace('.', ',') }]);
    }

    const reducs = ticketOriginal.objets?.filter(o => o.nom.toLowerCase().includes('réduction'));
    let red = '';
    if (reducs && reducs.length === 1) {
      const nom = reducs[0].nom.toLowerCase();
      if (nom.includes('gros panier bénévole')) red = 'trueGrosPanierBene';
      else if (nom.includes('gros panier client')) red = 'trueGrosPanierClient';
      else if (nom.includes('fidélité bénévole')) red = 'trueBene';
      else if (nom.includes('fidélité client')) red = 'trueClient';
    }
    setReductionOriginale(red);
    setReductionType(red || '');
  }, [ticketOriginal]);

  // Helper function to parse amount string to cents
  const parseMontant = (str) => {
    if (!str) return 0;
    const normalise = str.replace(',', '.');
    const nombre = parseFloat(normalise);
    return isNaN(nombre) ? 0 : Math.round(nombre * 100);
  };


  const handleChange = (index, field, value) => {
    const updated = [...corrections];
    if (field === 'nbr') {
      updated[index][field] = parseInt(value);
    } else if (field === 'prix') {
      updated[index][field] = Math.round(parseFloat(value.replace(',', '.')) * 100);
    } else {
      updated[index][field] = value;
    }
    setCorrections(updated);
  };

  // Supprime un article de la liste des corrections et l'ajoute à la liste des articles supprimés
  const supprimerArticle = (index) => {
    const updated = [...corrections];
    const removed = updated.splice(index, 1);
    setCorrections(updated);
    setArticlesSupprimes([...articlesSupprimes, removed[0]]);
  };

  // Restaure le dernier article supprimé
  const restaurerDernierArticle = () => {
    if (articlesSupprimes.length === 0) return;
    const last = articlesSupprimes[articlesSupprimes.length - 1];
    setCorrections([...corrections, last]);
    setArticlesSupprimes(articlesSupprimes.slice(0, -1));
  };

  // Calcule le total avant réduction initiale (pour affichage) - Keep as is
  const totalAvantReductionInitiale = () => {
    if (!reductionOriginale) return totalAvant;
    if (reductionOriginale === 'trueClient') return totalAvant + 500;
    if (reductionOriginale === 'trueBene') return totalAvant + 1000;
    if (reductionOriginale === 'trueGrosPanierClient') return Math.round(totalAvant / 0.9);
    if (reductionOriginale === 'trueGrosPanierBene') return Math.round(totalAvant / 0.8);
    return totalAvant;
  };

  // Calcule le total après application de la réduction sélectionnée
  const totalApresReduction = () => {
    const totalSansReduction = corrections
      .filter(c => !c.nom.toLowerCase().includes('réduction'))
      .reduce((sum, a) => sum + a.prix * a.nbr, 0);

    let total = totalSansReduction;
    if (reductionType === 'trueClient') total -= 500;
    else if (reductionType === 'trueBene') total -= 1000;
    else if (reductionType === 'trueGrosPanierClient') total = Math.round(total * 0.9);
    else if (reductionType === 'trueGrosPanierBene') total = Math.round(total * 0.8);
    return total < 0 ? 0 : total;
  };

  const totalCorrige = totalApresReduction(); // Calculate once

  // New functions for managing payments (copied and adapted from ValidationVente)
  const totalPaiements = paiements.reduce((s, p) => s + parseMontant(p.montant), 0);

  const corrigerTotalPaiementsExact = (paiementsModifiés) => {
    const copie = [...paiementsModifiés];
    const totalCents = copie.reduce((s, p) => s + parseMontant(p.montant), 0);
    const delta = totalCorrige - totalCents; // Use totalCorrige here

    if (copie.length === 0) return copie;

    const dernierIndex = copie.length - 1;
    const montantDernier = parseMontant(copie[dernierIndex].montant);
    const nouveauMontant = Math.max(montantDernier + delta, 0);

    copie[dernierIndex].montant = (nouveauMontant / 100).toFixed(2).replace('.', ',');
    return copie;
  };

  const ajouterPaiement = () => {
    setPaiements([...paiements, { moyen: '', montant: '' }]);
  };

  const supprimerPaiement = (index) => {
    const copie = [...paiements];
    copie.splice(index, 1);
    setPaiements(corrigerTotalPaiementsExact(copie));
  };

  const modifierPaiement = (index, champ, valeur) => {
    const copie = [...paiements];
    copie[index][champ] = valeur;
    const corrigé = corrigerTotalPaiementsExact(copie);
    setPaiements(corrigé);
  };

  useEffect(() => {
    // Adjust payments automatically when totalCorrige changes and only one payment method is present
    if (paiements.length === 1) {
      const montantActuel = parseMontant(paiements[0].montant);
      if (montantActuel !== totalCorrige) {
        setPaiements([{
          ...paiements[0],
          montant: (totalCorrige / 100).toFixed(2).replace('.', ',')
        }]);
      }
    }
  }, [totalCorrige, paiements.length]); // Added paiements.length as a dependency


  // Envoie la correction au backend après vérifications
  const envoyerCorrection = async () => {
    // Vérifie que le motif est renseigné
    if (!motif.trim()) return alert('Merci de préciser un motif.');

    // Check if at least one payment method is selected and amounts match
    if (paiements.length === 0) {
      return alert('Merci de spécifier au moins un mode de paiement.');
    }

    if (totalPaiements !== totalCorrige) {
      return alert(
        `Le total des paiements (${(totalPaiements / 100).toFixed(2)} €) ne correspond pas au total corrigé du ticket (${(totalCorrige / 100).toFixed(2)} €).`
      );
    }

    const body = {
      uuid_ticket_original: ticketOriginal.ticket.uuid_ticket,
      articles_origine: ticketOriginal.objets,
      articles_correction: corrections,
      motif,
      uuid_session_caisse: uuidSessionCaisse,
      // Pass the array of payments
      paiements: paiements.map(p => ({
        moyen: p.moyen,
        montant: parseMontant(p.montant)
      })),
      reductionType
    };

    if (!sessionCaisseOuverte || !uuidSessionCaisse) {
      alert("Aucune session caisse ouverte !");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      const result = await res.json();
      if (result.success) {
        alert('Correction enregistrée.');
        onSuccess();
        onHide();
      } else {
        alert('Erreur lors de la correction.');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  };

  const estUneReduction = (article) => article.nom.toLowerCase().includes('réduction');

  const [showBoutonsModal, setShowBoutonsModal] = useState(false);
  const [categorieActive, setCategorieActive] = useState('');
  const [produits, setProduits] = useState({});

  useEffect(() => {
    fetch('http://localhost:3001/api/produits/organises')
      .then(res => res.json())
      .then(data => setProduits(data));
  }, []);

  const ajouterProduit = (prod) => {
    const nouvelArticle = {
      nom: prod.nom,
      prix: prod.prix,
      nbr: 1,
      categorie: prod.categorie || 'Inconnue'
    };
    setCorrections(prev => [...prev, nouvelArticle]);
  };


  return (
    <>
      <Modal show={show} onHide={onHide} size="lg" backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>Corriger le ticket #{ticketOriginal.ticket.id_ticket}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {corrections.map((art, i) => {
            const isReduction = estUneReduction(art);
            return (
              <div className="d-flex gap-2 mb-2" key={i}>
                <Form.Control value={art.nom} disabled />
                <TactileInput
                  type="number"
                  className="form-control"
                  value={art.nbr}
                  onChange={(e) => handleChange(i, 'nbr', e.target.value)}
                  disabled={isReduction}
                />
                <TactileInput
                  type="number"
                  className="form-control"
                  step="0.01"
                  value={(art.prix / 100).toFixed(2)}
                  onChange={(e) => handleChange(i, 'prix', e.target.value)}
                  disabled={isReduction}
                />
                <Form.Control value={art.categorie} disabled />
                <Button variant="danger" onClick={() => supprimerArticle(i)} disabled={isReduction}>✖</Button>
              </div>
            );
          })}

          {articlesSupprimes.length > 0 && (
            <div className="text-end">
              <Button size="sm" variant="secondary" onClick={restaurerDernierArticle}>
                ↺ Annuler la dernière suppression
              </Button>
            </div>
          )}

          <Button variant="success" className="mt-3" onClick={() => setShowBoutonsModal(true)}>
            ➕ Ajouter un article
          </Button>

          <div className="mt-3">
            <strong>Total avant correction :</strong> {(totalAvant / 100).toFixed(2)} €<br />
            <strong>Total après correction :</strong> {(totalCorrige / 100).toFixed(2)} €
          </div>

          {/* Payment selection logic */}
          <div className="mb-2 mt-3">
            <Form.Label>Modes de paiement :</Form.Label>
            {paiements.map((p, index) => (
              <div className="d-flex mb-1" key={index}>
                <Form.Select
                  className="me-2"
                  value={p.moyen}
                  onChange={e => modifierPaiement(index, 'moyen', e.target.value)}
                >
                  <option value="">Mode...</option>
                  <option value="espèces">Espèces</option>
                  <option value="carte">Carte</option>
                  <option value="chèque">Chèque</option>
                  <option value="virement">Virement</option>
                </Form.Select>
                <TactileInput
                  type="number"
                  className="form-control"
                  placeholder="Montant en euros"
                  value={p.montant}
                  onChange={e => modifierPaiement(index, 'montant', e.target.value)}
                />
                {paiements.length > 1 && (
                  <Button
                    variant="outline-danger"
                    onClick={() => supprimerPaiement(index)}
                    title="Supprimer ce paiement"
                    className="ms-2"
                  >
                    ❌
                  </Button>
                )}
              </div>
            ))}
            <Button size="sm" variant="secondary" className="w-100 mt-2" onClick={ajouterPaiement}>+ Ajouter un paiement</Button>
          </div>
          <div>Total saisi pour les paiements : {(totalPaiements / 100).toFixed(2)} €</div>


          <Form.Group className="mt-3">
            <Form.Label>Type de réduction</Form.Label>
            <Form.Select value={reductionType} onChange={(e) => setReductionType(e.target.value)}>
              <option value="">Aucune</option>
              <option value="trueClient">Fidélité client (-5€)</option>
              <option value="trueBene">Fidélité bénévole (-10€)</option>
              <option value="trueGrosPanierClient">Gros panier client (-10%)</option>
              <option value="trueGrosPanierBene">Gros panier bénévole (-20%)</option>
            </Form.Select>
          </Form.Group>

          <Form.Group className="mt-3">
            
            <Form.Group className="mt-3">
  <Form.Label>Motif de correction</Form.Label>
  <TactileInput
    as="textarea"
    rows={2}
    className="form-control"
    value={motif}
    onChange={(e) => setMotif(e.target.value)}
    placeholder="Exemple : erreur de quantité saisie par le caissier"
  />
</Form.Group>

          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Annuler</Button>
          <Button variant="warning" onClick={envoyerCorrection} disabled={loading}>
            {loading ? 'Correction en cours...' : 'Valider la correction'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showBoutonsModal} onHide={() => setShowBoutonsModal(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Ajouter un article</Modal.Title>
        </Modal.Header>
        <Modal.Body className="d-flex" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ minWidth: '200px' }}>
            <CategorieSelector
              categories={Object.keys(produits)}
              active={categorieActive}
              onSelect={setCategorieActive}
            />
          </div>
          <div className="flex-grow-1 ps-4">
            {categorieActive && (
              <BoutonsCaisse
                produits={produits[categorieActive]}
                onClick={(prod) => {
                  ajouterProduit(prod);
                  setShowBoutonsModal(false);
                }}
              />
            )}
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}

export default CorrectionModal;