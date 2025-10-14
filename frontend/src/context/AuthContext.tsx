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
  username: string;
  email: string;
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
  username: string;
  email: string;
  password: string;
};

const STORAGE_TOKEN_KEY = "stg.auth.token";
const STORAGE_USER_KEY = "stg.auth.user";

// Temporary hard-coded account for demo login flows. Remove when backend auth is wired up.
const TEST_ACCOUNT = {
  email: "a@b.com",
  password: "123qwe",
  token: "demo-test-token",
  user: {
    username: "Demo Analyst",
    email: "a@b.com",
  },
} as const;

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
      return JSON.parse(stored) as User;
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
      if (email === TEST_ACCOUNT.email && password === TEST_ACCOUNT.password) {
        // Demo shortcut: allows QA to log in without hitting the backend. Remove once backend is ready.
        setToken(TEST_ACCOUNT.token);
        setUser(TEST_ACCOUNT.user);
        return;
      }

      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        token?: string;
        user?: User;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? "Invalid email or password.");
      }

      if (!data.token || !data.user) {
        throw new Error("Unexpected server response.");
      }

      setToken(data.token);
      setUser(data.user);
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const register = useCallback(async ({ username, email, password }: RegisterPayload) => {
    setIsAuthenticating(true);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const payload = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Unable to create account.");
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
