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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur transition-colors duration-200 dark:border-white/10 dark:bg-slate-950/70">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="text-lg font-bold tracking-wide text-slate-900 transition-transform duration-150 hover:scale-105 hover:text-stg-accent dark:text-white"
        >
          Social Threat Guardian
        </Link>

        <ul className="hidden flex-1 items-center justify-center gap-8 text-sm font-medium md:flex">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `relative pb-1 transition-colors duration-150 ${isActive
                    ? "text-slate-900 after:absolute after:-bottom-0.5 after:left-0 after:h-[2px] after:w-full after:bg-stg-accent dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-300">
          <button
            type="button"
            aria-label="Notifications"
            className="rounded-full border border-slate-200/70 bg-white/70 p-2 transition transform duration-150 hover:scale-105 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:hover:text-white"
          >
            <Bell className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Change language"
            className="rounded-full border border-slate-200/70 bg-white/70 p-2 transition transform duration-150 hover:scale-105 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:hover:text-white"
          >
            <Globe className="h-4 w-4" aria-hidden />
          </button>
          <NavLink
            to="/settings"
            aria-label="Settings"
            className="rounded-full border border-slate-200/70 bg-white/70 p-2 transition transform duration-150 hover:scale-105 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:hover:text-white"
          >
            <Settings className="h-4 w-4" aria-hidden />
          </NavLink>
        </div>
      </nav>
    </header>
  );
};

export default NavBar;
