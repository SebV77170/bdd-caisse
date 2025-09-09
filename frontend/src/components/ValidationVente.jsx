import React, { useState, useEffect, useMemo, useContext } from 'react';
import TactileInput from './TactileInput';
import { useActiveSession } from '../contexts/SessionCaisseContext';
import { toast } from 'react-toastify';
import { Modal, Button } from 'react-bootstrap';
import { ModePaiementBoutonsContext } from '../contexts/ModePaiementBoutonsContext';

const PAYMENT_METHODS = ['especes', 'carte', 'cheque', 'virement'];
const METHOD_LABELS = {
  especes: 'Espèces',
  carte: 'Carte',
  cheque: 'Chèque',
  virement: 'Virement',
};

function ValidationVente({ total, id_temp_vente, onValide }) {
  const activeSession = useActiveSession();
  const { modePaiementBoutons } = useContext(ModePaiementBoutonsContext);
  const [reduction, setReduction] = useState('');
  const [reductionsDisponibles, setReductionsDisponibles] = useState([]);
  const [paiements, setPaiements] = useState([
    { moyen: 'carte', montant: (total / 100).toFixed(2).replace('.', ',') },
  ]);
  const [codePostal, setCodePostal] = useState('');
  const [email, setEmail] = useState('');
  const [showMixte, setShowMixte] = useState(false);
  const uuidSessionCaisse = activeSession?.uuid_session || null;

  // 💶 ESPÈCES — états modale/calculette
  const [showCash, setShowCash] = useState(false);
  const [montantDonne, setMontantDonne] = useState(''); // string "12,34"

  const parseMontant = (str) => {
    if (!str) return 0;
    const normalise = String(str).replace(',', '.');
    const nombre = parseFloat(normalise);
    return isNaN(nombre) ? 0 : Math.round(nombre * 100);
  };
  const fmtEuros = (cents) => (cents / 100).toFixed(2).replace('.', ',');

  const totalAvecReduction = useMemo(() => {
    let t = total;
    switch (reduction) {
      case 'trueClient':
        t -= 500;
        break;
      case 'trueBene':
        t -= 1000;
        break;
      case 'trueGrosPanierClient':
        t = Math.round(total * 0.9);
        break;
      case 'trueGrosPanierBene':
        t = Math.round(total * 0.8);
        break;
      default:
        break;
    }
    return Math.max(t, 0);
  }, [total, reduction]);

  useEffect(() => {
    if (total < 5000) {
      setReductionsDisponibles([
        { value: 'trueClient', label: 'Fidélité Client (-5€)' },
        { value: 'trueBene', label: 'Fidélité Bénévole (-10€)' },
      ]);
      if (reduction === 'trueGrosPanierClient' || reduction === 'trueGrosPanierBene') {
        setReduction('');
      }
    } else {
      const grosPanier = [
        { value: 'trueGrosPanierClient', label: 'Gros Panier Client (-10%)' },
        { value: 'trueGrosPanierBene', label: 'Gros Panier Bénévole (-20%)' },
      ];
      setReductionsDisponibles(grosPanier);
      if (!reduction) setReduction('trueGrosPanierClient');
    }
  }, [total]); // eslint-disable-line

  // Si un seul paiement, garder l’auto-ajustement sur le montant
  useEffect(() => {
    if (paiements.length === 1) {
      const montantActuel = parseMontant(paiements[0].montant);
      if (montantActuel !== totalAvecReduction) {
        setPaiements([
          {
            ...paiements[0],
            montant: fmtEuros(totalAvecReduction),
          },
        ]);
      }
    }
  }, [totalAvecReduction]); // eslint-disable-line

  const totalPaiements = useMemo(
    () => paiements.reduce((s, p) => s + parseMontant(p.montant), 0),
    [paiements]
  );

  const corrigerTotalPaiementsExact = (paiementsModifies) => {
    const copie = [...paiementsModifies];
    const totalCents = copie.reduce((s, p) => s + parseMontant(p.montant), 0);
    const delta = totalAvecReduction - totalCents;

    if (copie.length === 0) return copie;

    const dernierIndex = copie.length - 1;
    const montantDernier = parseMontant(copie[dernierIndex].montant);
    const nouveauMontant = Math.max(montantDernier + delta, 0);

    copie[dernierIndex].montant = fmtEuros(nouveauMontant);
    return copie;
  };

  // Moyens déjà utilisés (optionnellement en excluant une ligne)
  const usedMethods = (exceptIndex = null) => {
    return paiements
      .map((p, i) => (i === exceptIndex ? null : p.moyen))
      .filter(Boolean);
  };

  // Options disponibles pour une ligne donnée
  const optionsForIndex = (index) => {
    const used = new Set(usedMethods(index));
    const current = paiements[index]?.moyen || null;
    return PAYMENT_METHODS.filter((m) => m === current || !used.has(m));
  };

  const ajouterPaiement = () => {
    const used = new Set(usedMethods());
    const next = PAYMENT_METHODS.find((m) => !used.has(m));

    if (!next) {
      toast.info('Tous les moyens de paiement sont déjà sélectionnés.');
      return;
    }

    const reste = Math.max(totalAvecReduction - totalPaiements, 0);
    const nouveau = {
      moyen: next,
      montant: fmtEuros(reste),
    };

    const corriges = corrigerTotalPaiementsExact([...paiements, nouveau]);
    setPaiements(corriges);
  };

  const supprimerPaiement = (index) => {
    const copie = [...paiements];
    copie.splice(index, 1);
    setPaiements(corrigerTotalPaiementsExact(copie));
  };

  const modifierPaiement = (index, champ, valeur) => {
    const copie = [...paiements];

    if (champ === 'moyen') {
      const dejaPris = usedMethods(index);
      if (dejaPris.includes(valeur)) {
        toast.warn('Ce moyen est déjà utilisé.');
        return;
      }
    }

    copie[index][champ] = valeur;
    const corrige = corrigerTotalPaiementsExact(copie);
    setPaiements(corrige);
  };

  const validerVente = (paiementsOverride = paiements) => {
    if (!activeSession || !uuidSessionCaisse) {
      toast.error('Aucune session caisse ouverte !');
      return;
    }

    const totalLocal = paiementsOverride.reduce((s, p) => s + parseMontant(p.montant), 0);
    if (totalLocal !== totalAvecReduction) {
      toast.error('Le total des paiements ne correspond pas au montant à payer.');
      return;
    }

    const paiementsCentimes = paiementsOverride.map((p) => ({
      moyen: p.moyen,
      montant: parseMontant(p.montant),
    }));

    const data = {
      id_temp_vente,
      uuid_session_caisse: uuidSessionCaisse,
      reductionType: reduction || null,
      paiements: paiementsCentimes,
      code_postal: codePostal || null,
      email: email || null,
    };

    fetch('http://localhost:3001/api/valider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((result) => {
        console.log('Résultat serveur :', result);
        if (result.success) {
          toast.success('Vente validée avec succès');
          if (!reduction) {
            const tampons = Math.floor(totalAvecReduction / 500);
            toast.success(`Ajoutez ${tampons} tampon(s) sur la carte de fidélité`);
          }
          if (email) {
            toast.success(`Un ticket sera envoyé à : ${email}`);
          }

          window.electron?.ensureInteractiveLight?.();
          onValide();

          requestAnimationFrame(() => {
            window.electron?.ensureInteractiveRaise?.();
          });
        } else {
          toast.error('Erreur pendant validation');
        }
      })
      .catch((err) => {
        console.error('Erreur lors de la validation', err);
        toast.error('Erreur de communication');
      });
  };

  const validerPaiementDirect = (moyen) => {
    const unique = [
      { moyen, montant: fmtEuros(totalAvecReduction) },
    ];
    validerVente(unique);
  };

  let nombreTampons = 0;
  if (total < 5000) {
    nombreTampons = Math.floor(total / 500);
  }

  // 🧮💶 ==================  Calculette "Espèces"  ==================
  const cashGivenCents = parseMontant(montantDonne);
  const changeCents = Math.max(cashGivenCents - totalAvecReduction, 0);
  const manqueCents = Math.max(totalAvecReduction - cashGivenCents, 0);
  const peutValiderCash = cashGivenCents >= totalAvecReduction;

  const addToMontantDonne = (addCents) => {
    const newCents = cashGivenCents + addCents;
    setMontantDonne(fmtEuros(newCents));
  };
  const setExact = () => setMontantDonne(fmtEuros(totalAvecReduction));
  const clearMontant = () => setMontantDonne('');

  const appendChar = (char) => {
    // mini pavé numérique
    if (char === '←') {
      setMontantDonne((prev) => (prev || '').slice(0, -1));
    } else if (char === ',' && !(montantDonne || '').includes(',')) {
      setMontantDonne((prev) => (prev || '') + ',');
    } else if (/^\d$/.test(char)) {
      setMontantDonne((prev) => (prev || '') + char);
    } else if (char === 'C') {
      clearMontant();
    }
  };

  const quickNextMultiple = (stepCents) => {
    const due = totalAvecReduction;
    const next = Math.ceil(due / stepCents) * stepCents;
    return next;
  };

  // =================================================================

  const formulairePaiements = (
    <div className="mb-2">
      <label>Paiements :</label>
      {paiements.map((p, index) => (
        <div className="d-flex mb-1" key={index}>
          <select
            className="form-select me-2"
            value={p.moyen}
            onChange={(e) => modifierPaiement(index, 'moyen', e.target.value)}
          >
            {optionsForIndex(index).map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </select>

          <TactileInput
            type="text"
            isDecimal="true"
            className="form-control me-2"
            placeholder="Montant en euros"
            value={p.montant}
            onChange={(e) => modifierPaiement(index, 'montant', e.target.value)}
          />

          {paiements.length > 1 && (
            <button
              className="btn btn-outline-danger"
              onClick={() => supprimerPaiement(index)}
              title="Supprimer ce paiement"
            >
              ❌
            </button>
          )}
        </div>
      ))}
      <button className="btn btn-sm btn-secondary w-100 mt-2" onClick={ajouterPaiement}>
        + Ajouter un paiement
      </button>
    </div>
  );

  return (
    <div className="p-3 bg-white border rounded shadow-sm">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <h5 className="me-3">Finaliser la vente</h5>
        <div className="d-flex gap-2">
          <TactileInput
            type="text"
            isDecimal="true"
            className="form-control form-control-sm"
            style={{ maxWidth: '100px' }}
            placeholder="Code postal"
            value={codePostal}
            onChange={(e) => setCodePostal(e.target.value)}
          />
          <TactileInput
            type="email"
            className="form-control form-control-sm"
            style={{ maxWidth: '180px' }}
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div className="mb-2">
        <label>Réduction :</label>
        <select className="form-select" value={reduction} onChange={(e) => setReduction(e.target.value)}>
          <option value="">Aucune</option>
          {reductionsDisponibles.map((red) => (
            <option key={red.value} value={red.value}>
              {red.label}
            </option>
          ))}
        </select>
      </div>

      <div>Total à payer après réduction : {fmtEuros(totalAvecReduction)} €</div>
      <div>Nombre de tampons à ajouter : {nombreTampons}</div>

      {modePaiementBoutons ? (
        <>
          <div className="mt-3 d-flex flex-wrap gap-2">
            <button className="btn btn-success flex-fill" onClick={() => validerPaiementDirect('carte')}>
              Carte
            </button>
            {/* 🔁 ICI on ouvre la modale espèces au lieu de valider direct */}
            <button className="btn btn-success flex-fill" onClick={() => { setMontantDonne(''); setShowCash(true); }}>
              Espèces
            </button>
            <button className="btn btn-success flex-fill" onClick={() => validerPaiementDirect('virement')}>
              Virement
            </button>
            <button className="btn btn-success flex-fill" onClick={() => validerPaiementDirect('cheque')}>
              Chèque
            </button>
            <button className="btn btn-warning flex-fill" onClick={() => setShowMixte(true)}>
              Mixte
            </button>
          </div>

          {/* 🧮💶 Modale ESPÈCES */}
          <Modal show={showCash} onHide={() => setShowCash(false)}>
            <Modal.Header closeButton>
              <Modal.Title>Encaissement en espèces</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="mb-2 d-flex justify-content-between">
                <div><strong>À payer :</strong></div>
                <div>{fmtEuros(totalAvecReduction)} €</div>
              </div>

              <div className="mb-2">
                <label className="form-label">Montant donné par le client</label>
                <TactileInput
                  type="text"
                  isDecimal="true"
                  className="form-control"
                  placeholder="0,00"
                  value={montantDonne}
                  onChange={(e) => setMontantDonne(e.target.value)}
                />
              </div>

              {/* Résultat rendu */}
              <div className="d-flex justify-content-between align-items-center">
                
                  
                    <div className="fs-6"><strong>À rendre :</strong></div>
                    <div className="fs-4">{fmtEuros(changeCents)} €</div>
                 
                
              </div>

            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowCash(false)}>Annuler</Button>
              <Button
                variant="success"
                onClick={() => {
                  // On valide la vente en "Espèces" pour le montant dû,
                  // et on informe le rendu.
                  setShowCash(false);
                  if (changeCents > 0) {
                    toast.info(`Rendre ${fmtEuros(changeCents)} €`);
                  }
                  validerPaiementDirect('especes');
                }}
              >
                Encaisser & valider
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Modale Paiement mixte (inchangé) */}
          <Modal show={showMixte} onHide={() => setShowMixte(false)}>
            <Modal.Header closeButton>
              <Modal.Title>Paiement mixte</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {formulairePaiements}
              <div>Total saisi : {fmtEuros(totalPaiements)} €</div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowMixte(false)}>
                Fermer
              </Button>
              <Button variant="primary" onClick={() => { validerVente(); setShowMixte(false); }}>
                Valider
              </Button>
            </Modal.Footer>
          </Modal>
        </>
      ) : (
        <>
          {formulairePaiements}
          <div>Total saisi : {fmtEuros(totalPaiements)} €</div>
          <button className="btn btn-success w-100 mt-3" onClick={() => validerVente()}>
            Valider la vente
          </button>
        </>
      )}
    </div>
  );
}

export default ValidationVente;
