import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ModalSyncSecondaire from '../components/ModalSyncSecondaire';

const mockSetDemande = jest.fn();
let mockDemande = {
  requestId: 'request-caisse-b',
  message: 'Synchronisation de la caisse B'
};

jest.mock('../contexts/SyncModalContext', () => ({
  useSyncModal: () => ({
    demande: mockDemande,
    setDemande: mockSetDemande
  })
}));

jest.mock('../contexts/SessionCaisseContext', () => ({
  useActiveSession: () => ({ uuid_session: 'session-principale' })
}));

describe('ModalSyncSecondaire', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDemande = {
      requestId: 'request-caisse-b',
      message: 'Synchronisation de la caisse B'
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('valide uniquement la demande identifiée par le message socket', async () => {
    render(<ModalSyncSecondaire />);

    fireEvent.click(screen.getByRole('button', { name: /Accepter/ }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/sync/recevoir-de-secondaire/valider',
      expect.objectContaining({
        body: JSON.stringify({
          decision: 'accepter',
          uuid_session_caisse_principale: 'session-principale',
          requestId: 'request-caisse-b'
        })
      })
    ));
    expect(mockSetDemande).toHaveBeenCalledWith(null);
  });

  test('affiche le détail et conserve la demande si le lot est invalide', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Lot de synchronisation invalide',
        details: 'Référence vers un ticket absent'
      })
    });

    render(<ModalSyncSecondaire />);
    fireEvent.click(screen.getByRole('button', { name: /Accepter/ }));

    expect(await screen.findByText('Référence vers un ticket absent')).toBeInTheDocument();
    expect(mockSetDemande).not.toHaveBeenCalledWith(null);
  });

  test('efface une ancienne erreur lorsqu’une nouvelle demande arrive', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ details: 'Ancienne erreur' })
    });
    const rendered = render(<ModalSyncSecondaire />);

    fireEvent.click(screen.getByRole('button', { name: /Accepter/ }));
    expect(await screen.findByText('Ancienne erreur')).toBeInTheDocument();

    mockDemande = {
      requestId: 'request-caisse-c',
      message: 'Synchronisation de la caisse C'
    };
    rendered.rerender(<ModalSyncSecondaire />);

    await waitFor(() => {
      expect(screen.queryByText('Ancienne erreur')).not.toBeInTheDocument();
    });
  });
});
