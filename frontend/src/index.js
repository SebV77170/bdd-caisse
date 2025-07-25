import React from 'react';
import ReactDOM from 'react-dom/client'; // ou 'react-dom' pour versions plus anciennes
import App from './App';
import { HashRouter } from "react-router-dom";
import { DevModeProvider } from './contexts/DevModeContext';
import { SessionProvider } from './contexts/SessionContext';
import { SessionCaisseProvider } from './contexts/SessionCaisseContext';
import { SessionCaisseSecondaireProvider } from './contexts/SessionCaisseContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <HashRouter>
    <DevModeProvider>
      <SessionProvider>
        <SessionCaisseProvider>
          <SessionCaisseSecondaireProvider>
            <App />
          </SessionCaisseSecondaireProvider>
        </SessionCaisseProvider>
      </SessionProvider>
    </DevModeProvider>
  </HashRouter>
);


