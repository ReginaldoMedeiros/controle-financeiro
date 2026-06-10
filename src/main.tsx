import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { ensureSeed } from './db/seed';
import { requestPersistentStorage } from './db/db';

// Garante categorias/regras padrão e tenta storage persistente antes de renderizar.
ensureSeed();
requestPersistentStorage();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* HashRouter funciona em GitHub Pages sem configurar rewrite de rotas */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
