import { fireEvent, render, screen } from '@testing-library/react';
import React, { useContext } from 'react';
import {
  ModeTactileContext,
  ModeTactileProvider
} from '../contexts/ModeTactileContext';
import {
  ModePaiementBoutonsContext,
  ModePaiementBoutonsProvider
} from '../contexts/ModePaiementBoutonsContext';
import { DevModeContext, DevModeProvider } from '../contexts/DevModeContext';

const contexts = [
  {
    name: 'mode tactile',
    key: 'modeTactile',
    Context: ModeTactileContext,
    Provider: ModeTactileProvider,
    valueKey: 'modeTactile',
    setterKey: 'setModeTactile'
  },
  {
    name: 'boutons de paiement',
    key: 'modePaiementBoutons',
    Context: ModePaiementBoutonsContext,
    Provider: ModePaiementBoutonsProvider,
    valueKey: 'modePaiementBoutons',
    setterKey: 'setModePaiementBoutons'
  },
  {
    name: 'mode développeur',
    key: 'devMode',
    Context: DevModeContext,
    Provider: DevModeProvider,
    valueKey: 'devMode',
    setterKey: 'setDevMode'
  }
];

function PreferenceHarness({ Context, valueKey, setterKey }) {
  const state = useContext(Context);
  return (
    <button type="button" onClick={() => state[setterKey](!state[valueKey])}>
      {String(state[valueKey])}
    </button>
  );
}

describe.each(contexts)('$name', config => {
  beforeEach(() => localStorage.clear());

  function renderPreference() {
    const { Provider, Context, valueKey, setterKey } = config;
    return render(
      <Provider>
        <PreferenceHarness
          Context={Context}
          valueKey={valueKey}
          setterKey={setterKey}
        />
      </Provider>
    );
  }

  test('est désactivé par défaut puis persiste sa modification', () => {
    renderPreference();
    const button = screen.getByRole('button', { name: 'false' });

    fireEvent.click(button);

    expect(screen.getByRole('button', { name: 'true' })).toBeInTheDocument();
    expect(localStorage.getItem(config.key)).toBe('true');
  });

  test('restaure la valeur sauvegardée', () => {
    localStorage.setItem(config.key, 'true');
    renderPreference();
    expect(screen.getByRole('button', { name: 'true' })).toBeInTheDocument();
  });

  test('retombe sur false si la valeur sauvegardée est invalide', () => {
    localStorage.setItem(config.key, '{invalide');
    renderPreference();
    expect(screen.getByRole('button', { name: 'false' })).toBeInTheDocument();
  });
});
