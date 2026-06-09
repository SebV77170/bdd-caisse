import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ModalOuvertureSecondaire from '../components/ModalOuvertureSecondaire';

const mockSetDemandeOuverture = jest.fn();

jest.mock('../contexts/SyncModalContext', () => ({
  useSyncModal: () => ({
    demandeOuverture: {
      requestId: 'opening-request-1',
      sourceName: 'Boutique',
      registerNumber: 2,
      requestedBy: 'Alice'
    },
    setDemandeOuverture: mockSetDemandeOuverture
  })
}));

describe('ModalOuvertureSecondaire', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true })
    });
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('confirme explicitement que le poste est la caisse principale', async () => {
    render(<ModalOuvertureSecondaire />);

    expect(screen.getByText(/Êtes-vous bien la caisse principale/)).toBeInTheDocument();
    expect(screen.getByText(/Boutique - poste 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Oui, autoriser l’ouverture' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/sync/recevoir-de-secondaire/ouverture/repondre',
      expect.objectContaining({
        body: JSON.stringify({
          requestId: 'opening-request-1',
          decision: 'accepter'
        })
      })
    ));
    expect(mockSetDemandeOuverture).toHaveBeenCalledWith(null);
  });
});
