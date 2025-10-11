import { Link, NavLink } from "react-router-dom";
import { Bell, Globe, Settings } from "lucide-react";
import type { FC } from "react";

const navItems = [
  { label: "Home", to: "/" },
  { label: "Harassment Networks", to: "/harassment-networks" },
  { label: "Doxxing/Multilingual", to: "/doxxing" },
  { label: "Monitors", to: "/monitors" },
];

const NavBar: FC = () => {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="text-lg font-bold tracking-wide text-white transition-transform duration-150 hover:scale-105 hover:text-stg-accent"
        >
          Social Threat Guardian
        </Link>

        <ul className="hidden flex-1 items-center justify-center gap-8 text-sm font-medium md:flex">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `relative pb-1 transition-colors duration-150 ${
                    isActive
                      ? "text-white after:absolute after:-bottom-0.5 after:left-0 after:h-[2px] after:w-full after:bg-stg-accent"
                      : "text-slate-300 hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3 text-slate-300">
          <button
            type="button"
            aria-label="Notifications"
            className="rounded-full border border-white/10 bg-white/5 p-2 transition transform duration-150 hover:scale-105 hover:text-white"
          >
            <Bell className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Change language"
            className="rounded-full border border-white/10 bg-white/5 p-2 transition transform duration-150 hover:scale-105 hover:text-white"
          >
            <Globe className="h-4 w-4" aria-hidden />
          </button>
          <NavLink
            to="/settings"
            aria-label="Settings"
            className="rounded-full border border-white/10 bg-white/5 p-2 transition transform duration-150 hover:scale-105 hover:text-white"
          >
            <Settings className="h-4 w-4" aria-hidden />
          </NavLink>
        </div>
      </nav>
    </header>
  );
};

export default NavBar;
