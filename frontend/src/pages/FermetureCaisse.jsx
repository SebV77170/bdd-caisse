import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import CompteEspeces from '../components/compteEspeces';
import AffichageEcarts from '../components/AffichageEcarts';
import BilanSessionCaisse from '../components/BilanSessionCaisse';
import BilanReductionsSession from '../components/BilanReductionsSession';
import TactileInput from '../components/TactileInput';
import { useActiveSession } from '../contexts/SessionCaisseContext';
import { set } from 'date-fns';
import { euro } from '../utils/euro';
import SiCaissePrincipale from '../utils/SiCaissePrincipale';
import SiCaisseSecondaire from '../utils/SiCaisseSecondaire';


// Composant principal pour la fermeture de caisse
function FermetureCaisse() {
  // États pour les différents champs du formulaire et données de la caisse
  const activeSession = useActiveSession();
  const [fondInitial, setFondInitial] = useState(null);
  const [montantReel, setMontantReel] = useState('');
  const [attendu, setAttendu] = useState(null);
  const [montantReelCarte, setMontantReelCarte] = useState('');
  const [montantReelCheque, setMontantReelCheque] = useState('0');
  const [montantReelVirement, setMontantReelVirement] = useState('0');
  const [commentaire, setCommentaire] = useState('');
  const [responsablePseudo, setResponsablePseudo] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [reductions, setReductions] = useState(null);
  const navigate = useNavigate();
  const uuidSessionCaisse = activeSession?.uuid_session || null;
  const sessionCaisseOuverte = activeSession;
  const [useCompteEspeces, setUseCompteEspeces] = useState(false); // ✅ NEW


  // Affiche l'UUID de la session caisse dans la console (debug)
  console.log("UUID session caisse en contexte :", uuidSessionCaisse);

  // --- HANDLER CAISSE PRINCIPALE ---
  // Gestion de la soumission du formulaire de fermeture de caisse
  const handleSubmitPrincipal = async (e) => {
    e.preventDefault();

    // Vérifie qu'une session caisse est ouverte
    if (!sessionCaisseOuverte || !uuidSessionCaisse) {
      alert("Aucune session caisse ouverte !");
      return;
    }

    // Vérifie que les champs obligatoires sont remplis
    if (!montantReel || !responsablePseudo || !motDePasse) {
      toast.error('Tous les champs obligatoires doivent être remplis');
      return;
    }

    try {
      // Envoie les données de fermeture au backend
      const res = await fetch('http://localhost:3001/api/caisse/fermeture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          montant_reel: euro(montantReel).intValue,
          montant_reel_carte: euro(montantReelCarte).intValue,
          montant_reel_cheque: euro(montantReelCheque).intValue,
          montant_reel_virement: euro(montantReelVirement).intValue,
          commentaire,
          uuid_session_caisse: uuidSessionCaisse,
          responsable_pseudo: responsablePseudo,
          mot_de_passe: motDePasse
        })
      });

      const data = await res.json();

      // Affiche un toast selon le résultat
      if (data.success) {
        console.log(data.success);

    // On redirige et on transmet un message dans l’état de navigation
    navigate('/Bilan', {
      state: { toastMessage: 'Caisse fermée avec succès !' }
    });
  } else {
        toast.error(data.error || 'Erreur lors de la fermeture');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur de communication avec le serveur');
    }
  };

  // --- HANDLER CAISSE SECONDAIRE ---
  // Ferme la caisse secondaire + envoie vers la principale (route unique côté backend)
  const handleSubmitSecondaire = async (e) => {
    e.preventDefault();
    if (!uuidSessionCaisse) return toast.error("Aucune session caisse ouverte !");
    if (!responsablePseudo || !motDePasse) {
      return toast.error('Pseudo responsable et mot de passe requis');
    }
    try {
      const res = await fetch('http://localhost:3001/api/sync/envoyer-secondaire-vers-principal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          // le backend ferme officiellement la session secondaire AVANT d’envoyer :
          commentaire,
          uuid_session_caisse: uuidSessionCaisse,
          responsable_pseudo: responsablePseudo,
          mot_de_passe: motDePasse
          // (les montants peuvent être omis: le backend mettra 0 par défaut si tu as suivi la logique proposée)
        })
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`✅ Données envoyées (${result.ids?.length || 0}) & caisse secondaire fermée.`);
        navigate('/Bilan', { state: { toastMessage: 'Caisse secondaire fermée et synchronisée !' } });
      } else {
        toast.error('❌ Échec de l’envoi : ' + (result.message || 'Erreur inconnue.'));
      }
    } catch (err) {
      console.error(err);
      toast.error('❌ Erreur de communication avec le serveur.');
    }
  };


  // Récupère le fond initial déclaré à l'ouverture de la caisse
  useEffect(() => {
    fetch('http://localhost:3001/api/caisse/fermeture/fond_initial')
      .then(res => res.json())
      .then(data => {
        if (data.fond_initial !== undefined) {
          setFondInitial(data.fond_initial/100);
        } else {
          console.error('Fond initial introuvable');
        }
      })
      .catch(err => {
        console.error('Erreur de récupération du fond initial :', err);
      });
  }, []);

  // Récupère les réductions appliquées sur la session
  useEffect(() => {
    if (!uuidSessionCaisse) return;
    fetch('http://localhost:3001/api/bilan/reductions_session_caisse?uuid_session_caisse=' + uuidSessionCaisse,{credentials: 'include',})
      .then(res => res.json())
      .then(data => {
        console.log('Réductions récupérées :', data); // 👈 Ici pour voir les résultats
        setReductions(data);
      })
      .catch(err => {
        console.error('Erreur récupération réductions :', err);
        setReductions({});
      });
  }, [uuidSessionCaisse]);


  // Récupère les montants attendus pour la session de caisse en cours
  useEffect(() => {
    // Récupération des montants attendus depuis la table "bilan"
    fetch('http://localhost:3001/api/bilan/bilan_session_caisse?uuid_session_caisse=' + uuidSessionCaisse,{credentials: 'include'})
      .then(res => res.json())
      .then(data => {
        setAttendu({
          nombreVentes: data.nombre_ventes ?? 0,
          espece: (data.prix_total_espece) ?? 0,
          carte: (data.prix_total_carte) ?? 0,
          cheque: (data.prix_total_cheque) ?? 0,
          virement: (data.prix_total_virement) ?? 0,
          total: (data.prix_total) ?? 0
        });
      })
      .catch((err) => {
        console.error('Erreur lors du chargement du bilan :', err);
        setAttendu({
          espece: 0,
          carte: 0,
          cheque: 0,
          virement: 0
        });
      });
  }, []);

  // Rendu du composant principal de fermeture de caisse
  return (
    <div className="bilan-scroll-container">
      <div style={{ padding: 20, maxWidth: 500, margin: 'auto' }}>
        <h2>Fermeture de caisse</h2>
        <div>
          <label>Fond Initial déclaré (€) :</label><br />
          <div>
            {fondInitial}
          </div>
        </div>
        {/* Affiche le bilan de la session de caisse */}
        <BilanSessionCaisse
          nbVentes={attendu?.nombreVentes ?? 0}
          totalPaiements={{
            espece: attendu?.espece ?? 0,
            carte: attendu?.carte ?? 0,
            cheque: attendu?.cheque ?? 0,
            virement: attendu?.virement ?? 0
          }}
        />
        {reductions && (
          <BilanReductionsSession reductions={reductions} />
        )}

       <SiCaissePrincipale>
          <form onSubmit={handleSubmitPrincipal}>
            {/* ✅ Toggle d'utilisation du calculateur espèces */}
            <div style={{ margin: '12px 0' }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={useCompteEspeces}
                  onChange={(e) => {
                    setUseCompteEspeces(e.target.checked);
                    // Optionnel : si on désactive, on garde la valeur actuelle dans le champ manuel.
                    // Si tu préfères réinitialiser : setMontantReel('');
                  }}
                />
                Utiliser le calculateur d'espèces
              </label>
              <small style={{ opacity: 0.8 }}>
                Coche pour compter les espèces billet/pièce. Décoche pour saisir le montant total à la main.
              </small>
            </div>

            {/* ✅ Affichage conditionnel du composant espèces */}
            {useCompteEspeces && (
              <>
                <CompteEspeces onChangeTotal={(total) => setMontantReel(total)} />
                <div style={{ marginTop: 8 }}>
                  <strong>Montant réel (calculé) :</strong>{' '}
                  {montantReel || '0'}
                </div>
              </>
            )}

            {/* ✅ Saisie manuelle uniquement si le calculateur n'est pas utilisé */}
            {!useCompteEspeces && (
              <div style={{ marginTop: 10 }}>
                <label>Montant réel dans la caisse (€) :</label><br />
                <TactileInput
                  type="number"
                  value={montantReel}
                  onChange={(e) => setMontantReel(e.target.value)}
                  required={!useCompteEspeces}     // requis seulement en mode manuel
                />
              </div>
            )}
          <div>
            <label>Montant réel des transactions Sumup (€) :</label><br />
            <TactileInput
              type="number"
              value={montantReelCarte}
              isDecimal={true}
              onChange={(e) => setMontantReelCarte(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Montant réel des chèques (€) :</label><br />
            <TactileInput
              type="number"
              value={montantReelCheque}
              onChange={(e) => setMontantReelCheque(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Montant réel des virement (€) :</label><br />
            <TactileInput
              type="number"
              value={montantReelVirement}
              onChange={(e) => setMontantReelVirement(e.target.value)}
              required
            />
          </div>
          {/* Affiche les écarts entre attendu et réel */}
          <AffichageEcarts
            attendu={{
              espece: (attendu?.espece + fondInitial*100 ?? 0),
              carte: (attendu?.carte ?? 0),
              cheque: (attendu?.cheque ?? 0),
              virement: (attendu?.virement ?? 0),
            }}
            reel={{
              espece: montantReel*100,           // en centimes
              carte: montantReelCarte*100,
              cheque: montantReelCheque*100,
              virement: montantReelVirement*100
            }}
            fondInitial={fondInitial*100}
          />
          <div>
            <label>Commentaire (facultatif) :</label><br />
            <TactileInput
              as="textarea"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Votre message"
            />
          </div>
          <div>
            <label>Pseudo du responsable :</label><br />
            <TactileInput
              type="text"
              value={responsablePseudo}
              onChange={(e) => setResponsablePseudo(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Mot de passe du responsable :</label><br />
            <TactileInput
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
            />
          </div>
          <button type="submit" style={{ marginTop: 10 }}>Fermer la caisse</button>
        </form>
        </SiCaissePrincipale>

        <SiCaisseSecondaire>
             {/* Formulaire de fermeture de caisse */}
        <form onSubmit={handleSubmitSecondaire}>
          
          <div>
            <label>Commentaire (facultatif) :</label><br />
            <TactileInput
              as="textarea"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Votre message"
            />
          </div>
          <div>
            <label>Pseudo du responsable :</label><br />
            <TactileInput
              type="text"
              value={responsablePseudo}
              onChange={(e) => setResponsablePseudo(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Mot de passe du responsable :</label><br />
            <TactileInput
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
            />
          </div>
          <button type="submit" style={{ marginTop: 10 }}>Fermer la caisse et envoyer à la caisse principale</button>
        </form>
        </SiCaisseSecondaire>

      </div>
    </div>
  );
}

export default FermetureCaisse;
