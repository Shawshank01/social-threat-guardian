import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ThemeSetting = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: ThemeSetting;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeSetting) => void;
};

const STORAGE_KEY = "stg-theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<ThemeSetting>(() => {
    if (typeof window === "undefined") return "system";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial =
      stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    const applied = initial === "system" ? getSystemTheme() : initial;
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", applied === "dark");
    }
    return initial;
  });
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    theme === "system" ? getSystemTheme() : theme
  );

  useEffect(() => {
    const applyTheme = (setting: ThemeSetting) => {
      const next = setting === "system" ? getSystemTheme() : setting;
      setResolvedTheme(next);
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", next === "dark");
      }
    };

    applyTheme(theme);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }

    const legacyAddListener = (media as any).addListener as
      | ((listener: (event: MediaQueryListEvent) => void) => void)
      | undefined;
    legacyAddListener?.call(media, handleChange);

    return () => {
      const legacyRemoveListener = (media as any).removeListener as
        | ((listener: (event: MediaQueryListEvent) => void) => void)
        | undefined;
      legacyRemoveListener?.call(media, handleChange);
    };
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
};
