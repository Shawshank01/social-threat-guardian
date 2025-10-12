import { useCallback, useState, type KeyboardEvent } from "react";
import { Laptop, MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

const options = [
  { value: "light" as const, label: "Light", icon: SunMedium },
  { value: "dark" as const, label: "Dark", icon: MoonStar },
  { value: "system" as const, label: "Auto", icon: Laptop },
];

const ThemeToggle = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [pinned, setPinned] = useState(false);

  const handleToggle = useCallback(() => {
    setPinned((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      setPinned(false);
    }
  }, []);

  const panelBaseClasses =
    "absolute bottom-14 right-0 w-48 origin-bottom-right rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-xl backdrop-blur transition-all duration-200 ease-out pointer-events-none opacity-0 translate-y-2 scale-95 group-hover:pointer-events-auto group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:scale-100 dark:border-white/10 dark:bg-slate-900/90";
  const panelClassName = `${panelBaseClasses} ${
    pinned ? "pointer-events-auto opacity-100 translate-y-0 scale-100" : ""
  }`;

  const ActiveIcon = resolvedTheme === "dark" ? MoonStar : SunMedium;

  return (
    <div className="group fixed bottom-6 right-6 z-40" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={handleToggle}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-600 shadow-lg transition hover:text-stg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stg-accent dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:text-white"
        aria-label="Toggle theme options"
        aria-haspopup="true"
        aria-expanded={pinned}
      >
        <ActiveIcon className="h-5 w-5" aria-hidden />
        <span className="sr-only">Toggle theme options</span>
      </button>

      <div className={panelClassName} role="radiogroup" aria-label="Theme selection">
        <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
          Theme
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">
            {resolvedTheme === "light" ? "Light" : "Dark"}
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {options.map(({ value, label, icon: Icon }) => {
            const isActive = theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  isActive
                    ? "border-stg-accent bg-stg-accent/10 text-stg-accent"
                    : "border-slate-200 bg-white text-slate-600 hover:border-stg-accent/60 hover:text-stg-accent dark:border-white/10 dark:bg-white/10 dark:text-slate-300 dark:hover:text-white"
                }`}
                role="radio"
                aria-checked={isActive}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ThemeToggle;
