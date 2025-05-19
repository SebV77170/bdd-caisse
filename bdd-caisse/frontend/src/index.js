import React from 'react';
import ReactDOM from 'react-dom/client'; // ou 'react-dom' pour versions plus anciennes
import App from './App';
import { HashRouter } from "react-router-dom";

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <HashRouter>
    <App />
  </HashRouter>
);

