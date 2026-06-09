import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FactureModal from '../components/factureModal';
import { ModeTactileContext } from '../contexts/ModeTactileContext';
import { toast } from 'react-toastify';

jest.mock('react-toastify', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

function renderModal(overrides = {}) {
  const props = {
    show: true,
    onClose: jest.fn(),
    ticket: { id_ticket: 12, uuid_ticket: 'ticket-12' },
    raisonSociale: 'Association Test',
    adresseFacturation: '1 rue du Test',
    setRaisonSociale: jest.fn(),
    setAdresseFacturation: jest.fn(),
    onSuccess: jest.fn(),
    ...overrides
  };

  render(
    <ModeTactileContext.Provider value={{ modeTactile: false }}>
      <FactureModal {...props} />
    </ModeTactileContext.Provider>
  );
  return props;
}

describe('FactureModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('refuse la génération si les coordonnées sont incomplètes', () => {
    renderModal({ raisonSociale: '' });
    fireEvent.click(screen.getByRole('button', { name: 'Générer' }));

    expect(toast.error).toHaveBeenCalledWith('Veuillez remplir tous les champs.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('génère la facture et transmet son lien au parent', async () => {
    const onSuccess = jest.fn();
    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        success: true,
        emailSent: true,
        lien: 'factures/2026/facture.pdf'
      })
    });
    renderModal({ onSuccess });
    fireEvent.change(screen.getByPlaceholderText('exemple@client.com'), {
      target: { value: 'client@example.test' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Générer' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(
      'factures/2026/facture.pdf'
    ));
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/facture/ticket-12',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          raison_sociale: 'Association Test',
          adresse: '1 rue du Test',
          email: 'client@example.test'
        })
      })
    );
    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining('client@example.test')
    );
  });

  test('signale la panne SMTP sans perdre la facture locale', async () => {
    const onSuccess = jest.fn();
    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        success: true,
        emailSent: false,
        emailError: 'SMTP indisponible',
        lien: 'factures/2026/facture.pdf'
      })
    });
    renderModal({ onSuccess });
    fireEvent.change(screen.getByPlaceholderText('exemple@client.com'), {
      target: { value: 'client@example.test' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Générer' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(
      'factures/2026/facture.pdf'
    ));
    expect(toast.warn).toHaveBeenCalledWith(
      expect.stringContaining("n'a pas été envoyé")
    );
    expect(toast.info).not.toHaveBeenCalled();
  });

  test('signale une erreur serveur sans appeler le succès', async () => {
    const onSuccess = jest.fn();
    global.fetch.mockRejectedValue(new Error('hors ligne'));
    renderModal({ onSuccess });
    fireEvent.click(screen.getByRole('button', { name: 'Générer' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erreur serveur'));
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
