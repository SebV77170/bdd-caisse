import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import CategorieSelector from '../components/CategorieSelector';
import BoutonsCaisse from '../components/BoutonsCaisse';
import TactileInput from '../components/TactileInput';
import { apiUrl } from '../utils/apiBase';
import './PreTicketTablette.css';

function formatEuros(cents) {
  return (cents / 100).toFixed(2).replace('.', ',');
}

function PreTicketTablette() {
  const [boutons, setBoutons] = useState({});
  const [categories, setCategories] = useState([]);
  const [categorieActive, setCategorieActive] = useState('');
  const [preTicket, setPreTicket] = useState(null);
  const [items, setItems] = useState([]);
  const [clientLabel, setClientLabel] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [busy, setBusy] = useState(false);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.prixt, 0),
    [items]
  );

  useEffect(() => {
    fetch(apiUrl('/api/produits/organises'), { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setBoutons(data);
        const cats = Object.entries(data).map(([nomCat, sousCats]) => {
          let color = 'secondary';
          const firstSousCat = Object.values(sousCats)[0];
          if (Array.isArray(firstSousCat) && firstSousCat.length > 0) {
            color = firstSousCat[0]?.color || 'secondary';
          }
          return { nom: nomCat, color };
        });
        setCategories(cats);
        if (cats.length > 0) setCategorieActive(cats[0].nom);
      })
      .catch(() => toast.error('Impossible de charger les produits'));
  }, []);

  const syncDetails = useCallback((data) => {
    setPreTicket(data);
    setItems(data.items || []);
    setClientLabel(data.client_label || '');
    setCommentaire(data.commentaire || '');
  }, []);

  const creerPreTicket = useCallback(async () => {
    const res = await fetch(apiUrl('/api/pre-tickets'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_name: window.navigator?.userAgent?.includes('Android') ? 'Tablette' : 'Poste distant',
        client_label: clientLabel || null,
        commentaire: commentaire || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Creation impossible');
    setPreTicket(data);
    return data;
  }, [clientLabel, commentaire]);

  const ensurePreTicket = useCallback(async () => {
    if (preTicket) return preTicket;
    return creerPreTicket();
  }, [creerPreTicket, preTicket]);

  const ajouterAuPreTicket = async (produit) => {
    try {
      const current = await ensurePreTicket();
      const res = await fetch(apiUrl(`/api/pre-tickets/${current.uuid_pre_ticket}/items`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_produit: produit.id_bouton, quantite: 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ajout impossible');
      syncDetails(data);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const modifierItem = async (id, champ, valeur) => {
    if (!preTicket) return;
    const body = champ === 'prix'
      ? { prix: Math.round(Number(String(valeur).replace(',', '.')) * 100) }
      : { nbr: Number.parseInt(valeur, 10) };

    try {
      const res = await fetch(apiUrl(`/api/pre-tickets/${preTicket.uuid_pre_ticket}/items/${id}`), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Modification impossible');
      syncDetails(data);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const supprimerItem = async (id) => {
    if (!preTicket) return;
    try {
      const res = await fetch(apiUrl(`/api/pre-tickets/${preTicket.uuid_pre_ticket}/items/${id}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Suppression impossible');
      syncDetails(data);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const envoyerPreTicket = async () => {
    if (!preTicket || items.length === 0 || busy) return;
    setBusy(true);
    try {
      await fetch(apiUrl(`/api/pre-tickets/${preTicket.uuid_pre_ticket}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_label: clientLabel || null,
          commentaire: commentaire || null,
        }),
      });
      const res = await fetch(apiUrl(`/api/pre-tickets/${preTicket.uuid_pre_ticket}/envoyer`), {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Envoi impossible');
      toast.success('Pre-ticket envoye a la caisse');
      setPreTicket(null);
      setItems([]);
      setClientLabel('');
      setCommentaire('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const nouveauPreTicket = async () => {
    if (items.length > 0) {
      toast.info('Envoyez ou videz le pre-ticket en cours avant de recommencer.');
      return;
    }
    try {
      const data = await creerPreTicket();
      syncDetails({ ...data, items: [] });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="pre-ticket-tablet">
      <div className="pre-ticket-floating-submit">
        <div>
          <span>Total</span>
          <strong>{formatEuros(total)} EUR</strong>
        </div>
        <button
          className="btn btn-primary"
          disabled={busy || items.length === 0}
          onClick={envoyerPreTicket}
        >
          Transmettre a la caisse principale
        </button>
      </div>

      <aside className="pre-ticket-categories">
        <button className="btn btn-success w-100 mb-3" onClick={nouveauPreTicket}>
          Nouveau
        </button>
        <CategorieSelector
          categories={categories}
          active={categorieActive}
          onSelect={setCategorieActive}
        />
      </aside>

      <main className="pre-ticket-products">
        <div className="pre-ticket-toolbar">
          <div>
            <h1>{categorieActive || 'Produits'}</h1>
            <span>{items.length} ligne(s)</span>
          </div>
          <div className="pre-ticket-meta">
            <TactileInput
              className="form-control"
              placeholder="Repere client"
              value={clientLabel}
              onChange={(event) => setClientLabel(event.target.value)}
            />
            <TactileInput
              className="form-control"
              placeholder="Note"
              value={commentaire}
              onChange={(event) => setCommentaire(event.target.value)}
            />
          </div>
        </div>

        <div className="pre-ticket-product-scroll">
          {categorieActive && boutons[categorieActive] ? (
            <BoutonsCaisse produits={boutons[categorieActive]} onClick={ajouterAuPreTicket} />
          ) : (
            <div className="alert alert-info">Chargement des produits...</div>
          )}
        </div>
      </main>

      <aside className="pre-ticket-current">
        <h2>Pre-ticket</h2>
        <div className="pre-ticket-items">
          {items.length === 0 ? (
            <div className="pre-ticket-empty">Touchez les produits pour preparer le panier.</div>
          ) : (
            items.map(item => (
              <div className="pre-ticket-line" key={item.id}>
                <button className="btn btn-sm btn-outline-danger" onClick={() => supprimerItem(item.id)}>
                  X
                </button>
                <div className="pre-ticket-line-name">{item.nom}</div>
                <TactileInput
                  type="number"
                  className="form-control"
                  value={item.nbr}
                  onChange={(event) => modifierItem(item.id, 'nbr', event.target.value)}
                />
                <TactileInput
                  type="text"
                  isDecimal="true"
                  className="form-control"
                  value={formatEuros(item.prix)}
                  onChange={(event) => modifierItem(item.id, 'prix', event.target.value)}
                />
                <strong>{formatEuros(item.prixt)} EUR</strong>
              </div>
            ))
          )}
        </div>
        <div className="pre-ticket-total">
          <span>Total</span>
          <strong>{formatEuros(total)} EUR</strong>
        </div>
        <button
          className="btn btn-primary btn-lg w-100"
          disabled={busy || items.length === 0}
          onClick={envoyerPreTicket}
        >
          Transmettre a la caisse principale
        </button>
      </aside>
    </div>
  );
}

export default PreTicketTablette;
