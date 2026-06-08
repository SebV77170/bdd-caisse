import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ValidationVente from '../components/ValidationVente';
import { ModePaiementBoutonsContext } from '../contexts/ModePaiementBoutonsContext';
import { toast } from 'react-toastify';

let mockActiveSession = null;

jest.mock('../contexts/SessionCaisseContext', () => ({
  useActiveSession: () => mockActiveSession
}));

jest.mock('../components/TactileInput', () => {
  return function MockTactileInput({ isDecimal, ...props }) {
    return <input {...props} />;
  };
});

jest.mock('react-toastify', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

function renderValidation(props = {}, modePaiementBoutons = true) {
  return render(
    <ModePaiementBoutonsContext.Provider value={{ modePaiementBoutons }}>
      <ValidationVente
        total={2500}
        id_temp_vente={42}
        onValide={jest.fn()}
        {...props}
      />
    </ModePaiementBoutonsContext.Provider>
  );
}

describe('ValidationVente', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveSession = { uuid_session: 'session-1' };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('refuse la validation sans session de caisse active', () => {
    mockActiveSession = null;
    renderValidation();

    fireEvent.click(screen.getByRole('button', { name: 'Carte' }));

    expect(toast.error).toHaveBeenCalledWith('Aucune session caisse ouverte !');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('valide directement un paiement carte avec les montants en centimes', async () => {
    const onValide = jest.fn();
    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({ success: true })
    });
    renderValidation({ onValide });

    fireEvent.change(screen.getByPlaceholderText('Code postal'), {
      target: { value: '77170' }
    });
    fireEvent.change(screen.getByPlaceholderText('email'), {
      target: { value: 'client@example.test' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Carte' }));

    await waitFor(() => expect(onValide).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/valider',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          id_temp_vente: 42,
          uuid_session_caisse: 'session-1',
          reductionType: null,
          paiements: [{ moyen: 'carte', montant: 2500 }],
          code_postal: '77170',
          email: 'client@example.test'
        })
      })
    );
    expect(toast.success).toHaveBeenCalledWith('Vente validée avec succès');
  });

  test('applique automatiquement la réduction gros panier client', async () => {
    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({ success: true })
    });
    renderValidation({ total: 10000 });

    expect(screen.getByText(/90,00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Carte' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(payload.reductionType).toBe('trueGrosPanierClient');
    expect(payload.paiements).toEqual([{ moyen: 'carte', montant: 9000 }]);
  });

  test('affiche une erreur si le backend refuse la vente', async () => {
    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({ success: false })
    });
    renderValidation();

    fireEvent.click(screen.getByRole('button', { name: 'Carte' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Erreur pendant validation');
    });
  });
});
