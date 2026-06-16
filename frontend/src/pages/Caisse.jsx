import React, { useEffect, useState, useCallback } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/App.scss';
import VenteSelector from '../components/VenteSelector';
import CategorieSelector from '../components/CategorieSelector';
import BoutonsCaisse from '../components/BoutonsCaisse';
import TicketVente from '../components/TicketVente';
import ValidationVente from '../components/ValidationVente';
import PreTicketQueue from '../components/PreTicketQueue';
import { toast } from 'react-toastify';
import { useLocation } from 'react-router-dom';
import { useActiveSession } from '../contexts/SessionCaisseContext';
import { useConfirm } from "../contexts/ConfirmContext";
import { apiUrl } from '../utils/apiBase';


function Caisse() {
  const activeSession = useActiveSession();
  const [boutons, setBoutons] = useState({});
  const [categories, setCategories] = useState([]);
  const [categorieActive, setCategorieActive] = useState('');
  const [ticketModif, setTicketModif] = useState([]);
  const [modifs, setModifs] = useState({});
  const [ventes, setVentes] = useState([]);
  const [venteActive, setVenteActive] = useState(null);
  const [ouvert, setOuvert] = useState(false);
    console.log("🧪 activeSession:", activeSession);


  useEffect(() => {
  fetch(apiUrl('/api/produits/organises'), { credentials: 'include' })
    .then(res => res.json())
    .then(data => {
      setBoutons(data);

      // Construire [{ nom, color }]
      const cats = Object.entries(data).map(([nomCat, sousCats]) => {
        // Cherche la 1ère couleur trouvée dans les produits de la catégorie
        let color = 'secondary';
        const firstSousCat = Object.values(sousCats)[0]; // tableau d’items
        if (Array.isArray(firstSousCat) && firstSousCat.length > 0) {
          color = firstSousCat[0]?.color || 'secondary';
        }
        return { nom: nomCat, color };
      });

      setCategories(cats);
      if (cats.length > 0) setCategorieActive(cats[0].nom);
    })
    .catch(err => console.error('Erreur fetch /organises:', err));
}, []);



  const chargerVentes = useCallback(() => {
    fetch(apiUrl('/api/ventes'), { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setVentes(data);
        if (!venteActive && data.length > 0) {
          setVenteActive(data[0].id_temp_vente);
        }
      });
  }, [venteActive]);

  const chargerTicket = useCallback((idOverride = null) => {
    

    const id = idOverride || venteActive;
    if (!id) return;
    fetch(apiUrl(`/api/ticket/${id}`), { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setTicketModif(data);
        setModifs({});
      });
  }, [venteActive]);

  useEffect(() => {
    chargerVentes();
  }, [chargerVentes]);

  useEffect(() => {
    chargerTicket();
  }, [chargerTicket]);

  const location = useLocation();
      useEffect(() => {
        if (location.state?.toastMessage) {
          toast.success(location.state.toastMessage);
          window.history.replaceState({}, document.title);
        }
      }, [location.state]);

  const nouvelleVente = () => {
    fetch(apiUrl('/api/ventes'), { method: 'POST', credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setVenteActive(data.id_temp_vente);
        chargerVentes();
      });
  };

  const ajouterAuTicket = (produit) => {
    if (!venteActive) return;
    fetch(apiUrl('/api/ticket'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id_produit: produit.id_bouton, quantite: 1, id_temp_vente: venteActive })
    })
      .then(() => chargerTicket())
      .catch(err => console.error('Erreur dans fetch ticket:', err));
  };

  const supprimerArticle = (id) => {
    fetch(apiUrl(`/api/ticket/${id}`), { method: 'DELETE', credentials: 'include' })
      .then(() => chargerTicket());
  };

  const handleInputChange = (id, champ, valeur) => {
    const nouveau = ticketModif.map(item =>
      item.id === id ? { ...item, [champ]: valeur } : item
    );
    setTicketModif(nouveau);
    setModifs(prev => ({
      ...prev,
      [id]: { ...prev[id], [champ]: valeur }
    }));
  };

  const enregistrerModifs = (id) => {
    chargerTicket();
  };

  const confirm = useConfirm();

   const annulerVente = async () => {
    if (!venteActive) return;
    const ok = await confirm({
      title: "Annuler la vente",
      message: "Confirmer l'annulation de la vente ?",
      confirmText: "Oui, annuler",
      cancelText: "Non",
      variant: "warning",
    });
    if (!ok) return;

    fetch(apiUrl(`/api/ventes/${venteActive}`), {
      method: 'DELETE',
      credentials: 'include'
    })
      .then(() => {
        setVenteActive(null);
        setTicketModif([]);
        setModifs({});
        chargerVentes();
      })
      .catch(err => console.error("Erreur lors de l'annulation :", err));
  };


  const totalTicket = ticketModif.reduce((sum, item) => sum + item.prixt, 0);

  const recupererPreTicket = (idTempVente) => {
    setVenteActive(idTempVente);
    chargerVentes();
    chargerTicket(idTempVente);
    setOuvert(false);
  };

  /* if (!sessionCaisseOuverte) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center h-100">
        <h1 className="display-4 text-center">
          Caisse fermée, merci d'ouvrir une session caisse, svp.
        </h1>
        <Link to="/ouverture-caisse" className="btn btn-primary mt-4">
          Ouvrir la caisse
        </Link>
      </div>
    );
  } */

  return (
    <div className="container-fluid p-0 h-100 d-flex flex-column overflow-hidden">

      <PreTicketQueue onRecovered={recupererPreTicket} />

      <div className="bg-light border-bottom sticky-top py-2 px-3" style={{ overflowX: 'auto', whiteSpace: 'nowrap', zIndex: 1020 }}>
        <div className="d-inline-flex gap-2">
          <VenteSelector
            ventes={ventes}
            venteActive={venteActive}
            onSelect={setVenteActive}
            onNew={nouvelleVente}
          />
          <button
            className="btn btn-sm btn-outline-danger mt-3"
            onClick={annulerVente}
          >
            ❌ Annuler la vente
          </button>
        </div>
      </div>

      <div className="row flex-grow-1 m-0 h-100 overflow-hidden">
        <div className="col-md-2 bg-light h-100 overflow-auto pt-3">
          <CategorieSelector
            categories={categories}                 // ✅ objets { nom, color }
            active={categorieActive}
            onSelect={setCategorieActive}           // onSelect reçoit le nom
          />
        </div>

          <div className="col-md-6 d-flex flex-column bg-light h-100 p-0">
            <div className="flex-grow-1 overflow-auto pt-3 px-3">
            <h4>{categorieActive}</h4>
            {venteActive ? (
              categorieActive && boutons[categorieActive] && (
                <BoutonsCaisse produits={boutons[categorieActive]} onClick={ajouterAuTicket} />
              )
            ) : (
              <div className="alert alert-info text-center my-5">
                <h5>Merci de cliquer sur <strong>Nouvelle Vente</strong> svp.</h5>
              </div>
            )}
          </div>

          {/* Ce menu est contenu dans le div, et pas en position fixe */}
          <div className="border-top bg-white shadow-sm">
            <div className="d-flex justify-content-center">
              <button
                onClick={() => setOuvert(!ouvert)}
                className="btn btn-outline-secondary my-2"
              >
                {ouvert ? '↓ Fermer' : '↑ Valider la vente'}
              </button>
            </div>

            <div
              className="transition-custom overflow-hidden"
              style={{
                maxHeight: ouvert ? '1000px' : '0px', // Suffisamment grand
                transition: 'max-height 0.3s ease-in-out'
              }}
            >

              {venteActive && (
                <div className="p-3">
                  <ValidationVente
                    total={totalTicket}
                    id_temp_vente={venteActive}
                    onValide={() => {
                      setVenteActive(null);
                      chargerVentes();
                      setTicketModif([]);
                      setOuvert(false);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-4 bg-light pt-3 d-flex flex-column h-100 overflow-hidden">
          <div className="overflow-auto px-3" style={{ flex: 1 }}>
            <TicketVente
              ticket={ticketModif}
              modifs={modifs}
              onChange={handleInputChange}
              onDelete={supprimerArticle}
              onSave={enregistrerModifs}
            />
          </div>
          <div className="border-top p-3 bg-white text-center fw-bold fs-4 shadow-sm">
            Total : {(totalTicket / 100).toFixed(2)} €
          </div>
        </div>
      </div>
    </div>
  );
}

export default Caisse;
