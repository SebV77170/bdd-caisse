import React, { useState, useEffect } from 'react';
import { useSessionCaisse } from '../contexts/SessionCaisseContext';

// Composant de validation de la vente, gestion des paiements et réductions
function ValidationVente({ total, id_temp_vente, onValide }) {
  const [reduction, setReduction] = useState('');
  const [reductionsDisponibles, setReductionsDisponibles] = useState([]);
  const [paiements, setPaiements] = useState([{ moyen: 'carte', montant: (total / 100).toFixed(2).replace('.', ',') }]);
  const [codePostal, setCodePostal] = useState('');
  const [email, setEmail] = useState('');
  const { uuidSessionCaisse, sessionCaisseOuverte } = useSessionCaisse();

  console.log("UUID session caisse en contexte :", uuidSessionCaisse);


  const totalAvecReduction = React.useMemo(() => {
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
      if (!reduction) {
        setReduction('trueGrosPanierClient');
      }
    }
  }, [total]);

  useEffect(() => {
    if (paiements.length === 1) {
      const montantActuel = parseMontant(paiements[0].montant);
      if (montantActuel !== totalAvecReduction) {
        setPaiements([{
          ...paiements[0],
          montant: (totalAvecReduction / 100).toFixed(2).replace('.', ',')
        }]);
      }
    }
  }, [totalAvecReduction]);

  const parseMontant = (str) => {
    if (!str) return 0;
    const normalise = str.replace(',', '.');
    const nombre = parseFloat(normalise);
    return isNaN(nombre) ? 0 : Math.round(nombre * 100);
  };

  const totalPaiements = paiements.reduce((s, p) => s + parseMontant(p.montant), 0);

  const corrigerTotalPaiementsExact = (paiementsModifiés) => {
    const copie = [...paiementsModifiés];
    const totalCents = copie.reduce((s, p) => s + parseMontant(p.montant), 0);
    const delta = totalAvecReduction - totalCents;

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

  // Fonction appelée lors de la validation de la vente
  const validerVente = () => {
    // Vérifie qu'une session caisse est ouverte
    if (!sessionCaisseOuverte || !uuidSessionCaisse) {
      alert("Aucune session caisse ouverte !");
      return;
    }

    // Vérifie que le total des paiements correspond au total attendu
    if (totalPaiements !== totalAvecReduction) {
      alert('Le total des paiements ne correspond pas au montant à payer.');
      return;
    }

    // Prépare les paiements en centimes pour l'envoi au backend
    const paiementsCentimes = paiements.map(p => ({
      moyen: p.moyen,
      montant: parseMontant(p.montant)
    }));

    // Prépare les données à envoyer au backend
    const data = {
      id_temp_vente,
      uuid_session_caisse: uuidSessionCaisse,
      reductionType: reduction || null,
      paiements: paiementsCentimes,
      code_postal: codePostal || null,
      email: email || null
    };

    // Envoie la requête de validation de la vente au backend
    fetch('http://localhost:3001/api/valider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          alert('Vente validée avec succès');
          if (email) {
            alert(`Un ticket sera envoyé à : ${email}`);
          }
          onValide();
        } else {
          alert('Erreur pendant validation');
        }
      })
      .catch(err => {
        console.error('Erreur lors de la validation', err);
        alert('Erreur de communication');
      });
  };

  return (
    <div className="p-3 bg-white border rounded shadow-sm">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <h5 className="me-3">Finaliser la vente</h5>
        <div className="d-flex gap-2">
          <input
            type="text"
            className="form-control form-control-sm"
            style={{ maxWidth: '100px' }}
            placeholder="Code postal"
            value={codePostal}
            onChange={e => setCodePostal(e.target.value)}
          />
          <input
            type="email"
            className="form-control form-control-sm"
            style={{ maxWidth: '180px' }}
            placeholder="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div className="mb-2">
        <label>Réduction :</label>
        <select className="form-select" value={reduction} onChange={(e) => setReduction(e.target.value)}>
          <option value="">Aucune</option>
          {reductionsDisponibles.map(red => (
            <option key={red.value} value={red.value}>{red.label}</option>
          ))}
        </select>
      </div>

      <div>Total à payer après réduction : {(totalAvecReduction / 100).toFixed(2)} €</div>

      <div className="mb-2">
        <label>Paiements :</label>
        {paiements.map((p, index) => (
          <div className="d-flex mb-1" key={index}>
            <select
              className="form-select me-2"
              value={p.moyen}
              onChange={e => modifierPaiement(index, 'moyen', e.target.value)}
            >
              <option value="">Mode...</option>
              <option value="espèces">Espèces</option>
              <option value="carte">Carte</option>
              <option value="chèque">Chèque</option>
              <option value="virement">Virement</option>
            </select>
            <input
              type="text"
              className="form-control me-2"
              placeholder="Montant en euros"
              value={p.montant}
              onChange={e => modifierPaiement(index, 'montant', e.target.value)}
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
        <button className="btn btn-sm btn-secondary w-100 mt-2" onClick={ajouterPaiement}>+ Ajouter un paiement</button>
      </div>

      <div>Total saisi : {(totalPaiements / 100).toFixed(2)} €</div>

      <button className="btn btn-success w-100 mt-3" onClick={validerVente}>Valider la vente</button>
    </div>
  );
}

export default ValidationVente;
