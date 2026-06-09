import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ModalSyncSecondaire from '../components/ModalSyncSecondaire';

const mockSetDemande = jest.fn();

jest.mock('../contexts/SyncModalContext', () => ({
  useSyncModal: () => ({
    demande: {
      requestId: 'request-caisse-b',
      message: 'Synchronisation de la caisse B'
    },
    setDemande: mockSetDemande
  })
}));

jest.mock('../contexts/SessionCaisseContext', () => ({
  useActiveSession: () => ({ uuid_session: 'session-principale' })
}));

describe('ModalSyncSecondaire', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
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
});
