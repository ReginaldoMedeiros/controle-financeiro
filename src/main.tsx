import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { ensureSeed } from './db/seed';
import { requestPersistentStorage } from './db/db';
import { registerAutoSync, reconcile } from './db/sync';

// Garante categorias/regras padrão e tenta storage persistente antes de renderizar.
// Após o seed, liga a sincronização (hooks de auto-push) e reconcilia com o
// GitHub, se já estiver configurada. O seed roda ANTES dos hooks para não
// contar como alteração local.
ensureSeed().then(() => {
  registerAutoSync();
  reconcile();
});
requestPersistentStorage();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* HashRouter funciona em GitHub Pages sem configurar rewrite de rotas */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
