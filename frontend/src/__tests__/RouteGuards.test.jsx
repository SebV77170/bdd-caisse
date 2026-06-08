import { render, screen, waitFor } from '@testing-library/react';
import RequireUserSession from '../components/RequireUserSession';
import RequireUserAndCaisseSession from '../components/RequireUserAndCaisseSession';

const mockNavigate = jest.fn();
let mockSessionState = { user: null, loading: false };
let mockActiveSession = null;

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/protected' })
}));

jest.mock('../contexts/SessionContext', () => ({
  useSession: () => mockSessionState
}));

jest.mock('../contexts/SessionCaisseContext', () => ({
  useActiveSession: () => mockActiveSession
}));

describe('Route guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionState = { user: null, loading: false };
    mockActiveSession = null;
  });

  test('RequireUserSession affiche le chargement', () => {
    mockSessionState = { user: null, loading: true };
    render(<RequireUserSession><div>Privé</div></RequireUserSession>);
    expect(screen.getByText(/Chargement/)).toBeInTheDocument();
  });

  test('RequireUserSession redirige un visiteur vers login', async () => {
    render(<RequireUserSession><div>Privé</div></RequireUserSession>);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('Privé')).not.toBeInTheDocument();
  });

  test('RequireUserSession rend le contenu pour un utilisateur connecté', () => {
    mockSessionState = { user: { pseudo: 'jean' }, loading: false };
    render(<RequireUserSession><div>Privé</div></RequireUserSession>);
    expect(screen.getByText('Privé')).toBeInTheDocument();
  });

  test('RequireUserAndCaisseSession redirige sans utilisateur', async () => {
    mockSessionState = { user: null, loading: false };
    mockActiveSession = { uuid_session: 'session-1' };
    render(<RequireUserAndCaisseSession><div>Caisse</div></RequireUserAndCaisseSession>);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
  });

  test('RequireUserAndCaisseSession redirige sans caisse ouverte', async () => {
    mockSessionState = { user: { pseudo: 'jean' }, loading: false };
    mockActiveSession = null;
    render(<RequireUserAndCaisseSession><div>Caisse</div></RequireUserAndCaisseSession>);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/caisse-non-ouverte'));
  });

  test('RequireUserAndCaisseSession rend le contenu si tout est actif', () => {
    mockSessionState = { user: { pseudo: 'jean' }, loading: false };
    mockActiveSession = { uuid_session: 'session-1' };
    render(<RequireUserAndCaisseSession><div>Caisse</div></RequireUserAndCaisseSession>);
    expect(screen.getByText('Caisse')).toBeInTheDocument();
  });
});
