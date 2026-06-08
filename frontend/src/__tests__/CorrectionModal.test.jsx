import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CorrectionModal from '../components/CorrectionModal';
import { ModeTactileContext } from '../contexts/ModeTactileContext';
import { toast } from 'react-toastify';

let mockActiveSession = { uuid_session: 'session-1' };

jest.mock('../contexts/SessionCaisseContext', () => ({
  useActiveSession: () => mockActiveSession
}));

jest.mock('../components/TactileInput', () => {
  return function MockTactileInput({ isDecimal, ...props }) {
    return <input {...props} />;
  };
});
jest.mock('../components/CategorieSelector', () => () => <div>Catégories</div>);
jest.mock('../components/BoutonsCaisse', () => () => <div>Produits</div>);
jest.mock('../components/MotifManagerModal', () => () => null);

jest.mock('react-toastify', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

const ticketOriginal = {
  ticket: {
    id_ticket: 7,
    uuid_ticket: 'ticket-original',
    moyen_paiement: 'carte'
  },
  objets: [
    {
      uuid_objet: 'object-1',
      nom: 'Livre',
      prix: 1500,
      nbr: 1,
      categorie: 'Culture'
    }
  ],
  paiementMixte: { carte: 1500 }
};

function renderModal(props = {}) {
  return render(
    <ModeTactileContext.Provider value={{ modeTactile: false }}>
      <CorrectionModal
        show
        onHide={jest.fn()}
        ticketOriginal={ticketOriginal}
        onSuccess={jest.fn()}
        {...props}
      />
    </ModeTactileContext.Provider>
  );
}

describe('CorrectionModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveSession = { uuid_session: 'session-1' };
    global.fetch = jest.fn(url => {
      if (url.endsWith('/api/motifs')) {
        return Promise.resolve({
          json: () => Promise.resolve([{ id: 1, motif: 'Erreur de saisie' }])
        });
      }
      if (url.endsWith('/api/produits/organises')) {
        return Promise.resolve({ json: () => Promise.resolve({}) });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ success: true })
      });
    });
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('exige un motif avant toute correction', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Valider la correction' }));

    expect(toast.error).toHaveBeenCalledWith('Merci de préciser un motif.');
    expect(global.fetch).not.toHaveBeenCalledWith(
      'http://localhost:3001/api/correction',
      expect.anything()
    );
  });

  test('envoie une correction complète puis ferme la modale', async () => {
    const onSuccess = jest.fn();
    const onHide = jest.fn();
    renderModal({ onSuccess, onHide });

    const motifSelect = await screen.findByLabelText('Sélectionnez un motif de correction');
    fireEvent.change(motifSelect, { target: { value: 'Erreur de saisie' } });
    fireEvent.change(screen.getByLabelText('Identifiant / Pseudo'), {
      target: { value: 'admin' }
    });
    fireEvent.change(screen.getByLabelText('Mot de passe'), {
      target: { value: 'secret' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Valider la correction' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onHide).toHaveBeenCalled();

    const correctionCall = global.fetch.mock.calls.find(
      ([url]) => url === 'http://localhost:3001/api/correction'
    );
    const payload = JSON.parse(correctionCall[1].body);
    expect(payload).toMatchObject({
      uuid_ticket_original: 'ticket-original',
      motif: 'Erreur de saisie',
      responsable_pseudo: 'admin',
      mot_de_passe: 'secret',
      uuid_session_caisse: 'session-1',
      paiements: [{ moyen: 'carte', montant: 1500 }]
    });
    expect(toast.success).toHaveBeenCalledWith('Correction enregistrée.');
  });

  test('refuse une correction si aucune caisse n’est ouverte', async () => {
    mockActiveSession = null;
    renderModal();
    await screen.findByRole('option', { name: 'Erreur de saisie' });
    const motifSelect = await screen.findByLabelText('Sélectionnez un motif de correction');
    fireEvent.change(motifSelect, { target: { value: 'Erreur de saisie' } });
    fireEvent.change(screen.getByLabelText('Identifiant / Pseudo'), {
      target: { value: 'admin' }
    });
    fireEvent.change(screen.getByLabelText('Mot de passe'), {
      target: { value: 'secret' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Valider la correction' }));

    expect(toast.error).toHaveBeenCalledWith('Aucune session caisse ouverte !');
  });
});
