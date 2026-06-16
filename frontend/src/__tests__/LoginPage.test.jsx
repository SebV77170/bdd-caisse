import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from '../pages/LoginPage';
import { toast } from 'react-toastify';

const mockNavigate = jest.fn();
const mockLogin = jest.fn();
let mockActiveSession = null;

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null })
}));

jest.mock('../contexts/SessionContext', () => ({
  useSession: () => ({ login: mockLogin })
}));

jest.mock('../contexts/SessionCaisseContext', () => ({
  useActiveSession: () => mockActiveSession
}));

jest.mock('react-toastify', () => ({
  toast: {
    error: jest.fn()
  }
}));

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveSession = null;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('refuse la soumission si les champs sont vides', () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(screen.getByText('Tous les champs doivent être remplis')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  test('connecte puis redirige vers caisse non ouverte', async () => {
    mockLogin.mockResolvedValue();
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Identifiant / Pseudo'), {
      target: { value: 'Jean' }
    });
    fireEvent.change(screen.getByLabelText('Mot de passe'), {
      target: { value: 'secret' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({ pseudo: 'Jean', mot_de_passe: 'secret' });
      expect(mockNavigate).toHaveBeenCalledWith('/caisse-non-ouverte');
    });
  });

  test('ajoute le caissier puis redirige vers la caisse active', async () => {
    mockActiveSession = { uuid_session: 'session-1' };
    mockLogin.mockResolvedValue();
    global.fetch.mockResolvedValue({ ok: true });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Identifiant / Pseudo'), {
      target: { value: 'Jean' }
    });
    fireEvent.change(screen.getByLabelText('Mot de passe'), {
      target: { value: 'secret' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/session/ajouter-caissier',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ nom: 'Jean' })
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith('/caisse');
    });
  });

  test('affiche une notification si la connexion échoue', async () => {
    mockLogin.mockRejectedValue(new Error('identifiants invalides'));
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Identifiant / Pseudo'), {
      target: { value: 'Jean' }
    });
    fireEvent.change(screen.getByLabelText('Mot de passe'), {
      target: { value: 'bad' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Erreur de connexion : identifiants invalides'
      );
    });
  });

  test('ne propose plus la création locale de compte', () => {
    render(<LoginPage />);
    expect(screen.queryByText("Je n'ai pas de compte")).not.toBeInTheDocument();
  });
});
