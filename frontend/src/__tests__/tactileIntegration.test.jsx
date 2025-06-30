import { render } from '@testing-library/react';
import { ModeTactileContext } from '../App';
import { SessionCaisseContext } from '../contexts/SessionCaisseContext';
import Caisse from '../pages/Caisse';
import FermetureCaisse from '../pages/FermetureCaisse';
import OuvertureCaisse from '../pages/ouvertureCaisse';
import BilanTickets from '../pages/BilanTickets';

function MockProviders({ children }) {
  const sessionValue = {
    uuidSessionCaisse: 'test',
    sessionCaisseOuverte: true,
    refreshSessionCaisse: () => {}
  };
  return (
    <SessionCaisseContext.Provider value={sessionValue}>
      <ModeTactileContext.Provider value={{ modeTactile: true, setModeTactile: () => {} }}>
        {children}
      </ModeTactileContext.Provider>
    </SessionCaisseContext.Provider>
  );
}

const pages = {
  Caisse: Caisse,
  FermetureCaisse: FermetureCaisse,
  OuvertureCaisse: OuvertureCaisse,
  BilanTickets: BilanTickets,
};

function findNonTactile(container) {
  return container.querySelectorAll(
    'input[type="text"]:not([readonly]), input[type="password"]:not([readonly]), input[type="number"]:not([readonly]), textarea:not([readonly])'
  );
}

describe('Integration tactile mode pages', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({}) }));
  });

  for (const [name, Page] of Object.entries(pages)) {
    test(`${name} uses tactile inputs`, () => {
      const { container } = render(
        <MockProviders>
          <Page />
        </MockProviders>
      );
      const nonTactile = findNonTactile(container);
      expect(nonTactile.length).toBe(0);
    });
  }
});
