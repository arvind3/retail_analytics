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
    {/* Top indigo accent line */}
    <div className="h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />

    {/* Sticky header */}
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0A0F1E]/90 backdrop-blur-md">
      <div className="px-6 lg:px-10 xl:px-16">
        {/* Row 1: badge + data status */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <span className="badge">Enterprise Retail Analytics</span>
            <span className="hidden text-xs text-slate-500 sm:inline">
              Powered by DuckDB-WASM
            </span>
          </div>
          <DataStatus />
        </div>

        {/* Row 2: title + subtitle + nav */}
        <div className="pb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50 lg:text-3xl">
            Retail Decision Intelligence
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Executive-ready retail analytics delivered in-browser. Understand sales momentum,
            customer retention, promotion performance, and category opportunity in one workflow.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              'Zero backend analytics runtime',
              'Privacy-safe client-side execution',
              'Executive KPI + decision guidance',
            ].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-slate-400"
              >
                {tag}
              </span>
            ))}
          </div>
          <nav className="mt-4 flex flex-wrap gap-2">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-150 ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-500 text-white shadow-glow'
                      : 'border-white/[0.10] bg-white/[0.04] text-slate-300 hover:border-indigo-600 hover:bg-white/[0.07] hover:text-slate-100'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </header>

    {/* Main content — full width */}
    <main className="px-6 py-8 lg:px-10 xl:px-16">{children}</main>
  </div>
);

export default Layout;
