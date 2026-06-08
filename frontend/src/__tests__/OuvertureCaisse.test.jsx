import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OuvertureCaisse from '../pages/ouvertureCaisse';
import { ModeTactileContext } from '../contexts/ModeTactileContext';

const mockNavigate = jest.fn();
const mockRefreshSessionCaisse = jest.fn();
const mockRefreshCaisseSecondaire = jest.fn();
const mockMarkSecondaryOpen = jest.fn();
const mockWaitUntilReady = jest.fn().mockResolvedValue();
let mockActiveSession = { uuid_session: 'session-1' };

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}));

jest.mock('../contexts/SessionCaisseContext', () => ({
  useSessionCaisse: () => ({ refreshSessionCaisse: mockRefreshSessionCaisse }),
  useSessionCaisseSecondaire: () => ({
    refreshCaisseSecondaire: mockRefreshCaisseSecondaire,
    markSecondaryOpen: mockMarkSecondaryOpen
  }),
  useActiveSession: () => mockActiveSession,
  waitUntilSessionRefIsReady: (...args) => mockWaitUntilReady(...args)
}));

jest.mock('../components/compteEspeces', () => () => <div>Calculateur espèces</div>);

function renderPage() {
  return render(
    <ModeTactileContext.Provider value={{ modeTactile: false }}>
      <OuvertureCaisse />
    </ModeTactileContext.Provider>
  );
}

function fillManager() {
  fireEvent.change(screen.getByLabelText('Identifiant / Pseudo'), {
    target: { value: 'admin' }
  });
  fireEvent.change(screen.getByLabelText('Mot de passe'), {
    target: { value: 'secret' }
  });
}

describe('OuvertureCaisse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveSession = { uuid_session: 'session-1' };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('exige le responsable et le fond pour une caisse principale', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la caisse principale' }));

    expect(screen.getByText('Pseudo du responsable et mot de passe requis.')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('ouvre une caisse principale avec un fond converti en centimes', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, id_session: 'principal-1' })
    });
    renderPage();
    fireEvent.change(screen.getByLabelText(/Fond de caisse initial/), {
      target: { value: '123.45' }
    });
    fillManager();
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la caisse principale' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(
      '/caisse',
      expect.objectContaining({
        state: { toastMessage: 'Caisse principale ouverte avec succès !' }
      })
    ));
    const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(payload).toMatchObject({
      fond_initial: 12345,
      responsable_pseudo: 'admin',
      mot_de_passe: 'secret',
      secondaire: false,
      issecondaire: 0
    });
  });

  test('ouvre une secondaire avec un fond nul et met le contexte à jour', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, id_session: 'secondary-1' })
    });
    renderPage();
    fireEvent.click(screen.getByRole('checkbox', { name: /caisse secondaire/ }));
    fillManager();
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la caisse secondaire' }));

    await waitFor(() => expect(mockMarkSecondaryOpen).toHaveBeenCalledWith('secondary-1'));
    const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(payload).toMatchObject({
      fond_initial: 0,
      secondaire: true,
      issecondaire: 1
    });
    expect(mockRefreshSessionCaisse).toHaveBeenCalled();
    expect(mockRefreshCaisseSecondaire).toHaveBeenCalled();
  });

  test('affiche le message d’erreur renvoyé par le backend', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({ error: 'Une caisse est déjà ouverte' })
    });
    renderPage();
    fireEvent.change(screen.getByLabelText(/Fond de caisse initial/), {
      target: { value: '100' }
    });
    fillManager();
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la caisse principale' }));

    expect(await screen.findByText('Une caisse est déjà ouverte')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
