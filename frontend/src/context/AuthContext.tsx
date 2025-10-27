import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type User = {
  id?: string;
  email: string;
  name: string | null;
};

type AuthContextState = {
  user: User | null;
  token: string | null;
  isAuthenticating: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
};

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

const STORAGE_TOKEN_KEY = "stg.auth.token";
const STORAGE_USER_KEY = "stg.auth.user";

const DEFAULT_API_BASE = "/api";

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/+$/, "");

const buildApiUrl = (path: string) => {
  const normalizedPath = path.replace(/^\/+/, "");
  return `${apiBase}/${normalizedPath}`;
};

const AuthContext = createContext<AuthContextState | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_TOKEN_KEY);
  });
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(STORAGE_USER_KEY);
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored) as Partial<User> & { username?: string };
      if (!parsed || typeof parsed !== "object") return null;
      return {
        id: parsed.id,
        email: parsed.email ?? "",
        name: parsed.name ?? (parsed.username ?? null),
      };
    } catch {
      window.localStorage.removeItem(STORAGE_USER_KEY);
      return null;
    }
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!token) {
      window.localStorage.removeItem(STORAGE_TOKEN_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_TOKEN_KEY, token);
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user) {
      window.localStorage.removeItem(STORAGE_USER_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
  }, [user]);

  const login = useCallback(async ({ email, password }: LoginPayload) => {
    setIsAuthenticating(true);
    try {
      const response = await fetch(buildApiUrl("/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        token?: string;
        user?: { id?: string; email?: string; name?: string | null; username?: string | null };
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? data.error ?? "Invalid email or password.");
      }

      if (!data.token || !data.user || !data.user.email) {
        throw new Error("Unexpected server response.");
      }

      const normalisedUser: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name ?? data.user.username ?? null,
      };

      setToken(data.token);
      setUser(normalisedUser);
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const register = useCallback(async ({ name, email, password }: RegisterPayload) => {
    setIsAuthenticating(true);
    try {
      const response = await fetch(buildApiUrl("/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? payload.error ?? "Unable to create account.");
      }
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_TOKEN_KEY);
      window.localStorage.removeItem(STORAGE_USER_KEY);
    }
  }, []);

  const value = useMemo<AuthContextState>(
    () => ({
      user,
      token,
      isAuthenticating,
      login,
      register,
      logout,
    }),
    [user, token, isAuthenticating, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextState => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
};

export const getAuthorizationHeader = (): HeadersInit => {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem(STORAGE_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
};
