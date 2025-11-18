import { Link, NavLink, useNavigate } from "react-router-dom";
import { Bell, Settings } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const NavBar = () => {
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const hideMenuTimeoutRef = useRef<number | null>(null);

  const openSettingsMenu = () => {
    if (hideMenuTimeoutRef.current) {
      window.clearTimeout(hideMenuTimeoutRef.current);
      hideMenuTimeoutRef.current = null;
    }
    setIsSettingsMenuOpen(true);
  };

  const scheduleCloseSettingsMenu = () => {
    if (hideMenuTimeoutRef.current) {
      window.clearTimeout(hideMenuTimeoutRef.current);
    }
    hideMenuTimeoutRef.current = window.setTimeout(() => {
      setIsSettingsMenuOpen(false);
      hideMenuTimeoutRef.current = null;
    }, 180);
  };

  useEffect(() => {
    return () => {
      if (hideMenuTimeoutRef.current) {
        window.clearTimeout(hideMenuTimeoutRef.current);
      }
    };
  }, []);

  const navItems = useMemo(() => {
    const items = [
      { label: "Home", to: "/" },
      { label: "Harassment Networks", to: "/harassment-networks" },
      { label: "Personal Monitors", to: "/personal-monitors" },
    ];

    if (token) {
      items.push({ label: "Dashboard", to: "/dashboard" });
    }

    return items;
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur transition-colors duration-200 dark:border-white/10 dark:bg-slate-950/70">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-base font-bold tracking-wide text-slate-900 transition-transform duration-150 hover:scale-105 hover:text-stg-accent dark:text-white sm:text-lg"
        >
          <img
            src="/icon.svg"
            alt="Social Threat Guardian logo"
            className="h-6 w-6 rounded-md shadow-sm"
            loading="lazy"
            decoding="async"
          />
          <span>Social Threat Guardian</span>
        </Link>

        <ul className="hidden flex-1 items-center justify-center gap-6 text-xs font-medium sm:gap-8 sm:text-sm md:flex">
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

        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-300 sm:gap-3">
          {token ? (
            <>
              <button
                type="button"
                aria-label="Notifications"
                className="hidden rounded-full border border-slate-200/70 bg-white/70 p-2 transition transform duration-150 hover:scale-105 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:hover:text-white sm:inline-flex"
              >
                <Bell className="h-4 w-4" aria-hidden />
              </button>
              <div
                className="relative hidden sm:inline-flex"
                onMouseEnter={openSettingsMenu}
                onMouseLeave={scheduleCloseSettingsMenu}
              >
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={isSettingsMenuOpen}
                  onClick={() => {
                    if (hideMenuTimeoutRef.current) {
                      window.clearTimeout(hideMenuTimeoutRef.current);
                      hideMenuTimeoutRef.current = null;
                    }
                    setIsSettingsMenuOpen((prev) => !prev);
                  }}
                  className="rounded-full border border-slate-200/70 bg-white/70 p-2 transition transform duration-150 hover:scale-105 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:hover:text-white"
                >
                  <Settings className="h-4 w-4" aria-hidden />
                </button>
                {isSettingsMenuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-lg dark:border-white/10 dark:bg-slate-900/90">
                    <NavLink
                      to="/settings"
                      onClick={() => setIsSettingsMenuOpen(false)}
                      className={({ isActive }) =>
                        `block rounded-xl px-3 py-2 text-sm transition ${isActive ? "bg-stg-accent/10 text-stg-accent" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"}`
                      }
                    >
                      Account Settings
                    </NavLink>
                    <NavLink
                      to="/bookmarks"
                      onClick={() => setIsSettingsMenuOpen(false)}
                      className={({ isActive }) =>
                        `block rounded-xl px-3 py-2 text-sm transition ${isActive ? "bg-stg-accent/10 text-stg-accent" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"}`
                      }
                    >
                      Bookmarks
                    </NavLink>
                  </div>
                )}
              </div>
              <span className="hidden text-sm font-semibold text-slate-700 dark:text-slate-200 sm:inline-flex">
                {user?.name ?? "Analyst"}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-slate-200/80 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-slate-700 transition hover:border-stg-accent hover:text-stg-accent dark:border-white/10 dark:text-slate-200 dark:hover:text-white"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink
                to="/register"
                className={({ isActive }) =>
                  `rounded-full border border-transparent px-4 py-1.5 text-sm font-semibold uppercase tracking-wide transition ${isActive
                    ? "text-stg-accent"
                    : "text-slate-600 hover:text-stg-accent dark:text-slate-300"
                  }`
                }
              >
                Register
              </NavLink>
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `rounded-full border border-stg-accent px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-stg-accent transition hover:bg-stg-accent/10 ${isActive ? "bg-stg-accent/10" : ""
                  }`
                }
              >
                Login
              </NavLink>
            </>
          )}
        </div>
      </nav>
    </header>
  );
};

export default NavBar;
