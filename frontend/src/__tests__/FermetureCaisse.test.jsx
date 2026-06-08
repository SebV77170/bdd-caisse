import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FermetureCaisse from '../pages/FermetureCaisse';
import { toast } from 'react-toastify';

const mockNavigate = jest.fn();
let mockActiveSession = {
  uuid_session: 'session-1',
  type: 'principale'
};

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}));

jest.mock('../contexts/SessionCaisseContext', () => ({
  useActiveSession: () => mockActiveSession
}));

jest.mock('../utils/SiCaissePrincipale', () => {
  return function MockPrincipal({ children }) {
    return mockActiveSession?.type === 'principale' ? children : null;
  };
});

jest.mock('../utils/SiCaisseSecondaire', () => {
  return function MockSecondary({ children }) {
    return mockActiveSession?.type === 'secondaire' ? children : null;
  };
});

jest.mock('../components/TactileInput', () => {
  return function MockTactileInput({ isDecimal, ...props }) {
    return <input {...props} />;
  };
});
jest.mock('../components/compteEspeces', () => () => <div>Calculateur espèces</div>);
jest.mock('../components/AffichageEcarts', () => () => <div>Écarts</div>);
jest.mock('../components/BilanSessionCaisse', () => () => <div>Bilan session</div>);
jest.mock('../components/BilanReductionsSession', () => () => <div>Réductions</div>);

jest.mock('react-toastify', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn()
  }
}));

function managerFields() {
  fireEvent.change(screen.getByLabelText('Identifiant / Pseudo'), {
    target: { value: 'admin' }
  });
  fireEvent.change(screen.getByLabelText('Mot de passe'), {
    target: { value: 'secret' }
  });
}

function mockInitialFetches(finalResult = { success: true }) {
  global.fetch = jest.fn(url => {
    if (url.includes('/fond_initial')) {
      return Promise.resolve({ json: () => Promise.resolve({ fond_initial: 10000 }) });
    }
    if (url.includes('/reductions_session_caisse')) {
      return Promise.resolve({ json: () => Promise.resolve({}) });
    }
    if (url.includes('/bilan_session_caisse')) {
      return Promise.resolve({
        json: () => Promise.resolve({
          nombre_ventes: 2,
          prix_total_espece: 2000,
          prix_total_carte: 3000,
          prix_total_cheque: 0,
          prix_total_virement: 0,
          prix_total: 5000
        })
      });
    }
    return Promise.resolve({ json: () => Promise.resolve(finalResult) });
  });
}

describe('FermetureCaisse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveSession = { uuid_session: 'session-1', type: 'principale' };
    mockInitialFetches();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('refuse une fermeture principale incomplète', async () => {
    render(<FermetureCaisse />);
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la caisse' }));

    expect(toast.error).toHaveBeenCalledWith(
      'Tous les champs obligatoires doivent être remplis'
    );
  });

  test('ferme la caisse principale avec les montants convertis en centimes', async () => {
    const { container } = render(<FermetureCaisse />);
    await screen.findByText('100');

    const amountInputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(amountInputs[0], { target: { value: '120.50' } });
    fireEvent.change(amountInputs[1], { target: { value: '30.00' } });
    fireEvent.change(amountInputs[2], { target: { value: '5.00' } });
    fireEvent.change(amountInputs[3], { target: { value: '2.50' } });
    managerFields();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la caisse' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(
      '/Bilan',
      { state: { toastMessage: 'Caisse fermée avec succès !' } }
    ));
    const closeCall = global.fetch.mock.calls.find(
      ([url]) => url === 'http://localhost:3001/api/caisse/fermeture'
    );
    expect(JSON.parse(closeCall[1].body)).toMatchObject({
      montant_reel: 12050,
      montant_reel_carte: 3000,
      montant_reel_cheque: 500,
      montant_reel_virement: 250,
      uuid_session_caisse: 'session-1',
      responsable_pseudo: 'admin'
    });
  });

  test('ferme et synchronise une caisse secondaire', async () => {
    mockActiveSession = { uuid_session: 'secondary-1', type: 'secondaire' };
    render(<FermetureCaisse />);
    managerFields();
    fireEvent.click(screen.getByRole('button', {
      name: /Fermer la caisse et envoyer/
    }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(
      '/Bilan',
      { state: { toastMessage: 'Caisse secondaire fermée et synchronisée !' } }
    ));
    const syncCall = global.fetch.mock.calls.find(
      ([url]) => url === 'http://localhost:3001/api/sync/envoyer-secondaire-vers-principal'
    );
    expect(JSON.parse(syncCall[1].body)).toMatchObject({
      uuid_session_caisse: 'secondary-1',
      responsable_pseudo: 'admin',
      mot_de_passe: 'secret'
    });
  });
});
