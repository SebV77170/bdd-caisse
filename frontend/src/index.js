import React from 'react';
import ReactDOM from 'react-dom/client'; // ou 'react-dom' pour versions plus anciennes
import App from './App';
import { HashRouter } from "react-router-dom";
import { SessionCaisseProvider } from './contexts/SessionCaisseContext';
import { DevModeProvider } from './contexts/DevModeContext';
import { SessionProvider } from './contexts/SessionContext';


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <HashRouter>
    <DevModeProvider>
      <SessionProvider>
        <SessionCaisseProvider>
          <App />
        </SessionCaisseProvider>
      </SessionProvider>
    </DevModeProvider>
  </HashRouter>
);

