import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import CompteEspeces from '../components/compteEspeces';
import AffichageEcarts from '../components/AffichageEcarts';
import BilanSessionCaisse from '../components/BilanSessionCaisse';
import BilanReductionsSession from '../components/BilanReductionsSession';
import TactileInput from '../components/TactileInput';
import { useSessionCaisse } from '../contexts/SessionCaisseContext';
import { set } from 'date-fns';
import { euro } from '../utils/euro';


// Composant principal pour la fermeture de caisse
function FermetureCaisse() {
  // États pour les différents champs du formulaire et données de la caisse
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
  const { uuidSessionCaisse, sessionCaisseOuverte,  refreshSessionCaisse } = useSessionCaisse();

  // Affiche l'UUID de la session caisse dans la console (debug)
  console.log("UUID session caisse en contexte :", uuidSessionCaisse);

  // Gestion de la soumission du formulaire de fermeture de caisse
  const handleSubmit = async (e) => {
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

        refreshSessionCaisse();
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
    fetch('http://localhost:3001/api/bilan/reductions_session_caisse?uuid_session_caisse=' + uuidSessionCaisse)
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
    fetch('http://localhost:3001/api/bilan/bilan_session_caisse?uuid_session_caisse=' + uuidSessionCaisse)
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

        {/* Formulaire de fermeture de caisse */}
        <form onSubmit={handleSubmit}>
          {/* ✅ Intégration du tableau des espèces */}
          <CompteEspeces onChangeTotal={(total) => setMontantReel(total)} />
          <div></div>
          <div>
            <label>Montant réel dans la caisse (€) :</label><br />
            <TactileInput
              type="number"
              value={montantReel}
              onChange={(e) => setMontantReel(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Montant réel des transactions Sumup (€) :</label><br />
            <TactileInput
              type="number"
              value={montantReelCarte}
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

        {/* Affiche les notifications toast */}
        <ToastContainer position="top-center" autoClose={3000} />
      </div>
    </div>
  );
}

export default FermetureCaisse;
