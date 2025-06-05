import React from 'react';
import ReactDOM from 'react-dom/client'; // ou 'react-dom' pour versions plus anciennes
import App from './App';
import { HashRouter } from "react-router-dom";
import { SessionCaisseProvider } from './contexts/SessionCaisseContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <HashRouter>
    <SessionCaisseProvider>
      <App />
    </SessionCaisseProvider>
  </HashRouter>
);

