import { NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Import from './pages/Import';
import Categories from './pages/Categories';
import Projection from './pages/Projection';
import Settings from './pages/Settings';

const NAV = [
  { to: '/', label: 'Início', icon: '📊', end: true },
  { to: '/transactions', label: 'Lançamentos', icon: '📝' },
  { to: '/import', label: 'Importar', icon: '📥' },
  { to: '/projection', label: 'Projeção', icon: '📈' },
  { to: '/settings', label: 'Ajustes', icon: '⚙️' },
];

export default function App() {
  return (
    <div className="min-h-full flex flex-col">
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 pb-28 pt-6 safe-top">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/import" element={<Import />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/projection" element={<Projection />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-800 bg-slate-900/95 backdrop-blur safe-bottom">
        <div className="mx-auto max-w-2xl grid grid-cols-5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${
                  isActive ? 'text-brand-500' : 'text-slate-400'
                }`
              }
            >
              <span className="text-xl leading-none">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
