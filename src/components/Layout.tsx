import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import DataStatus from './DataStatus';

const links = [
  { to: '/', label: 'Executive Overview' },
  { to: '/insights', label: 'Customer & Promotion Intelligence' },
  { to: '/sql-studio', label: 'Decision Lab' }
];

const Layout = ({ children }: { children: ReactNode }) => (
  <div className="app-shell texture">
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 pb-12 pt-10">
      <header className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="badge">Enterprise Retail Analytics</span>
          <h1 className="font-serif text-4xl text-ink-900">
            Retail Decision Intelligence
          </h1>
          <p className="max-w-2xl text-base text-ink-600">
            Executive-ready retail intelligence delivered with in-browser analytics. Understand
            sales momentum, customer retention, promotion performance, and category opportunity in
            one decision workflow.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-ink-600">
            <span className="rounded-full border border-ink-200 bg-white/70 px-3 py-1">
              Zero backend analytics runtime
            </span>
            <span className="rounded-full border border-ink-200 bg-white/70 px-3 py-1">
              Privacy-safe client-side execution
            </span>
            <span className="rounded-full border border-ink-200 bg-white/70 px-3 py-1">
              Executive KPI + decision guidance
            </span>
          </div>
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
