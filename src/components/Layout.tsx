import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import DataStatus from './DataStatus';

const links = [
  { to: '/', label: 'Executive Dashboard' },
  { to: '/insights', label: 'Customer & Promo Insights' },
  { to: '/sql-studio', label: 'SQL Studio' }
];

const Layout = ({ children }: { children: ReactNode }) => (
  <div className="app-shell texture">
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 pb-12 pt-10">
      <header className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="badge">In-browser Analytics</span>
          <h1 className="font-serif text-4xl text-ink-900">
            Retail Analytics Leadership Demo
          </h1>
          <p className="max-w-2xl text-base text-ink-600">
            DuckDB-WASM executes analytical SQL directly in the browser using the completejourney
            retail dataset. No servers, no backend, just in-memory insights for executive decisions.
          </p>
        </div>
        <nav className="flex flex-wrap gap-3">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'border-accent-500 bg-accent-500 text-white'
                    : 'border-ink-200 bg-white/80 text-ink-700 hover:border-accent-300'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <DataStatus />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  </div>
);

export default Layout;
