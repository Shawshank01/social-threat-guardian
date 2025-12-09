import { Link, NavLink, useNavigate } from "react-router-dom";
import { Bell, Menu, X, Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from "@/utils/notifications";

const NavBar = () => {
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const hideMenuTimeoutRef = useRef<number | null>(null);
  const hideNotificationTimeoutRef = useRef<number | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const menuOpenTimeRef = useRef<number>(0);
  const lastToggleTimeRef = useRef<number>(0);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  const handleToggleSettingsMenu = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.stopPropagation();
    }

    const now = Date.now();
    if (now - lastToggleTimeRef.current < 300) {
      return;
    }
    lastToggleTimeRef.current = now;

    if (hideMenuTimeoutRef.current) {
      window.clearTimeout(hideMenuTimeoutRef.current);
      hideMenuTimeoutRef.current = null;
    }
    setIsSettingsMenuOpen((prev) => {
      const newValue = !prev;
      if (newValue) {
        menuOpenTimeRef.current = Date.now();
      }
      return newValue;
    });
  }, []);

  const handleCloseSettingsMenu = useCallback(() => {
    if (hideMenuTimeoutRef.current) {
      window.clearTimeout(hideMenuTimeoutRef.current);
      hideMenuTimeoutRef.current = null;
    }
    setIsSettingsMenuOpen(false);
  }, []);

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
      if (hideNotificationTimeoutRef.current) {
        window.clearTimeout(hideNotificationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      const target = event.target as Node;
      if (
        mobileMenuRef.current?.contains(target) ||
        mobileMenuButtonRef.current?.contains(target)
      ) {
        return;
      }
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!isSettingsMenuOpen) return;

    const handleClickOutside = (event: Event) => {
      const target = event.target as Node;

      if (
        settingsMenuRef.current?.contains(target) ||
        settingsButtonRef.current?.contains(target)
      ) {
        return;
      }

      const timeSinceOpen = Date.now() - menuOpenTimeRef.current;
      const isMobile = window.innerWidth < 640;
      if (timeSinceOpen < (isMobile ? 300 : 100)) {
        return;
      }

      handleCloseSettingsMenu();
    };

    const isMobile = window.innerWidth < 640;
    const delay = isMobile ? 200 : 0;

    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside, true);
      document.addEventListener("touchstart", handleClickOutside, true);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
    };
  }, [isSettingsMenuOpen, handleCloseSettingsMenu]);

  const navItems = useMemo(() => {
    const items = [];

    if (token) {
      items.push(
        { label: "Dashboard", to: "/dashboard" },
        { label: "Personal Monitors", to: "/personal-monitors" },
        { label: "Harassment Networks", to: "/harassment-networks" },
        { label: "Home", to: "/" },
      );
    } else {
      items.push(
        { label: "Home", to: "/" },
        { label: "Personal Monitors", to: "/personal-monitors" },
      );
    }

    return items;
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const loadNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      setIsLoadingNotifications(true);
      const [notifs, count] = await Promise.all([
        fetchNotifications(token, { limit: 10, unreadOnly: false }),
        fetchUnreadCount(token),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (error) {
      console.error("[NavBar] Failed to load notifications:", error);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [token]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleToggleNotificationMenu = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (hideNotificationTimeoutRef.current) {
      window.clearTimeout(hideNotificationTimeoutRef.current);
      hideNotificationTimeoutRef.current = null;
    }
    setIsNotificationMenuOpen((prev) => {
      if (!prev) {
        loadNotifications();
      }
      return !prev;
    });
  }, [loadNotifications]);

  const handleCloseNotificationMenu = useCallback(() => {
    if (hideNotificationTimeoutRef.current) {
      window.clearTimeout(hideNotificationTimeoutRef.current);
      hideNotificationTimeoutRef.current = null;
    }
    setIsNotificationMenuOpen(false);
  }, []);

  const scheduleCloseNotificationMenu = useCallback(() => {
    if (hideNotificationTimeoutRef.current) {
      window.clearTimeout(hideNotificationTimeoutRef.current);
    }
    hideNotificationTimeoutRef.current = window.setTimeout(() => {
      setIsNotificationMenuOpen(false);
      hideNotificationTimeoutRef.current = null;
    }, 220);
  }, []);

  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    if (!token) return;
    try {
      await markNotificationRead(token, notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("[NavBar] Failed to mark notification as read:", error);
    }
  }, [token]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (!token) return;
    try {
      await markAllNotificationsRead(token);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })),
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("[NavBar] Failed to mark all as read:", error);
    }
  }, [token]);

  useEffect(() => {
    if (!isNotificationMenuOpen) return;

    const handleClickOutside = (event: Event) => {
      const target = event.target as Node;
      if (
        notificationMenuRef.current?.contains(target) ||
        notificationButtonRef.current?.contains(target)
      ) {
        return;
      }
      handleCloseNotificationMenu();
    };

    const isMobile = window.innerWidth < 640;
    const delay = isMobile ? 200 : 0;

    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside, true);
      document.addEventListener("touchstart", handleClickOutside, true);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
    };
  }, [isNotificationMenuOpen, handleCloseNotificationMenu]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 min-h-[4rem] border-b border-slate-200/70 bg-white/80 backdrop-blur transition-colors duration-200 dark:border-white/10 dark:bg-slate-950/70 sm:h-16">
      <nav className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6 sm:py-0">
        {/* Mobile Menu Button and Logo Row */}
        <div className="flex items-center justify-between gap-2 sm:justify-start">
          {/* Mobile Menu Button, only visible on mobile */}
          <button
            ref={mobileMenuButtonRef}
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex items-center justify-center rounded-lg border border-slate-200/70 bg-white/70 p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white sm:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>

          {/* Logo and Title */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-bold tracking-wide text-slate-900 transition-transform duration-150 hover:scale-105 hover:text-stg-accent dark:text-white sm:text-base md:text-lg"
          >
            <img
              src="/icon.svg"
              alt="Social Threat Guardian logo"
              className="h-5 w-5 rounded-md shadow-sm sm:h-6 sm:w-6"
              loading="lazy"
              decoding="async"
            />
            <span className="truncate">Social Threat Guardian</span>
          </Link>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div
            ref={mobileMenuRef}
            className="absolute left-0 top-full z-40 w-full border-b border-slate-200/70 bg-white/95 backdrop-blur shadow-lg dark:border-white/10 dark:bg-slate-950/95 sm:hidden"
          >
            <ul className="flex flex-col gap-0 px-4 py-2">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `block rounded-lg px-4 py-3 text-sm font-medium transition-colors duration-150 ${isActive
                        ? "bg-stg-accent/10 text-stg-accent"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Navigation Items on Desktop: Centered, on Mobile: Hidden */}
        <ul className="hidden flex-1 items-center justify-center gap-6 text-xs font-medium sm:flex md:gap-8 md:text-sm">
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

        {/* Right Side Actions */}
        <div className="flex items-center justify-end gap-1.5 text-slate-500 dark:text-slate-300 sm:gap-2 md:gap-3">
          {token ? (
            <>
              <div
                ref={notificationMenuRef}
                className="relative flex flex-shrink-0"
                onMouseEnter={(e) => {
                  if (window.matchMedia('(hover: hover)').matches) {
                    if (hideNotificationTimeoutRef.current) {
                      window.clearTimeout(hideNotificationTimeoutRef.current);
                      hideNotificationTimeoutRef.current = null;
                    }
                    setIsNotificationMenuOpen(true);
                  }
                }}
                onMouseLeave={(e) => {
                  if (window.matchMedia('(hover: hover)').matches) {
                    scheduleCloseNotificationMenu();
                  }
                }}
              >
                <button
                  ref={notificationButtonRef}
                  type="button"
                  aria-label="Notifications"
                  aria-expanded={isNotificationMenuOpen}
                  onClick={handleToggleNotificationMenu}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleToggleNotificationMenu(e);
                  }}
                  className="relative flex flex-shrink-0 rounded-full border border-slate-200/70 bg-white/70 p-1.5 transition transform duration-150 hover:scale-105 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:hover:text-white sm:p-2"
                >
                  <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white sm:h-5 sm:w-5 sm:text-xs">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
                {isNotificationMenuOpen && (
                  <div
                    className="fixed left-1/2 top-[4.5rem] z-50 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-80 max-h-[32rem] rounded-2xl border border-slate-200/80 bg-white/95 shadow-lg dark:border-white/10 dark:bg-slate-900/90 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:translate-x-0 sm:mt-2 sm:w-96 sm:max-w-none"
                    onMouseEnter={() => {
                      if (window.matchMedia('(hover: hover)').matches && hideNotificationTimeoutRef.current) {
                        window.clearTimeout(hideNotificationTimeoutRef.current);
                        hideNotificationTimeoutRef.current = null;
                      }
                    }}
                    onMouseLeave={() => {
                      if (window.matchMedia('(hover: hover)').matches) {
                        scheduleCloseNotificationMenu();
                      }
                    }}
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/70 p-3 dark:border-white/10">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Notifications
                      </h3>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllAsRead}
                          className="text-xs text-stg-accent hover:underline"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="max-h-[28rem] overflow-y-auto">
                      {isLoadingNotifications ? (
                        <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                          Loading...
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                          No notifications
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-200/70 dark:divide-white/10">
                          {notifications.map((notification) => {
                            const isUnread = !notification.readAt;
                            return (
                              <div
                                key={notification.id}
                                className={`p-3 transition-colors ${isUnread
                                  ? "bg-stg-accent/5 dark:bg-stg-accent/10"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                  }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    {notification.title && (
                                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                                        {notification.title}
                                      </h4>
                                    )}
                                    {notification.message && (
                                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                                        {notification.message}
                                      </p>
                                    )}
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                                      {new Date(notification.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                  {isUnread && (
                                    <button
                                      type="button"
                                      onClick={() => handleMarkAsRead(notification.id)}
                                      className="flex-shrink-0 rounded-full p-1 hover:bg-slate-200/70 dark:hover:bg-slate-700"
                                      aria-label="Mark as read"
                                    >
                                      <Check className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div
                ref={settingsMenuRef}
                className="relative flex flex-shrink-0"
                onMouseEnter={(e) => {
                  // Only use hover on desktop
                  if (window.matchMedia('(hover: hover)').matches) {
                    openSettingsMenu();
                  }
                }}
                onMouseLeave={(e) => {
                  if (window.matchMedia('(hover: hover)').matches) {
                    scheduleCloseSettingsMenu();
                  }
                }}
              >
                <button
                  ref={settingsButtonRef}
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={isSettingsMenuOpen}
                  onClick={handleToggleSettingsMenu}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleToggleSettingsMenu(e);
                  }}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white/70 px-2 py-1.5 text-[10px] font-semibold text-slate-700 transition transform duration-150 hover:scale-105 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:text-white sm:px-3 sm:py-1.5 sm:text-xs md:text-sm"
                >
                  <span className="max-w-[60px] truncate sm:max-w-none">
                    {user?.name ?? "Analyst"}
                  </span>
                </button>
                {isSettingsMenuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-40 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-lg dark:border-white/10 dark:bg-slate-900/90 sm:w-48" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
                    <NavLink
                      to="/settings"
                      onClick={handleCloseSettingsMenu}
                      className={({ isActive }) =>
                        `block rounded-xl px-3 py-2 text-xs transition sm:text-sm ${isActive ? "bg-stg-accent/10 text-stg-accent" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"}`
                      }
                    >
                      Account Settings
                    </NavLink>
                    <NavLink
                      to="/bookmarks"
                      onClick={handleCloseSettingsMenu}
                      className={({ isActive }) =>
                        `block rounded-xl px-3 py-2 text-xs transition sm:text-sm ${isActive ? "bg-stg-accent/10 text-stg-accent" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"}`
                      }
                    >
                      Bookmarks
                    </NavLink>
                    <button
                      type="button"
                      onClick={() => {
                        handleCloseSettingsMenu();
                        handleLogout();
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-xs transition sm:text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <NavLink
                to="/register"
                className={({ isActive }) =>
                  `rounded-full border border-transparent px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition sm:px-3 sm:py-1.5 sm:text-xs md:px-4 md:text-sm ${isActive
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
                  `rounded-full border border-stg-accent px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-stg-accent transition hover:bg-stg-accent/10 sm:px-3 sm:py-1.5 sm:text-xs md:px-4 md:text-sm ${isActive ? "bg-stg-accent/10" : ""
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
